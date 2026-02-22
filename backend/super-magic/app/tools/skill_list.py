"""Skill List Tool - 列出所有来源的可用 skill"""

from app.i18n import i18n
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_utils.manager import GlobalSkillManager
from app.core.skill_utils.skill_directory_scan import (
    discover_skills_in_directory,
    discover_skills_in_workspace,
)
from app.paths import PathManager

logger = get_logger(__name__)

# source 过滤参数合法值（与 skill_sources 中 system_skills 对应）
_VALID_SOURCES = {"all", "system", "crew", "workspace"}

# 同名 skill 解析优先级（与 GlobalSkillManager.get_skills_dirs 目录顺序一致）
# system（agents/skills）> crew > workspace
_SHADOW_SAME_NAME_NOTE = (
    "shadowed by higher-priority source (same name); priority: system > crew > workspace"
)


@dataclass
class SkillItem:
    """单个 skill 的列表条目"""
    name: str
    source: str          # "system" | "crew" | "workspace"
    can_override: bool
    description: str = ""
    path: str = ""
    note: Optional[str] = None


class SkillListParams(BaseToolParams):
    """Skill List 工具参数"""

    source: str = Field(
        "all",
        description="""<!--zh: 来源过滤，可选值：all（全部）、system（agents/skills 项目内置）、crew（当前 crew agent 私有）、workspace（用户安装和创建）。同名时优先级：system > crew > workspace。-->
Source filter. Options: all (default), system (agents/skills project built-in), crew (current crew-agent private), workspace (user-installed and custom). Same-name priority: system > crew > workspace.""",
    )


@tool()
class SkillList(BaseTool[SkillListParams]):
    """<!--zh
    列出当前所有可用 skill 的工具，包含 system（agents/skills）、crew 私有 skill 和 workspace skill（skillhub 安装 + 用户创建）。
    同名解析优先级：system > crew > workspace；低优先级来源上的同名项会标注 shadow（与 SkillManager 加载顺序一致）。
    每个 skill 标注来源和是否可被覆盖（system 不可覆盖；crew / workspace 可被更高优先级同名项覆盖）。
    在创建新 skill 前，建议先调用此工具检查是否存在同名 skill。
    -->
    Tool that lists all available skills: system (agents/skills), crew private, and workspace (skillhub-installed and custom).
    Same-name resolution priority: system > crew > workspace; lower-priority duplicates are labeled as shadowed (matches SkillManager search order).
    Each entry shows source and can_override (system: false; crew/workspace: true unless shadowed).

    列出结果不受 .agent 中 `skills:` / `skills_dir` 限制；二者仅影响系统提示中展示的 skill 集合。
    """

    async def execute(self, tool_context: ToolContext, params: SkillListParams) -> ToolResult:
        source_filter = params.source.strip().lower() if params.source else "all"
        if source_filter not in _VALID_SOURCES:
            source_filter = "all"

        skills: List[SkillItem] = []
        system_skills: List[SkillItem] = []
        crew_skills: List[SkillItem] = []

        if source_filter in ("all", "system"):
            system_skills = await self._list_system_skills()
            skills.extend(system_skills)

        if source_filter in ("all", "crew"):
            crew_skills = await self._list_crew_skills()
            if source_filter == "all":
                system_names = {s.name for s in system_skills}
                for c in crew_skills:
                    if c.name in system_names:
                        c.note = _SHADOW_SAME_NAME_NOTE
            skills.extend(crew_skills)

        if source_filter in ("all", "workspace"):
            workspace = await self._list_workspace_skills()
            if source_filter == "all":
                higher_priority_names = {s.name for s in system_skills} | {s.name for s in crew_skills}
            else:
                system_skills = await self._list_system_skills()
                crew_skills = await self._list_crew_skills()
                higher_priority_names = {s.name for s in system_skills} | {s.name for s in crew_skills}
            for ws in workspace:
                if ws.name in higher_priority_names:
                    ws.note = _SHADOW_SAME_NAME_NOTE
                skills.append(ws)

        if not skills:
            return ToolResult(content="No skills found.")

        lines = [
            "Priority: system > crew > workspace (same name resolves to the highest source).\n",
            f"Total: {len(skills)} skill(s)\n",
        ]
        for s in skills:
            line = f"[{s.source}] {s.name}  can_override={s.can_override}"
            if s.description:
                line += f"\n  {s.description}"
            if s.note:
                line += f"\n  NOTE: {s.note}"
            lines.append(line)

        return ToolResult(content="\n\n".join(lines))

    async def _list_system_skills(self) -> List[SkillItem]:
        """列出 agents/skills/ 目录下的 system skill（与 skill_sources.system_skills 一致）"""
        system_dir = PathManager.get_agents_dir() / "skills"
        metas = await discover_skills_in_directory(system_dir)
        results = [
            SkillItem(
                name=meta.name,
                source="system",
                can_override=False,
                description=meta.description,
                path=str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            )
            for meta in metas
        ]
        results.sort(key=lambda x: x.name)
        logger.info(f"system skills: {len(results)} 个")
        return results

    async def _list_crew_skills(self) -> List[SkillItem]:
        """列出当前 crew agent 私有 skills（agents/crew/{agent_code}/skills）"""
        current_agent_type = (GlobalSkillManager.get_current_agent_type() or "").strip()
        if not current_agent_type:
            return []

        try:
            crew_dir = PathManager.get_crew_skills_dir(current_agent_type)
        except ValueError as e:
            logger.warning(f"当前 agent 标识非法，跳过 crew skills 列表: {e}")
            return []
        metas = await discover_skills_in_directory(crew_dir)
        results = [
            SkillItem(
                name=meta.name,
                source="crew",
                can_override=True,
                description=meta.description,
                path=str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            )
            for meta in metas
        ]
        results.sort(key=lambda x: x.name)
        logger.info(f"crew skills({current_agent_type}): {len(results)} 个")
        return results

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        source = (arguments or {}).get("source", "all")
        return i18n.translate("skill_list.success", category="tool.messages", source=source)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate(tool_name, category="tool.actions"),
                "remark": i18n.translate("skill_list.error", category="tool.messages"),
            }

        return {
            "action": i18n.translate(tool_name, category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }

    async def _list_workspace_skills(self) -> List[SkillItem]:
        """列出 workspace 持久化 skills 目录下的 skill（含用户创建与 skillhub 安装产物）"""
        metas = await discover_skills_in_workspace()
        results = [
            SkillItem(
                name=meta.name,
                source="workspace",
                can_override=True,
                description=meta.description,
                path=str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            )
            for meta in metas
        ]
        results.sort(key=lambda x: x.name)
        logger.info(f"workspace skills: {len(results)} 个")
        return results
