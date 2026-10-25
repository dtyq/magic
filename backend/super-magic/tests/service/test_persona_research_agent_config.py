from pathlib import Path

from agentlang.agent.define.parser import parse_agent_file
from app.core.entity.message.client_message import AgentMode
from app.core.models.agent_runtime import AgentProviderType, AgentTarget
from app.tools.core.tool_factory import tool_factory

AGENTS_DIR = Path(__file__).resolve().parents[2] / "agents"
SKILLS_DIR = AGENTS_DIR / "skills"


def _load_agent(agent_name: str):
    content = (AGENTS_DIR / f"{agent_name}.agent").read_text(encoding="utf-8")
    return parse_agent_file(content)


def test_persona_research_mode_routes_to_builtin_agent():
    assert AgentMode.PERSONA_RESEARCH.value == "persona_research"
    assert AgentMode.PERSONA_RESEARCH.get_agent_type() == "persona-research"
    assert AgentMode.resolve_agent_type("persona_research") == "persona-research"

    target = AgentTarget.from_mode("persona_research")
    assert target == AgentTarget(AgentProviderType.BUILTIN, "persona-research")


def test_persona_interviewer_resolves_by_name_as_builtin():
    """子 Agent 按 .agent 文件名调用，不需要新增 AgentMode。"""
    target = AgentTarget.from_name("persona-interviewer")
    assert target == AgentTarget(AgentProviderType.BUILTIN, "persona-interviewer")
    assert (AGENTS_DIR / f"{target.agent_name}.agent").is_file()


def test_persona_research_agent_definition():
    agent_define, prompt = _load_agent("persona-research")

    assert "persona_chat" in agent_define.tools_config
    assert "ask_user" in agent_define.tools_config
    assert agent_define.code_execution is True  # call_subagent 依赖 Code Mode
    system_skill_names = [entry.name for entry in agent_define.skills_config.system_skills]
    assert {"subagents", "persona-research", "deep-research"} <= set(system_skill_names)
    assert [entry.name for entry in agent_define.skills_config.preload] == ["persona-research"]
    assert "<!--zh" not in prompt


def test_persona_interviewer_agent_definition():
    agent_define, prompt = _load_agent("persona-interviewer")

    # 不挂 write_file：记录由 persona_chat 追加、finish_persona_transcript 收尾。
    assert set(agent_define.tools_config) == {"list_dir", "read_files", "persona_chat", "finish_persona_transcript"}
    assert agent_define.code_execution is False
    assert agent_define.skills_config is None
    assert "persona_chat" in prompt
    assert "<!--zh" not in prompt


def test_persona_agents_reference_existing_tools_and_skills():
    for agent_name in ("persona-research", "persona-interviewer"):
        agent_define, _ = _load_agent(agent_name)
        missing_tools = [name for name in agent_define.tools_config if tool_factory.get_tool(name) is None]
        assert missing_tools == [], f"{agent_name} references unknown tools: {missing_tools}"
        if agent_define.skills_config is not None:
            for entry in agent_define.skills_config.system_skills:
                assert (SKILLS_DIR / entry.name / "SKILL.md").is_file(), entry.name


def test_persona_research_skill_references_exist():
    skill_dir = SKILLS_DIR / "persona-research"
    skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")

    assert skill.startswith("---\nname: persona-research\n")
    for relative_path in (
        "reference/file-contracts.md",
        "reference/methods.md",
        "reference/report-templates.md",
        "reference/tools.md",
    ):
        assert relative_path in skill
        assert (skill_dir / relative_path).is_file()
    # 内置报告模板由 report-templates.md 引用，update_study 也从这里复制默认模板。
    templates_doc = (skill_dir / "reference/report-templates.md").read_text(encoding="utf-8")
    assert "reference/report-template.html" in templates_doc
    assert (skill_dir / "reference/report-template.html").is_file()


def test_persona_research_code_mode_tools_are_registered_and_code_mode_only():
    """主 Agent 通过 run_sdk_snippet 调用这些工具，不能在 .agent 的 tools 里声明。"""
    agent_define, _ = _load_agent("persona-research")
    for name in ("update_study", "save_personas", "check_interviews", "save_study_synthesis", "save_validation_questionnaire", "attach_persona_portrait", "embed_persona_portraits"):
        info = tool_factory.get_tool(name)
        assert info is not None and info.code_mode_only, name
        assert name not in agent_define.tools_config
    interviewer_tool = tool_factory.get_tool("finish_persona_transcript")
    assert interviewer_tool is not None and not interviewer_tool.code_mode_only
