"""
应用层工具验证器实现

提供 ToolValidatorProtocol 的具体实现，处理工具存在性和可用性验证
"""

from typing import Dict

from agentlang.logger import get_logger
from agentlang.tools.validator import ToolValidatorProtocol
from app.tools.core.tool_factory import tool_factory
from app.tools.remote.remote_tool_manager import remote_tool_manager

logger = get_logger(__name__)

# 已废弃工具的兼容映射：旧名称 -> 新名称
# 当 .agent 文件中声明了旧名称时，自动替换为新名称并记录 warning
_DEPRECATED_TOOL_ALIASES: Dict[str, str] = {
    "generate_image": "generate_images",
}


class AppToolValidator(ToolValidatorProtocol):
    """应用层工具验证器

    检查工具是否存在且可用，若不存在或不可用则忽略并抛出 warning
    使用轻量级检查，避免在初始化时加载所有工具类
    """

    def filter_valid_tools(self, tools_definition: Dict[str, Dict]) -> Dict[str, Dict]:
        """过滤无效工具，返回有效工具定义

        Args:
            tools_definition: 原始工具定义字典

        Returns:
            Dict[str, Dict]: 过滤后的有效工具字典
        """
        # 先做废弃工具的兼容性重映射，再走后续验证逻辑
        remapped: Dict[str, Dict] = {}
        for tool_name, tool_config in tools_definition.items():
            if tool_name in _DEPRECATED_TOOL_ALIASES:
                new_name = _DEPRECATED_TOOL_ALIASES[tool_name]
                logger.warning(
                    f"工具 '{tool_name}' 已废弃，请在 .agent 文件中改为使用 '{new_name}'，本次自动替换"
                )
                # 若 .agent 已同时声明了新名称，跳过，避免重复
                if new_name not in remapped and new_name not in tools_definition:
                    remapped[new_name] = tool_config
            else:
                remapped[tool_name] = tool_config

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
                    logger.warning(f"工具 '{tool_name}' 不存在，将在 Agent 定义中被忽略")
                    continue

                if not tool_factory.check_tool_availability_light(tool_name):
                    logger.warning(f"工具 '{tool_name}' 不可用（环境变量未配置或依赖缺失），将在 Agent 定义中被忽略")
                    continue

                valid_tools[tool_name] = remapped[tool_name]
                logger.debug(f"工具 '{tool_name}' 验证通过")

            except Exception as e:
                # 其他错误
                logger.warning(f"验证工具 '{tool_name}' 时发生错误，将在 Agent 定义中被忽略: {e}")
                continue

        return valid_tools


# 全局单例实例
app_tool_validator = AppToolValidator()
