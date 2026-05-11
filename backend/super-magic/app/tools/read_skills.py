"""Read Skills Tool - 批量读取项目 skills 的完整内容"""

import asyncio
from pathlib import Path

from app.i18n import i18n
from typing import Any, Dict, List, Optional, Tuple

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_manager import get_global_skill_manager, find_skill

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


@tool()
class ReadSkills(BaseTool[ReadSkillsParams]):
    """<!--zh
    批量读取项目 skills 的完整内容工具
    用于一次性加载多个 skill 的详细使用说明、示例和参考文档

    强烈建议在需要读取多个 skills 时使用此工具一次性读取，而非多次调用工具逐个读取，这将会极大提升任务效率
    -->
    Tool for batch reading the complete content of project skills
    Used to load detailed skill instructions, examples, and reference documentation for multiple skills at once

    Strongly recommended to use this tool for batch reading multiple skills at once, rather than calling tools multiple times individually, which will greatly improve task efficiency
    """

    async def execute(self, tool_context: ToolContext, params: ReadSkillsParams) -> ToolResult:
        """执行批量读取工具逻辑

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含 skill_names 列表

        Returns:
            ToolResult: 工具执行结果
        """
        if not params.skill_names:
            error_msg = "skill_names 列表不能为空"
            return ToolResult(ok=False, content=error_msg)

        # 获取当前 agent 的 excluded_skills，确保被禁用的 skill 无法通过任何方式加载
        excluded_skills: set = set()
        agent_context = tool_context.get_extension("agent_context")
        if agent_context and hasattr(agent_context, "get_excluded_skills"):
            excluded_skills = set(agent_context.get_excluded_skills())

        try:
            # 批量读取所有 skills
            results = []
            success_count = 0
            failure_count = 0
            failed_skills = []

            for skill_name in params.skill_names:
                # 被禁用的 skill 直接拒绝，不尝试查找或读取
                if skill_name in excluded_skills:
                    results.append({"skill_name": skill_name, "success": False, "error": f"Skill '{skill_name}' is disabled for the current agent and cannot be loaded."})
                    failure_count += 1
                    failed_skills.append(skill_name)
                    logger.info(f"拒绝读取被禁用的 skill: {skill_name}")
                    continue
                try:
                    skill = await find_skill(skill_name)

                    # s3 挂载有延迟，首次找不到时等待 2s 后重试一次
                    if not skill:
                        logger.warning(f"Skill 未找到，2s 后重试: {skill_name}")
                        await asyncio.sleep(2)
                        skill = await find_skill(skill_name)

                    if not skill:
                        error_msg = f"未找到名为 '{skill_name}' 的 skill"
                        results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                        failure_count += 1
                        failed_skills.append(skill_name)
                        logger.warning(f"Skill 不存在: {skill_name}")
                        continue

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

                    skill_output_parts += [skill.content, "</skill_content>"]

                    skill_content = "\n".join(skill_output_parts)

                    actual_skill_dir = skill.skill_dir or (
                        Path(skill.skill_file).parent if skill.skill_file else None
                    )
                    results.append({
                        "skill_name": skill_name,
                        "success": True,
                        "content": skill_content,
                        "skill_dir_path": actual_skill_dir,
                    })
                    success_count += 1
                    logger.info(f"成功读取 skill: {skill_name}")

                except Exception as e:
                    logger.error(f"读取 skill '{skill_name}' 时出错: {e}")
                    import traceback

                    logger.error(traceback.format_exc())

                    error_msg = f"读取 skill '{skill_name}' 失败: {str(e)}"
                    results.append({"skill_name": skill_name, "success": False, "error": error_msg})
                    failure_count += 1
                    failed_skills.append(skill_name)

            # 并发检查版本更新，有更新时推送 horizon 通知
            # 若调用方明确传入 check_updates=False（用户已忽略或拒绝更新），则跳过检查
            if params.check_updates:
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
                ok=True,
                content=content,
                extra_info={"success_count": success_count, "failure_count": failure_count},
            )

        except Exception as e:
            logger.error(f"批量读取 skills 时出错: {e}")
            import traceback

            logger.error(traceback.format_exc())

            error_msg = f"批量读取 skills 失败: {str(e)}"
            result = ToolResult(ok=False, content=error_msg)
            result.use_custom_remark = True
            return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """根据 extra_info 里的计数和 arguments 里的名称生成 remark"""
        extra = result.extra_info or {}
        success_count = extra.get("success_count", 0)
        failure_count = extra.get("failure_count", 0)
        skill_names: List[str] = (arguments or {}).get("skill_names", [])

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
        if not result.ok:
            # 只有 skill_names 为空时才走这里
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
        from app.core.skill_utils.providers.registry import get_registry
        from app.core.skill_utils.providers.base import SkillProviderId

        async def check_one(skill_name: str, skill_dir: Path) -> Optional[Tuple[str, str, str]]:
            """检查单个 skill 版本，返回 (skill_name, current_version, latest_version) 或 None。"""
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

                return skill_name, manifest.version, latest
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
                for skill_name, current_ver, latest_ver in updates
            )
            lines = [
                f"New versions are available for the following skills: {skill_list}.",
                "You may use the ask_user tool to check with the user whether they would like to update. "
                "If confirmed, call install_skills to perform the update. "
                "If the user declines or ignores the update, pass check_updates=false in all subsequent read_skills calls to suppress further update checks.",
            ]

            self.get_horizon(tool_context).push_notification(
                "skill_update_checker",
                "\n".join(lines),
            )
        except Exception as e:
            logger.warning(f"版本更新检查失败: {e}")
