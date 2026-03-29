"""
Task message factory for creating different types of server messages.

Attachment Processing:
- Attachments are automatically processed and sorted by AttachmentSorter.get_processed_attachments()
- Sorting strategy: timestamp-based (newest first) with index files prioritized
- See app/utils/attachment_sorter.py for detailed sorting logic and future optimization directions
"""

from app.i18n import i18n
from app.core.entity.final_error import render_final_error
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import Attachment, AttachmentTag
from app.core.entity.event.event import (
    AfterClientChatEventData,
    BeforeSafetyCheckEventData,
    AfterSafetyCheckEventData,
    BeforeMcpInitEventData,
    AfterMcpInitEventData,
)
from agentlang.event.data import (
    BeforeInitEventData,
    AfterInitEventData,
    AfterMainAgentRunEventData,
    BeforeLlmRequestEventData,
    AfterLlmResponseEventData,
    BeforeAgentThinkEventData,
    AfterAgentThinkEventData,
    BeforeAgentReplyEventData,
    AfterAgentReplyEventData,
    BeforeToolCallEventData,
    AfterToolCallEventData,
    PendingToolCallEventData,
)
from app.core.entity.message.server_message import (
    MessageType,
    ServerMessage,
    ServerMessagePayload,
    TaskStatus,
    Tool,
    ToolStatus,
    ToolDetail,
    DisplayType,
)
from agentlang.event.event import Event, EventType
from agentlang.llms.token_usage.models import TokenUsageCollection
from agentlang.logger import get_logger
from app.core.entity.event.event_context import EventContext
from app.utils.attachment_sorter import AttachmentSorter
from typing import Optional, List, Dict
import random
import json
from datetime import datetime

logger = get_logger(__name__)

