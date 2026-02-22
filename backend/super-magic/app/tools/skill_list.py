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
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_latest_published_skill_versions_parameter import (
    GetLatestPublishedSkillVersionsParameter,
)

logger = get_logger(__name__)

# source 过滤参数合法值（与 skill_sources 中 system_skills 对应）
_VALID_SOURCES = {"all", "system", "crew", "workspace", "my_library"}

# 同名 skill 解析优先级（与 GlobalSkillManager.get_skills_dirs 目录顺序一致）
# system（agents/skills）> crew > workspace；my_library 项需安装到 workspace 后才可使用
_SHADOW_SAME_NAME_NOTE = (
    "shadowed by higher-priority source (same name); priority: system > crew > workspace"
)
_MY_LIBRARY_INSTALLED_NOTE = "already installed in workspace"


@dataclass
class SkillItem:
    """单个 skill 的列表条目"""
    name: str
    source: str          # "system" | "crew" | "workspace" | "my_library"
    can_override: bool
    description: str = ""
    path: str = ""
    code: Optional[str] = None       # 仅 my_library 设置：平台 skill code，用于 skillhub install-platform-me <code>
    installed: Optional[bool] = None  # 仅 my_library 设置：True 已安装到 workspace，False 未安装；其他来源均为本地已安装，不设此字段
    note: Optional[str] = None


class SkillListParams(BaseToolParams):
    """Skill List 工具参数"""

    source: str = Field(
        "all",
        description="""<!--zh: 来源过滤，可选值：all（全部）、system（agents/skills 项目内置）、crew（当前 crew agent 私有）、workspace（用户安装和创建）、my_library（平台「我的技能库」，含未安装项）。同名时优先级：system > crew > workspace；my_library 项需安装到 workspace 后方可使用。-->
Source filter. Options: all (default), system (agents/skills project built-in), crew (current crew-agent private), workspace (user-installed and custom), my_library (platform skill library, including uninstalled skills). Same-name priority: system > crew > workspace; my_library skills must be installed to workspace before use.""",
    )


@tool()
class SkillList(BaseTool[SkillListParams]):
    """<!--zh
    列出所有可用 skill，包含：system（agents/skills）、crew 私有 skill、workspace skill（skillhub 安装 + 用户创建）以及平台「我的技能库」（含未安装项）。
    同名解析优先级：system > crew > workspace；my_library 项需安装到 workspace 后方可使用，已安装项会标注。
    低优先级来源上的同名项会标注 shadow（与 SkillManager 加载顺序一致）。
    每个 skill 标注来源和是否可被覆盖（system 不可覆盖；crew / workspace / my_library 可被更高优先级同名项覆盖）。
    my_library 中未安装（installed=False）的 skill 可通过 shell_exec 执行 skillhub install-platform-me <code> 安装到 workspace，code 字段即为所需参数。
    在创建新 skill 前，建议先调用此工具检查是否存在同名 skill。
    -->
    Lists all available skills: system (agents/skills), crew private, workspace (skillhub-installed and custom), and platform my_library (including uninstalled skills).
    Same-name resolution priority: system > crew > workspace; my_library skills must be installed to workspace before use; already-installed ones are labeled.
    Lower-priority duplicates are labeled as shadowed (matches SkillManager search order).
    Each entry shows source and can_override (system: false; crew/workspace/my_library: true unless shadowed).
    To install an uninstalled my_library skill (installed=False), run: shell_exec(command="skillhub install-platform-me <code>") where code is the skill's code field.
    Before creating a new skill, it is recommended to call this tool first to check for name conflicts.
    """

    async def execute(self, tool_context: ToolContext, params: SkillListParams) -> ToolResult:
        source_filter = params.source.strip().lower() if params.source else "all"
        if source_filter not in _VALID_SOURCES:
            source_filter = "all"

        skills: List[SkillItem] = []
        system_skills: List[SkillItem] = []
        crew_skills: List[SkillItem] = []
        workspace_skills: List[SkillItem] = []

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
            workspace_skills = await self._list_workspace_skills()
            if source_filter == "all":
                higher_priority_names = {s.name for s in system_skills} | {s.name for s in crew_skills}
            else:
                system_skills = await self._list_system_skills()
                crew_skills = await self._list_crew_skills()
                higher_priority_names = {s.name for s in system_skills} | {s.name for s in crew_skills}
            for ws in workspace_skills:
                if ws.name in higher_priority_names:
                    ws.note = _SHADOW_SAME_NAME_NOTE
                skills.append(ws)

        if source_filter in ("all", "my_library"):
            if not workspace_skills:
                workspace_skills = await self._list_workspace_skills()
            workspace_names = {s.name for s in workspace_skills}
            my_library = await self._list_my_library_skills()
            for item in my_library:
                item.installed = item.name in workspace_names
                if item.installed:
                    item.note = _MY_LIBRARY_INSTALLED_NOTE
                skills.append(item)

        if not skills:
            return ToolResult(content="No skills found.")

        lines = [
            "Priority: system > crew > workspace (same name resolves to the highest source). my_library skills must be installed to workspace before use.\n",
            f"Total: {len(skills)} skill(s)\n",
        ]
        for s in skills:
            line = f"[{s.source}] {s.name}  can_override={s.can_override}"
            if s.code is not None:
                line += f"  code={s.code}"
            if s.installed is not None:
                line += f"  installed={s.installed}"
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

    async def _list_my_library_skills(self) -> List[SkillItem]:
        """从平台「我的技能库」获取最多 200 个技能，失败时降级为空列表"""
        try:
            sdk = get_magic_service_sdk()
            parameter = GetLatestPublishedSkillVersionsParameter(
                page=1,
                page_size=100,
            )
            result = await sdk.skill.query_latest_published_versions_async(parameter)
            results = [
                SkillItem(
                    name=item.package_name or item.name,
                    source="my_library",
                    can_override=True,
                    description=item.description,
                    path="",
                    code=item.code,
                )
                for item in result.get_items()
            ]
            results.sort(key=lambda x: x.name)
            logger.info(f"my_library skills: {len(results)} 个")
            return results
        except Exception as e:
            logger.warning(f"获取我的技能库失败，跳过: {e}")
            return []

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
