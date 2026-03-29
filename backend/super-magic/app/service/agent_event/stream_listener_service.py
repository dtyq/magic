import traceback
from typing import List
import json
from dataclasses import asdict
import asyncio

from app.core.context.agent_context import AgentContext
from agentlang.config.non_human_config import NonHumanConfigManager
from agentlang.context.tool_context import ToolContext
from app.core.entity.event.event import (
    AfterClientChatEventData,
    AfterSafetyCheckEventData,
    BeforeSafetyCheckEventData,
    BeforeMcpInitEventData,
    AfterMcpInitEventData,
)
from app.core.entity.event.file_event import FileEventData
from agentlang.event.data import (
    AfterInitEventData,
    AfterLlmResponseEventData,
    BeforeAgentThinkEventData,
    AfterAgentThinkEventData,
    BeforeAgentReplyEventData,
    AfterAgentReplyEventData,
    AfterToolCallEventData,
    AgentSuspendedEventData,
    BeforeInitEventData,
    BeforeLlmRequestEventData,
    BeforeToolCallEventData,
    ErrorEventData,
    AfterMainAgentRunEventData,
    PendingToolCallEventData,
)
from app.core.entity.factory.task_message_factory import TaskMessageFactory
from app.core.entity.message.server_message import ServerMessage, TaskStatus, TaskStep
from agentlang.event.event import Event, EventType
from app.core.stream.http_subscription_stream import HTTPSubscriptionStream
from app.core.stream.stdout_stream import StdoutStream
from agentlang.logger import get_logger
from app.service.agent_event.base_listener_service import BaseListenerService
from app.core.entity.event.event_context import EventContext
from app.tools.core.base_tool import BaseTool

logger = get_logger(__name__)

