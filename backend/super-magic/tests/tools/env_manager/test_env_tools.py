import json

import pytest
from dotenv import dotenv_values

from agentlang.tools.tool_result import ToolResult
from app.i18n import I18nManager
from app.tools.env_manager import service
from app.tools.env_manager.list_env import ListEnv, ListEnvParams
from app.tools.env_manager.set_env import SetEnv, SetEnvParams
from app.tools.env_manager.unset_env import UnsetEnv, UnsetEnvParams


@pytest.fixture()
def env_paths(tmp_path, monkeypatch):
    personal_env = tmp_path / "home" / ".magic" / "super-magic.env"
    workspace_dir = tmp_path / "workspace"
    workspace_env = workspace_dir / ".magic" / ".env"

    monkeypatch.setattr(service.PathManager, "get_personal_env_file", lambda: personal_env)
    monkeypatch.setattr(service.PathManager, "get_workspace_dir", lambda: workspace_dir)
    monkeypatch.setattr(service.PathManager, "get_workspace_env_file", lambda: workspace_env)

    return {
        "personal_env": personal_env,
        "workspace_dir": workspace_dir,
        "workspace_skill_env": workspace_dir / ".magic" / "skills" / ".env",
        "workspace_root_env": workspace_dir / ".env",
        "workspace_env": workspace_env,
    }


@pytest.fixture(autouse=True)
def reset_i18n_language():
    I18nManager.reset_language()
    yield
    I18nManager.reset_language()


def _read_env(path):
    return dotenv_values(str(path))


async def _detail_content(tool, result, arguments):
    detail = await tool.get_tool_detail(None, result, arguments)
    assert detail is not None
    return detail.data.content


def _serialized_result(result):
    return json.dumps(
        {
            "content": result.content,
            "data": result.data,
            "extra_info": result.extra_info,
        },
        ensure_ascii=False,
    )


@pytest.mark.asyncio
async def test_env_tools_are_code_mode_only_and_have_display_hooks():
    tools = [
        (SetEnv(), "set_env", {"key": "MOCK_API_KEY", "value": "mock-personal-secret-value"}),
        (UnsetEnv(), "unset_env", {"key": "MOCK_API_KEY"}),
        (ListEnv(), "list_env", {"scope": "personal"}),
    ]

    for tool, tool_name, arguments in tools:
        assert tool.code_mode_only is True
        assert tool.get_effective_name() == tool_name
        before = await tool.get_before_tool_call_friendly_action_and_remark(tool_name, None, arguments)
        after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool_name,
            None,
            ToolResult(content="ok", extra_info={"key": arguments.get("key", ""), "scope": arguments.get("scope", "personal")}),
            0.1,
            arguments,
        )
        detail = await tool.get_tool_detail(
            None,
            ToolResult(content="ok", extra_info={"key": arguments.get("key", ""), "scope": arguments.get("scope", "personal")}),
            arguments,
        )

        assert before["action"]
        assert before["remark"]
        assert after["action"]
        assert after["remark"]
        assert detail is not None
        assert "mock-personal-secret-value" not in before["remark"]
        assert "mock-personal-secret-value" not in after["remark"]
        assert "mock-personal-secret-value" not in detail.data.content


@pytest.mark.asyncio
async def test_env_tool_action_and_remark_are_i18n():
    I18nManager.set_language("en_US")

    set_tool = SetEnv()
    set_before = await set_tool.get_before_tool_call_friendly_action_and_remark(
        "set_env",
        None,
        {"key": "MOCK_API_KEY"},
    )
    set_after = await set_tool.get_after_tool_call_friendly_action_and_remark(
        "set_env",
        None,
        ToolResult(content="ok", extra_info={"key": "MOCK_API_KEY", "scope": "personal"}),
        0.1,
        {"key": "MOCK_API_KEY"},
    )
    list_after = await ListEnv().get_after_tool_call_friendly_action_and_remark(
        "list_env",
        None,
        ToolResult(content="ok", extra_info={"scope": "all", "count": 2}),
        0.1,
        {"scope": "all"},
    )

    assert set_before["action"] == "Save environment variable"
    assert set_before["remark"] == "Saving MOCK_API_KEY to personal env"
    assert set_after["remark"] == "Saved MOCK_API_KEY to personal env"
    assert list_after["action"] == "List environment variables"
    assert list_after["remark"] == "Found 2 variable(s) in effective env"

    I18nManager.set_language("zh_CN")
    unset_before = await UnsetEnv().get_before_tool_call_friendly_action_and_remark(
        "unset_env",
        None,
        {"key": "MOCK_API_KEY", "scope": "workspace"},
    )

    assert unset_before["action"] == "删除环境变量"
    assert unset_before["remark"] == "正在删除 MOCK_API_KEY（工作区 env）"


@pytest.mark.asyncio
async def test_set_env_defaults_to_personal_scope(env_paths):
    tool = SetEnv()
    plain_value = "mock-personal-secret-value"

    result = await tool.execute(None, SetEnvParams(key="MOCK_API_KEY", value=plain_value))
    detail = await _detail_content(tool, result, {"key": "MOCK_API_KEY", "value": plain_value})

    assert result.ok is True
    assert _read_env(env_paths["personal_env"])["MOCK_API_KEY"] == plain_value
    assert not env_paths["workspace_env"].exists()
    assert plain_value not in _serialized_result(result)
    assert plain_value not in detail
    assert f"变量值: `{service.EnvManagerService.mask_value(plain_value)}`" in detail


