"""Read Skills Tool - 批量读取可用 skills 的完整内容"""

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.core.skill_manager import find_skill
from app.core.skill_utils.constants import SKILL_MAX_TOKENS, SKILL_READ_LIMIT_NOTICE
from app.core.skill_utils.referenced_project_skills import (
    find_referenced_project_skill,
    get_referenced_project_skills_dir,
    is_referenced_project_bound,
    missing_workspace_skill_hint,
)
from app.core.skill_utils.skill_sources import get_personal_skills_dir
from app.i18n import i18n
from app.tools.core import AutoMount, BaseTool, BaseToolParams, tool
from app.tools.core.base_tool import ToolResultContentMode
from app.tools.read_files import FileReadOperation, ReadFiles, ReadFilesParams
from app.tools.read_skills_hooks import (
    SkillLoadedHookContext,
    notify_skill_loaded,
)

logger = get_logger(__name__)


class ReadSkillsParams(BaseToolParams):
    """Read Skills 工具参数"""

    skill_names: List[str] = Field(
        ...,
        description="""<!--zh: 要读取的 skill 名称列表，例如：["canvas-design", "audio-chat"]-->
The list of skill names to read, e.g., ["canvas-design", "audio-chat"]""",
        min_length=1,
    )

    check_updates: bool = Field(
        default=True,
        description="""<!--zh: 是否检查 skill 版本更新，默认为 true。若用户已明确表示不更新或忽略更新提醒，后续调用时应传 false 以跳过版本检查。-->
Whether to check for skill version updates. Defaults to true. If the user has explicitly declined or ignored the update reminder, pass false in subsequent calls to skip the version check.""",
    )

    project_id: Optional[str] = Field(
        default=None,
        description="""<!--zh: 读取 @micro_app / @project 业务 skill 时必填。从 mention 复制已绑定/已挂载的引用项目 ID；第一次调用就必须带上。传入后只读取该项目 `.magic/skills/`，不回退到当前工作区（含微应用 runtime project）同名 skill。系统或当前工作区 skill 不要传。禁止编造。-->
Required when loading a companion skill from a `@micro_app` or `@project` mention: copy the bound/mounted referenced-project id and pass it on the first call. When set, read only that project's `.magic/skills/` and never fall back to a same-named skill in the current workspace, including a micro-app runtime project. Omit this for system or current-workspace skills. Do not invent it.""",
    )

    @field_validator("skill_names", mode="before")
    @classmethod
    def normalize_skill_names(cls, value: Any) -> Any:
        """兼容模型把单个 skill 名称误传为字符串的情况。"""
        if isinstance(value, str):
            names = [item.strip() for item in value.split(",") if item.strip()]
            if names:
                return names
        return value

    @field_validator("project_id", mode="before")
    @classmethod
    def normalize_project_id(cls, value: Any) -> Any:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


