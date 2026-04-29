"""
代理上下文类

管理与代理相关的业务参数
"""

import asyncio
import os
import json
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Type

from app.core.context.pending_reply_state import PendingReplyState

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon
    from app.core.entity.factory.task_message_factory_protocol import TaskMessageFactoryProtocol
from datetime import datetime, timedelta

from agentlang.context.base_agent_context import BaseAgentContext
from agentlang.context.shared_context import create_agent_shared_context
from app.core.config.communication_config import STSTokenRefreshConfig
from app.core.entity.agent_profile import AgentProfile, DEFAULT_AGENT_PROFILE
from app.core.entity.attachment import Attachment
from app.core.entity.message.client_message import ChatClientMessage, InitClientMessage, Metadata, User
from app.core.entity.project_archive import ProjectArchiveInfo
from agentlang.event.event import Event, EventType, StoppableEvent
from agentlang.event.common import BaseEventData
from app.core.stream import Stream
from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.core.context.run_interruption import RunCancelState, RunCleanupRegistry, RunCancellationHandle
from app.core.entity.final_task_state import FinalTaskState
from loguru import logger
from app.infrastructure.storage.types import PlatformType
from agentlang.llms.token_usage.models import TokenUsageCollection
from agentlang.llms.token_usage.report import TokenUsageReport

# 获取日志记录器
logger = get_logger(__name__)

# stop_run 等待 cancel_blocker 归零的最长时间（秒）
_CANCEL_BLOCKER_WAIT_TIMEOUT_S: float = 10.0


async def _auto_manage_correlation_id(event_type: EventType, data: BaseEventData) -> None:
    """
    自动管理事件关联数据

    Args:
        event_type: 事件类型
        data: 事件数据
    """
    from agentlang.event import (
        get_correlation_manager,
        is_before_event,
        is_after_event,
        get_event_pair_type,
        EventPairType
    )
    from app.tools.core.base_tool import BaseTool

    # 获取事件对类型
    event_pair_type = get_event_pair_type(event_type.value)
    if not event_pair_type:
        # 不是配对事件，无需处理
        return

    # 对于 TOOL_CALL 事件，检查工具实例的 should_trigger_events() 方法
    # 如果工具不应该触发事件，就不生成/消耗 correlation_id
    if event_pair_type == EventPairType.TOOL_CALL:
        if hasattr(data, 'tool_instance') and isinstance(data.tool_instance, BaseTool):
            if not data.tool_instance.should_trigger_events():
                # 工具设置了 should_trigger_events() = False，跳过 correlation_id 管理
                logger.debug(f"工具 {data.tool_instance.__class__.__name__} 设置了 should_trigger_events()=False，跳过 correlation_id 管理")
                return

    correlation_manager = get_correlation_manager()

    if is_before_event(event_type.value):
        # before 事件：生成 correlation_id
        if not data.correlation_id:  # 只有在没有手动设置时才自动生成
            correlation_id = correlation_manager.generate_for_before_event(event_pair_type)
            data.correlation_id = correlation_id
            logger.info(f"自动生成 correlation_id: {correlation_id} for {event_type}")

    elif is_after_event(event_type.value):
        # after 事件：消耗 correlation_id
        if not data.correlation_id:  # 只有在没有手动设置时才自动消耗
            consumed_correlation_id = correlation_manager.consume_for_after_event(event_pair_type)
            if consumed_correlation_id:
                data.correlation_id = consumed_correlation_id
                logger.info(f"自动消耗 correlation_id: {consumed_correlation_id} for {event_type}")
            else:
                logger.warning(f"无法找到对应的 correlation_id 用于 {event_type} 事件")


