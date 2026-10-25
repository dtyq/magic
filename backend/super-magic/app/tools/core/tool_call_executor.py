"""工具调用执行器模块

负责执行工具调用的串行和并行逻辑，包括根据配置自动选择执行模式。
本模块是工具系统的核心组件之一，提供了统一的工具调用执行接口。

设计思路：
1. 单例模式：全局提供一个 tool_call_executor 实例，所有代码使用相同实例
2. 配置管理：在初始化时读取默认配置，支持运行时通过参数覆盖
3. 执行模式：自动根据配置和工具数量选择串行或并行执行
"""

from app.i18n import i18n
import asyncio
import json
import time
import traceback
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from agentlang.chat_history import ToolCall
from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.parallel import Parallel
from pydantic import ValidationError

from app.core.context.agent_context import AgentContext
from app.tools.core.base_tool import ToolForwardRequest, ToolResultContentMode
from app.tools.core.tool_call_event_manager import ToolCallEventManager
from app.tools.core.tool_executor import tool_executor
from app.tools.core.tool_result_content_manager import tool_result_content_manager

logger = get_logger(__name__)

@dataclass(frozen=True, slots=True)
class _ToolCallOutcome:
    """一次工具执行的业务结果及交付上下文，不属于对外 ToolResult 协议。"""

    result: ToolResult
    tool_name: str
    tool_context: ToolContext | None
    result_content_mode: ToolResultContentMode = ToolResultContentMode.GLOBAL
    forward_warning: str | None = None


