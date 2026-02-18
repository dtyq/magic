"""create_skill - 为指定 Agent 创建新技能文件"""

import re
from typing import Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.paths import PathManager
from app.i18n import i18n

logger = get_logger(__name__)


class CreateSkillParams(BaseToolParams):
    """CreateSkill 工具参数"""
    agent_code: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 编码。如不提供则使用当前会话的 agent_code。
Agent code. If not provided, uses the current session's agent_code.-->"""
    )
    skill_name: str = Field(
        ...,
        description="""<!--zh: 技能名称，使用 kebab-case 格式（如 my-awesome-skill）。
Skill name in kebab-case format (e.g., my-awesome-skill).-->"""
    )
    description_en: str = Field(
        ...,
        description="""<!--zh: 技能英文描述。必须包含：何时触发、信号词、何时不使用。
English description. Must include: when to trigger, signal words, when NOT to use.-->"""
    )
    description_cn: str = Field(
        ...,
        description="""<!--zh: 技能中文描述。必须包含：何时触发、信号词、何时不使用。
Chinese description. Must include: when to trigger, signal words, when NOT to use.-->"""
    )
    name_cn: str = Field(
        ...,
        description="""<!--zh: 技能中文名称。
Chinese skill name.-->"""
    )
    content: str = Field(
        ...,
        description="""<!--zh: SKILL.md 的 Markdown 正文部分（不含 frontmatter）。应包含概述、使用条件、执行步骤、输出规范、注意事项等。
Markdown body of SKILL.md (without frontmatter). Should include overview, usage conditions, execution steps, output format, notes, etc.-->"""
    )


@tool()
class CreateSkill(BaseTool[CreateSkillParams]):
    """<!--zh
    为指定 Agent 创建新技能文件（SKILL.md）。技能文件遵循标准 frontmatter + Markdown 格式，
    可被 SkillLoader 正确解析。创建后需调用 upload_skill 上传并绑定到 Agent。
    -->
    Create a new skill file (SKILL.md) for a custom agent. The skill file follows
    the standard frontmatter + Markdown format parseable by SkillLoader.
    After creation, use upload_skill to upload and bind to the agent.
    """

    def _get_remark_content(self, result: ToolResult, arguments=None) -> str:
        if result.ok:
            skill_name = (arguments or {}).get("skill_name", "")
            if skill_name:
                return i18n.translate("agent_manager.create_skill_success", category="tool.messages", skill_name=skill_name)
            return i18n.translate("agent_manager.create_skill_default", category="tool.messages")
        return ""

    async def execute(self, tool_context: ToolContext, params: CreateSkillParams) -> ToolResult:
        from app.core.context.agent_context import AgentContext

        # Resolve agent_code
        agent_code = params.agent_code
        if not agent_code:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                agent_code = agent_context.get_agent_code()

        if not agent_code:
            return ToolResult(ok=False, content=i18n.translate("agent_manager.agent_code_not_found", category="tool.messages"))

        # Validate skill_name format
        if not re.match(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$', params.skill_name):
            return ToolResult(ok=False, content=i18n.translate("agent_manager.skill_name_invalid", category="tool.messages"))

        # Build SKILL.md content
        skill_md = (
            f"---\n"
            f"name: {params.skill_name}\n"
            f"description: |\n"
            f"  {params.description_en}\n"
            f"\n"
            f"name-cn: {params.name_cn}\n"
            f"description-cn: |\n"
            f"  {params.description_cn}\n"
            f"---\n\n"
            f"{params.content}"
        )

        # Write to disk
        agent_dir = PathManager.get_agent_studio_dir(agent_code)
        skill_dir = agent_dir / "skills" / params.skill_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_file = skill_dir / "SKILL.md"

        if skill_file.exists():
            return ToolResult(ok=False, content=i18n.translate("agent_manager.skill_already_exists", category="tool.messages", skill_name=params.skill_name))

        skill_file.write_text(skill_md, encoding="utf-8")

        _t = lambda key, **kw: i18n.translate(key, category="tool.messages", **kw)

        summary = (
            f"## {_t('agent_manager.summary_skill_created')}\n\n"
            f"- **{_t('agent_manager.label_skill_name')}**: {params.skill_name}\n"
            f"- **{_t('agent_manager.label_cn_name')}**: {params.name_cn}\n"
            f"- **{_t('agent_manager.label_file_path')}**: .agent_studio/{agent_code}/skills/{params.skill_name}/SKILL.md\n\n"
            f"{_t('agent_manager.next_step_upload')}"
        )

        return ToolResult(content=summary)
