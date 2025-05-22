"""
任务消息工厂模块

提供创建不同类型TaskMessage的工厂类
"""

import random
import time

from agentlang.event.data import (
    AfterInitEventData,
    AfterLlmResponseEventData,
    AfterMainAgentRunEventData,
    AfterToolCallEventData,
    BeforeInitEventData,
    BeforeLlmRequestEventData,
    BeforeToolCallEventData,
)
from agentlang.event.event import Event, EventType
from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import AttachmentTag
from app.core.entity.event.event import (
    AfterClientChatEventData,
    AfterSafetyCheckEventData,
    BeforeSafetyCheckEventData,
)
from app.core.entity.event.event_context import EventContext
from app.core.entity.message.server_message import (
    MessageType,
    ServerMessage,
    ServerMessagePayload,
    TaskStatus,
    Tool,
    ToolStatus,
)

logger = get_logger(__name__)

class TaskMessageFactory:
    """任务消息工厂类，用于创建不同类型的TaskMessage对象"""

    @classmethod
    def create_error_message(cls, agent_context: AgentContext, error_message: str) -> ServerMessage:
        """
        创建错误消息
        """
        return ServerMessage(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id="",
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.ERROR,
                content=error_message,
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
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.INIT,
                status=TaskStatus.WAITING,
                content="工作区正在初始化",
                event=event.event_type
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
            content = "虚拟机初始化完成"
        else:
            status = TaskStatus.ERROR
            content = "虚拟机初始化失败"

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.INIT,
                status=status,
                content="",
                event=event.event_type,
                tool=Tool(
                    id=agent_context.get_task_id(),
                    name="finish_task",
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
        return ServerMessage.create(
            metadata=event.data.agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=event.data.agent_context.get_task_id(),
                sandbox_id=event.data.agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.RUNNING,
                content="ok",
                event=EventType.AFTER_CLIENT_CHAT
            )
        )
        # 创建挂起消息
    @classmethod
    def create_agent_suspended_message(cls, agent_context: AgentContext) -> ServerMessage:
        """
        创建挂起消息
        """
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=TaskStatus.SUSPENDED,
                content="任务已终止",
                event=EventType.AGENT_SUSPENDED
            )
        )

    @classmethod
    def create_after_main_agent_run_message(cls, event: Event[AfterMainAgentRunEventData]) -> ServerMessage:
        """
        创建主 agent 运行后消息

        Args:
            event: 主agent运行后事件，包含AfterMainAgentRunEventData数据

        Returns:
            ServerMessage: 主 agent 完成任务的消息
        """
        agent_context: AgentContext = event.data.agent_context
        all_attachments = agent_context.get_attachments()
        # Filter out browser attachments first
        filtered_attachments = [attachment for attachment in all_attachments
                                if attachment.file_tag != AttachmentTag.BROWSER]
        # Sort the filtered attachments by timestamp in descending order
        attachments = sorted(filtered_attachments, key=lambda att: att.timestamp, reverse=True)

        logger.info(f"创建主 agent 完成消息，过滤掉了 {len(all_attachments) - len(attachments)} 个浏览器附件，并按时间戳排序")

        # 获取项目压缩包信息（如果存在）
        project_archive = agent_context.get_project_archive_info()
        if project_archive:
            logger.info(f"从 SharedContext 获取到项目压缩包信息: key={project_archive.file_key}")

        if event.data.agent_state == TaskStatus.FINISHED.value:
            status = TaskStatus.FINISHED
            content = "任务已完成"
        else:
            status = TaskStatus.ERROR
            content = "任务执行结束"

        sleep_duration = random.uniform(1, 2)
        time.sleep(sleep_duration)
        logger.debug(f"Slept for {sleep_duration:.2f} seconds before LLM request")
        
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=status,
                content=content,
                attachments=attachments,
                project_archive=project_archive,
                event=EventType.AFTER_MAIN_AGENT_RUN
            )
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
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=TaskStatus.RUNNING,
                content=content,
                event=event.event_type
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
        content = ""
        llm_response_message = event.data.llm_response_message
        if llm_response_message and llm_response_message.content:
            content = llm_response_message.content

        # 从事件数据中获取show_in_ui值
        show_in_ui = getattr(event.data, "show_in_ui", True)

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 确保 task_id 不为 None，如果为 None 则使用空字符串
        task_id = agent_context.get_task_id() or ""
        
        # 从事件数据中获取 token_usage_details
        token_usage_details_from_event = getattr(event.data, "token_usage", None)

        payload = ServerMessagePayload.create(
            task_id=task_id,
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.THINKING,
            status=TaskStatus.RUNNING,
            content=content,
            event=event.event_type,
            show_in_ui=show_in_ui,
            # token_usage_details is no longer part of ServerMessagePayload.create
        )
        
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=payload,
            token_usage_details=token_usage_details_from_event
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
        tool_instance = event.data.tool_instance
        # 如果大模型上一次已经返回了，就不再发送 content 内容了
        if event.data.llm_response_message.content and event.data.llm_response_message.content != "Continue":
            content = ""
        else:
            content = await tool_instance.get_before_tool_call_friendly_content(event.data.tool_context, event.data.arguments)

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 确保 task_id 不为 None
        task_id = agent_context.get_task_id() or ""

        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=task_id,
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.TOOL_CALL,
                status=TaskStatus.RUNNING,
                content=content,
                event=event.event_type
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

        # 1. 默认 content
        content = ""

        # 2. 尝试 get_after_tool_call_friendly_content
        friendly_content = await tool_instance.get_after_tool_call_friendly_content(
            event.data.tool_context, 
            result, 
            execution_time, 
            event.data.arguments
        )
        if friendly_content and friendly_content.strip():
            content = friendly_content

        # 3. 如果 friendly_content 为空, 尝试 result.explanation
        elif result.explanation is not None and result.explanation.strip():
            content = result.explanation

        message_type = MessageType.TOOL_CALL
        status = TaskStatus.RUNNING

        tool_detail = await tool_instance.get_tool_detail(event.data.tool_context, result, event.data.arguments)

        friendly_action_and_remark = await tool_instance.get_after_tool_call_friendly_action_and_remark(tool_name, event.data.tool_context, result, execution_time, event.data.arguments)

        # 创建工具对象
        tool = Tool(
            id=event.data.tool_call.id,
            name=tool_name,
            action=friendly_action_and_remark["action"],
            status=ToolStatus.FINISHED,
            remark=friendly_action_and_remark["remark"],
            detail=tool_detail,
            attachments=attachments
        )

        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 确保 task_id 不为 None，如果为 None 则使用空字符串
        task_id = agent_context.get_task_id() or ""

        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=task_id,
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=message_type,
                status=status,
                content=content,
                tool=tool,
                event=event.event_type
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
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=TaskStatus.RUNNING,
                content=content,
                event=event.event_type,
                show_in_ui=False
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
        return ServerMessage.create(
            metadata=agent_context.get_init_client_message_metadata(),
            payload=ServerMessagePayload.create(
                task_id=agent_context.get_task_id(),
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.THINKING,
                status=status,
                content=content,
                event=event.event_type
            )
        )