# hook 在返回前执行，必须交付完整指令；此豁免不代表已有安全预算。
@tool(auto_mount=AutoMount.SKILLS, result_content_mode=ToolResultContentMode.INSTRUCTION)
class ReadSkills(BaseTool[ReadSkillsParams]):
    """<!--zh
    批量读取可用 skills 的完整内容工具
    用于一次性加载多个 skill 的详细使用说明、示例和参考文档

    强烈建议在需要读取多个 skills 时使用此工具一次性读取，而非多次调用工具逐个读取，这将会极大提升任务效率
    -->
    Tool for batch reading the complete content of available skills
    Used to load detailed skill instructions, examples, and reference documentation for multiple skills at once

    Strongly recommended to use this tool for batch reading multiple skills at once, rather than calling tools multiple times individually, which will greatly improve task efficiency
    """

    async def execute(self, tool_context: ToolContext | None, params: ReadSkillsParams) -> ToolResult:
        """执行批量读取工具逻辑

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含 skill_names 列表

        Returns:
            ToolResult: 工具执行结果
        """
        if not params.skill_names:
            error_msg = "skill_names must not be empty"
            return ToolResult(ok=False, content=error_msg)

        project_id = params.project_id
        if project_id and not await is_referenced_project_bound(project_id):
            error_msg = (
                f"project_id '{project_id}' is not in the bound or mounted referenced-project set. "
                "Copy project_id from a @micro_app or @project mention; do not invent IDs."
            )
            return ToolResult(ok=False, content=error_msg)

        # 获取当前 agent 的 excluded_skills，确保被禁用的 skill 无法通过任何方式加载
        agent_context = (
            tool_context.get_extension_typed("agent_context", AgentContext)
            if tool_context is not None
            else None
        )
        agent_name = agent_context.agent_name if agent_context is not None else None
        excluded_skills = {
            value.strip().casefold()
            for value in (
                agent_context.get_excluded_skills()
                if agent_context is not None
                else []
            )
            if value.strip()
        }

        try:
            # 批量读取所有 skills
            results = []
            success_count = 0
            failure_count = 0
            failed_skills = []
            pending_confirmation_count = 0
            read_files_tool = ReadFiles()

            for skill_name in params.skill_names:
                # 被禁用的 skill 直接拒绝，不尝试查找或读取
                if skill_name.strip().casefold() in excluded_skills:
                    results.append({"skill_name": skill_name, "success": False, "error": f"Skill '{skill_name}' is disabled for the current agent and cannot be loaded."})
                    failure_count += 1
                    failed_skills.append(skill_name)
                    logger.info(f"拒绝读取被禁用的 skill: {skill_name}")
                    continue
                try:
                    if project_id:
                        skill = await find_referenced_project_skill(skill_name, project_id)
                    else:
                        skill = await find_skill(skill_name, agent_name=agent_name)

                    # s3 挂载有延迟，首次找不到时等待 2s 后重试一次
                    if not skill:
                        should_retry = True
                        if project_id and await get_referenced_project_skills_dir(project_id) is not None:
                            should_retry = False
                        if should_retry:
                            logger.warning(f"Skill 未找到，2s 后重试: {skill_name}")
                            await asyncio.sleep(2)
                            if project_id:
                                skill = await find_referenced_project_skill(skill_name, project_id)
                            else:
                                skill = await find_skill(skill_name, agent_name=agent_name)

                    # A market-declared skill may be installed lazily on first read.
                    if not skill and not project_id:
                        from app.core.skill_utils.skill_references import install_market_reference

                        try:
                            declared = await install_market_reference(
                                skill_name, agent_name or "", agent_context, tool_context
                            )
                            if declared:
                                skill = await find_skill(skill_name, agent_name=agent_name)
                        except Exception:
                            results.append({
                                "skill_name": skill_name,
                                "success": False,
                                "error": (
                                    f"Skill '{skill_name}' is declared but could not be fetched. "
                                    "Access may have changed or the package may be unavailable."
                                ),
                            })
                            failure_count += 1
                            failed_skills.append(skill_name)
                            continue

                    if (
                        skill is not None
                        and skill.name.strip().casefold() in excluded_skills
                    ):
                        results.append({"skill_name": skill_name, "success": False, "error": f"Skill '{skill_name}' is disabled for the current agent and cannot be loaded."})
                        failure_count += 1
                        failed_skills.append(skill_name)
                        logger.info(f"拒绝读取被禁用的 skill: {skill_name}")
                        continue

                    if not skill:
                        if project_id:
                            error_msg = (
                                f"Skill '{skill_name}' was not found in referenced project "
                                f"'{project_id}' .magic/skills/. Do not fall back to workspace "
                                "or system skills with the same name."
                            )
                        else:
                            error_msg = await missing_workspace_skill_hint(skill_name)
                        results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                        failure_count += 1
                        failed_skills.append(skill_name)
                        logger.warning(f"Skill 不存在: {skill_name}")
                        continue

                    if not skill.skill_file:
                        raise ValueError(f"Skill '{skill.name}' has no source file")
                    file_result = await read_files_tool.execute(
                        tool_context,
                        ReadFilesParams(operations=[FileReadOperation(
                            file_path=str(skill.skill_file), offset=0, limit=-1,
                        )]),
                        max_tokens=SKILL_MAX_TOKENS,
                        allow_fuzzy_match=False,
                        apply_batch_limit=False,
                        use_context_budget=False,
                    )
                    if not file_result.ok or not file_result.extra_info["file_results"][0]["is_success"]:
                        raise ValueError(file_result.content)
                    needs_confirmation: bool = file_result.extra_info["file_results"][0]["was_truncated"]

                    # 构建单个 skill 的输出，使用 XML 标签包裹
                    skill_output_parts = [
                        f"Loading: {skill.name}",
                        "",
                        f'<skill_content name="{skill.name}">',
                    ]

                    location = skill.skill_file or skill.skill_dir
                    skill_dir = skill.skill_dir or (str(Path(skill.skill_file).parent) if skill.skill_file else None)
                    if location:
                        skill_output_parts.append(f"<location>{location}</location>")
                    if skill_dir:
                        skill_output_parts.append(f"<skill_dir>{skill_dir}</skill_dir>")
                    if location or skill_dir:
                        skill_output_parts.append("")

                    if needs_confirmation:
                        skill_output_parts.append(SKILL_READ_LIMIT_NOTICE)
                    skill_output_parts += [file_result.content, "</skill_content>"]

                    skill_content = "\n".join(skill_output_parts)

                    actual_skill_dir = skill.skill_dir or (
                        Path(skill.skill_file).parent if skill.skill_file else None
                    )
                    await notify_skill_loaded(
                        SkillLoadedHookContext(
                            requested_skill_name=skill_name,
                            resolved_skill_name=skill.name,
                            location=str(location) if location else None,
                            skill_dir=Path(actual_skill_dir) if actual_skill_dir else None,
                            tool_context=tool_context,
                            agent_context=agent_context,
                        )
                    )
                    results.append({
                        "skill_name": skill_name,
                        "success": True,
                        "content": skill_content,
                        "location": str(location) if location else None,
                        "skill_dir": str(skill_dir) if skill_dir else None,
                        "skill_dir_path": actual_skill_dir,
                        "needs_confirmation": needs_confirmation,
                    })
                    if needs_confirmation:
                        pending_confirmation_count += 1
                    success_count += 1
                    logger.info(f"成功读取 skill: {skill_name}")

                except Exception as e:
                    logger.error(f"读取 skill '{skill_name}' 时出错: {e}")
                    import traceback

                    logger.error(traceback.format_exc())

                    error_msg = f"Failed to read Skill '{skill_name}': {e!s}"
                    results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                    failure_count += 1
                    failed_skills.append(skill_name)

            # 并发检查版本更新，有更新时推送 horizon 通知
            # 若调用方明确传入 check_updates=False（用户已忽略或拒绝更新），则跳过检查
            # 引用项目 skill 只读、无安装来源，跳过版本检查
            if params.check_updates and not project_id and tool_context is not None:
                skill_update_targets: List[Tuple[str, Path]] = [
                    (r["skill_name"], r["skill_dir_path"])
                    for r in results
                    if r["success"] and r.get("skill_dir_path") is not None
                ]
                if skill_update_targets:
                    try:
                        await asyncio.wait_for(
                            self._check_skill_updates(tool_context, skill_update_targets),
                            timeout=10.0,
                        )
                    except asyncio.TimeoutError:
                        logger.debug("版本更新检查整体超时，跳过")
                    except Exception as e:
                        logger.debug(f"版本更新检查异常: {e}")

            # 构建最终输出
            output_parts = []

            total_count = len(params.skill_names)
            is_single_skill = total_count == 1 and success_count == 1

            # 多个 Skill 时添加摘要
            if not is_single_skill:
                summary_parts = [f"Batch loading {total_count} Skills"]
                if success_count > 0:
                    summary_parts.append(f"succeeded: {success_count}")
                if failure_count > 0:
                    summary_parts.append(f"failed: {failure_count}")
                output_parts.append(" | ".join(summary_parts))
                output_parts.append("")

            # 先列出失败信息
            if failed_skills:
                output_parts.append("Failed Skills:")
                for result in results:
                    if not result["success"]:
                        output_parts.append(f"  - {result['skill_name']}: {result['error']}")
                output_parts.append("")

            # 添加成功的 Skill 内容
            first_success = True
            for result in results:
                if result["success"]:
                    if not first_success and not is_single_skill:
                        output_parts.append("")
                        output_parts.append("=" * 80)
                        output_parts.append("")
                    first_success = False
                    output_parts.append(result["content"])

            content = "\n".join(output_parts)

            return ToolResult(
                ok=success_count > 0,
                content=content,
                extra_info={
                    "success_count": success_count,
                    "failure_count": failure_count,
                    "pending_confirmation_count": pending_confirmation_count,
                    "skill_names": params.skill_names,
                    "md_content": _format_result_md(results, len(params.skill_names), success_count, failure_count),
                },
            )

        except Exception as e:
            logger.error(f"批量读取 skills 时出错: {e}")
            import traceback

            logger.error(traceback.format_exc())

            error_msg = f"Failed to read Skills: {e!s}"
            result = ToolResult(ok=False, content=error_msg)
            result.use_custom_remark = True
            return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """根据 extra_info 里的计数和 arguments 里的名称生成 remark"""
        extra = result.extra_info or {}
        success_count = extra.get("success_count", 0)
        failure_count = extra.get("failure_count", 0)
        skill_names: List[str] = (arguments or {}).get("skill_names", [])

        if extra.get("pending_confirmation_count", 0):
            return i18n.translate(
                "read_skills.awaiting_read_confirmation", category="tool.messages",
                count=extra["pending_confirmation_count"],
            )

        if failure_count == 0:
            # 全部成功
            if success_count == 1:
                return i18n.translate(
                    "read_skills.success_single",
                    category="tool.messages",
                    skill_name=skill_names[0] if skill_names else "",
                )
            if success_count > 1:
                return i18n.translate("read_skills.success_multiple", category="tool.messages", count=success_count)
        elif success_count == 0:
            # 全部失败
            if failure_count == 1:
                return i18n.translate(
                    "read_skills.fail_single",
                    category="tool.messages",
                    skill_name=skill_names[0] if skill_names else "",
                )
            return i18n.translate("read_skills.fail_multiple", category="tool.messages", count=failure_count)
        else:
            # 部分成功
            return i18n.translate(
                "read_skills.partial",
                category="tool.messages",
                success_count=success_count,
                failure_count=failure_count,
            )

        return i18n.translate("read_skills.success", category="tool.messages")

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        extra = result.extra_info or {}
        md_content = extra.get("md_content")
        if not md_content:
            return None
        skill_names = extra.get("skill_names", [])
        file_name = f"read_skills_{_safe_file_name('_'.join(skill_names) or 'all')}.md"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=file_name,
                content=md_content,
            ),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """获取工具调用后的友好动作和备注"""
        action = i18n.translate(tool_name, category="tool.actions")
        if not result.ok and not result.extra_info:
            # 尚未形成逐项结果时使用通用失败说明。
            remark = i18n.translate("read_skills.error", category="tool.messages")
        else:
            remark = self._get_remark_content(result, arguments)
        return {"action": action, "remark": remark}

    async def _check_skill_updates(
        self,
        tool_context: ToolContext,
        skill_dirs: List[Tuple[str, Path]],
    ) -> None:
        """并发检查已读 skill 的版本更新，有更新时通过 horizon 推送通知。

        每个检查独立容错，整体不超过 8 秒。任何异常只 debug log，不影响主流程。
        """
        from app.core.skill_utils.manifest import read_manifest
        from app.core.skill_utils.providers.base import SkillProviderId
        from app.core.skill_utils.providers.registry import get_registry

        async def check_one(skill_name: str, skill_dir: Path) -> Optional[Tuple[str, str, str, str]]:
            """检查单个 skill 版本，返回名称、版本和原安装范围。"""
            try:
                manifest = await asyncio.to_thread(read_manifest, skill_dir)
                if not manifest or not manifest.source_id or manifest.version == "unknown":
                    return None

                try:
                    provider_id = SkillProviderId(manifest.provider)
                except ValueError:
                    return None

                registry = get_registry()
                try:
                    provider = registry.get(provider_id)
                except KeyError:
                    return None

                if not provider.enabled:
                    return None

                latest = await asyncio.wait_for(
                    provider.resolve_latest(manifest.source_id),
                    timeout=8.0,
                )

                if latest is None or latest == "unknown" or latest == manifest.version:
                    return None

                return skill_name, manifest.version, latest, _get_install_scope(skill_dir)
            except asyncio.TimeoutError:
                logger.warning(f"检查 skill '{skill_name}' 版本超时")
                return None
            except Exception as e:
                logger.warning(f"检查 skill '{skill_name}' 版本时出错: {e}")
                return None

        try:
            tasks = [check_one(name, d) for name, d in skill_dirs]
            check_results = await asyncio.gather(*tasks, return_exceptions=True)

            updates = [r for r in check_results if isinstance(r, tuple)]
            if not updates:
                return

            skill_list = ", ".join(
                f"{skill_name} ({current_ver} -> {latest_ver})"
                for skill_name, current_ver, latest_ver, _scope in updates
            )
            scope_list = ", ".join(
                f"{skill_name}={scope}"
                for skill_name, _current_ver, _latest_ver, scope in updates
            )
            lines = [
                f"New versions are available for the following skills: {skill_list}.",
                "You may use the ask_user tool to check with the user whether they would like to update. "
                "If confirmed, call install_skills to perform the update and preserve each skill's current installation scope. "
                f"Set scope on each install item as follows: {scope_list}. "
                "If the user declines or ignores the update, pass check_updates=false in all subsequent read_skills calls to suppress further update checks.",
            ]

            self.get_horizon(tool_context).push_notification(
                "skill_update_checker",
                "\n".join(lines),
            )
        except Exception as e:
            logger.warning(f"版本更新检查失败: {e}")


