"""工具执行器模块

负责执行工具调用，管理工具实例集合。本模块是工具系统的核心组件之一，
提供了统一的工具执行接口，简化了工具的获取和调用过程。

设计思路：
1. 单例模式：全局提供一个tool_executor实例，所有代码使用相同实例
2. 执行代理：对tool_factory的功能扩展，处理参数转换和错误捕获
3. 参数适配：自动将传入参数适配为工具需要的格式
"""

import time
import traceback
from typing import Any, Dict, List

from pydantic import ValidationError

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core.tool_factory import tool_factory

logger = get_logger(__name__)


class ToolExecutor:
    """工具执行器

    管理工具集合并执行工具调用。工具执行器负责：
    1. 获取和管理工具实例
    2. 执行工具调用，包括参数处理和错误捕获
    3. 提供统一的接口获取工具模式信息

    使用方式：
    ```python
    # 使用全局实例
    from app.tools.core.tool_executor import tool_executor

    # 执行工具
    result = await tool_executor.execute_tool_call(tool_context, arguments)

    # 获取工具实例
    tool = tool_executor.get_tool("tool_name")

    # 获取工具函数调用模式
    schemas = tool_executor.get_tool_schemas()
    ```
    """

    def __init__(self, tools=None):
        """初始化工具执行器

        Args:
            tools: 要使用的工具列表，如果为None则使用所有注册的工具
        """
        # 确保工具工厂已初始化
        if not tool_factory._tools:
            tool_factory.initialize()
        self._tools = tools or []

    def set_tools(self, tools: List):
        """设置工具列表

        Args:
            tools: 工具列表
        """
        self._tools = tools or []

    async def execute_tool_call(self, tool_context: ToolContext, arguments: Dict[str, Any] = None) -> ToolResult:
        """执行工具调用

        此方法是工具调用的主要入口点，它处理：
        1. 工具实例获取
        2. 参数验证和转换
        3. 错误捕获和处理
        4. 结果格式化

        Args:
            tool_context: 工具上下文，包含工具名称等信息
            arguments: 工具参数字典

        Returns:
            ToolResult: 工具执行结果
        """
        tool_name = tool_context.tool_name

        try:
            # 获取工具实例
            tool_instance = self.get_tool(tool_name)
            if not tool_instance:
                friendly_error = f"工具 '{tool_name}' 不存在，请检查工具名称是否正确"
                logger.error(f"❌ {friendly_error}")
                raise ValueError(friendly_error)

            # 确保参数不为None
            if arguments is None:
                arguments = {}

            # 通过__call__方法调用工具，自动处理参数转换
            # 注意：这里使用__call__而不是直接调用execute，以便触发参数模型转换
            start_time = time.time()
            result: ToolResult = await tool_instance(tool_context, **arguments)
            execution_time = time.time() - start_time

            # 记录执行结果
            if not result.ok:
                logger.warning(f"❌ 工具逻辑执行失败: {tool_name} (耗时: {execution_time:.3f}s)")
                logger.warning(f"💥 失败内容: {result.content}")

            # 设置执行时间和名称
            if result:
                result.execution_time = execution_time
                result.name = tool_name
                result.tool_call_id = tool_context.tool_call_id

            return result
        except ValidationError as ve:
            # 特别处理参数验证错误
            logger.error(f"📋 工具参数验证失败: {tool_name} - {ve!s}")

            # 尝试提取友好的错误消息
            error_msg = self._get_friendly_validation_error(tool_name, ve)

            result = ToolResult.error(error_msg, name=tool_name)

            # 设置工具调用ID
            if hasattr(tool_context, 'tool_call_id'):
                result.tool_call_id = tool_context.tool_call_id

            return result
        except Exception as e:
            # 记录异常信息
            error_stack = traceback.format_exc()
            error_type = type(e).__name__

            logger.error(f"💥 工具执行异常: {tool_name} ({error_type}: {str(e)})")

            # 根据错误类型生成友好的错误消息
            error_msg = self._get_friendly_error_message(tool_name, error_type, str(e))

            result = ToolResult.error(error_msg, name=tool_name)

            # 设置工具调用ID
            if hasattr(tool_context, 'tool_call_id'):
                result.tool_call_id = tool_context.tool_call_id

            return result

    def _get_friendly_validation_error(self, tool_name: str, validation_error: ValidationError) -> str:
        """获取友好的验证错误消息

        处理Pydantic验证错误，返回用户友好的错误消息

        Args:
            tool_name: 工具名称
            validation_error: 验证错误

        Returns:
            str: 友好的错误消息
        """
        # 尝试从错误中提取错误详情
        try:
            error_details = validation_error.errors()

            # 检查是否有缺失字段
            missing_fields = []
            type_errors = []
            other_errors = []

            for err in error_details:
                err_type = err.get("type", "")
                field_path = ".".join(str(loc) for loc in err.get("loc", []))

                if err_type == "missing":
                    missing_fields.append(field_path)
                elif "type" in err_type:
                    type_errors.append(f"'{field_path}'")
                else:
                    other_errors.append(f"'{field_path}'")

            # 构建友好错误消息
            if missing_fields:
                return f"执行工具 '{tool_name}' 缺少必填参数：{', '.join(missing_fields)}"
            elif type_errors:
                return f"执行工具 '{tool_name}' 的参数类型错误，请检查以下参数：{', '.join(type_errors)}"
            elif other_errors:
                return f"执行工具 '{tool_name}' 的参数验证失败，请检查以下参数：{', '.join(other_errors)}"

        except Exception as e:
            # 如果提取详情失败，返回通用错误消息
            logger.error(f"解析验证错误详情时出错: {e}")

        # 默认友好错误消息
        return f"执行工具 '{tool_name}' 的参数验证失败，请检查输入参数是否符合要求"

    def _get_friendly_error_message(self, tool_name: str, error_type: str, error_message: str) -> str:
        """获取友好的错误消息

        根据错误类型和消息生成用户友好的错误提示

        Args:
            tool_name: 工具名称
            error_type: 错误类型
            error_message: 原始错误消息

        Returns:
            str: 友好的错误消息
        """
        # 检查是否已经是友好错误消息
        if "不存在" in error_message or "检查" in error_message:
            return error_message

        # 根据错误类型返回友好消息
        if "NotFound" in error_type or "not found" in error_message.lower():
            return f"执行工具 '{tool_name}' 失败：找不到请求的资源"

        if "Permission" in error_type or "Access" in error_type:
            return f"执行工具 '{tool_name}' 失败：没有足够的权限"

        if "Timeout" in error_type or "timeout" in error_message.lower():
            return f"执行工具 '{tool_name}' 失败：操作超时，请稍后重试"

        if "Connection" in error_type or "network" in error_message.lower():
            return f"执行工具 '{tool_name}' 失败：网络连接问题"

        if "Value" in error_type:
            return f"执行工具 '{tool_name}' 失败：参数值无效，请检查输入"

        # 默认友好错误消息
        return f"执行工具 '{tool_name}' 失败：{error_message}"

    def get_tool(self, tool_name: str):
        """获取工具实例

        Args:
            tool_name: 工具名称

        Returns:
            工具实例，如果不存在则返回None
        """
        try:
            return tool_factory.get_tool_instance(tool_name)
        except Exception as e:
            logger.error(f"获取工具 {tool_name} 实例失败: {e}")
            return None

    def get_all_tools(self):
        """获取所有工具实例

        如果设置了特定工具列表，则返回该列表
        否则返回所有已注册的工具实例

        Returns:
            所有工具实例列表
        """
        if self._tools:
            return self._tools
        return tool_factory.get_all_tool_instances()

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """获取所有工具的函数调用架构

        生成OpenAI兼容的Function Calling格式描述
        优先使用预构建定义，不存在时自动生成

        Returns:
            函数调用架构列表，格式为OpenAI规范
        """
        schemas = []

        if self._tools:
            # 如果设置了特定工具列表，使用工具实例的名称
            tool_names = [tool.get_effective_name() for tool in self._tools]
        else:
            # 否则获取所有已注册的工具名称
            tool_names = tool_factory.get_tool_names()

        for tool_name in tool_names:
            # 只从预构建定义获取参数
            tool_param = tool_factory.get_tool_param_from_definition(tool_name)

            if tool_param:
                schemas.append(tool_param)
                logger.debug(f"从预构建定义获取工具参数: {tool_name}")
            else:
                # 预定义参数不存在，跳过该工具并警告
                logger.warning(f"工具 {tool_name} 的预定义参数不存在，跳过添加。请运行工具定义生成命令来创建预定义文件。")

        return schemas

    async def run_tool(self, tool_context: ToolContext, tool_name: str = None, **args):
        """运行工具

        兼容旧代码的调用方式，如果提供了tool_name则用它更新tool_context

        Args:
            tool_context: 工具上下文
            tool_name: 可选的工具名称，如果提供则更新tool_context
            **args: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        # 如果提供了tool_name，则更新tool_context
        if tool_name:
            tool_context.tool_name = tool_name

        # 执行工具
        return await self.execute_tool_call(tool_context, args)


# 创建全局工具执行器实例
# 这是一个单例，整个应用程序应该使用此实例而不是创建新实例
tool_executor = ToolExecutor()
