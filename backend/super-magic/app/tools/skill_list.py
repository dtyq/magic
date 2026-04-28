"""Skill List Tool - 列出所有来源的可用 skill"""

from app.i18n import i18n
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_utils.manager import GlobalSkillManager
from app.core.skill_utils.skill_directory_scan import (
    discover_skills_in_directory,
    discover_skills_in_workspace,
)
from app.path_manager import PathManager
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.get_latest_published_skill_versions_parameter import (
    GetLatestPublishedSkillVersionsParameter,
)

logger = get_logger(__name__)

# source 过滤参数合法值（与 skill_sources 中 system_skills 对应）
_VALID_SOURCES = {"all", "system", "crew", "workspace", "my_skill_library"}

# 同名 skill 解析优先级（与 GlobalSkillManager.get_skills_dirs 目录顺序一致）
# system（agents/skills）> crew > workspace；my_skill_library 项需安装到 workspace 后才可使用
_SHADOW_SAME_NAME_NOTE = "shadowed by higher-priority source"


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
        description="""<!--zh: 来源过滤，可选值：all（全部）、system（agents/skills 项目内置）、crew（当前 crew agent 私有）、workspace（用户安装和创建）、my_skill_library（平台「我的技能库」，含未安装项）。同名时优先级：system > crew > workspace；my_skill_library 项需安装到 workspace 后方可使用。-->
Source filter. Options: all (default), system (built-in), crew (current crew-agent private), workspace (user-installed and custom), my_skill_library (platform skill library, including uninstalled). Same-name priority: system > crew > workspace; my_skill_library skills must be installed to workspace before use.""",
    )


@tool()
class SkillList(BaseTool[SkillListParams]):
    """<!--zh
    列出所有可用 skill，包含：system（agents/skills）、crew 私有 skill、workspace skill（skillhub 安装 + 用户创建）以及平台「我的技能库」（含未安装项）。
    同名解析优先级：system > crew > workspace；my_skill_library 项需安装到 workspace 后方可使用。
    低优先级来源上的同名项会标注 note="shadowed by higher-priority source"。
    my_skill_library 中未安装（installed="false"）的 skill 可通过 shell_exec 执行 skillhub install-platform-me <code> 安装到 workspace。
    在创建新 skill 前，建议先调用此工具检查是否存在同名 skill。
    -->
    Lists all available skills: system (built-in), crew (private), workspace (skillhub-installed and custom), and my_skill_library (platform library, including uninstalled).
    Same-name priority: system > crew > workspace; my_skill_library skills must be installed to workspace before use.
    Lower-priority duplicates are labeled with note="shadowed by higher-priority source".
    To install an uninstalled my_skill_library skill (installed="false"): shell_exec(command="skillhub install-platform-me <code>").
    Before creating a new skill, call this tool first to check for name conflicts.
    """

    async def execute(self, tool_context: ToolContext, params: SkillListParams) -> ToolResult:
        source_filter = params.source.strip().lower() if params.source else "all"
        if source_filter not in _VALID_SOURCES:
            source_filter = "all"

        # 从当前 agent 上下文中读取 excluded_skills，保证多 agent 实例隔离
        excluded_system_skills: set = set()
        agent_context = tool_context.get_extension("agent_context")
        if agent_context and hasattr(agent_context, "get_excluded_skills"):
            excluded_system_skills = set(agent_context.get_excluded_skills())

        skills: List[SkillItem] = []
        system_skills: List[SkillItem] = []
        crew_skills: List[SkillItem] = []
        workspace_skills: List[SkillItem] = []

        if source_filter in ("all", "system"):
            system_skills = await self._list_system_skills(excluded_system_skills)
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

        if source_filter in ("all", "my_skill_library"):
            if not workspace_skills:
                workspace_skills = await self._list_workspace_skills()
            workspace_names = {s.name for s in workspace_skills}
            existing_names = {s.name for s in skills}
            my_library = await self._list_my_library_skills()
            for item in my_library:
                if item.name in existing_names:
                    continue
                item.installed = item.name in workspace_names
                skills.append(item)

        if not skills:
            return ToolResult(content="No skills found.")

        # 按来源分组，保持优先级顺序输出
        groups: Dict[str, List[SkillItem]] = {}
        for s in skills:
            groups.setdefault(s.source, []).append(s)

        lines = ['<skills priority="system > crew > workspace; my_skill_library items must be installed to workspace before use">']
        for source in ["system", "crew", "workspace", "my_skill_library"]:
            items = groups.get(source, [])
            if not items:
                continue
            lines.append(f'  <{source} count="{len(items)}">')
            for s in items:
                attrs = f'name="{s.name}"'
                if s.code is not None:
                    attrs += f' code="{s.code}"'
                if s.installed is not None:
                    attrs += f' installed="{str(s.installed).lower()}"'
                if s.description:
                    attrs += f' description="{s.description.replace(chr(34), "&quot;")}"'
                if s.note:
                    attrs += f' note="{s.note}"'
                lines.append(f'    <skill {attrs} />')
            lines.append(f'  </{source}>')
        lines.append('</skills>')

        return ToolResult(content="\n".join(lines))

    async def _list_system_skills(self, excluded: set = None) -> List[SkillItem]:
        """列出 agents/skills/ 目录下的 system skill（与 skill_sources.system_skills 一致）"""
        system_dir = PathManager.get_agents_dir() / "skills"
        metas = await discover_skills_in_directory(system_dir)
        excluded_set = excluded or set()
        results = [
            SkillItem(
                name=meta.name,
                source="system",
                can_override=False,
                description=meta.description,
                path=str(meta.skill_dir / "SKILL.md") if meta.skill_dir else "",
            )
            for meta in metas
            if meta.name not in excluded_set
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

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        """为前端提供标准工具详情，避免 skill_list 只在模型上下文中可见。"""
        if not result.content:
            return None

        source = (arguments or {}).get("source", "all")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=f"skill_list_{source}.md",
                content=f"```xml\n{result.content}\n```",
            ),
        )

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
                    source="my_skill_library",
                    can_override=True,
                    description=item.description,
                    path="",
                    code=item.code,
                )
                for item in result.get_items()
                if item.source_type != "SYSTEM"
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
