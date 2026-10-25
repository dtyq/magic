import sys
import types
from importlib import import_module
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

# 只保留本测试需要的包路径，避免加载不相关的云存储依赖。
_storage_package_was_stubbed = "app.infrastructure.storage" not in sys.modules
if _storage_package_was_stubbed:
    storage_package = types.ModuleType("app.infrastructure.storage")
    storage_package.__path__ = [
        str(Path(__file__).resolve().parents[2] / "app" / "infrastructure" / "storage")
    ]
    sys.modules["app.infrastructure.storage"] = storage_package

_tools_package_was_stubbed = "app.tools" not in sys.modules
if _tools_package_was_stubbed:
    tools_package = types.ModuleType("app.tools")
    tools_package.__path__ = [str(Path(__file__).resolve().parents[2] / "app" / "tools")]
    sys.modules["app.tools"] = tools_package

maintenance_module = import_module("app.service.memory.runtime.extraction.memory_maintenance_prompt")
provider_module = import_module("app.service.memory.runtime.extraction.memory_extraction_prompt_provider")
budget_module = import_module("app.service.memory.policies.memory_file_budget")
scope_module = import_module("app.service.memory.policies.memory_scope")
MemoryMaintenancePromptBuilder = maintenance_module.MemoryMaintenancePromptBuilder
MemoryExtractionPromptProvider = provider_module.MemoryExtractionPromptProvider
MemoryFileTokenUsage = budget_module.MemoryFileTokenUsage
MemoryFileReadStatus = budget_module.MemoryFileReadStatus
MemoryMdBudget = budget_module.MemoryMdBudget
MemoryScope = scope_module.MemoryScope
MemoryScopeKind = scope_module.MemoryScopeKind

if _tools_package_was_stubbed:
    sys.modules.pop("app.tools", None)
if _storage_package_was_stubbed:
    sys.modules.pop("app.infrastructure.storage", None)

"""
旧模板枚举和占位符渲染入口已随政策迁入 Skill 删除；对应三个模板接口用例不再适用。
保留并适配原有的预算、缺失文件容错、动态事实、中文注释和主提示词职责检查，不增加场景。
"""


@pytest.mark.asyncio
async def test_memory_maintenance_prompt_only_lists_files_at_or_over_limit(monkeypatch, tmp_path):
    """用量按文件分别展示，只有严格超过 Token 最大值才标记超限。"""
    scopes = (
        MemoryScope(MemoryScopeKind.GLOBAL, tmp_path / "global"),
        MemoryScope(MemoryScopeKind.PROJECT, tmp_path / "project"),
    )
    monkeypatch.setattr(maintenance_module, "resolve_memory_scopes", lambda _context: scopes)

    async def fake_inspect(path: Path, _event: object) -> MemoryFileTokenUsage:
        tokens = 16001 if path == scopes[0].memory_file else 16000
        return MemoryFileTokenUsage(path, MemoryFileReadStatus.OK, tokens, size_bytes=tokens * 3)

    monkeypatch.setattr(maintenance_module, "inspect_memory_file", fake_inspect)
    builder = MemoryMaintenancePromptBuilder()
    usages = await builder.inspect(SimpleNamespace(get_interruption_event=lambda: None))
    prompt = builder.render_usage(usages, MemoryMdBudget(10000, 16000))
    assert str(scopes[0].memory_file) in prompt
    assert str(scopes[1].memory_file) in prompt
    assert prompt.count("over maximum: yes") == 1
    assert prompt.count("over maximum: no") == 1
    assert "target 10,000; maximum 16,000" in prompt


@pytest.mark.asyncio
async def test_memory_maintenance_prompt_skips_missing_files(monkeypatch, tmp_path):
    """缺失主文件不阻断 after-run，也不被误报为已计数的空文件。"""
    scope = MemoryScope(MemoryScopeKind.GLOBAL, tmp_path / "global")
    monkeypatch.setattr(maintenance_module, "resolve_memory_scopes", lambda _context: (scope,))
    builder = MemoryMaintenancePromptBuilder()
    usages = await builder.inspect(SimpleNamespace(get_interruption_event=lambda: None))
    assert usages[0].status == MemoryFileReadStatus.MISSING
    assert usages[0].estimated_tokens is None
    assert "no file currently exists" in builder.render_usage(usages, MemoryMdBudget(10000, 16000))


