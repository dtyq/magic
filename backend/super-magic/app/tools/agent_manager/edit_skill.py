"""edit_skill - 编辑指定 Agent 的已有技能文件"""

from typing import Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.paths import PathManager
from app.i18n import i18n

logger = get_logger(__name__)


class EditSkillParams(BaseToolParams):
    """EditSkill 工具参数"""
    agent_code: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 编码。如不提供则使用当前会话的 agent_code。
Agent code. If not provided, uses the current session's agent_code.-->"""
    )
    skill_name: str = Field(
        ...,
        description="""<!--zh: 要编辑的技能名称（kebab-case）。
Skill name to edit (kebab-case).-->"""
    )
    new_content: str = Field(
        ...,
        description="""<!--zh: 替换后的 SKILL.md 完整内容（包含 frontmatter）。确保遵循标准 frontmatter + Markdown 格式。
Full replacement content of SKILL.md (including frontmatter). Must follow standard frontmatter + Markdown format.-->"""
    )


@tool()
class EditSkill(BaseTool[EditSkillParams]):
    """<!--zh
    编辑指定 Agent 的已有技能文件（SKILL.md）。将以新内容完整替换原文件。
    编辑后需调用 upload_skill 重新上传。
    -->
    Edit an existing skill file (SKILL.md) for a custom agent.
    Replaces the file content entirely. After editing, use upload_skill to re-upload.
    """

    def _get_remark_content(self, result: ToolResult, arguments=None) -> str:
        if result.ok:
            skill_name = (arguments or {}).get("skill_name", "")
            if skill_name:
                return i18n.translate("agent_manager.edit_skill_success", category="tool.messages", skill_name=skill_name)
            return i18n.translate("agent_manager.edit_skill_default", category="tool.messages")
        return ""

    async def execute(self, tool_context: ToolContext, params: EditSkillParams) -> ToolResult:
        from app.core.context.agent_context import AgentContext

        # Resolve agent_code
        agent_code = params.agent_code
        if not agent_code:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                agent_code = agent_context.get_agent_code()

        if not agent_code:
            return ToolResult(ok=False, content=i18n.translate("agent_manager.agent_code_not_found", category="tool.messages"))

        # Locate skill file
        agent_dir = PathManager.get_agent_studio_dir(agent_code)
        skill_dir = agent_dir / "skills" / params.skill_name
        skill_file = skill_dir / "SKILL.md"

        if not skill_file.exists():
            return ToolResult(ok=False, content=i18n.translate("agent_manager.skill_not_found_check", category="tool.messages", skill_name=params.skill_name))

        # Validate frontmatter presence
        content = params.new_content.strip()
        if not content.startswith("---"):
            return ToolResult(ok=False, content=i18n.translate("agent_manager.frontmatter_required", category="tool.messages"))

        # Read old content for diff summary
        old_content = skill_file.read_text(encoding="utf-8")
        old_lines = len(old_content.splitlines())
        new_lines = len(content.splitlines())

        # Write new content
        skill_file.write_text(content, encoding="utf-8")

        _t = lambda key, **kw: i18n.translate(key, category="tool.messages", **kw)

        summary = (
            f"## {_t('agent_manager.summary_skill_edited')}\n\n"
            f"- **{_t('agent_manager.label_skill_name')}**: {params.skill_name}\n"
            f"- **{_t('agent_manager.label_change')}**: {_t('agent_manager.change_lines', old=old_lines, new=new_lines)}\n"
            f"- **{_t('agent_manager.label_file_path')}**: .agent_studio/{agent_code}/skills/{params.skill_name}/SKILL.md\n\n"
            f"{_t('agent_manager.next_step_reupload')}"
        )

        return ToolResult(content=summary)
