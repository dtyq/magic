"""工具调用工具函数模块

提供工具调用相关的工具函数，如格式转换等
"""

import json
from typing import List

from agentlang.chat_history import FunctionCall, ToolCall
from agentlang.logger import get_logger
from openai.types.chat import ChatCompletionMessageToolCall

logger = get_logger(__name__)


def parse_and_convert_tool_calls(openai_tool_calls: List[ChatCompletionMessageToolCall]) -> List[ToolCall]:
    """将OpenAI工具调用转换为内部ToolCall格式

    Args:
        openai_tool_calls: OpenAI返回的工具调用列表

    Returns:
        List[ToolCall]: 内部格式的工具调用列表
    """
    tool_calls_to_execute = []

    for tc_openai in openai_tool_calls:
        # 确保类型正确
        if not isinstance(tc_openai, ChatCompletionMessageToolCall):
            logger.warning(f"跳过无效的tool_call类型: {type(tc_openai)}")
            continue

        try:
            # 解析属性
            arguments_str = getattr(getattr(tc_openai, 'function', None), 'arguments', None)
            func_name = getattr(getattr(tc_openai, 'function', None), 'name', None)
            tool_id = getattr(tc_openai, 'id', None)
            tool_type = getattr(tc_openai, 'type', 'function')  # 默认为function

            # 验证必要属性
            if not all([tool_id, func_name, arguments_str is not None]):
                logger.warning(f"跳过结构不完整的OpenAI ToolCall: {tc_openai}")
                continue

            # 处理非字符串参数
            if not isinstance(arguments_str, str):
                logger.warning(f"OpenAI ToolCall arguments非字符串: {arguments_str}，尝试转为JSON字符串")
                try:
                    arguments_str = json.dumps(arguments_str, ensure_ascii=False)
                except Exception:
                    logger.error(f"无法将OpenAI ToolCall arguments转为JSON字符串: {arguments_str}，使用空对象字符串")
                    arguments_str = "{}"

            # 创建内部FunctionCall
            internal_func = FunctionCall(
                name=func_name,
                arguments=arguments_str
            )

            # 创建内部ToolCall
            internal_tc = ToolCall(
                id=tool_id,
                type=tool_type,
                function=internal_func
            )

            tool_calls_to_execute.append(internal_tc)
        except AttributeError as ae:
            logger.error(f"访问OpenAI ToolCall属性时出错: {tc_openai}, 错误: {ae}", exc_info=True)
        except Exception as e:
            logger.error(f"转换OpenAI ToolCall到内部类型时出错: {tc_openai}, 错误: {e}", exc_info=True)

    return tool_calls_to_execute