@pytest.mark.asyncio
async def test_prompt_provider_appends_dynamic_maintenance_prompt(monkeypatch):
    """真实 Skill reference 与动态用量共同进入后台请求，不恢复 Python 政策模板。"""
    from agentlang.chat_history.chat_history import ChatHistoryForkData
    from agentlang.skills.loader import SkillLoader
    from app.core.horizon.models import HorizonState
    from app.core.skill_utils.prompt import SkillSources
    from app.core.models.agent_runtime import AgentProviderType, AgentTarget
    from app.core.models.agent_session import AgentSessionRef
    from app.service.agent_context_snapshot_service import AgentContextSnapshot

    root = Path(__file__).resolve().parents[2]
    skill = await SkillLoader().load_from_file(root / "agents/skills/memory/SKILL.md")
    monkeypatch.setattr(provider_module.PathManager, "get_compiled_agent_file", lambda _name: root / "agents/magic.agent")
    monkeypatch.setattr(provider_module, "resolve_skills_metadata", AsyncMock(return_value=SkillSources([skill], [])))
    monkeypatch.setattr(provider_module, "get_memory_md_budget", lambda: MemoryMdBudget(10000, 16000))
    monkeypatch.setattr(provider_module, "build_memory_runtime_context", lambda _context: "Runtime scope facts")
    builder = SimpleNamespace(inspect=AsyncMock(return_value=()), render_usage=lambda *_args: "Dynamic usage facts")
    context = SimpleNamespace(
        is_magiclaw=lambda: False,
        get_personal_preferences=lambda: SimpleNamespace(long_term_memory_enabled=True),
        has_skill=lambda name: name == "memory",
        shared_context=SimpleNamespace(get_field=lambda _key: "UTC"),
    )
    """
    与生产调用传同一种快照：provider 从 source 取得 Agent 配置，从 Horizon 取得来源话题。
    这里没有话题信息是合法状态，不能靠缺字段的桩迫使生产代码猜 ID 或增加宽松访问。
    """
    snapshot = AgentContextSnapshot(
        source=AgentSessionRef(
            target=AgentTarget(AgentProviderType.BUILTIN, "magic"),
            agent_id="source",
            chat_history_dir=root / ".chat_history",
        ),
        chat_history=ChatHistoryForkData(messages=(), session_document={}),
        horizon_state=HorizonState(agent_id="source"),
    )
    prompt = await MemoryExtractionPromptProvider(builder).load(snapshot, agent_context=context)
    assert "after-run.md" in prompt
    assert "Dynamic usage facts" in prompt
    assert "Runtime scope facts" in prompt
    builder.inspect.assert_awaited_once_with(context)


@pytest.mark.asyncio
async def test_memory_extraction_prompt_source_keeps_developer_annotations():
    """运行时路径说明保留完整中文开发注释，正式 Skill 使用英文。"""
    from app.utils.async_file_utils import async_read_text

    root = Path(__file__).resolve().parents[2]
    source = await async_read_text(root / "agents/prompts/file_memory_instructions.prompt")
    assert "<!--zh" in source


@pytest.mark.asyncio
async def test_memory_prompt_keeps_storage_and_retrieval_only():
    """主提示词只提供作用域与读取事实，完整维护规则由预加载 Skill 承担。"""
    from app.utils.async_file_utils import async_read_text

    root = Path(__file__).resolve().parents[2]
    content = await async_read_text(root / "agents/prompts/file_memory_instructions.prompt")
    assert "Runtime locations for file-based persistent memory" in content
    assert "latest memory notification" in content
    assert "notes/" in content
    assert len(content.encode("utf-8")) < 8 * 1024
    assert content.count("<!--zh") == 1
    assert "Normalize every stored fact" not in content
