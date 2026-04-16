"""
V2 消息工厂：将事件转换为 super_magic_message 格式的 ServerMessage。

消息结构对齐 OpenAI ChatCompletion Message，核心字段：
- role: "assistant" | "tool"
- content / reasoning_content / tool_calls / tool_call_id / tool
- correlation_id / topic_id / task_id / status
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from agentlang.event.data import (
    AfterAgentReplyEventData,
    AfterInitEventData,
    AfterMainAgentRunEventData,
    AfterToolCallEventData,
    BeforeAgentReplyEventData,
    BeforeAgentThinkEventData,
    AfterAgentThinkEventData,
    BeforeInitEventData,
    BeforeLlmRequestEventData,
    AfterLlmResponseEventData,
    BeforeToolCallEventData,
    PendingToolCallEventData,
)
from agentlang.event.event import Event, EventType
from agentlang.llms.token_usage.models import TokenUsageCollection
from agentlang.logger import get_logger
from agentlang.utils.snowflake import Snowflake
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import Attachment, AttachmentTag
from app.core.entity.event.event import (
    AfterClientChatEventData,
    AfterMcpInitEventData,
    BeforeMcpInitEventData,
)
from app.core.entity.event.event_context import EventContext
from app.core.entity.final_task_state import FinalTaskState, render_final_task_state_message
from app.core.entity.project_archive import ProjectArchiveInfo
from app.core.entity.message.message import MessageType
from app.core.entity.message.server_message import (
    DisplayType,
    ServerMessage,
    ServerMessagePayload,
    TaskStatus,
    Tool,
    ToolDetail,
    ToolStatus,
)
from app.core.entity.factory.task_message_factory_protocol import TaskMessageFactoryProtocol
from app.i18n import i18n
from app.utils.attachment_sorter import AttachmentSorter

logger = get_logger(__name__)


class TaskMessageFactoryV2(TaskMessageFactoryProtocol):
    """
    V2 消息工厂：所有非流式事件统一构建为 super_magic_message 格式。
    """

    # ──────────────────────────────────────────────
    # 公共构建方法
    # ──────────────────────────────────────────────

    @staticmethod
    def _make_tool_call_id(correlation_id: Optional[str]) -> str:
        """基于 correlation_id 生成形如 call_xxxx 的工具调用 ID。

        before/after 配对事件共享同一个 correlation_id，因此生成的 ID 天然一致可匹配。
        若 correlation_id 为空则回退到随机 UUID。
        """
        import uuid
        source = correlation_id if correlation_id else uuid.uuid4().hex
        return f"call_{source.replace('-', '')[:24]}"

    @classmethod
    def _get_topic_id(cls, agent_context: AgentContext) -> str:
        """从 agent_context 获取 topic_id。
        优先从 get_metadata() 字典读取（文件持久化，init 事件也可用），
        兼容本地调试路径（无 topic_id 时返回空字符串）。
        """
        try:
            metadata = agent_context.get_metadata()
            topic_id = metadata.get("topic_id")
            if topic_id:
                return str(topic_id)
        except Exception:
            pass
        return ""

    @classmethod
    def _build_inner_message(
        cls,
        agent_context: AgentContext,
        *,
        role: str,
        correlation_id: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        构建 super_magic_message 内层数据。

        自动填充 topic_id / task_id / correlation_id，
        其余字段通过 **kwargs 按需传入（None 值自动过滤）。
        """
        msg: Dict[str, Any] = {
            "role": role,
            "correlation_id": correlation_id or "",
            "topic_id": cls._get_topic_id(agent_context),
            "task_id": agent_context.get_task_id() or "",
        }
        for k, v in kwargs.items():
            if v is not None:
                msg[k] = v
        return msg

    @classmethod
    def _build_and_send(
        cls,
        agent_context: AgentContext,
        inner_message: Dict[str, Any],
        *,
        status: TaskStatus,
        event_type: EventType,
        correlation_id: Optional[str] = None,
        show_in_ui: bool = True,
        message_id: Optional[str] = None,
        token_used: Optional[int] = None,
        attachments: Optional[List[Attachment]] = None,
        project_archive: Optional[ProjectArchiveInfo] = None,
        token_usage_details: Optional[TokenUsageCollection] = None,
        content: str = "",
        content_type: Optional[str] = None,
    ) -> ServerMessage:
        """
        统一构建 raw_content + payload + ServerMessage。
        """
        # 确保 message_id 在 inner_message 和外层 payload 中一致
        if message_id is None:
            message_id = str(Snowflake.create_default().get_id())
        inner_message["message_id"] = message_id

        raw_content = {
            "type": "super_magic_message",
            "super_magic_message": inner_message,
        }

        payload = ServerMessagePayload.create(
            task_id=agent_context.get_task_id() or "",
            sandbox_id=agent_context.get_sandbox_id(),
            message_type=MessageType.SUPER_MAGIC_MESSAGE,
            status=status,
            content=content,
            seq_id=agent_context.get_next_seq_id(),
            event=event_type,
            correlation_id=correlation_id,
            show_in_ui=show_in_ui,
            raw_content=raw_content,
            message_id=message_id,
            token_used=token_used,
            attachments=attachments,
            project_archive=project_archive,
            content_type=content_type,
        )

        return ServerMessage.create(
            metadata=agent_context.get_metadata(),
            payload=payload,
            token_usage_details=token_usage_details,
        )

    @classmethod
    def _build_tool_call_item(
        cls,
        tool_call_id: str,
        function_name: str,
        arguments: str = "{}",
        label: Optional[str] = None,
    ) -> Dict[str, Any]:
        """构建单个 tool_call 结构"""
        func: Dict[str, Any] = {"name": function_name}
        if label:
            func["label"] = label
        func["arguments"] = arguments
        return {
            "id": tool_call_id,
            "type": "function",
            "function": func,
        }

    @classmethod
    def _build_tool_object(
        cls,
        *,
        tool_id: str,
        name: str,
        action: str,
        status: ToolStatus,
        remark: str = "",
        detail: Optional[ToolDetail] = None,
        attachments: Optional[List[Attachment]] = None,
    ) -> Dict[str, Any]:
        """构建 tool 对象（序列化为 dict 以放入 inner_message）"""
        tool = Tool(
            id=tool_id,
            name=name,
            action=action,
            status=status,
            remark=remark,
            detail=detail,
            attachments=attachments or [],
        )
        return tool.model_dump(exclude_none=True)

    @classmethod
    def _build_mcp_config_details(cls, server_configs) -> List[Dict[str, Any]]:
        """构建 MCP 配置详情列表（before / after 共用）"""
        config_details = []
        for config in server_configs:
            if config.label_names and len(config.label_names) > 0:
                for label_name in config.label_names:
                    config_details.append({
                        "name": config.name,
                        "type": config.type,
                        "source": config.source,
                        "label_name": label_name,
                    })
            else:
                config_details.append({
                    "name": config.name,
                    "type": config.type,
                    "source": config.source,
                    "label_name": config.label_name,
                })
        return config_details

    # ──────────────────────────────────────────────
    # 错误消息（保持 CHAT 类型，不走 super_magic_message）
    # ──────────────────────────────────────────────

    @classmethod
    def create_error_message(
        cls,
        agent_context: AgentContext,
        final_task_state: FinalTaskState,
    ) -> ServerMessage:
        content = render_final_task_state_message(final_task_state) or i18n.translate(
            "messages.task.failed",
            category="common.messages",
        )
        return ServerMessage(
            metadata=agent_context.get_metadata(),
            payload=ServerMessagePayload.create(
                task_id="",
                sandbox_id=agent_context.get_sandbox_id(),
                message_type=MessageType.CHAT,
                status=final_task_state.task_status,
                content=content,
                seq_id=agent_context.get_next_seq_id(),
                event=EventType.ERROR,
            ),
        )

    # ──────────────────────────────────────────────
    # VM 初始化
    # ──────────────────────────────────────────────

    @classmethod
    def create_before_init_message(cls, event: Event[BeforeInitEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        content = i18n.translate("task_vm_init.start", category="tool.messages")

        tool_call_id = cls._make_tool_call_id(event.data.correlation_id)
        inner = cls._build_inner_message(
            agent_context,
            role="assistant",
            correlation_id=event.data.correlation_id,
            tool_calls=[cls._build_tool_call_item(
                tool_call_id, "init_virtual_machine",
                label=agent_context.get_tool_label("init_virtual_machine"),
            )],
            tool=cls._build_tool_object(
                tool_id=tool_call_id,
                name="init_virtual_machine",
                action=content,
                status=ToolStatus.RUNNING,
            ),
            status="waiting",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.WAITING,
            event_type=event.event_type,
            correlation_id=event.data.correlation_id,
        )

    @classmethod
    def create_after_init_message(cls, event: Event[AfterInitEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        if event.data.success:
            task_status = TaskStatus.RUNNING
            tool_status = ToolStatus.FINISHED
            content = i18n.translate("task_vm_init.success", category="tool.messages")
        else:
            task_status = TaskStatus.ERROR
            tool_status = ToolStatus.ERROR
            content = i18n.translate("task_vm_init.failed", category="tool.messages")

        tool_call_id = cls._make_tool_call_id(event.data.correlation_id)
        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            correlation_id=event.data.correlation_id,
            tool_call_id=tool_call_id,
            tool=cls._build_tool_object(
                tool_id=tool_call_id,
                name="init_virtual_machine",
                action=content,
                status=tool_status,
            ),
            status=task_status.value,
        )
        return cls._build_and_send(
            agent_context, inner,
            status=task_status,
            event_type=event.event_type,
            correlation_id=event.data.correlation_id,
        )

    # ──────────────────────────────────────────────
    # MCP 初始化
    # ──────────────────────────────────────────────

    @classmethod
    def create_before_mcp_init_message(cls, event: Event[BeforeMcpInitEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.agent_context

        extension_names = [config.name for config in event.data.server_configs]
        extensions_text = ", ".join(extension_names)

        config_details = cls._build_mcp_config_details(event.data.server_configs)
        detail = ToolDetail(
            type=DisplayType.MCP_INIT,
            data={
                "phase": "before_init",
                "server_count": event.data.server_count,
                "server_configs": config_details,
                "timestamp": str(datetime.now()),
            },
        )

        tool_call_id = agent_context.get_task_id() or ""
        inner = cls._build_inner_message(
            agent_context,
            role="assistant",
            correlation_id=event.data.correlation_id,
            tool_calls=[cls._build_tool_call_item(
                tool_call_id, "mcp_init",
                label=agent_context.get_tool_label("mcp_init"),
            )],
            tool=cls._build_tool_object(
                tool_id=tool_call_id,
                name="mcp_init",
                action=agent_context.get_tool_label("mcp_init"),
                status=ToolStatus.RUNNING,
                remark=extensions_text,
                detail=detail,
            ),
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=event.event_type,
            correlation_id=event.data.correlation_id,
        )

    @classmethod
    def create_after_mcp_init_message(cls, event: Event[AfterMcpInitEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.agent_context

        # 构建成功/失败服务器列表
        successful_servers = []
        failed_servers = []
        if event.data.server_results:
            for result in event.data.server_results:
                server_name = getattr(result, "name", "unknown")
                server_status = getattr(result, "status", "unknown")
                if server_status == "success":
                    successful_servers.append(server_name)
                else:
                    failed_servers.append(server_name)

        result_parts = []
        if successful_servers:
            result_parts.append(
                i18n.translate("mcp_server.success", category="tool.messages", servers=", ".join(successful_servers))
            )
        if failed_servers:
            result_parts.append(
                i18n.translate("mcp_server.failed", category="tool.messages", servers=", ".join(failed_servers))
            )

        if event.data.success:
            tool_status = ToolStatus.FINISHED
        else:
            tool_status = ToolStatus.ERROR

        config_details = cls._build_mcp_config_details(event.data.server_configs)
        extension_names = [config.name for config in event.data.server_configs]
        extensions_text = ", ".join(extension_names)

        detail_data: Dict[str, Any] = {
            "phase": "after_init",
            "success": event.data.success,
            "initialized_count": event.data.initialized_count,
            "total_count": event.data.total_count,
            "server_configs": config_details,
            "error": event.data.error,
            "timestamp": str(datetime.now()),
        }

        # 添加服务器初始化结果
        if event.data.server_results:
            config_map = {config.name: config for config in event.data.server_configs}
            server_results_data = []
            for result in event.data.server_results:
                result_name = getattr(result, "name", "unknown")
                config = config_map.get(result_name)
                if isinstance(result, dict):
                    result_dict = result
                elif callable(getattr(result, "to_dict", None)):
                    result_dict = result.to_dict()
                else:
                    result_dict = {
                        "name": getattr(result, "name", "unknown"),
                        "status": getattr(result, "status", "unknown"),
                        "duration": getattr(result, "duration", 0.0),
                        "tools": getattr(result, "tools", []),
                        "tool_count": getattr(result, "tool_count", 0),
                        "error": getattr(result, "error", None),
                        "label_name": getattr(result, "label_name", ""),
                    }
                if config and config.label_names and len(config.label_names) > 0:
                    for label_name in config.label_names:
                        result_copy = result_dict.copy()
                        result_copy["label_name"] = label_name
                        server_results_data.append(result_copy)
                else:
                    if config:
                        result_dict["label_name"] = config.label_name
                    server_results_data.append(result_dict)
            detail_data["server_results"] = server_results_data

        detail = ToolDetail(type=DisplayType.MCP_INIT, data=detail_data)

        tool_call_id = agent_context.get_task_id() or ""
        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            correlation_id=event.data.correlation_id,
            tool_call_id=tool_call_id,
            tool=cls._build_tool_object(
                tool_id=tool_call_id,
                name="mcp_init",
                action=agent_context.get_tool_label("mcp_init"),
                status=tool_status,
                remark=extensions_text,
                detail=detail,
            ),
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=event.event_type,
            correlation_id=event.data.correlation_id,
        )

    # ──────────────────────────────────────────────
    # Agent Reply（含批量 tool_calls 暂存逻辑）
    # ──────────────────────────────────────────────

    @classmethod
    def create_after_agent_reply_message(cls, event: Event[AfterAgentReplyEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 提取 LLM 响应数据
        content = ""
        reasoning_content = ""
        tool_calls_raw = None

        llm_msg = event.data.llm_response_message
        if llm_msg:
            content = llm_msg.content or ""
            reasoning_content = getattr(llm_msg, "reasoning_content", "") or ""
            if llm_msg.tool_calls:
                tool_calls_raw = [
                    cls._build_tool_call_item(
                        tc.id,
                        tc.function.name,
                        tc.function.arguments,
                        label=agent_context.get_tool_label(tc.function.name),
                    )
                    for tc in llm_msg.tool_calls
                ]

        # 获取预生成的 message_id（由 streaming_handler_v2 写入）
        pending_state = agent_context.get_pending_reply_state()
        message_id = pending_state.message_id if pending_state else None

        # 有 tool_calls → 暂存，不发送消息（等 before_tool_call 消费）
        if tool_calls_raw:
            from app.core.context.pending_reply_state import PendingReplyState
            agent_context.set_pending_reply_state(PendingReplyState(
                content=content,
                reasoning=reasoning_content,
                correlation_id=event.data.correlation_id,
                message_id=message_id,
                tool_calls=tool_calls_raw,
            ))
            return None

        # 无 tool_calls → 直接发送 assistant 消息
        token_usage_report = None
        if event.data.token_usage:
            token_usage_report = TokenUsageCollection.create_item_report(event.data.token_usage)

        inner = cls._build_inner_message(
            agent_context,
            role="assistant",
            correlation_id=event.data.correlation_id,
            content=content,
            reasoning_content=reasoning_content,
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=EventType.AFTER_AGENT_REPLY,
            correlation_id=event.data.correlation_id,
            message_id=message_id,
            content_type="content",
            token_usage_details=token_usage_report,
        )

    # ──────────────────────────────────────────────
    # Tool Call（before / pending / after + 批量逻辑）
    # ──────────────────────────────────────────────

    @classmethod
    async def create_before_tool_call_message(cls, event: Event[BeforeToolCallEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)

        # 检查是否有暂存的 agent_reply（批量 tool_calls 的第一个工具）
        pending_state = agent_context.get_pending_reply_state()

        if pending_state and pending_state.tool_calls:
            # 第一个 before_tool_call：消费暂存数据，发送携带完整 tool_calls 的 assistant 消息
            consumed = pending_state.consume_for_first_tool_call()
            if consumed:
                p_content, p_reasoning, p_tool_calls, p_message_id = consumed

                # pending_state.correlation_id 是 LLM 请求 ID，与流式 chunk 的 correlation_id 一致
                llm_correlation_id = pending_state.correlation_id

                # 设置批量计数
                batch_size = len(p_tool_calls)
                if batch_size > 1:
                    pending_state.batch_remaining = batch_size - 1
                    # 批次主 correlation_id 统一使用 LLM 请求 ID，与流式保持一致
                    pending_state.batch_main_correlation_id = llm_correlation_id
                    # 收集后续 tool_call_id
                    pending_state.batch_subsequent_ids = {tc["id"] for tc in p_tool_calls[1:]}

                # 获取工具展示信息
                tool_instance = event.data.tool_instance
                friendly = await tool_instance.get_before_tool_call_friendly_action_and_remark(
                    event.data.tool_name, event.data.tool_context, event.data.arguments
                )
                tool_detail = None
                try:
                    tool_detail = await tool_instance.get_before_tool_detail(
                        event.data.tool_context, event.data.arguments
                    )
                except Exception as e:
                    logger.warning(f"获取工具调用前详细信息失败: {e}")

                # 用 friendly action 更新第一个 tool_call 的 label（比 after_agent_reply 阶段的 i18n 静态值更精确）
                action_label = friendly.get("action", "")
                if action_label and p_tool_calls:
                    p_tool_calls[0]["function"]["label"] = action_label

                inner = cls._build_inner_message(
                    agent_context,
                    role="assistant",
                    # correlation_id 使用 LLM 请求 ID，与流式 chunk 对齐，after_tool_call 也使用相同值
                    correlation_id=llm_correlation_id,
                    content=p_content or None,
                    reasoning_content=p_reasoning or None,
                    tool_calls=p_tool_calls,
                    tool=cls._build_tool_object(
                        tool_id=event.data.tool_call.id,
                        name=friendly.get("tool_name", event.data.tool_name),
                        action=friendly.get("action", ""),
                        status=ToolStatus.RUNNING,
                        remark=friendly.get("remark", ""),
                        detail=tool_detail,
                    ),
                    status="running",
                )
                return cls._build_and_send(
                    agent_context, inner,
                    status=TaskStatus.RUNNING,
                    event_type=EventType.BEFORE_TOOL_CALL,
                    # 外层 correlation_id 使用 LLM 请求 ID，与流式 chunk 及 after_tool_call 对齐
                    correlation_id=llm_correlation_id,
                    message_id=p_message_id,
                )

        # 检查是否应跳过（同批次后续 before_tool_call）
        if pending_state and pending_state.should_skip_tool_call():
            return None

        # 普通单次 tool_call（无暂存数据）
        tool_instance = event.data.tool_instance
        friendly = await tool_instance.get_before_tool_call_friendly_action_and_remark(
            event.data.tool_name, event.data.tool_context, event.data.arguments
        )
        tool_detail = None
        try:
            tool_detail = await tool_instance.get_before_tool_detail(
                event.data.tool_context, event.data.arguments
            )
        except Exception as e:
            logger.warning(f"获取工具调用前详细信息失败: {e}")

        inner = cls._build_inner_message(
            agent_context,
            role="assistant",
            correlation_id=event.data.correlation_id,
            tool_calls=[cls._build_tool_call_item(
                event.data.tool_call.id,
                event.data.tool_name,
                label=friendly.get("action", ""),
            )],
            tool=cls._build_tool_object(
                tool_id=event.data.tool_call.id,
                name=friendly.get("tool_name", event.data.tool_name),
                action=friendly.get("action", ""),
                status=ToolStatus.RUNNING,
                remark=friendly.get("remark", ""),
                detail=tool_detail,
            ),
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=EventType.BEFORE_TOOL_CALL,
            correlation_id=event.data.correlation_id,
        )

    @classmethod
    async def create_pending_tool_call_message(cls, event: Event[PendingToolCallEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        arguments = getattr(event.data, "arguments", {})

        # correlation_id 优先用 event.data，fallback 到 arguments
        correlation_id = event.data.correlation_id or arguments.get("correlation_id")

        # 批量工具场景：覆盖 correlation_id
        pending_state = agent_context.get_pending_reply_state()
        if pending_state:
            correlation_id = pending_state.resolve_effective_correlation_id(
                event.data.tool_context.tool_call_id, correlation_id
            )

        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            correlation_id=correlation_id,
            tool_call_id=event.data.tool_context.tool_call_id,
            tool=cls._build_tool_object(
                tool_id=event.data.tool_context.tool_call_id,
                name=arguments.get("name", ""),
                action=arguments.get("action", ""),
                status=ToolStatus.RUNNING,
                remark=arguments.get("detail", {}).get("data", {}).get("message", ""),
                detail=arguments.get("detail"),
            ),
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=event.event_type,
            correlation_id=correlation_id,
        )

    @classmethod
    async def create_after_tool_call_message(cls, event: Event[AfterToolCallEventData]) -> Optional[ServerMessage]:
        agent_context = event.data.tool_context.get_extension_typed("agent_context", AgentContext)
        tool_instance = event.data.tool_instance
        result = event.data.result

        # 获取工具展示信息
        tool_detail = await tool_instance.get_tool_detail(
            event.data.tool_context, result, event.data.arguments
        )
        friendly = await tool_instance.get_after_tool_call_friendly_action_and_remark(
            event.data.tool_name, event.data.tool_context, result,
            event.data.execution_time, event.data.arguments,
        )

        # 获取附件
        event_context = event.data.tool_context.get_extension_typed("event_context", EventContext)
        attachments = event_context.attachments if event_context else []

        # 设置工具状态
        remark_value = friendly.get("remark", "")
        if result and not result.ok:
            tool_status = ToolStatus.ERROR
            if not result.use_custom_remark:
                remark_value = i18n.translate("tool.call_failed_remark", category="tool.messages")
        else:
            tool_status = ToolStatus.FINISHED

        # 使用 LLM 请求 ID 作为 correlation_id，与流式 chunk 及 before_tool_call 对齐
        # pending_state.correlation_id 在 after_agent_reply 暂存时设置为 LLM 请求 ID
        correlation_id = event.data.correlation_id
        pending_state = agent_context.get_pending_reply_state()
        if pending_state and pending_state.correlation_id:
            correlation_id = pending_state.correlation_id

        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            correlation_id=correlation_id,
            tool_call_id=event.data.tool_call.id,
            tool=cls._build_tool_object(
                tool_id=event.data.tool_call.id,
                name=friendly.get("tool_name", event.data.tool_name),
                action=friendly.get("action", ""),
                status=tool_status,
                remark=remark_value,
                detail=tool_detail,
                attachments=attachments,
            ),
            status="running",
        )
        return cls._build_and_send(
            agent_context, inner,
            status=TaskStatus.RUNNING,
            event_type=event.event_type,
            correlation_id=correlation_id,
        )

    # ──────────────────────────────────────────────
    # 任务完成 / 挂起
    # ──────────────────────────────────────────────

    @classmethod
    async def create_after_main_agent_run_message(cls, event: Event[AfterMainAgentRunEventData]) -> ServerMessage:
        agent_context: AgentContext = event.data.agent_context

        # 使用 AttachmentSorter 获取处理后的附件
        processed_attachments = AttachmentSorter.get_processed_attachments(agent_context)
        attachments = cls._convert_to_final_attachments(processed_attachments)

        project_archive = agent_context.get_project_archive_info()

        # 根据 agent_state 决定最终消息状态
        final_task_state = agent_context.get_final_task_state()
        if final_task_state:
            status = final_task_state.task_status
            content = render_final_task_state_message(final_task_state) or (
                i18n.translate("messages.agent_suspended", category="common.messages")
                if status == TaskStatus.SUSPENDED
                else i18n.translate("messages.task.failed", category="common.messages")
            )
        elif event.data.agent_state == TaskStatus.FINISHED.value:
            status = TaskStatus.FINISHED
            content = i18n.translate("task.completed", category="tool.messages")
        elif event.data.agent_state == TaskStatus.SUSPENDED.value:
            status = TaskStatus.SUSPENDED
            content = i18n.translate("messages.agent_suspended", category="common.messages")
        else:
            status = TaskStatus.ERROR
            content = i18n.translate("messages.task.failed", category="common.messages")

        # 获取 token 总量
        token_used = None
        chat_history = getattr(agent_context, "chat_history", None)
        if chat_history:
            try:
                token_used = await chat_history.tokens_count()
            except Exception as e:
                logger.error(f"获取 token 总量失败: {e}", exc_info=True)

        tool_call_id = cls._make_tool_call_id(event.data.correlation_id)
        tool_status = ToolStatus.FINISHED if status != TaskStatus.ERROR else ToolStatus.ERROR
        tool_obj = cls._build_tool_object(
            tool_id=tool_call_id,
            name="finish_task",
            action=content,
            status=tool_status,
            attachments=attachments if attachments else None,
        )

        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            correlation_id=event.data.correlation_id,
            tool_call_id=tool_call_id,
            content="",
            status=status.value,
            tool=tool_obj,
        )
        return cls._build_and_send(
            agent_context, inner,
            status=status,
            event_type=EventType.AFTER_MAIN_AGENT_RUN,
            correlation_id=event.data.correlation_id,
            token_used=token_used,
            attachments=attachments,
            project_archive=project_archive,
            content=content,
        )

    @classmethod
    def create_agent_suspended_message(
        cls,
        agent_context: AgentContext,
        final_task_state: FinalTaskState,
    ) -> ServerMessage:
        content = render_final_task_state_message(final_task_state) or i18n.translate(
            "messages.agent_suspended",
            category="common.messages",
        )
        status = final_task_state.task_status

        inner = cls._build_inner_message(
            agent_context,
            role="tool",
            content=content,
            status=status.value,
        )
        return cls._build_and_send(
            agent_context, inner,
            status=status,
            event_type=EventType.AGENT_SUSPENDED,
        )

    # ──────────────────────────────────────────────
    # 客户端聊天确认（v2 不发送）
    # ──────────────────────────────────────────────

    @classmethod
    def create_after_client_chat_message(cls, event: Event[AfterClientChatEventData]) -> Optional[ServerMessage]:
        return None

    # ──────────────────────────────────────────────
    # V2 不发送的事件（返回 None）
    # ──────────────────────────────────────────────

    @classmethod
    def create_before_llm_request_message(cls, event: Event[BeforeLlmRequestEventData]) -> Optional[ServerMessage]:
        return None

    @classmethod
    def create_after_llm_response_message(cls, event: Event[AfterLlmResponseEventData]) -> Optional[ServerMessage]:
        return None

    @classmethod
    def create_before_agent_think_message(cls, event: Event[BeforeAgentThinkEventData]) -> Optional[ServerMessage]:
        return None

    @classmethod
    def create_after_agent_think_message(cls, event: Event[AfterAgentThinkEventData]) -> Optional[ServerMessage]:
        return None

    @classmethod
    def create_before_agent_reply_message(cls, event: Event[BeforeAgentReplyEventData]) -> Optional[ServerMessage]:
        return None

    # ──────────────────────────────────────────────
    # 附件处理（复用 v1 逻辑）
    # ──────────────────────────────────────────────

    @classmethod
    def _convert_to_final_attachments(cls, attachments: List[Attachment]) -> List[Attachment]:
        if not attachments:
            return []
        final_attachments = []
        for att in attachments:
            final_attachment = Attachment(
                file_key=att.file_key,
                file_tag=AttachmentTag.FINAL,
                file_extension=att.file_extension,
                filepath=att.filepath,
                filename=att.filename,
                display_filename=att.display_filename,
                file_size=att.file_size,
                file_url=att.file_url,
                timestamp=att.timestamp,
            )
            final_attachments.append(final_attachment)
        return final_attachments