@pytest.mark.asyncio
async def test_set_env_workspace_scope_writes_workspace_env(env_paths):
    tool = SetEnv()

    result = await tool.execute(
        None,
        SetEnvParams(key="MOCK_WORKSPACE_TOKEN", value="mock-workspace-secret-value", scope="workspace"),
    )

    assert result.ok is True
    assert _read_env(env_paths["workspace_env"])["MOCK_WORKSPACE_TOKEN"] == "mock-workspace-secret-value"
    assert not env_paths["personal_env"].exists()


@pytest.mark.asyncio
async def test_unset_env_deletes_from_selected_scope(env_paths):
    env_paths["personal_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["personal_env"].write_text("MOCK_REMOVE_ME=mock-secret-value\nMOCK_KEEP_ME=mock-keep\n", encoding="utf-8")

    result = await UnsetEnv().execute(None, UnsetEnvParams(key="MOCK_REMOVE_ME"))

    assert result.ok is True
    personal_values = _read_env(env_paths["personal_env"])
    assert "MOCK_REMOVE_ME" not in personal_values
    assert personal_values["MOCK_KEEP_ME"] == "mock-keep"


@pytest.mark.asyncio
async def test_list_env_all_uses_personal_value_as_highest_priority(env_paths):
    env_paths["workspace_skill_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["workspace_root_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["workspace_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["personal_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["workspace_skill_env"].write_text(
        "MOCK_SHARED=mock-skill-secret-value\nMOCK_SKILL_ONLY=mock-skill-only-value\n",
        encoding="utf-8",
    )
    env_paths["workspace_root_env"].write_text("MOCK_SHARED=mock-root-secret-value\n", encoding="utf-8")
    env_paths["workspace_env"].write_text(
        "MOCK_SHARED=mock-workspace-secret-value\nMOCK_WORKSPACE_ONLY=mock-workspace-only-value\n",
        encoding="utf-8",
    )
    env_paths["personal_env"].write_text(
        "MOCK_SHARED=mock-personal-secret-value\nMOCK_PERSONAL_ONLY=mock-personal-only-value\n",
        encoding="utf-8",
    )

    result = await ListEnv().execute(None, ListEnvParams(scope="all"))

    assert result.ok is True
    values = {item["key"]: item["value"] for item in result.data["keys"]}
    assert set(values) == {
        "MOCK_SHARED",
        "MOCK_SKILL_ONLY",
        "MOCK_WORKSPACE_ONLY",
        "MOCK_PERSONAL_ONLY",
    }
    assert values["MOCK_SHARED"] == service.EnvManagerService.mask_value("mock-personal-secret-value")
    assert "mock-personal-secret-value" not in _serialized_result(result)
    assert "mock-workspace-secret-value" not in _serialized_result(result)


@pytest.mark.asyncio
async def test_list_env_detail_shows_masked_values_only(env_paths):
    env_paths["personal_env"].parent.mkdir(parents=True, exist_ok=True)
    env_paths["personal_env"].write_text("MOCK_TOKEN=mock-personal-secret-value\n", encoding="utf-8")
    tool = ListEnv()

    result = await tool.execute(None, ListEnvParams())
    detail = await _detail_content(tool, result, {"scope": "personal"})

    assert result.ok is True
    assert "MOCK_TOKEN" in detail
    assert "mock-personal-secret-value" not in detail
    assert service.EnvManagerService.mask_value("mock-personal-secret-value") in detail


@pytest.mark.asyncio
async def test_invalid_key_returns_stable_error(env_paths):
    result = await SetEnv().execute(None, SetEnvParams(key="1_BAD", value="mock-secret-value"))

    assert result.ok is False
    assert result.content == "KEY 格式不合法: 1_BAD"
    assert result.extra_info["error_code"] == "invalid_key"
    assert result.extra_info["error_context"] == {"key": "1_BAD"}
    assert "mock-secret-value" not in _serialized_result(result)


@pytest.mark.asyncio
async def test_invalid_scope_returns_stable_error(env_paths):
    result = await ListEnv().execute(None, ListEnvParams(scope="project"))

    assert result.ok is False
    assert result.content == "scope 必须是: all|personal|workspace"
    assert result.extra_info["error_code"] == "invalid_scope"


@pytest.mark.asyncio
async def test_set_env_requires_value(env_paths):
    result = await SetEnv().execute(None, SetEnvParams(key="MOCK_API_KEY"))

    assert result.ok is False
    assert result.content == "VALUE 不能为空"
    assert result.extra_info["error_code"] == "value_required"


@pytest.mark.asyncio
async def test_frontend_failure_display_uses_structured_i18n_not_model_content(env_paths):
    tool = SetEnv()
    result = await tool.execute(None, SetEnvParams(key="1_BAD", value="mock-secret-value"))

    after = await tool.get_after_tool_call_friendly_action_and_remark(
        "set_env",
        None,
        result,
        0.1,
        {"key": "1_BAD", "value": "mock-secret-value"},
    )
    detail = await _detail_content(tool, result, {"key": "1_BAD", "value": "mock-secret-value"})

    assert result.content == "KEY 格式不合法: 1_BAD"
    assert result.content not in after["remark"]
    assert result.content not in detail
    assert "环境变量名格式不合法：1_BAD" in after["remark"]
    assert "环境变量名格式不合法：1_BAD" in detail
    assert "mock-secret-value" not in after["remark"]
    assert "mock-secret-value" not in detail