class StreamListenerService:
    """
    SuperMagic事件监听服务，用于处理和发送SuperMagic事件
    """

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """
        为代理上下文注册标准的事件监听器

        Args:
            agent_context: 代理上下文对象
        """
        # 创建事件类型到处理函数的映射
        event_listeners = {
            EventType.BEFORE_INIT: StreamListenerService._handle_before_init,
            EventType.AFTER_INIT: StreamListenerService._handle_after_init,
            EventType.BEFORE_SAFETY_CHECK: StreamListenerService._handle_before_safety_check,
            EventType.AFTER_SAFETY_CHECK: StreamListenerService._handle_after_safety_check,
            EventType.AFTER_CLIENT_CHAT: StreamListenerService._handle_after_client_chat,
            EventType.BEFORE_LLM_REQUEST: StreamListenerService._handle_before_llm_request,
            EventType.AFTER_LLM_REQUEST: StreamListenerService._handle_after_llm_response,
            EventType.BEFORE_AGENT_THINK: StreamListenerService._handle_before_agent_think,
            EventType.AFTER_AGENT_THINK: StreamListenerService._handle_after_agent_think,
            EventType.BEFORE_AGENT_REPLY: StreamListenerService._handle_before_agent_reply,
            EventType.AFTER_AGENT_REPLY: StreamListenerService._handle_after_agent_reply,
            EventType.BEFORE_TOOL_CALL: StreamListenerService._handle_before_tool_call,
            EventType.AFTER_TOOL_CALL: StreamListenerService._handle_after_tool_call,
            EventType.PENDING_TOOL_CALL: StreamListenerService._handle_pending_tool_call,
            EventType.AGENT_SUSPENDED: StreamListenerService._handle_agent_suspended,
            EventType.BEFORE_MAIN_AGENT_RUN: StreamListenerService._handle_before_main_agent_run,
            EventType.AFTER_MAIN_AGENT_RUN: StreamListenerService._handle_after_main_agent_run,
            EventType.ERROR: StreamListenerService._handle_error,
            EventType.FILE_CREATED: StreamListenerService._handle_file_created,
        }

        # 使用基类方法批量注册监听器
        BaseListenerService.register_listeners(agent_context, event_listeners)

        logger.info("已为代理上下文注册所有标准事件监听器")

    @staticmethod
    def _should_skip_init_messages(agent_context: AgentContext) -> bool:
        """
        检查是否应该跳过初始化消息

        Args:
            agent_context: 代理上下文对象

        Returns:
            bool: 如果应该跳过初始化消息返回 True，否则返回 False
        """
        metadata = agent_context.get_init_client_message_metadata()
        if metadata and metadata.skip_init_messages is True:
            return True
        return False

    @staticmethod
    async def _handle_before_init(event: Event[BeforeInitEventData]) -> None:
        """
        处理初始化前事件

        Args:
            event: 初始化前事件对象，包含BeforeInitEventData数据
        """
        # 检查是否跳过初始化消息（存在且为 true 时才跳过）
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        if StreamListenerService._should_skip_init_messages(agent_context):
            logger.info("检测到 skip_init_messages=True，跳过发送 BEFORE_INIT 消息")
            return

        # 使用工厂创建任务消息
        task_message = TaskMessageFactory.create_before_init_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)

    @staticmethod
    async def _handle_after_init(event: Event[AfterInitEventData]) -> None:
        """
        处理初始化后事件

        Args:
            event: 初始化后事件对象，包含AfterInitEventData数据
        """
        # 检查是否跳过初始化消息（存在且为 true 时才跳过）
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        if StreamListenerService._should_skip_init_messages(agent_context):
            logger.info("检测到 skip_init_messages=True，跳过发送 AFTER_INIT 消息")
            return

        # 使用工厂创建任务消息
        task_message = TaskMessageFactory.create_after_init_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)

    @staticmethod
    async def _handle_after_client_chat(event: Event[AfterClientChatEventData]) -> None:
        """
        处理客户端聊天后事件

        Args:
            event: 客户端聊天后事件对象，包含AfterClientChatEventData数据
        """

        task_message = TaskMessageFactory.create_after_client_chat_message(event)
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_before_llm_request(event: Event[BeforeLlmRequestEventData]) -> None:
        """
        处理LLM请求前事件

        Args:
            event: LLM请求前事件对象，包含BeforeLlmRequestEventData数据
        """
        # 使用工厂创建任务消息
        task_message = TaskMessageFactory.create_before_llm_request_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)
        logger.info(f"开始请求LLM: {event.data.model_name}")

    @staticmethod
    async def _handle_after_llm_response(event: Event[AfterLlmResponseEventData]) -> None:
        """
        处理LLM响应后事件

        Args:
            event: LLM响应后事件对象，包含AfterLlmResponseEventData数据
        """
        # 使用工厂创建任务消息
        task_message = TaskMessageFactory.create_after_llm_response_message(event)

        if event.data.llm_response_message.content == "Continue":
            if task_message.token_usage_details and task_message.token_usage_details.usages:
                token_usage_json = json.dumps(asdict(task_message.token_usage_details), indent=2, ensure_ascii=False)
                logger.warning(f"Continue响应，但存在token消耗: {token_usage_json}")
            logger.info("大模型没有返回任何内容，不发送消息")
            return

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)
        logger.info(f"结束请求LLM: {event.data.model_name}, 耗时: {event.data.request_time:.2f}秒")

    @staticmethod
    async def _handle_before_agent_think(event: Event[BeforeAgentThinkEventData]) -> None:
        """
        Handle BEFORE_AGENT_THINK event (thinking container start)

        Args:
            event: Before agent think event object containing BeforeAgentThinkEventData
        """
        # Create task message using factory
        task_message = TaskMessageFactory.create_before_agent_think_message(event)

        # Create tool_context for sending message
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)
        logger.info(f"思考容器开始: {event.data.model_name}, correlation_id: {event.data.correlation_id}")

    @staticmethod
    async def _handle_after_agent_think(event: Event[AfterAgentThinkEventData]) -> None:
        """
        Handle AFTER_AGENT_THINK event (thinking container end)

        Args:
            event: After agent think event object containing AfterAgentThinkEventData
        """
        # Create task message using factory
        task_message = TaskMessageFactory.create_after_agent_think_message(event)

        # Create tool_context for sending message
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

        status_str = "成功" if event.data.success else "失败"
        logger.info(f"思考容器结束: {event.data.model_name}, 状态: {status_str}, "
                   f"耗时: {event.data.execution_time:.2f}ms, correlation_id: {event.data.correlation_id}")

    @staticmethod
    async def _handle_before_agent_reply(event: Event[BeforeAgentReplyEventData]) -> None:
        """
        处理智能体回复开始前事件

        Args:
            event: 智能体回复开始前事件对象，包含BeforeAgentReplyEventData数据
        """
        # 使用工厂创建任务消息
        task_message = TaskMessageFactory.create_before_agent_reply_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)
        logger.info(f"开始大模型响应: {event.data.model_name}, correlation_id: {event.data.correlation_id}")

    @staticmethod
    async def _handle_after_agent_reply(event: Event[AfterAgentReplyEventData]) -> None:
        """
        处理智能体回复完成后事件

        Args:
            event: 智能体回复完成后事件对象，包含AfterAgentReplyEventData数据
        """
        # 使用专门的工厂方法创建任务消息
        task_message = TaskMessageFactory.create_after_agent_reply_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)

        status_str = "成功" if event.data.success else "失败"
        logger.info(f"完成大模型响应: {event.data.model_name}, 状态: {status_str}, "
                   f"耗时: {event.data.execution_time:.2f}ms, correlation_id: {event.data.correlation_id}")

    @staticmethod
    async def _handle_before_tool_call(event: Event[BeforeToolCallEventData]) -> None:
        """
        处理工具调用前事件

        Args:
            event: 工具调用前事件对象，包含BeforeToolCallEventData数据
        """

        if (hasattr(event.data, 'tool_instance')
            and isinstance(event.data.tool_instance, BaseTool)):
            tool_instance = event.data.tool_instance
            if not tool_instance.should_trigger_events():
                return

        # 检查是否为MCP初始化事件
        if isinstance(event.data, BeforeMcpInitEventData):
            # 使用MCP专用的消息创建方法
            # 需要重新包装事件以满足类型系统要求，因为泛型的不变性
            from agentlang.event.event import Event
            mcp_event = Event(event.event_type, event.data)
            task_message = TaskMessageFactory.create_before_mcp_init_message(mcp_event)
        else:
            # 使用工厂创建任务消息
            task_message = await TaskMessageFactory.create_before_tool_call_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)

    @staticmethod
    async def _handle_pending_tool_call(event: Event[PendingToolCallEventData]) -> None:
        """
        处理工具调用解释等待事件
        """
        task_message = await TaskMessageFactory.create_pending_tool_call_message(event)
        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)


    @staticmethod
    async def _handle_after_tool_call(event: Event[AfterToolCallEventData]) -> None:
        """
        处理工具调用后事件

        Args:
            event: 工具调用后事件对象，包含AfterToolCallEventData数据
        """
        if (hasattr(event.data, 'tool_instance')
            and isinstance(event.data.tool_instance, BaseTool)):
            tool_instance = event.data.tool_instance
            if not tool_instance.should_trigger_events():
                return

        # 检查是否为MCP初始化事件
        if isinstance(event.data, AfterMcpInitEventData):
            # 使用MCP专用的消息创建方法
            # 需要重新包装事件以满足类型系统要求，因为泛型的不变性
            from agentlang.event.event import Event
            mcp_event = Event(event.event_type, event.data)
            task_message = TaskMessageFactory.create_after_mcp_init_message(mcp_event)
        else:
            task_message = await TaskMessageFactory.create_after_tool_call_message(event)

        await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)

    @staticmethod
    async def _handle_agent_suspended(event: Event[AgentSuspendedEventData]) -> None:
        """
        处理agent终止事件

        Args:
            event: agent终止事件对象，包含AgentSuspendedEventData数据
        """

        task_message = TaskMessageFactory.create_agent_suspended_message(
            event.data.agent_context,
            event.data.final_task_state,
        )
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_before_main_agent_run(event: Event[BeforeSafetyCheckEventData]) -> None:
        """
        处理主agent运行前事件

        Args:
            event: 主agent运行前事件对象，包含BeforeSafetyCheckEventData数据
        """
        task_message = TaskMessageFactory.create_before_safety_check_message(event)

        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_after_main_agent_run(event: Event[AfterMainAgentRunEventData]) -> None:
        """
        处理主agent完成事件

        Args:
            event: 主agent完成事件对象，包含AfterMainAgentRunEventData数据
        """
        task_message = await TaskMessageFactory.create_after_main_agent_run_message(event)
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_error(event: Event[ErrorEventData]) -> None:
        """
        处理错误事件

        Args:
            event: 错误事件对象，包含ErrorEventData数据
        """
        task_message = TaskMessageFactory.create_error_message(
            event.data.agent_context,
            event.data.final_task_state,
        )
        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_before_safety_check(event: Event[BeforeSafetyCheckEventData]) -> None:
        """
        处理安全检查前事件

        Args:
            event: 安全检查前事件对象，包含BeforeSafetyCheckEventData数据
        """
        task_message = TaskMessageFactory.create_before_safety_check_message(event)

        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _handle_after_safety_check(event: Event[AfterSafetyCheckEventData]) -> None:
        """
        处理安全检查后事件

        Args:
            event: 安全检查后事件对象，包含AfterSafetyCheckEventData数据
        """
        task_message = TaskMessageFactory.create_after_safety_check_message(event)

        tool_context = ToolContext(metadata=event.data.agent_context.get_metadata())
        tool_context.register_extension("agent_context", event.data.agent_context)
        tool_context.register_extension("event_context", EventContext())

        await StreamListenerService._send_task_message(tool_context, task_message, event)

    @staticmethod
    async def _create_steps_from_todo_items(agent_context: AgentContext) -> List[TaskStep]:
        """
        从todo文件中加载todo列表并创建步骤列表

        Args:
            agent_context: 代理上下文(保留参数以保持方法签名兼容性)

        Returns:
            List[TaskStep]: 步骤列表
        """
        from app.service.todo_service import TodoService
        from app.core.entity.todo import TodoStatus

        steps = []

        # 从文件加载todos
        todo_items = await TodoService.load_todos()

        if not todo_items:
            return steps

        for todo_item in todo_items:
            # 将TodoStatus映射到TaskStatus
            if todo_item.status == TodoStatus.COMPLETED:
                step_status = TaskStatus.FINISHED
            elif todo_item.status == TodoStatus.IN_PROGRESS:
                step_status = TaskStatus.RUNNING
            elif todo_item.status == TodoStatus.PENDING:
                step_status = TaskStatus.WAITING
            elif todo_item.status == TodoStatus.CANCELLED:
                step_status = TaskStatus.SUSPENDED
            else:
                step_status = TaskStatus.WAITING  # 默认状态

            # 创建TaskStep对象
            step = TaskStep(
                id=todo_item.id,
                title=todo_item.content,
                status=step_status
            )
            steps.append(step)

        if steps:
            logger.info(f"从todo文件创建了 {len(steps)} 个步骤")

        return steps

    @staticmethod
    async def _send_task_message(tool_context: ToolContext, task_message: ServerMessage, event: Event) -> None:
        """
        通过WebSocket向客户端发送任务消息

        Args:
            tool_context: 工具上下文，包含agent_context和event_context
            task_message: 要发送的任务消息
        """
        if not tool_context.get_extension_typed("agent_context", AgentContext).streams:
            logger.error("agent_context.streams 为空")
            return

        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

        # 保存消息到历史文件
        try:
            from app.service.message_history_service import get_message_history_service
            history_manager = get_message_history_service()
            save_success = await history_manager.save_message(task_message)
            if save_success:
                logger.debug(f"消息已保存到历史: task_id={task_message.payload.task_id}, seq_id={task_message.payload.seq_id}")
            else:
                logger.warning(f"消息历史保存失败: task_id={task_message.payload.task_id}, seq_id={task_message.payload.seq_id}")
        except Exception as e:
            logger.error(f"保存消息历史时出错: {e}", exc_info=True)

        try:
            # 从工具上下文获取事件上下文
            event_context = tool_context.get_extension_typed("event_context", EventContext)
            payload = task_message.payload

            # 检查是否应该在UI中显示， 移动到客户端进行判断，暂时注释掉
            # if hasattr(payload, "show_in_ui") and not payload.show_in_ui:
            #     logger.info(f"跳过向客户端发送消息，因为 show_in_ui=False, message_id: {payload.message_id}")
            #     return

            # 检查是否需要推送到客户端
            # if payload.is_empty:
            #     logger.info(f"跳过向客户端发送消息，因为 ServerMessage content 为空, server_message: {task_message.model_dump_json()}")
            #     return

            # 只有在 todos 发生变化时才创建和发送 steps
            if event_context is not None and event_context.todos_changed:
                steps = await StreamListenerService._create_steps_from_todo_items(agent_context)
                if steps:
                    payload.steps = steps
                    logger.info(f"发送消息时包含了 {len(steps)} 个步骤")
                # 重置标记
                event_context.todos_changed = False

            # 检查是否需要注入 round 延迟（在构造消息之前）
            await StreamListenerService._apply_round_delay_if_needed(agent_context, event)

            message_json = task_message.model_dump_json()

            # 发送到所有流
            # 创建字典的副本进行迭代，避免在迭代过程中修改字典引发错误
            for stream_id, stream in list(agent_context.streams.items()):
                try:
                    if stream.should_ignore_event(event.event_type):
                        logger.info(f"跳过往流中写入消息，stream type: {type(stream)}, 事件类型: {event.event_type}")
                        continue

                    logger.info(f"开始往流中写入消息, stream type: {type(stream)}")
                    await stream.write(message_json)
                    logger.info(f"成功往流中写入消息, stream type: {type(stream)}")
                except Exception as e:
                    logger.error(f"堆栈信息: {traceback.format_exc()}")
                    logger.error(f"失败往流中写入消息: {e!s}, 删除流, stream type: {type(stream)}")
                    # 如果stdoutstream或者httpstream，则不删除
                    if isinstance(stream, StdoutStream) or isinstance(stream, HTTPSubscriptionStream):
                        logger.info(f"不删除流, stream type: {type(stream)}")
                    else:
                        logger.info(f"删除流, stream type: {type(stream)}")
                        tool_context.get_extension_typed("agent_context", AgentContext).remove_stream(stream)
            logger.debug(f"成功发送任务消息: {payload.message_id}")
        except Exception as e:
            # 打印堆栈信息
            logger.error(f"堆栈信息: {traceback.format_exc()}")
            logger.error(f"发送任务消息失败: {e!s}")

    @staticmethod
    async def _apply_round_delay_if_needed(
        agent_context: AgentContext,
        event: Event
    ) -> None:
        """如果启用了非人类限流，则在 round 响应前注入随机延迟

        Args:
            agent_context: Agent 上下文
            event: 当前事件
        """
        try:
            # 直接从 agent_context 获取配置
            options = agent_context.get_non_human_options()
            if not options or not options.has_round_delay():
                return

            # 只对特定事件类型注入延迟（例如 tool 调用结束、思考结束等）
            # 避免对所有事件都延迟，影响用户体验
            delay_trigger_events = [
                EventType.AFTER_TOOL_CALL,  # Tool 调用结束
                EventType.AFTER_AGENT_REPLY,  # Agent 回复结束
            ]

            if event.event_type not in delay_trigger_events:
                return

            # 获取随机延迟时间（配置类内部已实现随机计算）
            delay_seconds = options.get_round_delay()
            if delay_seconds is None:
                return

            logger.info(
                f"[非人类限流] Round 响应延迟: {delay_seconds:.2f}秒 "
                f"(event={event.event_type})"
            )

            # 注入延迟
            await asyncio.sleep(delay_seconds)

        except Exception as e:
            logger.error(f"注入 round 延迟失败: {e}")
            # 失败不影响主流程，继续执行

    @staticmethod
    async def _handle_file_created(event: Event[FileEventData]) -> None:
        """
        处理文件创建事件

        Args:
            event: 文件创建事件对象，包含FileEventData数据
        """
        logger.info(f"StreamListenerService: 文件已创建事件接收到: {event.data.filepath}")
        # 通常，文件创建的通知会通过 AFTER_TOOL_CALL 事件的消息发送，
        # 该消息会包含由 FileStorageListenerService 创建的附件。
        # 如果需要 StreamListenerService 直接发送关于文件创建的特定消息，
        # 则需要 TaskMessageFactory 提供相应的创建方法，并在这里调用。
        # 目前，此处理函数仅记录日志，以避免重复通知。

        # 示例：如果需要发送特定消息
        # task_message = TaskMessageFactory.create_file_created_message(event) # 假设有此工厂方法
        # await StreamListenerService._send_task_message(event.data.tool_context, task_message, event)
        pass