class ToolCallExecutor:
    """工具调用执行器

    负责执行工具调用的串行和并行逻辑，包括根据配置自动选择执行模式。
    使用全局单例模式，类似于 tool_executor 和 tool_factory。

    执行器在初始化时读取默认配置，但支持运行时通过参数覆盖。
    """

    def __init__(self):
        """初始化执行器，读取默认配置"""
        # 读取默认配置
        self.default_enable_multi_tool_calls = config.get("agent.enable_multi_tool_calls", False)
        self.default_enable_parallel = config.get("agent.enable_parallel_tool_calls", False)
        self.default_parallel_timeout = config.get("agent.parallel_tool_calls_timeout", None)

        logger.debug(
            f"ToolCallExecutor 初始化: "
            f"default_enable_multi_tool_calls={self.default_enable_multi_tool_calls}, "
            f"default_enable_parallel={self.default_enable_parallel}, "
            f"default_parallel_timeout={self.default_parallel_timeout}"
        )

    async def execute(
        self,
        tool_calls: List[ToolCall],
        agent_context: AgentContext,
        is_code_mode: bool = False,
        preflight_failures: Optional[Dict[str, str]] = None,
    ) -> List[ToolResult]:
        """执行工具调用（自动选择串行或并行模式）

        根据执行器初始化时读取的默认配置自动选择执行模式。

        Args:
            tool_calls: 工具调用列表
            agent_context: Agent上下文
            is_code_mode: 是否为 Code Mode 调用（run_sdk_snippet 子进程发起），会写入 ToolContext extension

        Returns:
            List[ToolResult]: 工具执行结果列表
        """
        # 检查多工具调用配置
        if not self.default_enable_multi_tool_calls and len(tool_calls) > 1:
            logger.debug("检测到多个工具调用，但多工具调用处理已禁用，只保留第一个")
            tool_calls = [tool_calls[0]]

        # 决策逻辑：根据配置和工具数量决定执行模式
        if not self.default_enable_parallel or len(tool_calls) <= 1:
            logger.debug("Using sequential execution mode for tool calls")
            return await self.execute_sequential(
                tool_calls,
                agent_context,
                is_code_mode=is_code_mode,
                preflight_failures=preflight_failures,
            )
        else:
            logger.info(f"Using parallel execution mode for {len(tool_calls)} tool calls")
            return await self.execute_parallel(
                tool_calls, agent_context, self.default_parallel_timeout
            )

    @staticmethod
    def _validate_forward_request(request: ToolForwardRequest) -> None:
        target_tool_name = request.target_tool.name
        target_params_class = request.target_tool.params_class
        if not target_tool_name or target_params_class is None:
            raise ValueError(
                "Forwarded tool type does not declare a valid name and parameter model."
            )
        if not isinstance(request.params, target_params_class):
            raise TypeError(
                f"Forwarded tool '{target_tool_name}' requires "
                f"'{target_params_class.__name__}', got '{type(request.params).__name__}'."
            )

    @staticmethod
    def _merge_forward_warning(result: ToolResult, warning: str | None) -> ToolResult:
        if not warning:
            return result
        content = f"{warning}\n\n{result.content}" if result.content else warning
        return result.model_copy(update={"content": content})

    async def execute_sequential(
        self,
        tool_calls: List[ToolCall],
        agent_context: AgentContext,
        is_code_mode: bool = False,
        preflight_failures: Optional[Dict[str, str]] = None,
    ) -> List[ToolResult]:
        """使用顺序模式执行 Tools 调用

        Args:
            tool_calls: 工具调用列表
            agent_context: Agent上下文
            is_code_mode: 是否为 Code Mode 调用，True 时写入 ToolContext extension

        Returns:
            List[ToolResult]: 工具执行结果列表
        """
        results: list[ToolResult] = []
        for tool_call in tool_calls:
            outcome = await self._execute_single(
                tool_call,
                agent_context,
                is_code_mode=is_code_mode,
                preflight_advice=(preflight_failures or {}).get(tool_call.id),
            )
            if outcome is None:
                continue
            # 业务执行及 AFTER 事件已完成；模型交付在此统一处理，每个结果只经过一次。
            model_result = self._merge_forward_warning(outcome.result, outcome.forward_warning)
            model_result = await tool_result_content_manager.prepare(
                model_result,
                mode=outcome.result_content_mode,
                tool_name=outcome.tool_name,
                tool_context=outcome.tool_context,
            )
            results.append(model_result)
        return results

    async def _execute_single(
        self,
        tool_call: ToolCall,
        agent_context: AgentContext,
        *,
        is_code_mode: bool,
        preflight_advice: str | None,
    ) -> _ToolCallOutcome | None:
        """执行业务与原有事件；失败也作为结果返回，取消继续向上传播。"""
        result = None
        tool_name = "[unknown]"
        tool_context = None
        tool_arguments_dict = None
        forward_warning: str | None = None
        result_content_mode = ToolResultContentMode.GLOBAL
        # 记录工具执行开始时间
        tool_start_time = time.time()

        # 创建OpenAI格式的工具调用对象
        openai_tool_call_for_event = ToolCallEventManager.create_openai_tool_call(
            tool_call.id,
            tool_call.type,
            tool_name,
            tool_call.function.arguments,
        )

        try:
            tool_name = tool_call.function.name
            openai_tool_call_for_event = ToolCallEventManager.create_openai_tool_call(
                tool_call.id,
                tool_call.type,
                tool_name,
                tool_call.function.arguments,
            )

            if preflight_advice:
                tool_arguments_dict = {}
                tool_context = ToolCallEventManager.create_tool_context(
                    agent_context,
                    tool_call.id,
                    tool_name,
                    tool_arguments_dict,
                )
                result = ToolResult.error(
                    "Tool call arguments are invalid. Do not reuse the same arguments. "
                    f"Retry the '{tool_name}' call with corrected JSON parameters. "
                    f"Validation advice: {preflight_advice}",
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    use_custom_remark=False,
                )
                await ToolCallEventManager.trigger_after_tool_call(
                    agent_context,
                    openai_tool_call_for_event,
                    tool_context,
                    tool_name,
                    tool_arguments_dict,
                    result,
                    0.0,
                )
                return _ToolCallOutcome(result=result, tool_name=tool_name, tool_context=tool_context)

            try:
                tool_arguments_dict = self._parse_tool_arguments(tool_call, tool_name)
            except (json.JSONDecodeError, ValueError) as parse_error:
                tool_arguments_dict = {}
                tool_context = ToolCallEventManager.create_tool_context(
                    agent_context,
                    tool_call.id,
                    tool_name,
                    tool_arguments_dict,
                )
                result = ToolResult.error(
                    "Tool call arguments are invalid JSON. Retry the tool call with valid JSON parameters. "
                    f"Parser detail: {parse_error}",
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    use_custom_remark=False,
                )
                await ToolCallEventManager.trigger_after_tool_call(
                    agent_context,
                    openai_tool_call_for_event,
                    tool_context,
                    tool_name,
                    tool_arguments_dict,
                    result,
                    0.0,
                )
                return _ToolCallOutcome(result=result, tool_name=tool_name, tool_context=tool_context)

            try:
                # 创建工具上下文
                tool_context = ToolCallEventManager.create_tool_context(
                    agent_context,
                    tool_call.id,
                    tool_name,
                    tool_arguments_dict,
                )

                # 标记 Code Mode 来源，供工具层做第二道拦截
                if is_code_mode:
                    tool_context.register_extension("is_code_mode", True)

                tool_instance = tool_executor.get_tool(tool_name)
                if tool_instance is not None:
                    try:
                        forward_request = await tool_instance.resolve_forwarded_tool(
                            tool_context,
                            tool_arguments_dict,
                        )
                    except ValidationError:
                        # 保留源工具的正常参数校验和错误展示。
                        forward_request = None
                    if forward_request is not None:
                        self._validate_forward_request(forward_request)
                        tool_name = forward_request.target_tool.name
                        tool_arguments_dict = forward_request.params.model_dump(
                            mode="json",
                            exclude_none=True,
                        )
                        forward_warning = forward_request.warning
                        tool_context = ToolCallEventManager.create_tool_context(
                            agent_context,
                            tool_call.id,
                            tool_name,
                            tool_arguments_dict,
                        )
                        if is_code_mode:
                            tool_context.register_extension("is_code_mode", True)

                openai_tool_call_for_event = ToolCallEventManager.create_openai_tool_call(
                    tool_call.id,
                    tool_call.type,
                    tool_name,
                    json.dumps(tool_arguments_dict, ensure_ascii=False),
                )
                safe_tool_arguments = tool_executor.sanitize_tool_arguments_for_log(
                    tool_name,
                    tool_arguments_dict,
                )
                logger.info(
                    f"开始执行工具: {tool_name}, 参数字段: "
                    f"{tool_executor.get_tool_parameter_names(safe_tool_arguments)}"
                )

                # 触发工具调用前事件
                await ToolCallEventManager.trigger_before_tool_call(
                    agent_context,
                    openai_tool_call_for_event,
                    tool_context,
                    tool_name,
                    tool_arguments_dict,
                )

                # --- 执行工具 ---
                result = await tool_executor.execute_tool_call(
                    tool_context=tool_context, arguments=tool_arguments_dict
                )
                # execute_tool_call 按最终名称取得实例；源工具转发声明不能传给目标。
                executed_tool = tool_executor.get_tool(tool_name)
                if executed_tool is not None:
                    result_content_mode = executed_tool.result_content_mode

                # 计算执行时间
                execution_time = time.time() - tool_start_time

                # 确保 result.tool_call_id 已设置
                if not result.tool_call_id:
                    result.tool_call_id = tool_call.id

                # 记录执行结果
                if result.ok:
                    logger.info(f"工具执行成功: {tool_name} (耗时: {execution_time:.3f}s)")

                # 触发工具调用后事件
                await ToolCallEventManager.trigger_after_tool_call(
                    agent_context,
                    openai_tool_call_for_event,
                    tool_context,
                    tool_name,
                    tool_arguments_dict,
                    result,
                    result.execution_time,
                )
            except asyncio.CancelledError:
                # 用户中断（或上层取消）。CancelledError 属 BaseException，不会被下面的
                # except Exception 捕获；若不在此补发终态事件，工具卡片会永远停在
                # before_tool_call 的“进行中”状态（例如一直显示“正在生成图像”）。
                result_content_mode = ToolResultContentMode.GLOBAL
                cancelled_execution_time = (
                    time.time() - tool_start_time if "tool_start_time" in locals() else 0.0
                )
                cancelled_result = ToolResult(
                    content=i18n.translate(
                        "tool.call_cancelled_content",
                        category="tool.messages",
                        tool_name=tool_name,
                    ),
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    ok=False,
                    execution_time=cancelled_execution_time,
                    # extra_info 只在进程内流转，用于把“被取消”这一语义带给消息工厂，
                    # 使其渲染“已终止”而不是通用的“遇到问题”。
                    extra_info={"cancelled": True},
                )
                if tool_context is not None and tool_arguments_dict is not None:
                    try:
                        # shield：补发期间若再次被取消，事件发送仍能跑完
                        await asyncio.shield(
                            ToolCallEventManager.trigger_after_tool_call(
                                agent_context,
                                openai_tool_call_for_event,
                                tool_context,
                                tool_name,
                                tool_arguments_dict,
                                cancelled_result,
                                cancelled_execution_time,
                            )
                        )
                    except Exception as event_error:
                        logger.error(
                            f"中断时补发工具终态事件失败: {tool_name}, 错误: {event_error}",
                            exc_info=True,
                        )
                else:
                    logger.warning(
                        f"中断时缺少 tool_context/arguments，无法为 {tool_name} 补发终态事件"
                    )
                # 终态事件已发出，继续向上传播取消
                raise
            except Exception as e:
                result_content_mode = ToolResultContentMode.GLOBAL
                # 计算执行时间（即使出错）
                execution_time = (
                    time.time() - tool_start_time if "tool_start_time" in locals() else 0.0
                )

                # 记录错误信息
                logger.warning(f"工具执行异常: {tool_name} (耗时: {execution_time:.3f}s) - {e!s}")

                # 打印错误堆栈（保留原有逻辑）
                print(traceback.format_exc())

                # 使用多语言错误消息
                error_content = i18n.translate("tool.execution_exception", category="tool.messages", tool_name=tool_name,
                    error=str(e),
                )

                # 创建失败的 ToolResult，确保有 tool_call_id
                result = ToolResult(
                    content=error_content,
                    tool_call_id=tool_call.id,
                    ok=False,
                    execution_time=execution_time,
                )

                # 触发工具调用后事件（失败情况）
                try:
                    # 检查必要的变量是否存在
                    if tool_context is None:
                        raise RuntimeError(
                            f"无法触发工具调用后事件：tool_context 未初始化。"
                            f"工具名称: {tool_name}, 错误: {e!s}"
                        )
                    if tool_arguments_dict is None:
                        raise RuntimeError(
                            f"无法触发工具调用后事件：tool_arguments_dict 未初始化。"
                            f"工具名称: {tool_name}, 错误: {e!s}"
                        )

                    await ToolCallEventManager.trigger_after_tool_call(
                        agent_context,
                        openai_tool_call_for_event,
                        tool_context,
                        tool_name,
                        tool_arguments_dict,
                        result,
                        execution_time,
                    )
                except Exception as event_error:
                    logger.error(
                        f"触发失败工具调用事件时出错: {event_error}", exc_info=True
                    )

        except AttributeError as attr_err:
            result = None
            result_content_mode = ToolResultContentMode.GLOBAL
            forward_warning = None
            logger.error(
                f"处理工具调用对象时访问属性出错: {tool_call}, 错误: {attr_err!r}",
                exc_info=True,
            )
            # 如果在循环的早期阶段出错，尝试创建一个包含错误信息的 ToolResult
            tool_call_id_fallback = getattr(tool_call, "id", None)
            tool_name_fallback = getattr(
                getattr(tool_call, "function", None), "name", "[unknown_early_error]"
            )
            tool_name = tool_name_fallback
            if tool_call_id_fallback:
                # 使用多语言错误消息
                error_content = i18n.translate("tool.execution_exception", category="tool.messages", tool_name=tool_name_fallback,
                    error=f"AttributeError: {attr_err!s}",)
                result = ToolResult(
                    content=error_content,
                    tool_call_id=tool_call_id_fallback,
                    name=tool_name_fallback,
                    ok=False,
                )
            else:
                # 如果连 id 都没有，无法创建 ToolResult，只能记录日志
                logger.error(f"无法创建工具失败结果：缺少 tool_call_id。错误: {attr_err!s}")

        except Exception as outer_err:
            result = None
            result_content_mode = ToolResultContentMode.GLOBAL
            forward_warning = None
            # 捕获 tool_call 对象本身处理（如属性访问）或 result 添加过程中的其他异常
            logger.error(
                f"处理工具调用对象或添加结果时发生严重错误: {tool_call}, 错误: {outer_err}",
                exc_info=True,
            )
            tool_call_id_fallback = getattr(tool_call, "id", None)
            tool_name_fallback = getattr(
                getattr(tool_call, "function", None), "name", "[unknown_outer_error]"
            )
            tool_name = tool_name_fallback
            if tool_call_id_fallback:
                # 使用多语言错误消息
                error_content = i18n.translate("tool.execution_exception", category="tool.messages", tool_name=tool_name_fallback,
                    error=str(outer_err),
                )
                result = ToolResult(
                    content=error_content,
                    tool_call_id=tool_call_id_fallback,
                    name=tool_name_fallback,
                    ok=False,
                )
            else:
                logger.error(f"无法创建工具失败结果：缺少 tool_call_id。错误: {outer_err!s}")

        if result is None:
            return None
        return _ToolCallOutcome(
            result=result,
            tool_name=tool_name,
            tool_context=tool_context,
            result_content_mode=result_content_mode,
            forward_warning=forward_warning,
        )

    async def execute_parallel(
        self,
        tool_calls: List[ToolCall],
        agent_context: AgentContext,
        parallel_timeout: Optional[float] = None,
    ) -> List[ToolResult]:
        """使用并行模式执行 Tools 调用

        Args:
            tool_calls: 工具调用列表
            agent_context: Agent上下文
            parallel_timeout: 并行执行超时时间（秒）

        Returns:
            List[ToolResult]: 工具执行结果列表
        """
        # TODO: 实现并行工具调用执行逻辑
        raise NotImplementedError("并行工具调用执行功能尚未实现")

    @staticmethod
    def _parse_tool_arguments(
        tool_call: ToolCall, tool_name: str, context_prefix: str = ""
    ) -> Dict[str, Any]:
        """解析工具调用参数

        注意：参数在保存到聊天记录前已经预处理过了，这里只需要简单解析

        Args:
            tool_call: 工具调用对象
            tool_name: 工具名称
            context_prefix: 日志上下文前缀（如"并行工具调用："）

        Returns:
            Dict[str, Any]: 解析后的参数字典

        Raises:
            ValueError: 参数不是 JSON 对象或 JSON 语法无效。
        """
        tool_arguments_str = tool_call.function.arguments

        try:
            # 直接解析，因为已经预处理过了
            tool_arguments_dict = json.loads(tool_arguments_str)
            if isinstance(tool_arguments_dict, dict):
                return tool_arguments_dict
            logger.warning(f"{context_prefix}工具 '{tool_name}' 参数类型异常，拒绝执行")
            raise ValueError(
                f"Invalid arguments for tool '{tool_name}': expected a JSON object"
            )
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON arguments for tool '{tool_name}': {e}") from e


# 创建全局工具调用执行器实例
# 这是一个单例，整个应用程序应该使用此实例而不是创建新实例
tool_call_executor = ToolCallExecutor()