# ── Markdown 展示格式（供 get_tool_detail 渲染，与给模型的 XML 完全独立） ────────


def _format_result_md(results: List[Dict[str, Any]], total_count: int, success_count: int, failure_count: int) -> str:
    lines: List[str] = []

    if total_count == 1 and success_count == 1:
        lines.append("已读取 **1** 个 Skill\n")
    else:
        lines.append(f"共请求 **{total_count}** 个 Skill，成功 **{success_count}** 个，失败 **{failure_count}** 个\n")

    failed_results = [r for r in results if not r.get("success")]
    if failed_results:
        lines.append("---\n\n### 读取失败\n")
        for result in failed_results:
            lines.append(f"- **{result.get('skill_name', '')}**：{result.get('error', '')}")
        lines.append("")

    success_results = [r for r in results if r.get("success")]
    for index, result in enumerate(success_results):
        if index > 0 or failed_results:
            lines.append("---\n")

        skill_name = result.get("skill_name", "")
        lines.append(f"## {skill_name}\n")

        location = result.get("location")
        skill_dir = result.get("skill_dir")
        meta_lines = []
        if location:
            meta_lines.append(f"- 位置：`{location}`")
        if skill_dir and skill_dir != location:
            meta_lines.append(f"- 目录：`{skill_dir}`")
        if meta_lines:
            lines.extend(meta_lines)
            lines.append("")

        if result.get("needs_confirmation"):
            lines.append(i18n.translate(
                "read_skills.awaiting_read_confirmation", category="tool.messages", count=1,
            ))
        else:
            lines.append("已成功读取。")
        lines.append("")

    return "\n".join(lines).strip()


def _safe_file_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name)


def _get_install_scope(skill_dir: Path) -> str:
    """根据 Skill 目录判断升级时应保持的安装范围。"""
    try:
        if Path(skill_dir).is_relative_to(get_personal_skills_dir()):
            return "personal"
    except (TypeError, ValueError):
        pass
    return "workspace"