class AgentContext(BaseAgentContext):
    """
    代理上下文类，包含代理运行需要的上下文信息
    实现 AgentContextInterface 接口，提供用户和代理相关信息
    """

    def __init__(self, isolated: bool = False):
        """
        初始化代理上下文。

        Args:
            isolated: 若为 True，使用独立的 AgentSharedContext 实例而非全局单例。
                      子 Agent 并行运行时必须设为 True，避免 current_llm_request_id、
                      cancel_blocker_count 等字段被并发写入冲突。
                      主 Agent 始终使用默认值 False（全局单例）。
        """
        shared_context = create_agent_shared_context() if isolated else None
        super().__init__(shared_context=shared_context)

        # 普通路径与隔离路径都走同一初始化逻辑；共享实例由 is_initialized 保护避免重复注册。
        self._init_shared_fields()

        # 初始化中断事件通知
        self._interruption_event = asyncio.Event()
        self._cancelable_event = asyncio.Event()
        if self.shared_context.get_field("cancel_blocker_count") == 0:
            self._cancelable_event.set()
        self._subagent_depth = 0
        self._subagent_parent_agent_name: Optional[str] = None

        # 运行时身份 / 上下文标识
        # context_id 用于 Skill Code Mode 路由；
        self._context_id: str = uuid.uuid4().hex
        # agent_id 用于运行时 session 标识；
        self._agent_id: Optional[str] = None
        # horizon_agent_id 用于 Horizon 持久化文件名。
        self._horizon_agent_id: Optional[str] = None

        # 设置工作空间目录
        try:
            self.set_workspace_dir(str(PathManager.get_workspace_dir()))
        except Exception as e:
            logger.warning(f"无法获取工作空间目录: {e}")
            self.set_workspace_dir(os.path.join(os.getcwd(), ".workspace"))
            self.ensure_workspace_dir()

        # 设置聊天历史目录
        try:
            chat_history_dir = str(PathManager.get_chat_history_dir())
            self.set_chat_history_dir(chat_history_dir)
        except Exception as e:
            logger.warning(f"无法获取聊天历史目录: {e}")
            chat_history_dir = os.path.join(os.getcwd(), ".chat_history")
            self.set_chat_history_dir(chat_history_dir)

        # 设置默认代理名称
        self.set_agent_name("magic")

        # Agent Profile 配置
        self._agent_profile: AgentProfile = DEFAULT_AGENT_PROFILE

        # run-level interruption 框架，每次新 run 通过 reset_run_state() 重置
        self._run_cancel_state: RunCancelState = RunCancelState()
        self._run_cleanup_registry: RunCleanupRegistry = RunCleanupRegistry()
        self._run_cancellation_handle: RunCancellationHandle = RunCancellationHandle()
        self._stop_run_task: Optional[asyncio.Task] = None

        # AgentHorizon 懒初始化，per-agent 上下文工程基础设施
        self._horizon: Optional["AgentHorizon"] = None

    @property
    def context_id(self) -> str:
        """当前 AgentContext 实例的唯一标识符（UUID hex），供全局注册表路由使用。"""
        return self._context_id

    def set_subagent_depth(self, depth: int) -> None:
        """设置子 Agent 深度。"""
        self._subagent_depth = max(depth, 0)

    def get_subagent_depth(self) -> int:
        """获取当前子 Agent 深度。主 Agent 固定为 0。"""
        return self._subagent_depth

    def set_subagent_parent_agent_name(self, agent_name: Optional[str]) -> None:
        """记录调用当前子 Agent 的父 Agent 名称。"""
        self._subagent_parent_agent_name = agent_name

    def get_subagent_parent_agent_name(self) -> Optional[str]:
        """获取父 Agent 名称；主 Agent 返回 None。"""
        return self._subagent_parent_agent_name

    def set_agent_id(self, agent_id: str) -> None:
        """设置运行时 agent_id，并同步更新依赖该 ID 的上下文设施。"""
        self._agent_id = agent_id
        self.set_horizon_agent_id(agent_id)

    def get_agent_id(self) -> Optional[str]:
        """获取运行时 agent_id。"""
        return self._agent_id

    def get_agent_session_label(self) -> str:
        """获取用于日志和文件名的人类可读标识，如 `magic<main>`。"""
        agent_id = self._agent_id or "unknown"
        return f"{self.agent_name}<{agent_id}>"

    @property
    def horizon(self) -> "AgentHorizon":
        """per-agent 上下文工程基础设施（懒初始化）。"""
        if self._horizon is None:
            from app.core.horizon import AgentHorizon
            from app.core.horizon.store import HorizonStore

            # 用 agent_name（文件名如 "magic"），而非 get_agent_name()（返回 profile 显示名）
            agent_name = self.agent_name
            chat_history_dir = self.get_chat_history_dir()
            # agent_id 此时可能未设置，用 "main" 兜底；agent.py 初始化完成后可通过 reset 更新
            agent_id = getattr(self, "_horizon_agent_id", None) or "main"

            store = HorizonStore(
                chat_history_dir=chat_history_dir,
                agent_name=agent_name,
                agent_id=agent_id,
            )
            self._horizon = AgentHorizon(store=store, agent_id=agent_id, agent_context=self)
        return self._horizon

    def set_horizon_agent_id(self, agent_id: str) -> None:
        """在 agent.py 完成 ID 分配后调用，确保持久化文件名正确。

        若 horizon 还未初始化则直接设置待用 ID；
        若已初始化则重建（agent_id 改变时需要换文件）。
        """
        if self._horizon is None:
            self._horizon_agent_id = agent_id
        else:
            from app.core.horizon import AgentHorizon
            from app.core.horizon.store import HorizonStore
            agent_name = self.agent_name
            chat_history_dir = self.get_chat_history_dir()
            store = HorizonStore(
                chat_history_dir=chat_history_dir,
                agent_name=agent_name,
                agent_id=agent_id,
            )
            self._horizon = AgentHorizon(store=store, agent_id=agent_id, agent_context=self)
        self._horizon_agent_id = agent_id

    def _init_shared_fields(self):
        """初始化共享字段并注册到 shared_context"""
        # 检查是否已经初始化
        if hasattr(self.shared_context, 'is_initialized') and self.shared_context.is_initialized():
            logger.debug("SharedContext 已经初始化，跳过重复初始化")
            return

        super()._init_shared_fields()

        # 使用 register_fields 一次性注册所有字段
        from typing import Dict, List, Optional, Any
        from app.core.entity.attachment import Attachment
        from app.core.entity.message.client_message import ChatClientMessage
        from app.core.entity.project_archive import ProjectArchiveInfo
        from app.core.stream import Stream
        import asyncio

        from app.core.context.pending_reply_state import PendingReplyState

        # 初始化并注册共享字段
        self.shared_context.register_fields({
            "streams": ({}, Dict[str, Stream]),
            "attachments": ({}, Dict[str, Attachment]),
            "chat_client_message": (None, Optional[ChatClientMessage]),
            "task_id": (None, Optional[str]),
            "interrupt_queue": (None, Optional[asyncio.Queue]),
            "sandbox_id": ("", str),
            "project_archive_info": (None, Optional[ProjectArchiveInfo]),
            "organization_code": (None, Optional[str]),
            "token_usage_report_manager": (None, Optional[TokenUsageReport]),
            "final_token_usage_report": (None, Optional[TokenUsageCollection]),
            "final_response": (None, Optional[str]),
            "final_task_state": (None, Optional[FinalTaskState]),
            "finish_task_files": (None, Optional[List[str]]),
            # LLM 请求ID
            "current_llm_request_id": (None, Optional[str]),
            # 中断控制
            "interruption_requested": (False, bool),  # 终止信号
            "interruption_reason": (None, Optional[str]),
            # 上一轮中断产生的运行时事实，下一轮合成 interrupted tool result 时带入模型上下文
            "interruption_notices": ([], List[str]),
            "cancel_blocker_count": (0, int),  # 阻止cancel的操作计数，默认0
            # 思考状态管理
            "is_thinking_flag": (False, bool),  # 是否真正在思考（由流式内容决定）
            "thinking_correlation_id": (None, Optional[str]),  # THINK 事件自身的 correlation_id
            "thinking_start_time": (None, Optional[float]),  # 思考开始时间
            # Skills 管理
            "loaded_skills": ([], List[str]),  # 已加载的 skills 列表
            "excluded_skills": ([], List[str]),  # 当前 agent 排除的 system skill 名称列表
            # 额外流式推送目标（各渠道的 StreamingInterface，处理消息期间注册，完成后清除）
            "streaming_sinks": ([], List),
            # Human in the Loop：前端工具调用等待用户完成时的暂停标记
            "user_tool_call_pending_id": (None, Optional[str]),
            # Agent Master 管理
            "agent_code": (None, Optional[str]),  # 当前自定义 Agent 的 agent_code
            # 消息版本协商（v1 / v2），由 set_chat_client_message 提取 dynamic_config.message_version 写入
            "message_version": ("v1", str),
            # v2 批量 tool_calls 暂存状态
            "pending_reply_state": (None, Optional[PendingReplyState]),
        })

        # 标记初始化完成
        if hasattr(self.shared_context, 'set_initialized'):
            self.shared_context.set_initialized(True)

        logger.info("已初始化 SharedContext 共享字段")

    def set_task_id(self, task_id: str) -> None:
        """设置任务ID

        Args:
            task_id: 任务ID
        """
        self.shared_context.update_field("task_id", task_id)
        logger.debug(f"已更新任务ID: {task_id}")

    def get_task_id(self) -> Optional[str]:
        """获取任务ID

        Returns:
            Optional[str]: 任务ID
        """
        return self.shared_context.get_field("task_id")

    def set_interrupt_queue(self, interrupt_queue: asyncio.Queue) -> None:
        """设置中断队列

        Args:
            interrupt_queue: 中断队列
        """
        self.shared_context.update_field("interrupt_queue", interrupt_queue)

    def get_interrupt_queue(self) -> Optional[asyncio.Queue]:
        """获取中断队列

        Returns:
            Optional[asyncio.Queue]: 中断队列
        """
        return self.shared_context.get_field("interrupt_queue")

    def set_agent_code(self, agent_code: str) -> None:
        """设置当前自定义 Agent 的 agent_code

        Args:
            agent_code: Agent 编码（如 sma-xxxxx）
        """
        self.shared_context.update_field("agent_code", agent_code)
        logger.debug(f"已更新 agent_code: {agent_code}")

    def get_agent_code(self) -> Optional[str]:
        """获取当前自定义 Agent 的 agent_code

        Returns:
            Optional[str]: agent_code
        """
        return self.shared_context.get_field("agent_code")

    def is_magiclaw(self) -> bool:
        """当前会话是否为 magiclaw 模式（龙虾 claw agent）。"""
        msg = self.get_chat_client_message()
        return msg is not None and str(getattr(msg, "agent_mode", "")) == "magiclaw"

    def set_sandbox_id(self, sandbox_id: str) -> None:
        """设置沙盒ID

        Args:
            sandbox_id: 沙盒ID
        """
        self.shared_context.update_field("sandbox_id", sandbox_id)
        logger.debug(f"已更新沙盒ID: {sandbox_id}")

    def get_sandbox_id(self) -> str:
        """获取沙盒ID

        Returns:
            str: 沙盒ID
        """
        return self.shared_context.get_field("sandbox_id")

    def set_organization_code(self, organization_code: str) -> None:
        """设置组织编码

        Args:
            organization_code: 组织编码
        """
        self.shared_context.update_field("organization_code", organization_code)

    def get_organization_code(self) -> Optional[str]:
        """获取组织编码

        Returns:
            Optional[str]: 组织编码
        """
        return self.shared_context.get_field("organization_code")

    def set_agent_profile(self, profile: AgentProfile) -> None:
        """设置 Agent Profile

        Args:
            profile: Agent Profile 对象
        """
        self._agent_profile = profile
        logger.info(f"设置 Agent Profile: name={profile.name}")

    def get_agent_profile(self) -> AgentProfile:
        """获取 Agent Profile

        Returns:
            AgentProfile: Agent Profile 对象
        """
        return self._agent_profile

    def get_agent_name(self) -> str:
        """获取 Agent 名称

        Returns:
            str: Agent 名称
        """
        return self._agent_profile.name

    def set_loaded_skills(self, skills: List[str]) -> None:
        """设置已加载的 skills 列表

        Args:
            skills: skills 名称列表
        """
        self.shared_context.update_field("loaded_skills", skills)
        logger.debug(f"已更新 loaded_skills: {skills}")

    def get_loaded_skills(self) -> List[str]:
        """获取已加载的 skills 列表

        Returns:
            List[str]: skills 名称列表
        """
        loaded_skills = self.shared_context.get_field("loaded_skills")
        return loaded_skills if loaded_skills is not None else []

    def has_skill(self, skill_name: str) -> bool:
        """检查是否加载了指定的 skill

        Args:
            skill_name: skill 名称

        Returns:
            bool: 是否加载了该 skill
        """
        loaded_skills = self.get_loaded_skills()
        return skill_name in loaded_skills

    def set_excluded_skills(self, skills: List[str]) -> None:
        """设置当前 agent 排除的 system skill 名称列表

        Args:
            skills: 排除的 skill 名称列表
        """
        self.shared_context.update_field("excluded_skills", list(skills) if skills else [])
        logger.debug(f"已更新 excluded_skills: {skills}")

    def get_excluded_skills(self) -> List[str]:
        """获取当前 agent 排除的 system skill 名称列表

        Returns:
            List[str]: 排除的 skill 名称列表
        """
        excluded = self.shared_context.get_field("excluded_skills")
        return excluded if excluded is not None else []

    def get_init_client_message(self) -> Optional[InitClientMessage]:
        """获取初始化客户端消息

        从文件读取并构造 InitClientMessage 对象

        Returns:
            Optional[InitClientMessage]: 初始化客户端消息对象
        """
        from app.utils.init_client_message_util import InitClientMessageUtil
        from app.core.entity.message.client_message import InitClientMessage

        config_data = InitClientMessageUtil.get_full_config()
        if config_data:
            return InitClientMessage(**config_data)
        return None

    def get_init_client_message_metadata(self) -> Optional[Metadata]:
        """获取初始化客户端消息的元数据对象

        从文件读取以确保获取到最新的 metadata

        Returns:
            Optional[Metadata]: 初始化客户端消息的元数据对象
        """
        from app.utils.init_client_message_util import InitClientMessageUtil
        metadata_dict = InitClientMessageUtil.get_metadata()
        if metadata_dict:
            return Metadata(**metadata_dict)
        return None

    def get_init_client_message_metadata_user(self) -> Optional[User]:
        """从InitClientMessage的metadata中安全获取user对象

        Returns:
            Optional[User]: user对象，如果不存在则返回None
        """
        metadata = self.get_init_client_message_metadata()
        if metadata is None:
            return None
        return metadata.user



    def get_init_client_message_sts_token_refresh(self) -> Optional[STSTokenRefreshConfig]:
        """获取初始化客户端消息的STS Token刷新配置

        从文件读取以确保获取到最新的配置

        Returns:
            Optional[STSTokenRefreshConfig]: STS Token刷新配置
        """
        from app.utils.init_client_message_util import InitClientMessageUtil
        sts_token_refresh_dict = InitClientMessageUtil.get_sts_token_refresh()
        if sts_token_refresh_dict:
            return STSTokenRefreshConfig(**sts_token_refresh_dict)
        return None

    def get_init_client_message_platform_type(self) -> Optional[PlatformType]:
        """获取初始化客户端消息中的平台类型

        从文件读取以确保获取到最新的配置

        Returns:
            Optional[PlatformType]: 平台类型
        """
        from app.utils.init_client_message_util import InitClientMessageUtil
        platform_str = InitClientMessageUtil.get_platform_type()
        if platform_str:
            return PlatformType(platform_str)
        return None

    def set_chat_client_message(self, chat_client_message: ChatClientMessage) -> None:
        """设置聊天客户端消息，并从 dynamic_config 中提取 message_version。

        仅当 dynamic_config 中明确提供了 message_version 时才更新，
        否则保持 shared_context 中已有的值（如从 session.json 回落设置的值）。

        Args:
            chat_client_message: 聊天客户端消息
        """
        self.shared_context.update_field("chat_client_message", chat_client_message)

        dynamic_config = getattr(chat_client_message, "dynamic_config", None) or {}
        version = dynamic_config.get("message_version") if isinstance(dynamic_config, dict) else None
        if version:
            self.shared_context.update_field("message_version", version)
            logger.debug(f"消息版本已设置为: {version}")

    def get_chat_client_message(self) -> Optional[ChatClientMessage]:
        """获取聊天客户端消息

        Returns:
            Optional[ChatClientMessage]: 聊天客户端消息
        """
        return self.shared_context.get_field("chat_client_message")

    def has_stream(self, stream: Stream) -> bool:
        """检查是否存在指定的通信流

        Args:
            stream: 要检查的通信流实例
        """
        stream_id = str(id(stream))
        streams = self.shared_context.get_field("streams")
        return stream_id in streams

    def add_stream(self, stream: Stream) -> None:
        """添加一个通信流到流字典中。

        Args:
            stream: 要添加的通信流实例。

        Raises:
            TypeError: 当传入的stream不是Stream接口的实现时抛出。
        """
        if not isinstance(stream, Stream):
            raise TypeError("stream必须是Stream接口的实现")

        streams = self.shared_context.get_field("streams")
        stream_id = str(id(stream))  # 使用stream对象的id作为键
        streams[stream_id] = stream
        logger.info(f"已添加新的Stream，当前Stream数量: {len(streams)}")

    def remove_stream(self, stream: Stream) -> None:
        """删除一个通信流。

        Args:
            stream: 要删除的通信流实例。
        """
        streams = self.shared_context.get_field("streams")
        stream_id = str(id(stream))
        if stream_id in streams:
            del streams[stream_id]
            logger.info(f"已删除Stream, type: {type(stream)}, 当前Stream数量: {len(streams)}")

    @property
    def streams(self) -> Dict[str, Stream]:
        """获取所有通信流的字典。

        Returns:
            Dict[str, Stream]: 通信流字典，键为stream ID，值为Stream对象。
        """
        return self.shared_context.get_field("streams")

    def set_project_archive_info(self, project_archive_info: ProjectArchiveInfo) -> None:
        """设置项目压缩包信息

        Args:
            project_archive_info: 项目压缩包信息
        """
        self.shared_context.update_field("project_archive_info", project_archive_info)

    def get_project_archive_info(self) -> Optional[ProjectArchiveInfo]:
        """获取项目压缩包信息

        Returns:
            Optional[ProjectArchiveInfo]: 项目压缩包信息
        """
        return self.shared_context.get_field("project_archive_info")

    # 重写基类方法，实现特定的事件分发
    async def dispatch_event(self, event_type: EventType, data: BaseEventData) -> Event[Any]:
        """
        触发指定类型的事件

        Args:
            event_type: 事件类型
            data: 事件数据，BaseEventData的子类实例

        Returns:
            Event: 处理后的事件对象
        """
        # 自动处理 correlation_id
        await _auto_manage_correlation_id(event_type, data)

        event = Event(event_type, data)
        return await self.get_event_dispatcher().dispatch(event)

    async def dispatch_stoppable_event(self, event_type: EventType, data: BaseEventData) -> StoppableEvent[Any]:
        """
        触发可停止的事件

        Args:
            event_type: 事件类型
            data: 事件数据，BaseEventData的子类实例

        Returns:
            StoppableEvent: 处理后的事件对象
        """
        # 自动处理 correlation_id
        await _auto_manage_correlation_id(event_type, data)

        event = StoppableEvent(event_type, data)
        return await self.get_event_dispatcher().dispatch(event)

    def update_activity_time(self) -> None:
        """更新agent活动时间"""
        self.shared_context.update_activity_time()

    # ─── Human in the Loop：前端工具调用暂停标记 ─────────────────────────────

    def set_user_tool_call_pending(self, tool_call_id: str) -> None:
        """设置前端工具调用等待状态（Agent 已暂停，等待用户在前端完成 tool_call_id 对应的操作）"""
        self.shared_context.update_field("user_tool_call_pending_id", tool_call_id)

    def clear_user_tool_call_pending(self) -> None:
        """清除前端工具调用等待状态"""
        self.shared_context.update_field("user_tool_call_pending_id", None)

    def has_user_tool_call_pending(self) -> bool:
        """返回当前是否存在尚未完成的前端工具调用"""
        return self.shared_context.get_field("user_tool_call_pending_id") is not None

    def get_user_tool_call_pending_id(self) -> Optional[str]:
        """返回当前待完成的前端工具调用 ID，无则返回 None"""
        return self.shared_context.get_field("user_tool_call_pending_id")

    def is_idle_timeout(self) -> bool:
        """检查agent是否超时闲置

        Returns:
            bool: 如果超时则返回True，否则返回False
        """
        # 等待前端工具调用完成期间，不触发空闲超时
        if self.has_user_tool_call_pending():
            return False
        return self.shared_context.is_idle_timeout()

    def add_attachment(self, attachment: Attachment) -> None:
        """添加附件到代理上下文

        所有工具产生的附件都将被添加到这里，以便在任务完成时一次性发送
        如果文件路径已存在，则更新对应的附件对象

        Args:
            attachment: 要添加的附件对象
        """
        attachments = self.shared_context.get_field("attachments")
        filepath = attachment.filepath

        if filepath in attachments:
            logger.debug(f"更新附件 {attachment.filename} (路径: {filepath}) 在代理上下文中")
        else:
            logger.debug(f"添加新附件 {attachment.filename} (路径: {filepath}) 到代理上下文，当前附件总数: {len(attachments) + 1}")

        attachments[filepath] = attachment

    def remove_attachment(self, filepath: str) -> bool:
        """根据文件路径移除附件

        Args:
            filepath: 要移除的附件的文件路径

        Returns:
            bool: 如果成功移除则返回True，否则返回False
        """
        attachments = self.shared_context.get_field("attachments")
        if filepath in attachments:
            removed_attachment = attachments.pop(filepath)
            logger.info(f"已移除附件: {removed_attachment.filename} (路径: {filepath})")
            return True
        else:
            logger.debug(f"尝试移除不存在的附件，路径: {filepath}")
            return False

    def get_attachments(self) -> List[Attachment]:
        """获取所有附件

        Returns:
            List[Attachment]: 所有收集到的附件列表
        """
        attachments = self.shared_context.get_field("attachments")
        return list(attachments.values())

    def get_changed_file_keys(self) -> List[str]:
        """
        获取变更文件的 file_key 列表

        Returns:
            List[str]: 变更文件的 file_key 列表
        """
        file_keys = []

        try:
            attachments = self.get_attachments()

            for attachment in attachments:
                if hasattr(attachment, 'file_key') and attachment.file_key:
                    file_keys.append(attachment.file_key)

        except Exception as e:
            logger.error(f"获取变更文件 file_key 列表失败: {e}")

        return file_keys

    def clear_attachments(self) -> None:
        """清空所有附件

        用于在新的agent run开始时清空上一轮对话的attachments
        """
        try:
            self.shared_context.update_field("attachments", {})
            logger.info("已清空agent context中的所有attachments")
        except Exception as e:
            logger.error(f"清空attachments失败: {e}")

    # 重写用户相关方法
    def get_user_id(self) -> Optional[str]:
        """获取用户ID

        Returns:
            Optional[str]: 用户ID，如果不存在则返回None
        """
        metadata = self.get_init_client_message_metadata()
        if metadata is None:
            return None
        return metadata.user_id

    def get_metadata(self) -> Dict[str, Any]:
        """获取元数据

        每次从文件读取以确保获取到最新的 metadata。
        language 字段以 i18n 当前语言为准，覆盖文件中的值，
        确保流消息中的 language 始终与实际翻译语言一致。

        Returns:
            Dict[str, Any]: 上下文元数据
        """
        from app.utils.init_client_message_util import InitClientMessageUtil
        from app.i18n import i18n
        metadata = dict(InitClientMessageUtil.get_metadata())
        metadata["language"] = i18n.get_language()
        return metadata

    def _serialize_value(self, value: Any) -> Any:
        """将值转换为可序列化的格式

        Args:
            value: 需要序列化的值

        Returns:
            Any: 转换后可序列化的值
        """
        if value is None:
            return None

        # 处理 pathlib.Path 对象
        if hasattr(value, "absolute") and callable(getattr(value, "absolute")):
            return str(value)

        # 处理具有 to_dict 方法的对象
        if hasattr(value, "to_dict") and callable(getattr(value, "to_dict")):
            return value.to_dict()

        # 处理日期时间对象
        if isinstance(value, (datetime, timedelta)):
            return str(value)

        # 处理异步队列
        if isinstance(value, asyncio.Queue):
            return f"<Queue:{id(value)}>"

        # 处理字典
        if isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}

        # 处理列表或元组
        if isinstance(value, (list, tuple)):
            return [self._serialize_value(item) for item in value]

        # 尝试直接转换为 str
        try:
            json.dumps(value)
            return value
        except (TypeError, OverflowError, ValueError):
            # 如果无法序列化，则返回类型和ID信息
            return f"<{type(value).__name__}:{id(value)}>"

    def to_dict(self) -> Dict[str, Any]:
        """将代理上下文转换为字典

        Returns:
            Dict[str, Any]: 包含代理上下文信息的字典
        """
        # 基本信息
        result = {
            "agent_name": self.get_agent_name(),
            "workspace_dir": self._serialize_value(self.get_workspace_dir()),
            "chat_history_dir": self._serialize_value(self.get_chat_history_dir()),
            "user_id": self.get_user_id(),
            "task_id": self.get_task_id(),
            "sandbox_id": self.get_sandbox_id(),
            "organization_code": self.get_organization_code(),
        }

        # 集合信息
        try:
            result["attachments_count"] = len(self.get_attachments())
            attachments = self.get_attachments()
            if attachments:
                result["attachments"] = [att.filename for att in attachments[:5]]
                if len(attachments) > 5:
                    result["attachments"].append(f"... 还有 {len(attachments) - 5} 个附件未显示")
        except Exception as e:
            result["attachments_error"] = str(e)

        try:
            result["streams_count"] = len(self.streams)
        except Exception as e:
            result["streams_error"] = str(e)

        # 添加共享上下文信息
        result["shared_context"] = "<使用 shared_context.to_dict() 查看详细信息>"

        return result

    def __str__(self) -> str:
        """自定义字符串表示

        Returns:
            str: 字典形式的字符串表示
        """
        try:
            return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
        except Exception as e:
            return f"<AgentContext object at {hex(id(self))}: {str(e)}>"

    def __repr__(self) -> str:
        """自定义对象表示

        Returns:
            str: 字典形式的对象表示
        """
        return self.__str__()

    def set_token_usage_report_manager(self, report: TokenUsageReport) -> None:
        """设置当前 Agent 会话专属的 token 使用报告管理器。"""
        self.shared_context.update_field("token_usage_report_manager", report)
        logger.debug("已更新 token 使用报告管理器")

    def get_token_usage_report_manager(self) -> Optional[TokenUsageReport]:
        """获取当前 Agent 会话专属的 token 使用报告管理器。"""
        if not self.shared_context.has_field("token_usage_report_manager"):
            return None
        return self.shared_context.get_field("token_usage_report_manager")

    def set_token_usage_report(self, report: TokenUsageCollection) -> None:
        """设置 token 使用报告

        Args:
            report: token 使用报告汇总
        """
        self.shared_context.update_field("final_token_usage_report", report)
        logger.debug("已更新 token 使用报告")

    def get_token_usage_report(self) -> Optional[TokenUsageCollection]:
        """获取最终的 Token 使用报告"""
        if not self.shared_context.has_field("final_token_usage_report"):
            return None
        return self.shared_context.get_field("final_token_usage_report")

    def set_final_response(self, response: Optional[str]) -> None:
        """设置最终响应内容

        Args:
            response: 最终响应字符串
        """
        self.shared_context.update_field("final_response", response)

    def get_final_response(self) -> Optional[str]:
        """获取最终响应内容

        Returns:
            Optional[str]: 最终响应字符串
        """
        return self.shared_context.get_field("final_response")

    def set_final_task_state(self, final_task_state: Optional[FinalTaskState]) -> None:
        """设置最终任务终态"""
        self.shared_context.update_field("final_task_state", final_task_state)

    def get_final_task_state(self) -> Optional[FinalTaskState]:
        """获取最终任务终态"""
        return self.shared_context.get_field("final_task_state")

    # ====== 序列号管理相关方法 ======

    def get_next_seq_id(self) -> int:
        """获取当前任务的下一个序列号"""
        from app.service.seq_id_manager import get_seq_id_manager_service

        task_id = self.get_task_id()
        if not task_id:
            logger.warning("task_id 为空，使用默认序列号 0")
            return 0

        seq_manager = get_seq_id_manager_service()
        return seq_manager.get_next_seq_id(task_id)

    def get_current_seq_id(self) -> int:
        """获取当前任务的当前序列号（不自增）"""
        from app.service.seq_id_manager import get_seq_id_manager_service

        task_id = self.get_task_id()
        if not task_id:
            return 0

        seq_manager = get_seq_id_manager_service()
        return seq_manager.get_current_seq_id(task_id)

    def initialize_task_sequence(self) -> None:
        """初始化任务序列号计数器"""
        from app.service.seq_id_manager import get_seq_id_manager_service

        task_id = self.get_task_id()
        if task_id:
            seq_manager = get_seq_id_manager_service()
            seq_manager.initialize_task(task_id)
            logger.info(f"已初始化任务序列号管理: {task_id}")

    async def initialize_task_sequence_async(self) -> None:
        """异步初始化任务序列号计数器"""
        from app.service.seq_id_manager import get_seq_id_manager_service

        task_id = self.get_task_id()
        if task_id:
            seq_manager = get_seq_id_manager_service()
            await seq_manager.initialize_task_async(task_id)
            logger.info(f"已初始化任务序列号管理: {task_id}")

    async def get_next_seq_id_async(self) -> int:
        """异步获取当前任务的下一个序列号"""
        from app.service.seq_id_manager import get_seq_id_manager_service

        task_id = self.get_task_id()
        if not task_id:
            logger.warning("task_id 为空，使用默认序列号 0")
            return 0

        seq_manager = get_seq_id_manager_service()
        return await seq_manager.get_next_seq_id_async(task_id)

    # ====== LLM Request ID 相关方法 ======

    def set_current_llm_request_id(self, request_id: str) -> None:
        """设置当前 LLM 请求的 request_id

        Args:
            request_id: LLM 请求的唯一标识符
        """
        self.shared_context.update_field("current_llm_request_id", request_id)
        logger.debug(f"已设置当前 LLM request_id: {request_id}")

    def get_current_llm_request_id(self) -> Optional[str]:
        """获取当前 LLM 请求的 request_id

        Returns:
            Optional[str]: 当前 LLM 请求的 request_id，如果没有则返回 None
        """
        return self.shared_context.get_field("current_llm_request_id")

    # ====== 中断控制相关方法 ======

    def set_interruption_request(self, requested: bool, reason: str = "User interrupted the task.") -> None:
        """设置/恢复终止信号

        Args:
            requested: 是否请求中断
            reason: 中断原因
        """
        self.shared_context.update_field("interruption_requested", requested)
        if requested:
            self.shared_context.update_field("interruption_reason", reason)
            # 立即通知所有等待中断的任务
            self._interruption_event.set()
            logger.info(f"中断事件已触发: {reason}")
        else:
            self.shared_context.update_field("interruption_reason", None)
            # 清除中断事件
            self._interruption_event.clear()

        logger.debug(f"已设置中断请求: {requested}, 原因: {reason if requested else 'N/A'}")

    def is_interruption_requested(self) -> bool:
        """检查是否有终止信号

        Returns:
            bool: 是否有终止信号
        """
        return self.shared_context.get_field("interruption_requested")

    def get_interruption_reason(self) -> Optional[str]:
        """获取中断原因

        Returns:
            Optional[str]: 中断原因，如果没有中断请求则返回None
        """
        return self.shared_context.get_field("interruption_reason")

    def get_interruption_event(self) -> asyncio.Event:
        """获取中断事件，用于异步等待中断信号

        Returns:
            asyncio.Event: 中断事件对象，可用于 await event.wait()
        """
        return self._interruption_event

    def append_interruption_notice(self, notice: str) -> None:
        """记录本轮中断产生的运行时事实，供下一轮合成 ToolResult 时注入模型上下文。"""
        text = notice.strip() if isinstance(notice, str) else ""
        if not text:
            return
        notices = list(self.shared_context.get_field("interruption_notices") or [])
        if text not in notices:
            notices.append(text)
        self.shared_context.update_field("interruption_notices", notices)

    def drain_interruption_notices(self) -> list[str]:
        """取出并清空中断事实，避免同一事实重复进入后续上下文。"""
        notices = list(self.shared_context.get_field("interruption_notices") or [])
        self.shared_context.update_field("interruption_notices", [])
        return notices

    def increment_cancel_blocker(self) -> None:
        """增加阻止cancel的操作计数"""
        current_count = self.shared_context.get_field("cancel_blocker_count")
        new_count = current_count + 1
        self.shared_context.update_field("cancel_blocker_count", new_count)
        if current_count == 0:
            self._cancelable_event.clear()
        logger.info(f"增加cancel阻止计数: {current_count} -> {new_count}")

    def decrement_cancel_blocker(self) -> None:
        """减少阻止cancel的操作计数"""
        current_count = self.shared_context.get_field("cancel_blocker_count")
        new_count = max(0, current_count - 1)  # 确保计数不会小于0
        self.shared_context.update_field("cancel_blocker_count", new_count)
        if new_count == 0:
            self._cancelable_event.set()
        logger.info(f"减少cancel阻止计数: {current_count} -> {new_count}")

        # 如果计数异常小于0，记录警告
        if current_count <= 0:
            logger.warning(f"cancel_blocker_count计数异常：尝试从{current_count}减少，已强制设为0")

    def is_cancelable(self) -> bool:
        """检查当前是否可以cancel（计数为0时可以cancel）

        Returns:
            bool: 计数为0时返回True，否则返回False
        """
        return self.shared_context.get_field("cancel_blocker_count") == 0

    def get_cancel_blocker_count(self) -> int:
        """获取当前阻止cancel的操作计数

        Returns:
            int: 当前阻止cancel的操作计数
        """
        return self.shared_context.get_field("cancel_blocker_count")

    async def wait_until_cancelable(
        self,
        timeout_s: float = _CANCEL_BLOCKER_WAIT_TIMEOUT_S,
    ) -> bool:
        """等待直到当前 run 可被 cancel，超时返回 False。"""
        if self.is_cancelable():
            return True

        try:
            await asyncio.wait_for(self._cancelable_event.wait(), timeout=timeout_s)
            return True
        except asyncio.TimeoutError:
            logger.warning(
                f"[AgentContext] cancel_blocker timeout after {timeout_s}s "
                f"(count={self.get_cancel_blocker_count()}), proceeding"
            )
            return False

    # ====== Run-level interruption 框架 ======

    def register_run_cleanup(self, key: str, handler) -> None:
        """注册当前 run 的 cleanup handler（按 key 可替换）。"""
        self._run_cleanup_registry.register(key, handler)

    def register_worker_cancel(self, cb) -> None:
        """注册当前 run 的 worker cancel callback，worker task 创建后立即调用。"""
        self._run_cancellation_handle.register(cb)

    async def stop_run(self, reason: str = "") -> None:
        """停止当前 run（幂等）：
        1. 标记中断，通知所有等待中断事件的协程
        2. 等待 cancel blocker 归零（最多 10 秒）
        3. 执行业务 cleanup registry
        4. 执行 worker cancel
        5. 标记完成
        """
        if self._stop_run_task and not self._stop_run_task.done():
            logger.debug(f"[AgentContext] stop_run already in progress, waiting (reason={reason})")
            await asyncio.shield(self._stop_run_task)
            return

        self._stop_run_task = asyncio.create_task(self._stop_run_impl(reason))
        try:
            await asyncio.shield(self._stop_run_task)
        finally:
            if self._stop_run_task.done():
                self._stop_run_task = None

    async def _stop_run_impl(self, reason: str) -> None:
        """执行当前 run 的实际停止流程；stop_run() 负责单飞等待。"""
        if self._run_cancel_state.cleanup_started and not self._run_cancel_state.cleanup_finished:
            return

        if self._run_cancel_state.cleanup_started and self._run_cancel_state.cleanup_finished:
            # 上次 stop_run 已完成，但 agent 仍在运行（首次中断未完全生效），允许重新发起
            logger.info(f"[AgentContext] previous stop_run completed but agent still running, re-stopping (reason={reason})")
            self._run_cancel_state = RunCancelState()
            self._run_cleanup_registry = RunCleanupRegistry()

        self._run_cancel_state.requested = True
        self._run_cancel_state.reason = reason
        self._run_cancel_state.cleanup_started = True
        self.shared_context.update_field("interruption_requested", True)
        self.shared_context.update_field("interruption_reason", reason)
        self._interruption_event.set()
        logger.info(f"[AgentContext] stop_run started: {reason}")

        # 等待 cancel blocker 归零（超时后强制继续）
        await self.wait_until_cancelable()

        # 先 cleanup 再 cancel worker，确保业务子系统内部异步延续点先被切断
        await self._run_cleanup_registry.run_all()
        await self._run_cancellation_handle.cancel()

        self._run_cancel_state.cleanup_finished = True
        logger.info("[AgentContext] stop_run completed")

    def reset_run_state(self) -> None:
        """复位 run interruption 状态，启动新 run 前调用。"""
        self._run_cancel_state = RunCancelState()
        self._run_cleanup_registry = RunCleanupRegistry()
        # cancellation handle 不重置，由 register_worker_cancel 在新 worker 创建时覆盖
        self.shared_context.update_field("interruption_requested", False)
        self.shared_context.update_field("interruption_reason", None)
        self._interruption_event.clear()

    # ====== 思考状态管理方法 ======

    def get_thinking_correlation_id(self) -> Optional[str]:
        """获取当前思考块的 correlation_id（用作其他事件的 parent_correlation_id）

        Returns:
            Optional[str]: 当前思考块的 correlation_id
        """
        return self.shared_context.get_field("thinking_correlation_id")

    def set_thinking_correlation_id(self, correlation_id: Optional[str]) -> None:
        """设置当前思考块的 correlation_id（BEFORE_AGENT_THINK 时调用）

        Args:
            correlation_id: 思考块的 correlation_id
        """
        import time
        self.shared_context.update_field("thinking_correlation_id", correlation_id)
        if correlation_id:
            self.shared_context.update_field("thinking_start_time", time.time())
            logger.debug(f"设置思考 correlation_id: {correlation_id}")
        else:
            self.shared_context.update_field("thinking_start_time", None)
            logger.debug("清除思考 correlation_id")

    def get_thinking_duration_ms(self) -> float:
        """获取当前思考持续时间（毫秒）

        Returns:
            float: 思考持续时间（毫秒）
        """
        import time
        start_time = self.shared_context.get_field("thinking_start_time")
        if start_time:
            return (time.time() - start_time) * 1000
        return 0.0

    def reset_thinking_state(self) -> None:
        """重置思考状态（AFTER_AGENT_THINK 后调用）"""
        self.shared_context.update_field("thinking_correlation_id", None)
        self.shared_context.update_field("thinking_start_time", None)
        logger.debug("重置思考状态")

    def add_streaming_sink(self, driver: "StreamingInterface") -> None:  # type: ignore[name-defined]
        """注册额外流式推送目标（如企微、飞书等渠道），处理消息期间有效。"""
        sinks: list = self.shared_context.get_field("streaming_sinks")
        if driver not in sinks:
            sinks.append(driver)

    def remove_streaming_sink(self, driver: "StreamingInterface") -> None:  # type: ignore[name-defined]
        """移除已注册的流式推送目标。"""
        sinks: list = self.shared_context.get_field("streaming_sinks")
        try:
            sinks.remove(driver)
        except ValueError:
            pass

    def get_streaming_sinks(self) -> list:
        """返回当前所有额外流式推送目标列表。"""
        return self.shared_context.get_field("streaming_sinks") or []

    # ====== 消息版本协商 ======

    def get_message_version(self) -> str:
        """获取当前会话的消息版本号，默认 'v1'。"""
        return self.shared_context.get_field("message_version") or "v1"

    def set_message_version(self, version: str) -> None:
        """显式设置消息结构版本，在 chat 消息到达后、init 事件触发前提前写入。

        Args:
            version: 消息版本字符串，如 "v1"、"v2"
        """
        if version:
            self.shared_context.update_field("message_version", version)

    async def load_last_message_version(self) -> Optional[str]:
        """从 session.json 读取上次保存的 message_version。

        在 chat 消息未携带 message_version 时作为回落来源。
        读取 current 块（存储最近一次完成请求的配置）。

        Returns:
            Optional[str]: 上次保存的 message_version，文件不存在或无记录时返回 None
        """
        from pathlib import Path
        from app.utils.async_file_utils import async_try_read_json
        chat_history_dir = self.get_chat_history_dir()
        agent_name = self.agent_name
        agent_id = self._agent_id or "main"
        session_file = Path(chat_history_dir) / f"{agent_name}<{agent_id}>.session.json"
        doc = await async_try_read_json(session_file)
        if doc is None:
            return None
        current = doc.get("current", {})
        if isinstance(current, dict):
            return current.get("message_version") or None
        return None

    def get_message_factory(self) -> "Type[TaskMessageFactoryProtocol]":
        """根据 message_version 从注册表获取对应的消息工厂类。"""
        from app.core.entity.factory.factory_registry import get_factory_by_version
        return get_factory_by_version(self.get_message_version())

    def get_tool_label(self, tool_name: str) -> str:
        """根据工具名称查 i18n 标签，查无结果时返回空字符串。"""
        from app.i18n import i18n
        label = i18n.translate(tool_name, category="tool.actions")
        # i18n.translate 查无结果时回退返回 tool_name 本身，此时视为无标签
        return label if label != tool_name else ""

    # ====== v2 批量 tool_calls 暂存状态 ======

    def get_pending_reply_state(self) -> Optional["PendingReplyState"]:
        """获取 v2 批量 tool_calls 暂存状态，不存在时返回 None。"""
        from app.core.context.pending_reply_state import PendingReplyState
        return self.shared_context.get_field("pending_reply_state")

    def set_pending_reply_state(self, state: Optional["PendingReplyState"]) -> None:
        """设置 v2 批量 tool_calls 暂存状态，传 None 可清除。"""
        self.shared_context.update_field("pending_reply_state", state)

    def refresh_streaming_message_id(self) -> str:
        """为下一次 v2 流式回复预生成 Snowflake message_id，写入 pending_reply_state。

        - 若 pending_reply_state 已存在，仅刷新 message_id，保留其余字段
        - 若不存在，创建新的 PendingReplyState 并设置 message_id
        - 返回生成的 message_id，供调用方按需使用

        Returns:
            str: 预生成的 message_id
        """
        from agentlang.utils.snowflake import Snowflake
        from app.core.context.pending_reply_state import PendingReplyState

        message_id = str(Snowflake.create_default().get_id())
        existing = self.get_pending_reply_state()
        if existing is not None:
            existing.message_id = message_id
        else:
            self.set_pending_reply_state(PendingReplyState(message_id=message_id))
        return message_id