class TaskMessageFactory:
    """任务消息工厂类，用于创建不同类型的TaskMessage对象"""



    @classmethod
    def create_error_message(cls, agent_context: AgentContext, error_message: str) -> ServerMessage:
        """
        创建错误消息
        """
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id="",
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.ERROR,
                content=error_message,
                seq_id=seq_id,  # 传递序列号
                event=EventType.ERROR
            )
        )

    @classmethod
    def create_before_init_message(cls, event: Event[BeforeInitEventData]) -> ServerMessage:
        """
        创建初始化前的任务消息

        Args:
            event: 初始化前事件

        Returns:
            TaskMessage: 初始化前的任务消息
        """
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        # 获取初始化开始消息
        content = i18n.translate("task_vm_init.start", category="tool.messages")

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.INIT,
                status=TaskStatus.WAITING,
                content='',
                seq_id=seq_id,  # 传递序列号
                event=event.event_type,
                correlation_id=event.data.correlation_id,  # 传入关联ID
                tool=Tool(
                    id=agent_context.get_task_id(),
                    name="init_virtual_machine",
                    action=content,
                    status=ToolStatus.RUNNING,
                    remark="",
                    detail=None,
                    attachments=[]
                )
            )
        )

    @classmethod
    def create_after_init_message(cls, event: Event[AfterInitEventData]) -> ServerMessage:
        """
        创建初始化后的任务消息

        Args:
            event: 初始化后事件

        Returns:
            TaskMessage: 初始化后的任务消息
        """
        if event.data.success:
            status = TaskStatus.RUNNING
            content = i18n.translate("task_vm_init.success", category="tool.messages")
        else:
            status = TaskStatus.ERROR
            content = i18n.translate("task_vm_init.failed", category="tool.messages")

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        seq_id = agent_context.get_next_seq_id()  # 获取序列号
        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.INIT,
                status=status,
                content="",
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id,  # 传入关联ID
                tool=Tool(
                    id=agent_context.get_task_id(),
                    name="init_virtual_machine",
                    action=content,
                    status=ToolStatus.FINISHED,
                    remark="",
                    detail=None,
                    attachments=[]
                )
            )
        )

    @classmethod
    def create_after_client_chat_message(cls, event: Event[AfterClientChatEventData]) -> ServerMessage:
        """
        创建客户端聊天后的任务消息
        """
        seq_id = event.data.agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=event.data.agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=event.data.agent_context.get_task_id(),
                sandbox_id=event.data.agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.RUNNING,
                content="ok",
                event=EventType.AFTER_CLIENT_CHAT,
                seq_id=seq_id,  # 传递序列号
            )
        )
        # 创建挂起消息
    @classmethod
    def create_agent_suspended_message(cls, agent_context: AgentContext, remark: Optional[str] = None) -> ServerMessage:
        """
        创建挂起消息

        Args:
            agent_context: Agent上下文
            remark: 自定义终止消息，如果为None则使用空字符串, 不显示给用户
        """
        # Use remark if provided, otherwise use default message
        content = remark if remark else ""

        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.SUSPENDED,
                content=content,
                event=EventType.AGENT_SUSPENDED,
                seq_id=seq_id,  # 传递序列号
                show_in_ui=True,
            )
        )

    @classmethod
    async def create_after_main_agent_run_message(cls, event: Event[AfterMainAgentRunEventData]) -> ServerMessage:
        """
        创建主 agent 运行后消息

        Args:
            event: 主agent运行后事件，包含AfterMainAgentRunEventData数据

        Returns:
            ServerMessage: 主 agent 完成任务的消息
        """
        agent_context: AgentContext = event.data.agent_context

        # 使用 AttachmentSorter 获取处理后的附件（已自动处理 finish_task 和回退逻辑）
        processed_attachments = AttachmentSorter.get_processed_attachments(agent_context)

        # 将 PROCESS tag 转换为 FINAL tag
        attachments = cls._convert_to_final_attachments(processed_attachments)

        logger.info(f"TaskMessageFactory: 最终attachments数量: {len(attachments)}")
        if attachments:
            logger.info(f"TaskMessageFactory: attachments详情: {[{'filename': att.filename, 'file_key': att.file_key} for att in attachments]}")

        # 获取项目压缩包信息（如果存在）
        project_archive = agent_context.get_project_archive_info()
        if project_archive:
            logger.info(f"从 SharedContext 获取到项目压缩包信息: key={project_archive.file_key}")

        # 根据 agent_state 决定最终消息状态
        logger.info(f"TaskMessageFactory: 接收到 agent_state = {event.data.agent_state}")
        final_response = agent_context.get_final_response()
        final_error_info = agent_context.get_final_error_info()
        if event.data.agent_state == TaskStatus.FINISHED.value:
            status = TaskStatus.FINISHED
            content = i18n.translate("task.completed", category="tool.messages")
        elif event.data.agent_state == TaskStatus.SUSPENDED.value:
            status = TaskStatus.SUSPENDED
            content = final_response
        else:
            status = TaskStatus.ERROR
            content = render_final_error(final_error_info) or i18n.translate("messages.task.failed", category="common.messages")

        # 获取会话消耗的 token 总量，复用与压缩工具相同的 tokens_count() 逻辑
        token_used = None
        chat_history = getattr(agent_context, 'chat_history', None)
        if chat_history:
            try:
                token_used = await chat_history.tokens_count()
                logger.info(f"获取到会话 token 总量: {token_used}")
            except Exception as e:
                logger.error(f"获取 token 总量失败: {e}", exc_info=True)

        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=status,
                content=content,
                attachments=attachments,
                project_archive=project_archive,
                event=EventType.AFTER_MAIN_AGENT_RUN,
                seq_id=seq_id,
                token_used=token_used,
            ),
        )

    @classmethod
    def create_before_llm_request_message(cls, event: Event[BeforeLlmRequestEventData]) -> ServerMessage:
        """
        创建LLM请求前的任务消息

        Args:
            event: LLM请求前事件

        Returns:
            TaskMessage: LLM请求前的任务消息
        """
        content = "正在思考"

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=TaskStatus.RUNNING,
                content=content,
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
            )
        )

    @classmethod
    def create_after_llm_response_message(cls, event: Event[AfterLlmResponseEventData]) -> ServerMessage:
        """
        创建LLM响应后的任务消息

        Args:
            event: LLM响应后事件

        Returns:
            TaskMessage: LLM响应后的任务消息
        """
        # 当前这个 llm 调用后的事件，只用来推送模型费用，后续等费用接入网关之后，该事件将废弃，请勿继续使用
        content = ""

        # after_llm_response_message 不显示给用户
        show_in_ui = False

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 确保 task_id 不为 None，如果为 None 则使用空字符串
        task_id = agent_context.get_task_id() or ""

        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.THINKING,
            status=TaskStatus.RUNNING,
            content=content,
            event=event.event_type,
            show_in_ui=show_in_ui,
            seq_id=seq_id,  # 传递序列号
            parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload
        )

    @classmethod
    def create_before_agent_think_message(cls, event: Event[BeforeAgentThinkEventData]) -> ServerMessage:
        """
        Create message for BEFORE_AGENT_THINK event (thinking container start)

        Args:
            event: Before agent think event

        Returns:
            ServerMessage: Thinking container start message
        """
        agent_context = event.data.agent_context

        # Get sequence number and task_id
        seq_id = agent_context.get_next_seq_id()
        task_id = agent_context.get_task_id() or ""

        # Empty content for container start
        content = ""

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.AGENT_THINKING,  # Use THINKING message type
            status=TaskStatus.RUNNING,
            content=content,
            event=EventType.BEFORE_AGENT_THINK,
            show_in_ui=True,
            seq_id=seq_id,
            correlation_id=event.data.correlation_id,  # The container's own correlation_id
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload
        )

    @classmethod
    def create_after_agent_think_message(cls, event: Event[AfterAgentThinkEventData]) -> ServerMessage:
        """
        Create message for AFTER_AGENT_THINK event (thinking container end)

        Args:
            event: After agent think event

        Returns:
            ServerMessage: Thinking container end message
        """
        agent_context = event.data.agent_context

        # Get sequence number and task_id
        seq_id = agent_context.get_next_seq_id()
        task_id = agent_context.get_task_id() or ""

        # Empty content for container end
        content = ""

        # Determine status based on success
        status = TaskStatus.RUNNING if event.data.success else TaskStatus.ERROR

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.AGENT_THINKING,  # Use THINKING message type
            status=status,
            content=content,
            event=EventType.AFTER_AGENT_THINK,
            show_in_ui=True,
            seq_id=seq_id,
            correlation_id=event.data.correlation_id,  # The container's own correlation_id
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload
        )

    @classmethod
    def create_before_agent_reply_message(cls, event: Event[BeforeAgentReplyEventData]) -> ServerMessage:
        """
        创建智能体回复开始前的任务消息（空内容文本卡片）

        Args:
            event: 智能体回复开始前事件

        Returns:
            ServerMessage: 大模型响应开始前的任务消息
        """
        # 按照其他方法的模式，从 tool_context 获取 agent_context
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 空内容
        content = ""

        # 获取序列号和task_id
        seq_id = agent_context.get_next_seq_id()
        task_id = agent_context.get_task_id() or ""

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.AGENT_REPLY,  # 使用智能体文本回复类型
            status=TaskStatus.RUNNING,
            content=content,
            event=EventType.BEFORE_AGENT_REPLY,  # 使用枚举类型
            show_in_ui=True,
            seq_id=seq_id,
            correlation_id=event.data.correlation_id,  # 传入关联ID
            parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
            content_type=event.data.content_type,  # 传递内容类型
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload
        )

    @classmethod
    def create_after_agent_reply_message(cls, event: Event[AfterAgentReplyEventData]) -> ServerMessage:
        """
        创建智能体回复完成后的任务消息（AFTER_AGENT_REPLY 事件）

        Args:
            event: 智能体回复完成后事件（AfterAgentReplyEventData）

        Returns:
            ServerMessage: 大模型响应完成后的任务消息
        """
        # 从 tool_context 获取 agent_context
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 获取响应内容
        content = ""
        if event.data.llm_response_message and event.data.llm_response_message.content:
            content = event.data.llm_response_message.content
            logger.info(f"[消息工厂] AFTER_AGENT_REPLY 获取到content: '{content}'")

        # 获取序列号和task_id
        seq_id = agent_context.get_next_seq_id()
        task_id = agent_context.get_task_id() or ""

        # 设置任务状态为运行中
        status = TaskStatus.RUNNING

        # 处理token使用数据
        token_usage_report = None
        if event.data.token_usage:
            # token_usage 已经是 TokenUsage 对象，直接使用
            token_usage_report = TokenUsageCollection.create_item_report(event.data.token_usage)

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.AGENT_REPLY,  # 使用智能体文本回复类型
            status=status,
            content=content,
            event=EventType.AFTER_AGENT_REPLY,  # 新的事件类型
            show_in_ui=True,
            seq_id=seq_id,
            correlation_id=event.data.correlation_id,  # 传入关联ID
            parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
            content_type=event.data.content_type,  # 传递内容类型
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload,
            token_usage_details=token_usage_report
        )

    @classmethod
    async def create_before_tool_call_message(cls, event: Event[BeforeToolCallEventData]) -> ServerMessage:
        """
        创建工具调用前的任务消息

        Args:
            event: 工具调用前事件

        Returns:
            TaskMessage: 工具调用前的任务消息
        """
        tool_name = event.data.tool_name
        tool_instance = event.data.tool_instance

        # BEFORE_TOOL_CALL 只通知工具调用信息，不需要内容
        content = ""

        # 获取工具调用前的友好动作和备注信息
        friendly_action_and_remark = await tool_instance.get_before_tool_call_friendly_action_and_remark(
            tool_name, event.data.tool_context, event.data.arguments
        )

        # 获取工具调用前的详细信息
        tool_detail = None
        try:
            tool_detail = await tool_instance.get_before_tool_detail(
                event.data.tool_context, event.data.arguments
            )
        except Exception as e:
            logger.warning(f"获取工具调用前详细信息失败: {e}")

        # 创建工具对象，显示即将调用的工具信息
        tool = Tool(
            id=event.data.tool_call.id,
            name=friendly_action_and_remark.get("tool_name", tool_name),
            action=friendly_action_and_remark.get("action", ""),
            status=ToolStatus.RUNNING,  # 即将调用，状态为运行中
            remark=friendly_action_and_remark.get("remark", ""),
            detail=tool_detail,  # 工具详细信息
            attachments=None
        )

        # 获取序列号 和 task_id
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        seq_id = agent_context.get_next_seq_id()
        task_id = agent_context.get_task_id() or ""

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        # 创建ServerMessage
        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.TOOL_CALL,
            status=TaskStatus.RUNNING,
            content=content,
            tool=tool,  # 添加工具信息
            event=EventType.BEFORE_TOOL_CALL,  # 使用枚举类型
            show_in_ui=True,
            seq_id=seq_id,  # 传递序列号
            correlation_id=event.data.correlation_id,  # 传入关联ID
            parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload
        )

    @classmethod
    async def create_pending_tool_call_message(cls, event: Event[PendingToolCallEventData]) -> ServerMessage:
        """
        创建工具调用解释等待任务消息
        """
        # 检查是否有自定义内容在 arguments 中
        arguments = getattr(event.data, 'arguments', {})
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        seq_id = agent_context.get_next_seq_id()  # 获取序列号
        tool = Tool(
            id=event.data.tool_context.tool_call_id,
            name=arguments['name'],
            action= arguments['action'],
            status=ToolStatus.RUNNING,
            remark=arguments['detail']['data']['message'],
            detail=arguments['detail'],
            attachments=None
        )

        # Get correlation_id: prioritize event.data.correlation_id, fallback to arguments
        event_correlation_id = event.data.correlation_id
        arguments_correlation_id = arguments.get('correlation_id')
        correlation_id = event_correlation_id or arguments_correlation_id

        # 添加日志 - 调试 correlation_id 来源
        logger.info(f"[create_pending_tool_call_message] event.data.correlation_id: {event_correlation_id}, "
                   f"arguments.correlation_id: {arguments_correlation_id}, "
                   f"final correlation_id: {correlation_id}")

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.TOOL_CALL,
                status=TaskStatus.RUNNING,
                content=arguments['action'],
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                correlation_id=correlation_id,  # 传递关联ID
                parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
                tool=tool
            )
        )

    @classmethod
    async def create_after_tool_call_message(cls, event: Event[AfterToolCallEventData]) -> ServerMessage:
        """
        创建工具调用后的任务消息

        Args:
            event: 工具调用后事件

        Returns:
            TaskMessage: 工具调用后的任务消息
        """
        tool_name = event.data.tool_name
        execution_time = event.data.execution_time
        result = event.data.result

        tool_instance = event.data.tool_instance

        # 从事件上下文中获取附件列表
        event_context = event.data.tool_context.get_extension_typed("event_context", EventContext)
        attachments = []
        if event_context:
            attachments = event_context.attachments
        else:
            logger.debug("未找到事件上下文，使用空附件列表")

        # 获取工具调用后的友好内容
        content = ""

        message_type = MessageType.TOOL_CALL
        status = TaskStatus.RUNNING

        tool_detail = await tool_instance.get_tool_detail(event.data.tool_context, result, event.data.arguments)

        friendly_action_and_remark = await tool_instance.get_after_tool_call_friendly_action_and_remark(
            tool_name, event.data.tool_context, result, execution_time, event.data.arguments
        )

        remark_value = friendly_action_and_remark.get("remark", "")

        # 根据工具执行结果设置工具状态
        if result and not result.ok:
            tool_status = ToolStatus.ERROR
            # 失败场景：根据 use_custom_remark 参数决定是否使用工具自定义的 remark
            if not result.use_custom_remark:
                remark_value = i18n.translate("tool.call_failed_remark", category="tool.messages")
            logger.info(f"工具调用失败，设置工具状态为ERROR: {tool_name}")
        else:
            tool_status = ToolStatus.FINISHED

        # 创建工具对象
        # 失败时强制清空 remark
        tool = Tool(
            id=event.data.tool_call.id,
            name=friendly_action_and_remark.get("tool_name", tool_name),
            action=friendly_action_and_remark.get("action", ""),
            status=tool_status,  # 使用根据结果设置的状态
            remark=remark_value,
            detail=tool_detail,
            attachments=attachments
        )

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 确保 task_id 不为 None，如果为 None 则使用空字符串
        task_id = agent_context.get_task_id() or ""

        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        # Get parent_correlation_id: prioritize event data, fallback to agent_context
        parent_correlation_id = event.data.parent_correlation_id or agent_context.get_thinking_correlation_id()

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=task_id,
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=message_type,
                status=status,
                content=content,
                tool=tool,
                event=event.event_type,
                show_in_ui=True,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id,  # 传入关联ID
                parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
            )
        )

    @classmethod
    def create_before_safety_check_message(cls, event: Event[BeforeSafetyCheckEventData]) -> ServerMessage:
        """
        创建安全检查前的任务消息

        Args:
            event: 安全检查前事件

        Returns:
            ServerMessage: 安全检查前的任务消息
        """
        content = "正在进行安全检查"

        agent_context = event.data.agent_context
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=TaskStatus.RUNNING,
                content=content,
                event=event.event_type,
                show_in_ui=False,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id  # 传入关联ID
            )
        )

    @classmethod
    def create_after_safety_check_message(cls, event: Event[AfterSafetyCheckEventData]) -> ServerMessage:
        """
        创建安全检查后的任务消息

        Args:
            event: 安全检查后事件

        Returns:
            ServerMessage: 安全检查后的任务消息
        """
        if event.data.is_safe:
            content = "安全检查通过"
            status = TaskStatus.RUNNING
        else:
            content = "安全检查未通过"
            status = TaskStatus.RUNNING

        agent_context = event.data.agent_context
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=status,
                content=content,
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id  # 传入关联ID
            )
        )

    @classmethod
    def create_before_mcp_init_message(cls, event: Event[BeforeMcpInitEventData]) -> ServerMessage:
        """
        创建 MCP 初始化前的任务消息

        Args:
            event: MCP 初始化前事件

        Returns:
            ServerMessage: MCP 初始化前的任务消息
        """
        agent_context = event.data.agent_context
        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        # 构建显示内容
        extension_names = [config.name for config in event.data.server_configs]
        extensions_text = ", ".join(extension_names)
        content = f"MCP 初始化中，正在安装{extensions_text}"

        # 构建详细信息，包含配置摘要
        config_details = []
        for config in event.data.server_configs:
            # 检查是否有 label_names 且不为空
            if config.label_names and len(config.label_names) > 0:
                # 拆分：为每个 label_name 创建一个配置条目
                for label_name in config.label_names:
                    config_details.append({
                        "name": config.name,
                        "type": config.type,
                        "source": config.source,
                        "label_name": label_name
                    })
            else:
                # 没有 label_names 或为空，使用原始逻辑
                config_details.append({
                    "name": config.name,
                    "type": config.type,
                    "source": config.source,
                    "label_name": config.label_name
                })

        detail_data = {
            "phase": "before_init",
            "server_count": event.data.server_count,
            "server_configs": config_details,
            "timestamp": str(datetime.now())
        }

        # 创建 ToolDetail 对象
        detail = ToolDetail(
            type=DisplayType.MCP_INIT,
            data=detail_data
        )

        logger.info(i18n.translate("mcp_init.start", category="tool.messages", content=content))

        agent_context = event.data.agent_context

        # 创建工具对象
        tool = Tool(
            id=agent_context.get_task_id() or "",
            name="mcp_init",
            action="MCP 初始化开始",
            status=ToolStatus.RUNNING,
            remark=extensions_text,
            detail=detail,
            attachments=[]
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id() or "",
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.TOOL_CALL,
                status=TaskStatus.RUNNING,
                content=content,
                tool=tool,
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id  # 传入关联ID
            )
        )

    @classmethod
    def create_after_mcp_init_message(cls, event: Event[AfterMcpInitEventData]) -> ServerMessage:
        """
        创建 MCP 初始化后的任务消息

        Args:
            event: MCP 初始化后事件

        Returns:
            ServerMessage: MCP 初始化后的任务消息
        """
        # 构建显示内容 - 显示具体的成功和失败服务器
        successful_servers = []
        failed_servers = []

        # 从详细的服务器结果构建消息
        if hasattr(event.data, 'server_results') and event.data.server_results:
            for result in event.data.server_results:
                server_name = getattr(result, 'name', 'unknown')
                server_status = getattr(result, 'status', 'unknown')

                if server_status == 'success':
                    successful_servers.append(server_name)
                else:
                    failed_servers.append(server_name)

        # 构建详细消息
        result_parts = []
        if successful_servers:
            success_text = i18n.translate("mcp_server.success", category="tool.messages", servers=', '.join(successful_servers))
            result_parts.append(success_text)
        if failed_servers:
            failed_text = i18n.translate("mcp_server.failed", category="tool.messages", servers=', '.join(failed_servers))
            result_parts.append(failed_text)

        result_text = "；".join(result_parts) if result_parts else "无结果"
        content = f"MCP 初始化完成，{result_text}"

        if event.data.success:
            status = TaskStatus.RUNNING
            tool_status = ToolStatus.FINISHED
        else:
            status = TaskStatus.RUNNING  # 即使 MCP 初始化失败，任务仍可继续
            tool_status = ToolStatus.ERROR

        # 构建详细信息
        config_details = []
        extension_names = []
        for config in event.data.server_configs:
            # 检查是否有 label_names 且不为空
            if config.label_names and len(config.label_names) > 0:
                # 拆分：为每个 label_name 创建一个配置条目
                for label_name in config.label_names:
                    config_details.append({
                        "name": config.name,
                        "type": config.type,
                        "source": config.source,
                        "label_name": label_name
                    })
            else:
                # 没有 label_names 或为空，使用原始逻辑
                config_details.append({
                    "name": config.name,
                    "type": config.type,
                    "source": config.source,
                    "label_name": config.label_name
                })
            extension_names.append(config.name)

        extensions_text = ", ".join(extension_names)

        detail_data = {
            "phase": "after_init",
            "success": event.data.success,
            "initialized_count": event.data.initialized_count,
            "total_count": event.data.total_count,
            "server_configs": config_details,
            "error": event.data.error,
            "timestamp": str(datetime.now())
        }

        # 添加详细的服务器初始化结果
        if hasattr(event.data, 'server_results') and event.data.server_results:
            server_results_data = []

            # 创建 server_config 名称到配置的映射
            config_map = {config.name: config for config in event.data.server_configs}

            # 为了拆分 server_results，我们需要将它们与 server_configs 通过名称匹配
            for result in event.data.server_results:
                # 获取对应的 server_config（通过名称匹配，而不是索引）
                result_name = getattr(result, 'name', 'unknown')
                config = config_map.get(result_name)

                # 转换 result 为字典格式
                if hasattr(result, 'to_dict'):
                    result_dict = result.to_dict()
                elif isinstance(result, dict):
                    result_dict = result
                else:
                    # 如果是其他类型，转换为字典
                    result_dict = {
                        "name": getattr(result, 'name', 'unknown'),
                        "status": getattr(result, 'status', 'unknown'),
                        "duration": getattr(result, 'duration', 0.0),
                        "tools": getattr(result, 'tools', []),
                        "tool_count": getattr(result, 'tool_count', 0),
                        "error": getattr(result, 'error', None),
                        "label_name": getattr(result, 'label_name', '')
                    }

                # 检查对应的 config 是否有 label_names 且不为空
                if config and config.label_names and len(config.label_names) > 0:
                    # 拆分：为每个 label_name 创建一个 server_result 条目
                    for label_name in config.label_names:
                        result_copy = result_dict.copy()
                        result_copy["label_name"] = label_name
                        server_results_data.append(result_copy)
                else:
                    # 没有 label_names 或为空，使用原始逻辑
                    # 如果找到了对应的配置，使用配置中的 label_name
                    if config:
                        result_dict["label_name"] = config.label_name
                    # 如果没有找到对应的配置，保持原有的 label_name（用于预先失败的结果）
                    server_results_data.append(result_dict)

            detail_data["server_results"] = server_results_data

        # 创建 ToolDetail 对象
        detail = ToolDetail(
            type=DisplayType.MCP_INIT,
            data=detail_data
        )

        logger.info(i18n.translate("mcp_init.success", category="tool.messages", content=content))
        if event.data.error:
            logger.warning(i18n.translate("mcp_init.error", category="tool.messages", error=event.data.error))

        agent_context = event.data.agent_context

        # 创建工具对象
        tool = Tool(
            id=agent_context.get_task_id() or "",
            name="mcp_init",
            action="初始化 MCP",
            status=tool_status,
            remark=extensions_text,
            detail=detail,
            attachments=[]
        )

        seq_id = agent_context.get_next_seq_id()  # 获取序列号

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id() or "",
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.TOOL_CALL,
                status=status,
                content="",
                tool=tool,
                event=event.event_type,
                seq_id=seq_id,  # 传递序列号
                correlation_id=event.data.correlation_id  # 传入关联ID
            )
        )

    @classmethod
    def _convert_to_final_attachments(cls, attachments: List[Attachment]) -> List[Attachment]:
        """
        将附件的 tag 从 PROCESS 转换为 FINAL

        此方法用于在任务完成时，将中间产物附件转换为最终产物附件。
        重要：保留原始的 file_key（包含目录的 "/" 后缀）

        Args:
            attachments: 原始附件列表

        Returns:
            List[Attachment]: tag 转换后的附件列表
        """
        if not attachments:
            return []

        final_attachments = []
        for att in attachments:
            # 创建新的 Attachment 对象，只修改 file_tag
            final_attachment = Attachment(
                file_key=att.file_key,  # 保留原始 file_key（目录会有 "/"）
                file_tag=AttachmentTag.FINAL,  # PROCESS → FINAL
                file_extension=att.file_extension,
                filepath=att.filepath,
                filename=att.filename,
                display_filename=att.display_filename,
                file_size=att.file_size,
                file_url=att.file_url,
                timestamp=att.timestamp
            )
            final_attachments.append(final_attachment)
            logger.debug(f"转换附件 tag: {att.filename} (PROCESS → FINAL), file_key: {att.file_key}")

        logger.info(f"成功转换 {len(final_attachments)} 个附件为 FINAL tag")
        return final_attachments
