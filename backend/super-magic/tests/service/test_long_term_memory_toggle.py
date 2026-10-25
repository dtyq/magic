import json
import sys
import types
from importlib import import_module
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

# AgentContext 只需要 storage.types，但存储包初始化会提前加载本测试不需要的云 SDK。
_storage_package_was_stubbed = "app.infrastructure.storage" not in sys.modules
if _storage_package_was_stubbed:
    storage_package = types.ModuleType("app.infrastructure.storage")
    storage_package.__path__ = [
        str(Path(__file__).resolve().parents[2] / "app" / "infrastructure" / "storage")
    ]
    sys.modules["app.infrastructure.storage"] = storage_package

# 自动读取服务只依赖 read_file 子模块，避免执行 app.tools.__init__ 的全量工具导入。
_tools_package_was_stubbed = "app.tools" not in sys.modules
if _tools_package_was_stubbed:
    tools_package = types.ModuleType("app.tools")
    tools_package.__path__ = [str(Path(__file__).resolve().parents[2] / "app" / "tools")]
    sys.modules["app.tools"] = tools_package

AgentContext = import_module("app.core.context.agent_context").AgentContext
message_module = import_module("app.core.entity.message.client_message")
ChatClientMessage = message_module.ChatClientMessage
Metadata = message_module.Metadata
PersonalPreferences = import_module(
    "app.core.entity.message.personal_preferences"
).PersonalPreferences
auto_read_module = import_module("app.service.auto_read_file_service")
AutoReadFileService = auto_read_module.AutoReadFileService
AutoReadLoadPolicy = auto_read_module.AutoReadLoadPolicy
AutoReadPathKind = auto_read_module.AutoReadPathKind
AutoReadRuleId = auto_read_module.AutoReadRuleId
AutoReadFileRule = auto_read_module.AutoReadFileRule
MemoryListenerService = import_module(
    "app.service.memory.runtime.events.memory_event_listener"
).MemoryListenerService
InitClientMessageUtil = import_module(
    "app.utils.init_client_message_util"
).InitClientMessageUtil
PathManager = import_module("app.path_manager").PathManager

if _tools_package_was_stubbed:
    sys.modules.pop("app.tools", None)
if _storage_package_was_stubbed:
    sys.modules.pop("app.infrastructure.storage", None)


def _context_with_metadata(chat_value, init_value):
    """
    构造包含当前聊天和历史 INIT 元数据的轻量上下文桩。

    当前 CHAT 可覆盖启动时的自动设置；这项来源选择不同时决定 Skill 是否加载成功。
    """
    message = ChatClientMessage(
        message_id="message-1",
        prompt="test",
        metadata=Metadata(
            personal_preferences={"long_term_memory_enabled": chat_value},
        ),
    )
    return SimpleNamespace(
        get_chat_client_message=lambda: message,
        get_init_client_message_metadata=lambda: Metadata(
            personal_preferences={"long_term_memory_enabled": init_value},
        ),
    )


@pytest.mark.parametrize(
    ("chat_value", "init_value", "expected"),
    [
        (True, False, True),
        (False, True, False),
        ("false", False, True),
        (None, True, True),
    ],
)
def test_agent_context_returns_current_chat_personal_preferences(
    chat_value,
    init_value,
    expected,
):
    context = _context_with_metadata(chat_value, init_value)
    preferences = AgentContext.get_personal_preferences(context)

    assert preferences.long_term_memory_enabled is expected


def test_agent_context_returns_default_preferences_without_chat_message():
    """没有当前聊天消息时返回默认个人偏好，INIT 字段不参与判断。"""
    context = SimpleNamespace(
        get_chat_client_message=lambda: None,
        get_init_client_message_metadata=lambda: Metadata(
            personal_preferences={"long_term_memory_enabled": False},
        ),
    )

    preferences = AgentContext.get_personal_preferences(context)

    assert preferences.long_term_memory_enabled is True


