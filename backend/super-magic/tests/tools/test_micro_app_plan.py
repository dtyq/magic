from pathlib import Path

from agentlang.agent.define.parser import parse_agent_file
from app.tools.micro_app_plan import (
    MicroAppPlanTool,
    build_plan_content,
    build_plan_payload,
)

AGENT_FILE = Path(__file__).resolve().parents[2] / "agents" / "micro-app.agent"
MAGICBASE_SKILL_FILE = Path(__file__).resolve().parents[2] / "agents" / "skills" / "magicbase" / "SKILL.md"


def test_micro_app_plan_uses_domain_specific_tool_name():
    tool = MicroAppPlanTool()

    assert MicroAppPlanTool.__module__ == "app.tools.micro_app_plan"
    assert tool.name == "micro_app_plan"
    assert tool.to_param()["function"]["name"] == "micro_app_plan"
    assert "call micro_app_plan again" in tool.get_prompt_hint()


def test_micro_app_agent_mounts_domain_specific_plan_tool():
    agent_content = AGENT_FILE.read_text(encoding="utf-8")
    agent_define = parse_agent_file(agent_content)[0]

    assert "micro_app_plan" in agent_define.tools_config
    assert "plan" not in agent_define.tools_config


def test_micro_app_agent_uses_download_skill_instead_of_direct_code_mode_tool():
    agent_content = AGENT_FILE.read_text(encoding="utf-8")
    agent_define = parse_agent_file(agent_content)[0]

    assert "download_from_urls" not in agent_define.tools_config
    assert agent_define.skills_config is not None
    assert "download" in agent_define.skills_config.get_system_skill_names()


def test_micro_app_agent_does_not_declare_runtime_managed_code_execution_tools():
    agent_content = AGENT_FILE.read_text(encoding="utf-8")
    agent_define = parse_agent_file(agent_content)[0]

    assert "run_python_snippet" not in agent_define.tools_config
    assert agent_define.code_execution is True


def test_micro_app_agent_delegates_magicbase_tools_to_code_mode():
    """MagicBase 工具已改为 Code Mode 专用，不能再出现在 agent tools 声明里。"""
    agent_content = AGENT_FILE.read_text(encoding="utf-8")
    agent_define = parse_agent_file(agent_content)[0]

    declared_magicbase_tools = [
        tool_name
        for tool_name in agent_define.tools_config
        if tool_name.startswith("magicbase") or "_magicbase_" in tool_name
    ]
    assert declared_magicbase_tools == []
    assert agent_define.skills_config is not None
    assert [entry.name for entry in agent_define.skills_config.preload] == [
        "micro-app-architect",
        "html-api-sdk",
        "magicbase",
    ]
    assert "use-magicbase" in agent_define.skills_config.get_system_skill_names()
    assert agent_define.code_execution is True


def test_magicbase_skill_documents_code_mode_execution():
    content = MAGICBASE_SKILL_FILE.read_text(encoding="utf-8")

    assert "Code Mode only" in content
    assert "run_sdk_snippet" in content
    assert 'tool.call("create_magicbase_table"' in content
    assert 'tool.call("update_magicbase_row"' in content


def test_micro_app_contract_docs_do_not_reference_legacy_plan_tool():
    for contract_file in (AGENT_FILE, MAGICBASE_SKILL_FILE):
        content = contract_file.read_text(encoding="utf-8")

        assert "`micro_app_plan`" in content
        assert "`plan`" not in content


def test_micro_app_plan_preserves_structured_data_model_fields():
    field = {
        "key": "name",
        "name": "活动名称",
        "type": "text",
        "required": True,
    }
    payload = build_plan_payload(
        {
            "data_model": [
                {
                    "table_name": "activities",
                    "purpose": "存储活动信息",
                    "fields": [field],
                }
            ]
        }
    )

    assert payload["data_model"][0]["fields"] == [field]

    content = build_plan_content(
        plan=payload,
        plan_id="plan-1",
        status="pending",
        response=None,
        expires_at=0,
    )

    assert content.data_model[0].fields == [field]
