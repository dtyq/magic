from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_common_workflows_unifies_mcp_and_skill_disambiguation():
    prompt = (ROOT / "agents/prompts/common_workflows.prompt").read_text(encoding="utf-8")

    assert "Candidate capability-source selection" in prompt
    assert "MCP/MCP, skill/skill, or MCP/skill" in prompt
    assert "chat history, docs, calendars, contacts, tasks/todos" in prompt
    assert "ask_user" in prompt
    assert "Do not guess from MCP/skill order, default preference, or <local_cli_context>" in prompt
    assert "<local_cli_context>" not in prompt.split("<workflows>", 1)[0]


def test_cli_skill_descriptions_include_chinese_product_names():
    dingtalk_skill = (ROOT / "agents/skills/dingtalk-cli/SKILL.md").read_text(encoding="utf-8")
    lark_skill = (ROOT / "agents/skills/lark-cli/SKILL.md").read_text(encoding="utf-8")

    assert "DingTalk/钉钉" in dingtalk_skill
    assert "Lark/Feishu/飞书" in lark_skill