def test_metadata_always_has_default_personal_preferences():
    metadata = Metadata()

    assert isinstance(metadata.personal_preferences, PersonalPreferences)
    assert metadata.personal_preferences.long_term_memory_enabled is True
    assert "personal_preferences" not in metadata.dict(exclude_unset=True)


def test_chat_runtime_metadata_is_not_persisted_to_init(monkeypatch, tmp_path):
    init_file = tmp_path / "init_client_message.json"
    init_file.write_text(json.dumps({"metadata": {"topic_id": "topic-1"}}), encoding="utf-8")
    monkeypatch.setattr(PathManager, "get_init_client_message_file", lambda: init_file)

    chat_message = SimpleNamespace(
        metadata=Metadata(
            super_magic_task_id="task-1",
            personal_preferences={"long_term_memory_enabled": False},
        )
    )
    InitClientMessageUtil._sync_chat_metadata_to_init(chat_message)

    saved = json.loads(init_file.read_text(encoding="utf-8"))
    assert saved["metadata"] == {
        "topic_id": "topic-1",
        "super_magic_task_id": "task-1",
    }


def test_metadata_migrates_legacy_top_level_long_term_memory_field():
    metadata = Metadata(long_term_memory_enabled=False)

    assert metadata.personal_preferences is not None
    assert metadata.personal_preferences.long_term_memory_enabled is False
    serialized = metadata.dict(exclude_none=True)
    assert "long_term_memory_enabled" not in serialized
    assert serialized["personal_preferences"] == {
        "long_term_memory_enabled": False,
        "show_follow_up_suggestions": True,
    }


@pytest.mark.parametrize("value", [None, "false", 0, []])
def test_personal_preferences_invalid_value_defaults_enabled(value):
    metadata = Metadata(personal_preferences={"long_term_memory_enabled": value})

    assert metadata.personal_preferences is not None
    assert metadata.personal_preferences.long_term_memory_enabled is True


@pytest.mark.asyncio
async def test_disabled_general_agent_skips_global_memory_rule():
    context = SimpleNamespace(
        is_magiclaw=lambda: False,
        get_personal_preferences=lambda: PersonalPreferences(
            long_term_memory_enabled=False,
        ),
    )
    rule = AutoReadFileRule(
        rule_id=AutoReadRuleId.GLOBAL_MEMORY,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.GLOBAL_MEMORY,
        priority=20,
    )

    assert await AutoReadFileService._resolve_rule(context, rule, None) == []


@pytest.mark.asyncio
async def test_disabled_general_agent_keeps_project_instructions(monkeypatch, tmp_path):
    context = SimpleNamespace(
        is_magiclaw=lambda: False,
        get_personal_preferences=lambda: PersonalPreferences(
            long_term_memory_enabled=False,
        ),
        get_workspace_dir=lambda: str(tmp_path),
    )
    rule = AutoReadFileRule(
        rule_id=AutoReadRuleId.PROJECT_INSTRUCTIONS,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.WORKSPACE_ROOT_AGENTS,
        priority=10,
    )
    expected = [SimpleNamespace(rule_id=AutoReadRuleId.PROJECT_INSTRUCTIONS)]
    single_candidate = AsyncMock(return_value=expected)
    monkeypatch.setattr(AutoReadFileService, "_single_candidate", single_candidate)

    assert await AutoReadFileService._resolve_rule(context, rule, None) == expected
    single_candidate.assert_awaited_once()


@pytest.mark.parametrize(
    ("is_main", "is_claw", "enabled", "expected"),
    [
        (True, False, True, True),
        (True, False, False, False),
        (True, True, False, True),
        (False, False, True, False),
    ],
)
def test_memory_listener_respects_general_switch_and_preserves_claw(
    is_main,
    is_claw,
    enabled,
    expected,
):
    context = SimpleNamespace(
        is_main_agent_context=lambda: is_main,
        is_magiclaw=lambda: is_claw,
        has_skill=lambda name: name == "memory",
        get_personal_preferences=lambda: PersonalPreferences(
            long_term_memory_enabled=enabled,
        ),
    )

    assert MemoryListenerService._is_enabled(context) is expected
