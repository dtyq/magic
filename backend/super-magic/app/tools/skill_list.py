"""Skill List Tool - 列出所有来源的可用 skill"""

from app.i18n import i18n
from typing import Any, Dict, List

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)

# source 过滤参数合法值
_VALID_SOURCES = {"all", "builtin", "crew", "workspace"}


class SkillListParams(BaseToolParams):
    """Skill List 工具参数"""

    source: str = Field(
        "all",
        description="""<!--zh: 来源过滤，可选值：all（全部）、builtin（内置）、crew（当前 crew agent 私有）、workspace（用户安装和创建）-->
Source filter. Options: all (default), builtin (built-in only), crew (current crew-agent private), workspace (user-installed and custom)""",
    )


@tool()
class SkillList(BaseTool[SkillListParams]):
    """<!--zh
    列出当前所有可用 skill 的工具，包含内置 skill、crew 私有 skill 和 workspace skill（skillhub 安装 + 用户创建）。
    每个 skill 标注来源和是否可被覆盖（内置 skill 优先级最高，不可覆盖；crew 次之）。
    在创建新 skill 前，建议先调用此工具检查是否存在同名 skill。
    -->
    Tool that lists all available skills, including built-in skills, crew private skills, and workspace skills (skillhub-installed and custom).
    Each skill shows its source and whether it can be overridden (built-in skills have highest priority and cannot be overridden; crew comes next).
    Recommended to call this tool before creating a new skill to check for name conflicts.
    """

    async def execute(self, tool_context: ToolContext, params: SkillListParams) -> ToolResult:
        source_filter = params.source.strip().lower() if params.source else "all"
        if source_filter not in _VALID_SOURCES:
            source_filter = "all"

        skills: List[Dict[str, Any]] = []

        if source_filter in ("all", "builtin"):
            builtin = await self._list_builtin_skills()
            skills.extend(builtin)

        if source_filter in ("all", "crew"):
            crew = await self._list_crew_skills()
            skills.extend(crew)

        if source_filter in ("all", "workspace"):
            workspace = await self._list_workspace_skills()
            # 标注与更高优先级来源（builtin / crew）同名的 workspace skill
            higher_priority_names = {s["name"] for s in skills}
            for ws in workspace:
                if ws["name"] in higher_priority_names:
                    ws["note"] = "shadowed by higher-priority skill with same name (not loadable)"
                skills.append(ws)

        if not skills:
            return ToolResult(content="No skills found.")

        lines = [f"Total: {len(skills)} skill(s)\n"]
        for s in skills:
            line = (
                f"[{s['source']}] {s['name']}"
                f"  can_override={s['can_override']}"
            )
            if s.get("description"):
                line += f"\n  {s['description']}"
            if s.get("note"):
                line += f"\n  NOTE: {s['note']}"
            lines.append(line)

        return ToolResult(content="\n\n".join(lines))

    async def _list_builtin_skills(self) -> List[Dict[str, Any]]:
        """列出 agents/skills/ 目录下的内置 skill"""
        from app.core.skill_utils.manager import GlobalSkillManager
        from app.core.skill_utils.skillhub import scan_skills_dir

        builtin_dir = GlobalSkillManager.get_project_root() / "agents" / "skills"
        metas = await scan_skills_dir(builtin_dir)
        results = [
            {
                "name": meta.name,
                "source": "builtin",
                "can_override": False,
                "description": meta.description,
                "path": str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            }
            for meta in metas
        ]
        results.sort(key=lambda x: x["name"])
        logger.info(f"内置 skills: {len(results)} 个")
        return results

    async def _list_crew_skills(self) -> List[Dict[str, Any]]:
        """列出当前 crew agent 私有 skills（agents/crew/{agent_code}/skills）"""
        from app.core.skill_utils.manager import GlobalSkillManager
        from app.core.skill_utils.skillhub import scan_skills_dir

        current_agent_type = (GlobalSkillManager.get_current_agent_type() or "").strip()
        if not current_agent_type:
            return []

        crew_dir = (
            GlobalSkillManager.get_project_root()
            / "agents"
            / "crew"
            / current_agent_type
            / "skills"
        )
        metas = await scan_skills_dir(crew_dir)
        results = [
            {
                "name": meta.name,
                "source": "crew",
                "can_override": True,
                "description": meta.description,
                "path": str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            }
            for meta in metas
        ]
        results.sort(key=lambda x: x["name"])
        logger.info(f"crew skills({current_agent_type}): {len(results)} 个")
        return results

    async def _list_workspace_skills(self) -> List[Dict[str, Any]]:
        """直接扫描 workspace/skills/ 目录发现 skill"""
        from app.core.skill_utils.skillhub import scan_workspace_skills

        metas = await scan_workspace_skills()
        results = [
            {
                "name": meta.name,
                "source": "workspace",
                "can_override": True,
                "description": meta.description,
                "path": str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            }
            for meta in metas
        ]
        results.sort(key=lambda x: x["name"])
        logger.info(f"workspace skills: {len(results)} 个")
        return results
