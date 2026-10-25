"""
应用层工具验证器实现

提供 ToolValidatorProtocol 的具体实现，处理工具存在性和可用性验证
"""

from typing import Dict, List

from agentlang.logger import get_logger
from agentlang.tools.validator import ToolValidatorProtocol
from app.core.tool_names import resolve_tool_names
from app.tools.core.tool_factory import tool_factory
from app.tools.remote.remote_tool_manager import remote_tool_manager

logger = get_logger(__name__)

# 这里只兼容历史 `.agent` 的工具挂载声明，不放宽 Agent 定义、身份模式或 Claw 编译错误。


class AppToolValidator(ToolValidatorProtocol):
    """应用层工具验证器

    检查工具是否存在且可用；不能直接挂载的声明按配置严格拒绝或记录 warning 后忽略
    使用轻量级检查，避免在初始化时加载所有工具类
    """

    def __init__(
        self,
        *,
        ignore_invalid_declarations: bool = False,
        agent_name: str = "",
    ) -> None:
        self._ignore_invalid_declarations = ignore_invalid_declarations
        self._agent_name = agent_name

    def filter_valid_tools(self, tools_definition: Dict[str, Dict]) -> Dict[str, Dict]:
        """过滤无效工具，返回有效工具定义

        Args:
            tools_definition: 原始工具定义字典

        Returns:
            Dict[str, Dict]: 过滤后的有效工具字典
        """
        ignored_tools: Dict[str, str] = {}

        # 先做废弃工具的兼容性重映射，再走后续验证逻辑
        remapped: Dict[str, Dict] = {}
        for tool_name, tool_config in tools_definition.items():
            current_names = (
                (tool_name,)
                if remote_tool_manager.is_remote_tool(tool_name)
                else resolve_tool_names(tool_name)
            )
            for current_name in current_names:
                # 显式当前配置优先；拆分或补出的工具用默认配置，不能继承旧工具参数。
                if current_name != tool_name and current_name in tools_definition:
                    continue
                if current_name not in remapped:
                    remapped[current_name] = (
                        tool_config if current_name == tool_name or len(current_names) == 1 else {}
                    )

        code_mode_only_tools: List[str] = []
        auto_mount_tools: List[str] = []
        for tool_name in remapped:
            if remote_tool_manager.is_remote_tool(tool_name):
                continue

            tool_info = tool_factory.get_tool(tool_name)
            if tool_info is not None and tool_info.code_mode_only:
                code_mode_only_tools.append(tool_name)
            if tool_info is not None and tool_info.auto_mount is not None:
                auto_mount_tools.append(tool_name)

        if code_mode_only_tools:
            invalid_tools = ", ".join(
                f"'{tool_name}'" for tool_name in sorted(code_mode_only_tools)
            )
            error_message = (
                f"Code Mode Only 工具不能在 .agent 的 tools 中显式声明: {invalid_tools}。"
                "请从 tools 中删除，并通过对应 Skill 使用 "
                "run_sdk_snippet + sdk.tool.call() 调用。"
            )
            self._reject_or_ignore_invalid_tools(
                remapped=remapped,
                tool_names=code_mode_only_tools,
                error_message=error_message,
                ignored_tools=ignored_tools,
                ignore_reason="仅支持通过 Code Mode 调用",
                warning_message=(
                    f".agent 工具配置中包含仅能通过 Code Mode 使用的工具：{invalid_tools}。"
                    "这些工具不应列在 tools 中，应由对应 Skill 通过 run_sdk_snippet 调用。"
                    "为了兼容已有配置，本次忽略这些声明，Agent 继续初始化。"
                ),
            )

        if auto_mount_tools:
            invalid_tools = ", ".join(
                f"'{tool_name}'" for tool_name in sorted(auto_mount_tools)
            )
            error_message = (
                f"运行时自动挂载工具不能在 .agent 的 tools 中显式声明: {invalid_tools}。"
                "请从 tools 中删除；实际挂载时机由 @tool(auto_mount=...) 控制。"
            )
            self._reject_or_ignore_invalid_tools(
                remapped=remapped,
                tool_names=auto_mount_tools,
                error_message=error_message,
                ignored_tools=ignored_tools,
                ignore_reason="由运行时自动挂载，不允许在 Agent 中显式声明",
                warning_message=(
                    f".agent 工具配置中包含由运行时自动提供的工具：{invalid_tools}。"
                    "这些工具不需要列在 tools 中，运行时会自动挂载。"
                    "为了兼容已有配置，本次忽略这些声明，Agent 继续初始化。"
                ),
            )

        valid_tools = {}

        for tool_name in remapped.keys():
            try:
                # 检查是否是远程工具
                if remote_tool_manager.is_remote_tool(tool_name):
                    # 远程工具直接通过验证，由 remote_tool_manager 管理
                    valid_tools[tool_name] = remapped[tool_name]
                    logger.debug(f"远程工具 '{tool_name}' 验证通过")
                    continue

                # 对于非远程工具，使用 tool_factory 进行检查
                if not tool_factory.tool_exists(tool_name):
                    self._record_or_log_ignored_tool(
                        ignored_tools=ignored_tools,
                        tool_name=tool_name,
                        reason="工具不存在",
                    )
                    continue

                if not tool_factory.check_tool_availability_light(tool_name):
                    self._record_or_log_ignored_tool(
                        ignored_tools=ignored_tools,
                        tool_name=tool_name,
                        reason="工具不可用（环境变量未配置或依赖缺失）",
                    )
                    continue

                valid_tools[tool_name] = remapped[tool_name]
                logger.debug(f"工具 '{tool_name}' 验证通过")

            except Exception as e:
                # 其他错误
                self._record_or_log_ignored_tool(
                    ignored_tools=ignored_tools,
                    tool_name=tool_name,
                    reason=f"工具验证失败: {e}",
                )
                continue

        if ignored_tools and self._ignore_invalid_declarations:
            agent_label = self._agent_name or "<unknown>"
            logger.warning(
                f"Agent '{agent_label}' 工具配置处理完成；已忽略条目：{ignored_tools}"
            )

        return valid_tools

    def _reject_or_ignore_invalid_tools(
        self,
        *,
        remapped: Dict[str, Dict],
        tool_names: List[str],
        error_message: str,
        ignored_tools: Dict[str, str],
        ignore_reason: str,
        warning_message: str,
    ) -> None:
        if not self._ignore_invalid_declarations:
            raise ValueError(error_message)

        agent_label = self._agent_name or "<unknown>"
        logger.warning(f"Agent '{agent_label}'：{warning_message}")

        for tool_name in tool_names:
            remapped.pop(tool_name, None)
            ignored_tools[tool_name] = ignore_reason

    def _record_or_log_ignored_tool(
        self,
        *,
        ignored_tools: Dict[str, str],
        tool_name: str,
        reason: str,
    ) -> None:
        if self._ignore_invalid_declarations:
            ignored_tools[tool_name] = reason
            return
        logger.warning(f"工具 '{tool_name}' 将在 Agent 定义中被忽略: {reason}")


# 全局入口也必须遵守同一兼容策略，避免未覆盖的 Agent 构造路径重新变成 fatal。
app_tool_validator = AppToolValidator(ignore_invalid_declarations=True)
