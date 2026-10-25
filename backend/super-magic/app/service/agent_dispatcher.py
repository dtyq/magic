from app.i18n import i18n
import asyncio
import os
import json
from collections.abc import Mapping
from typing import Dict, Optional, Union
import importlib
import importlib.metadata
import inspect
from enum import StrEnum

from app.infrastructure.sdk.base.exceptions import HttpRequestError
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import (
    MagicServiceApiError,
    MagicServiceUnauthorizedException,
)
from app.core.context.agent_context import AgentContext
from app.core.context.execution_source import (
    ASK_USER_POLICY_HORIZON_SOURCE,
    build_ask_user_policy_horizon_message,
    is_ask_user_allowed_source,
    remove_execution_source_from_dynamic_config,
    resolve_execution_source,
    stamp_execution_source,
)
from app.core.entity.final_task_state import FinalTaskState, FinalTaskStateCode, build_final_task_state
from app.core.models.agent_runtime import AgentLifetime, AgentTarget
from app.core.models.media_model import ImageModelSpec, VideoModelSpec
from app.core.models.model_selection_policy import ModelSelectionInput, ModelSelectionPolicy
from agentlang.chat_history.session_config import SessionConfig
from agentlang.event.data import ErrorEventData
from agentlang.event.event import EventType
from app.core.stream.http_subscription_stream import HTTPSubscriptionStream
from app.core.stream.stdout_stream import StdoutStream
from agentlang.config.config import config
from app.magic.agent import Agent
from app.service.agent_service import AgentService
from app.service.sandbox_restart_coordinator import sandbox_restart_coordinator
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService
from app.service.follow_up_suggestion.listener import FollowUpSuggestionListener

from app.service.agent_event.rag_listener_service import RagListenerService
from app.service.agent_event.resource_cleanup_listener_service import ResourceCleanupListenerService
from app.service.agent_event.stream_listener_service import StreamListenerService
from app.service.agent_event.checkpoint_listener_service import CheckpointListenerService
from app.service.agent_event.third_party_message_listener_service import ThirdPartyMessageListenerService
from app.service.memory.runtime.events.memory_event_listener import MemoryListenerService
from app.infrastructure.observability import install_tool_monitoring_listener
from app.service.mcp_service import MCPService
from app.path_manager import PathManager
from app.service.agent_event.channel_startup_listener_service import ChannelStartupListenerService
from app.core.entity.message.client_message import InitClientMessage, ChatClientMessage, AgentMode, ContextType
from app.service.cli_manager import CliManagerService
from app.service.home_persistence_service import HomePersistenceService
from app.service.startup_task import StartupTaskService
from app.service.crew_downloader import (
    CrewPackageFetchError,
    CrewPackageInvalidError,
)
from app.service.agent_runtime import (
    AgentDefinitionPrepareError,
    AgentRuntime,
    AgentTargetError,
)
from agentlang.logger import get_logger
from app.core.base_service import Base

logger = get_logger(__name__)


class AgentLoadFailureReason(StrEnum):
    ACCESS_DENIED = "access_denied"
    INVALID_PACKAGE = "invalid_package"
    FETCH_FAILED = "fetch_failed"
    UNKNOWN = "unknown"


_AGENT_LOAD_MESSAGE_KEYS = {
    AgentLoadFailureReason.ACCESS_DENIED: "messages.agent_load_access_denied",
    AgentLoadFailureReason.INVALID_PACKAGE: "messages.agent_load_invalid_package",
    AgentLoadFailureReason.FETCH_FAILED: "messages.agent_load_fetch_failed",
    AgentLoadFailureReason.UNKNOWN: "messages.agent_load_failed",
}


def _classify_agent_load_failure(error: Exception) -> AgentLoadFailureReason:
    current: BaseException | None = error
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, MagicServiceUnauthorizedException):
            return AgentLoadFailureReason.ACCESS_DENIED
        if isinstance(current, CrewPackageInvalidError):
            return AgentLoadFailureReason.INVALID_PACKAGE
        if isinstance(
            current,
            (CrewPackageFetchError, HttpRequestError, MagicServiceApiError),
        ):
            return AgentLoadFailureReason.FETCH_FAILED
        current = current.__cause__ or current.__context__
    return AgentLoadFailureReason.UNKNOWN


def _build_agent_load_final_task_state(error: Exception, agent_code: str) -> FinalTaskState:
    reason = _classify_agent_load_failure(error)
    message = i18n.translate(
        _AGENT_LOAD_MESSAGE_KEYS[reason],
        category="common.messages",
        agent_code=agent_code,
    )
    return build_final_task_state(
        FinalTaskStateCode.AGENT_LOAD_FAILED,
        custom_message=message,
    )


class AgentDispatcher(Base):
    SERVICE_TYPE = "dispatcher"
    """
    Agent调度器，负责Agent的创建、初始化和运行

    主要职责：
    1. 创建和初始化Agent及其上下文
    2. 注册Agent事件监听器
    3. 处理工作区初始化
    4. 运行Agent处理任务
    """

    # 单例实例
    _instance = None

    @classmethod
    def get_instance(cls):
        """获取AgentDispatcher单例实例"""
        if cls._instance is None:
            cls._instance = AgentDispatcher()
        return cls._instance

    def __init__(self):
        """初始化Agent调度器"""
        if self.__class__._instance is not None:
            return

        self.agent_context: Optional[AgentContext] = None
        self.http_streams: list[HTTPSubscriptionStream] = []
        self.is_workspace_initialized: bool = False  # 工作区初始化状态标志
        self.agent_service = AgentService()  # 创建AgentService实例

        # 标记 init 事件是否已经发送过（用于沙箱预启动场景的延迟发送）
        self.init_event_dispatched: bool = False


        # 设置为单例实例
        self.__class__._instance = self

    async def setup(self):
        """设置Agent上下文和注册监听器"""
        self.agent_context = self.agent_service.create_agent_context(
            stream_mode=False,
            task_id="",
            streams=[StdoutStream()],
            is_main_agent=True,
            sandbox_id=str(config.get("sandbox.id")),
        )

        self.agent_context.update_activity_time()

        # 注册各种监听器
        FileStorageListenerService.register_standard_listeners(self.agent_context)
        StreamListenerService.register_standard_listeners(self.agent_context)
        RagListenerService.register_standard_listeners(self.agent_context)
        # FileListenerService.register_standard_listeners(self.agent_context)
        CheckpointListenerService.register_standard_listeners(self.agent_context)
        MemoryListenerService.register_standard_listeners(self.agent_context)
        ResourceCleanupListenerService.register_standard_listeners(self.agent_context)
        ChannelStartupListenerService.register_standard_listeners(self.agent_context)
        ThirdPartyMessageListenerService.register_standard_listeners(self.agent_context)
        FollowUpSuggestionListener.register_standard_listeners(self.agent_context)

        # 注册工具监控监听器（非侵入式）
        install_tool_monitoring_listener(self.agent_context)

        # 从 entry points 中获取注册的监听器，group=supermagic.listeners.register
        group = "supermagic.agent_dispatcher.listeners.register"
        listeners_entry_points = list(importlib.metadata.entry_points(group=group))
        for entry_point in listeners_entry_points:
            try:
                logger.info(f"发现 agent_dispatcher 监听器: {entry_point.name}")
                module_name = entry_point.value.split(":")[0]
                method_name = entry_point.value.split(":")[1]
                module = importlib.import_module(module_name)

                found_method = False
                for name, obj in inspect.getmembers(module):
                    if inspect.isclass(obj) and hasattr(obj, method_name):
                        class_method = getattr(obj, method_name)
                        # 调用类的静态方法
                        class_method(self.agent_context)
                        found_method = True
                        logger.info(f"已注册 agent_dispatcher 监听器: {entry_point.name}")
                        break

                if not found_method:
                    logger.warning(f"模块 {module_name} 中没有找到类提供的静态方法 {method_name}，跳过")
            except Exception as e:
                logger.error(f"注册监听器 {entry_point.name} 时出错: {e!s}")
                # 继续处理其他监听器，不中断流程

        logger.info("AgentDispatcher 初始化完成")
        return self

    async def load_init_client_message(self) -> bool:
        """
        检查初始化客户端消息文件是否存在

        Returns:
            bool: 文件是否存在
        """
        if self.agent_context.get_init_client_message() is not None:
            logger.info("agent_context 已存在客户端初始化消息，跳过文件加载")
            await CliManagerService.initialize_from_environment(self.agent_context)
            return True

        try:
            init_client_message_file = PathManager.get_init_client_message_file()
            if os.path.exists(init_client_message_file):
                with open(init_client_message_file, "r", encoding="utf-8") as f:
                    init_message_data = json.load(f)
                    init_message = InitClientMessage(**init_message_data)
                    await self.initialize_workspace(init_message)
                    logger.info(f"已从 {init_client_message_file} 加载客户端初始化消息")
                    return True
            else:
                logger.error(f"客户端初始化消息文件 {init_client_message_file} 不存在")
                return False
        except Exception as e:
            logger.error(f"加载客户端初始化消息时出错: {e}")
            return False

    async def initialize_workspace(self, init_message: InitClientMessage):
        """初始化工作区"""
        logger.info("开始工作区初始化流程")

        await HomePersistenceService.initialize_from_environment()
        await CliManagerService.initialize_from_environment(self.agent_context)

        # ========== 配置更新阶段 - 每次都执行 ==========
        # 保存初始化消息到文件
        from app.utils.init_client_message_util import InitClientMessageUtil
        await InitClientMessageUtil.save_init_client_message(init_message)
        from app.service.user_context_service import UserContextService
        UserContextService.apply_init_config(self.agent_context, init_message)

        self.agent_context.set_super_magic_product_context(init_message.super_magic_product_context)

        # 阶段二：init_client_message.json 已就绪，执行可注册的动态配置初始化器。
        from app.service.init.config_initializers import (
            AIAbilityConfigInitializer,
            ModelConfigInitializer,
        )
        from app.service.init.initializer_registry import InitInitializerRegistry

        initializer_registry = InitInitializerRegistry()
        initializer_registry.register(ModelConfigInitializer())
        initializer_registry.register(AIAbilityConfigInitializer(init_message.dynamic_config))
        await initializer_registry.run(self.agent_context)

        # 从 init_message.metadata 提取并设置关键字段
        if init_message.metadata:
            # 设置 task_id
            if init_message.metadata.super_magic_task_id:
                self.agent_context.set_task_id(init_message.metadata.super_magic_task_id)
                logger.info(f"从 metadata 设置任务ID: {init_message.metadata.super_magic_task_id}")

                # 初始化序列号管理
                self.agent_context.initialize_task_sequence()
                logger.info(f"已初始化任务序列号管理: {init_message.metadata.super_magic_task_id}")

            # 设置 sandbox_id
            if init_message.metadata.sandbox_id:
                self.agent_context.set_sandbox_id(init_message.metadata.sandbox_id)
                logger.info(f"从 metadata 设置沙盒ID: {init_message.metadata.sandbox_id}")

            # 设置 organization_code
            if init_message.metadata.organization_code:
                self.agent_context.set_organization_code(init_message.metadata.organization_code)
                logger.info(f"从 metadata 设置组织编码: {init_message.metadata.organization_code}")

            logger.info(f"init_message.metadata.language: {init_message.metadata.language}")

            # 设置用户语言
            if init_message.metadata.language:
                i18n.set_language(init_message.metadata.language)
                logger.info(f"从 metadata 设置用户语言: {init_message.metadata.language}")
            else:
                # 默认设置为中文
                i18n.set_language("zh_CN")
                logger.info("使用默认语言: zh_CN")

        # 从 init 消息的 dynamic_config 中提前写入 message_version，确保 BEFORE_INIT/AFTER_INIT 使用正确的工厂。
        # chat 消息到达后若携带 message_version 会再次覆盖，以 chat 消息的值为准。
        if init_message.dynamic_config:
            version = init_message.dynamic_config.get("message_version")
            if version:
                self.agent_context.set_message_version(version)
                logger.info(f"从 init 消息的 dynamic_config 设置 message_version: {version}")

        # Agent Profile 不再从 init 消息获取，统一由 chat 消息设置
        # 见 dispatch_message() 中的 _apply_chat_agent_config()

        # ========== 资源初始化阶段 - 仅首次执行 ==========
        if self.is_workspace_initialized:
            logger.info("工作区已经初始化过，跳过资源创建和工作区初始化")
        else:
            logger.info("首次初始化工作区，开始创建资源...")

            # HTTP订阅流 - 通过环境变量控制是否启用
            enable_http_stream = os.getenv("ENABLE_HTTP_SUBSCRIPTION_STREAM", "true").lower() == "true"
            configs = init_message.message_subscription_config or []
            if configs and not self.http_streams:
                if enable_http_stream:
                    for subscription_config in configs:
                        stream = HTTPSubscriptionStream(subscription_config)
                        self.http_streams.append(stream)
                        self.agent_context.add_stream(stream)
                    logger.info(f"创建和添加了 {len(self.http_streams)} 个 HTTP订阅流")
                else:
                    logger.info("HTTP订阅流已通过环境变量 ENABLE_HTTP_SUBSCRIPTION_STREAM 禁用，跳过创建")

            # 设置聊天历史目录
            # if init_message.chat_history_dir:
            #     self.agent_context.set_chat_history_dir(init_message.chat_history_dir)
            #     logger.info(f"从 init_message 设置聊天历史目录: {init_message.chat_history_dir}")

            fetch_history = getattr(init_message, "fetch_history", True)
            if fetch_history:
                await self.agent_service.init_workspace(agent_context=self.agent_context, fetch_history=True)
            else:
                logger.info("客户端请求跳过远端聊天历史下载")
                await self.agent_service.init_workspace(agent_context=self.agent_context, fetch_history=False)

            # 改为按需加载agent，不再预先创建
            self.is_workspace_initialized = True

            # 标记 init 事件已发送（非预启动场景）
            # 只有在 skip_init_messages 不为 True 时才标记已发送
            # 因为如果 skip_init_messages=True，init 事件实际上没有发送
            metadata = self.agent_context.get_init_client_message_metadata()
            if metadata and metadata.skip_init_messages is True:
                logger.info("工作区初始化完成（预启动场景，init 事件未发送）")
            else:
                # 非预启动场景，init_workspace 方法已发送 init 事件
                if not self.init_event_dispatched:
                    self.set_init_event_dispatched(True)
                    logger.info("工作区初始化完成，标记 init 事件已发送（非预启动场景）")
                else:
                    logger.info("工作区初始化完成")

        await self.on_runtime_ready()

    async def on_runtime_ready(self) -> None:
        """
        系统完成工作区、ChatHistory 和 Horizon 恢复后，触发 runtime-ready 事项。

        MOCK DEMO：此时系统已经具备接收消息的条件，但没有伪造真实用户消息；
        如果 Horizon 存在 pending resumption，只提交一条内部 `/resume`。
        """
        if not self.is_workspace_initialized:
            return
        # TODO：runtime-ready 处理项增多后，改为可注册的生命周期监听机制，
        # 避免不同业务继续直接堆叠在本方法中。当前承载两项，不提前引入抽象：
        # 1. 启动任务：在后台按顺序运行用户登记的脚本（如重装依赖），不等待结果；
        # 2. 重启后续办（resumption）：Agent 主动重启沙盒前在 Horizon 记下的未完成事项，
        #    新进程就绪后自动提交一条内部 /resume，让 Agent 接着完成。
        try:
            StartupTaskService.get_instance().start()
        except Exception:
            logger.exception("启动任务后台调度失败")
        from app.service.agent_resumption_service import AgentResumptionService
        await AgentResumptionService.resume_pending(self)

    @staticmethod
    def _agent_mode_value(agent_mode: Union[AgentMode, str]) -> str:
        """返回消息协议中的 Agent 模式值，不做跨领域别名转换。"""
        if isinstance(agent_mode, AgentMode):
            return agent_mode.value
        return str(agent_mode).strip()

    def _build_agent_target(
        self,
        agent_mode: Union[AgentMode, str],
        agent_code: Optional[str],
    ) -> AgentTarget:
        """将消息入口的 mode/code 归一化为 Runtime target。"""
        return AgentTarget.from_mode(agent_mode, agent_code)

    @staticmethod
    def _extract_message_agent_code(message: ChatClientMessage) -> Optional[str]:
        dynamic_config = message.dynamic_config
        if not dynamic_config:
            return None
        agent_code = dynamic_config.get("agent_code")
        if not isinstance(agent_code, str):
            return None
        normalized = agent_code.strip()
        return normalized or None

    async def switch_agent(self, target: AgentTarget) -> Agent:
        """通过统一 Runtime 获取主 Agent。"""
        if self.agent_context is None:
            raise RuntimeError("AgentDispatcher is not initialized")
        return await AgentRuntime.get_instance().acquire(
            target=target,
            lifetime=AgentLifetime.CACHED,
            context=self.agent_context,
        )

    async def run_agent(self, agent: Agent):
        """
        运行Agent处理任务

        Args:
            agent: Agent实例

        Returns:
            bool: 是否成功运行
        """
        await self.agent_service.run_agent(agent=agent)

    def _apply_chat_agent_config(self, message: ChatClientMessage) -> None:
        """从 chat 消息的 agent 字段设置 AgentProfile（基线配置）。

        优先从 agent.profile 读取，兜底从旧的 agent.name / agent.description 读取。
        crew/claw 类型会在 Runtime 准备定义时被身份文件覆盖。
        """
        agent_config = message.agent
        if not agent_config:
            return

        try:
            from app.core.entity.agent_profile import AgentProfile

            profile = agent_config.profile
            agent_name = (
                (profile.name.strip() if profile and profile.name and profile.name.strip() else None)
                or (agent_config.name.strip() if agent_config.name and agent_config.name.strip() else None)
            )
            agent_desc = (
                (profile.description.strip() if profile and profile.description and profile.description.strip() else None)
                or (agent_config.description.strip() if agent_config.description and agent_config.description.strip() else None)
            )
            agent_role = (
                profile.role.strip() if profile and profile.role and profile.role.strip() else None
            )

            if agent_name:
                kwargs = {"name": agent_name}
                if agent_desc:
                    kwargs["description"] = agent_desc
                if agent_role:
                    kwargs["role"] = agent_role
                agent_profile = AgentProfile(**kwargs)
                self.agent_context.set_agent_profile(agent_profile)
                logger.info(f"从 chat agent 配置设置 AgentProfile: name={agent_profile.name}")
        except Exception as e:
            logger.warning(f"从 chat agent 配置设置 AgentProfile 失败: {e}")

    def _apply_builtin_mode_profile(self, agent_mode: Union[AgentMode, str]) -> None:
        """Set a localized baseline profile for built-in creation modes."""
        from app.core.entity.agent_profile import get_builtin_agent_profile

        normalized_mode = self._agent_mode_value(agent_mode)
        profile = get_builtin_agent_profile(normalized_mode)
        if profile is not None:
            self.agent_context.set_agent_profile(profile)

    @staticmethod
    def _last_dispatch_message_file():
        from app.path_manager import PathManager
        return PathManager.get_chat_history_dir() / "last_dispatch_message.json"

    async def get_last_dispatch_message(self) -> Optional[Dict]:
        """获取上次 dispatch 的消息快照，文件不存在时返回 None。"""
        from app.utils.async_file_utils import async_exists, async_read_json
        path = self._last_dispatch_message_file()
        if not await async_exists(path):
            return None
        try:
            data = await async_read_json(path)
            return data if isinstance(data, dict) else None
        except Exception as e:
            logger.warning(f"[AgentDispatcher] 读取上次 dispatch 消息快照失败，忽略: {e}")
            return None

    async def _fill_from_last_dispatch_message(self, message: ChatClientMessage) -> None:
        """用上次保存的消息快照补全本次未显式设置的字段（白名单控制，后续扩展在此处加 case）。"""
        last = await self.get_last_dispatch_message() or {}
        if not last:
            return
        # agent_mode：当前未显式携带（None）时从 last 取
        if message.agent_mode is None and last.get("agent_mode"):
            message.agent_mode = last["agent_mode"]
        # dynamic_config：以 last 为基础，当前消息显式携带的字段优先，
        # 模型字段不从 last_dispatch_message 补全，统一交给 session_config + ModelSelectionPolicy。
        last_dc = dict(last.get("dynamic_config") or {})
        last_dc.pop("image_model", None)
        last_dc.pop("video_model", None)
        # 新消息缺省时不要继承上一条 false；显式继续运行可沿用快照中的状态。
        if message.context_type != ContextType.CONTINUE:
            last_dc.pop("enable_web_search", None)
        last_dc = remove_execution_source_from_dynamic_config(last_dc)
        current_dc = message.dynamic_config or {}
        if last_dc:
            message.dynamic_config = {**last_dc, **current_dc}
        # agent：当前未携带时从 last 取（沙箱复用场景下 continuation 消息可能不带 agent）
        if message.agent is None and last.get("agent"):
            try:
                from app.core.entity.message.client_message import InitAgentConfig
                message.agent = InitAgentConfig(**last["agent"])
            except Exception as e:
                logger.debug(f"从上次 dispatch 快照恢复 agent 配置失败: {e}")

    async def _save_last_dispatch_message(self, message: ChatClientMessage) -> None:
        """保存本次 dispatch 的完整消息快照到本地 .chat_history。"""
        from app.utils.async_file_utils import async_write_json
        new_data = self._remove_model_selection_fields(message.model_dump(mode="json"))
        # 合并策略：以上次快照为基础，新值非 None 才覆盖，防止空值抹掉已存的有效配置
        existing = self._remove_model_selection_fields(await self.get_last_dispatch_message() or {})
        merged = {**existing, **{k: v for k, v in new_data.items() if v is not None}}
        # dynamic_config 做深合并：第三方 IM 消息只携带 agent_code 等部分字段，
        # 避免整个 key 覆盖导致 message_version / agent_code 等配置丢失。
        # 模型续传不依赖此快照，统一由 session_config + ModelSelectionPolicy 处理。
        existing_dc = dict(existing.get("dynamic_config") or {})
        # 保存本次有效搜索偏好；旧协议的新消息缺省时必须清掉旧值，
        # 否则下一次 resume 会从快照重新拾起上一个请求的开关。
        existing_dc.pop("enable_web_search", None)
        new_dc = new_data.get("dynamic_config") or {}
        if existing_dc or new_dc:
            merged["dynamic_config"] = {**existing_dc, **new_dc}
        try:
            await async_write_json(self._last_dispatch_message_file(), merged, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"[AgentDispatcher] 保存 dispatch 消息快照失败，忽略: {e}")

    def _apply_execution_source(self, message: ChatClientMessage) -> None:
        """Resolve and publish the current run source to AgentContext and horizon."""
        source = resolve_execution_source(message)
        stamp_execution_source(message, source)
        self.agent_context.set_execution_source(source)

        if is_ask_user_allowed_source(source):
            return

        try:
            self.agent_context.horizon.push_notification(
                ASK_USER_POLICY_HORIZON_SOURCE,
                build_ask_user_policy_horizon_message(source),
            )
        except Exception as e:
            logger.warning(f"[AgentDispatcher] 推送 ask_user 来源策略到 horizon 失败: {e}")

    @staticmethod
    def _remove_model_selection_fields(snapshot: Dict) -> Dict:
        """移除 dispatch 快照中的模型选择字段，模型续传统一由 session_config 负责。"""
        cleaned = dict(snapshot)
        cleaned.pop("model_id", None)

        dynamic_config = cleaned.get("dynamic_config")
        if isinstance(dynamic_config, dict):
            cleaned_dynamic_config = dict(dynamic_config)
            cleaned_dynamic_config.pop("image_model", None)
            cleaned_dynamic_config.pop("video_model", None)
            if cleaned_dynamic_config:
                cleaned["dynamic_config"] = cleaned_dynamic_config
            else:
                cleaned.pop("dynamic_config", None)

        return cleaned

    async def submit_message(
        self,
        message: ChatClientMessage,
        *,
        resumption_id: Optional[str] = None,
        resumption_run_id: Optional[str] = None,
    ) -> None:
        """
        Standard entry point for channel adapters to submit an inbound message.

        Interrupts the current agent run if one is in progress, then schedules a
        new run as a background task (non-blocking). The caller returns immediately
        after the new task is enqueued.

        Sequence: stop_run → reset_run_state → create_task → register_worker_cancel

        To register channel-specific teardown (e.g. close a reply stream), call
        agent_context.register_run_cleanup() immediately after this method returns —
        it will run when the new run ends or is interrupted.
        """
        sandbox_restart_coordinator.ensure_accepting_runs(self.agent_context.context_id)
        await self.agent_context.stop_run(reason="new message")
        sandbox_restart_coordinator.ensure_accepting_runs()
        self.agent_context.reset_run_state()
        self.agent_context.set_resumption_context(resumption_id, resumption_run_id)

        task = asyncio.create_task(self._run_dispatch_task(message))

        async def _cancel() -> None:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info("[AgentDispatcher] worker task cancelled")

        self.agent_context.register_worker_cancel(_cancel)

    async def _run_dispatch_task(self, message: ChatClientMessage) -> None:
        """Background task wrapper for dispatch_message, used by submit_message."""
        # Re-apply language at the start of every dispatch task.
        # asyncio.create_task() inherits a copy of the parent coroutine's ContextVar
        # state, but each HTTP request starts with no language set (ContextVar default
        # is None → zh_CN). Applying it here inside the task guarantees the correct
        # locale regardless of the caller's context state.
        # Priority: current chat message language > init metadata language > zh_CN default.
        from app.i18n import i18n
        language = None
        if message.metadata and message.metadata.language:
            language = message.metadata.language
        else:
            init_metadata = self.agent_context.get_init_client_message_metadata()
            if init_metadata and init_metadata.language:
                language = init_metadata.language
        i18n.set_language(language or "zh_CN")

        try:
            await self.dispatch_message(message)
        except asyncio.CancelledError:
            raise
        except (AgentTargetError, AgentDefinitionPrepareError) as e:
            logger.error(f"[AgentDispatcher] agent load failed: {e}")
            try:
                if self.agent_context:
                    agent_code = (
                        self._extract_message_agent_code(message)
                        or AgentMode.resolve_agent_type(message.agent_mode)
                    )
                    final_task_state = _build_agent_load_final_task_state(e, agent_code)
                    self.agent_context.set_final_task_state(final_task_state)
                    await self.agent_context.dispatch_event(
                        EventType.ERROR,
                        ErrorEventData(
                            agent_context=self.agent_context,
                            final_task_state=final_task_state,
                        ),
                    )
            except Exception:
                pass
        except Exception as e:
            logger.error(f"[AgentDispatcher] dispatch task failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                if self.agent_context:
                    final_task_state = build_final_task_state(
                        FinalTaskStateCode.INTERNAL_DISPATCH_FAILED,
                    )
                    self.agent_context.set_final_task_state(final_task_state)
                    await self.agent_context.dispatch_event(
                        EventType.ERROR,
                        ErrorEventData(
                            agent_context=self.agent_context,
                            final_task_state=final_task_state,
                        ),
                    )
            except Exception:
                pass

    async def dispatch_message(self, message: ChatClientMessage):
        """
        调度agent执行任务

        Args:
            client_message: 客户端消息

        Returns:
            bool: 是否成功调度
        """
        # 确保工作区已初始化
        if not self.is_workspace_initialized:
            initialized = await self.load_init_client_message()
            if not initialized:
                logger.error("智能体未初始化，请先调用工作区初始化")
                final_task_state = build_final_task_state(FinalTaskStateCode.AGENT_NOT_INITIALIZED)
                self.agent_context.set_final_task_state(final_task_state)
                await self.agent_context.dispatch_event(
                    EventType.ERROR,
                    ErrorEventData(
                        agent_context=self.agent_context,
                        final_task_state=final_task_state,
                    ),
                )
                return

        # 确保 magic-service 模型列表已加载（兜底：防止未经 initialize_workspace 路径就发起 chat）
        # 若已加载则跳过；未加载则同步触发一次，之后按 RefreshPolicy 策略在后台定期刷新。
        try:
            from agentlang.config.models.model_config_manager import model_config_manager
            from app.core.model_providers.magic_service_provider import MagicServiceProvider
            provider = MagicServiceProvider()
            await model_config_manager.ensure_provider_loaded(provider)
            model_config_manager.maybe_refresh_in_background(provider.provider_type)
        except Exception as e:
            logger.warning(f"dispatch_message: model provider check failed, continuing: {e}")

        # 确保 magic-service AI 能力配置已加载，失败不阻断 chat。
        try:
            from agentlang.config.ai_abilities.ability_config_manager import ai_ability_config_manager
            from app.core.ai_ability_providers.magic_service_provider import PROVIDER_TYPE
            from app.service.init.config_initializers import AIAbilityConfigInitializer

            await AIAbilityConfigInitializer(message.dynamic_config).run(self.agent_context)
            # 后台刷新只更新共享 AI 能力配置，不覆盖当前任务已经固定的提示词快照。
            ai_ability_config_manager.maybe_refresh_in_background(PROVIDER_TYPE)
        except Exception as e:
            logger.warning(f"dispatch_message: AI ability provider check failed, continuing: {e}")

        await self._fill_from_last_dispatch_message(message)

        # fill 后仍为 None 说明历史快照也没有，归一化为默认模式
        if message.agent_mode is None:
            message.agent_mode = AgentMode.GENERAL

        # image_model_id：从 dynamic_config.image_model.model_id 读取并 set 进 context
        image_model_config = (message.dynamic_config or {}).get("image_model")
        if image_model_config and isinstance(image_model_config, dict):
            image_model_id = image_model_config.get("model_id")
            if image_model_id:
                self.agent_context.set_dynamic_image_model_id(image_model_id)
                logger.info(f"[AgentDispatcher] 从消息 dynamic_config 设置图片模型: {image_model_id}")

        self._apply_execution_source(message)
        self.agent_context.set_chat_client_message(message)

        agent_code = self._extract_message_agent_code(message)

        # 先设置内置模式的本地化默认身份，再由 chat profile 和 crew/claw 编译产物覆盖。
        previous_profile = self.agent_context.get_agent_profile().model_copy(deep=True)
        self._apply_builtin_mode_profile(message.agent_mode)

        # 从 chat 消息的 agent 字段设置 AgentProfile（显式配置）
        # Runtime 中的 crew/claw Provider 可能会用身份文件覆盖此设置。
        self._apply_chat_agent_config(message)

        try:
            target = self._build_agent_target(message.agent_mode, agent_code)
            agent = await self.switch_agent(target)
            profile = message.agent.profile if message.agent is not None else None
            self.agent_context.set_user_facing_agent_name(
                target, (profile.user_facing_name or "") if profile is not None else "",
            )
        except asyncio.CancelledError:
            self.agent_context.set_agent_profile(previous_profile)
            raise
        except Exception:
            self.agent_context.set_agent_profile(previous_profile)
            raise

        # 保存本次 dispatch 的完整消息快照（存储全量，补全侧用白名单控制应用范围）
        await self._save_last_dispatch_message(message)

        self._apply_model_selection(message, agent)

        # 摄取客户端 MCP 配置：增量持久化到 ChatMcpStore，有变更时通过 horizon 通知模型
        logger.info("正在摄取客户端 MCP 配置...")
        await MCPService.ingest_from_message(message.mcp_config, self.agent_context)

        # 保存当前模型配置
        await self._save_session_config(message, agent)

        await self.run_agent(agent=agent)

        return True

    def set_init_event_dispatched(self, dispatched: bool) -> None:
        """设置 init 事件发送状态

        Args:
            dispatched: init 事件是否已发送
        """
        self.init_event_dispatched = dispatched
        logger.info(f"设置 init 事件发送状态: {dispatched}")

    def is_init_event_dispatched(self) -> bool:
        """检查 init 事件是否已发送

        Returns:
            bool: init 事件是否已发送
        """
        return self.init_event_dispatched

    @staticmethod
    def _dynamic_image_model(dynamic_config: Optional[Mapping[str, object]]) -> ImageModelSpec:
        if not isinstance(dynamic_config, Mapping):
            return ImageModelSpec.empty()
        return ImageModelSpec.from_raw(dynamic_config.get("image_model"))

    @staticmethod
    def _dynamic_video_model(dynamic_config: Optional[Mapping[str, object]]) -> VideoModelSpec:
        if not isinstance(dynamic_config, Mapping):
            return VideoModelSpec.empty()
        return VideoModelSpec.from_raw(dynamic_config.get("video_model"))

    @staticmethod
    def _session_image_model(current: SessionConfig, last: SessionConfig) -> ImageModelSpec:
        model_id = current.image_model_id or last.image_model_id
        sizes = current.image_model_sizes if current.image_model_sizes is not None else last.image_model_sizes
        return ImageModelSpec.from_values(model_id=model_id, sizes=sizes)

    @staticmethod
    def _session_video_model(current: SessionConfig, last: SessionConfig) -> VideoModelSpec:
        model_id = current.video_model_id or last.video_model_id
        video_generation_config = (
            current.video_generation_config
            if current.video_generation_config is not None
            else last.video_generation_config
        )
        return VideoModelSpec.from_values(
            model_id=model_id,
            video_generation_config=video_generation_config,
        )

    def _apply_model_selection(self, message: ChatClientMessage, agent: Agent) -> None:
        current_session_config = agent.chat_history.get_current_session_config()
        last_session_config = agent.chat_history.get_last_session_config()
        selection = ModelSelectionPolicy.resolve(ModelSelectionInput(
            configured_text_model_id=agent.agent_context.model_context.configured_text_model_id,
            request_text_model_id=message.model_id,
            session_text_model_id=current_session_config.model_id or last_session_config.model_id,
            request_image_model=self._dynamic_image_model(message.dynamic_config),
            session_image_model=self._session_image_model(current_session_config, last_session_config),
            request_video_model=self._dynamic_video_model(message.dynamic_config),
            session_video_model=self._session_video_model(current_session_config, last_session_config),
        ))
        agent.agent_context.model_context.apply_selection(selection)
        agent.agent_context.set_reasoning_effort((message.dynamic_config or {}).get("reasoning_effort"))
        logger.info(
            "[AgentDispatcher] 已应用模型选择: "
            f"text={selection.text_model_id}, "
            f"image={selection.image_model_id or '-'}, "
            f"video={selection.video_model_id or '-'}"
        )

    async def _save_session_config(self, message: ChatClientMessage, agent: Agent):
        """
        保存当前会话配置到聊天历史中（包括模型、图片模型、MCP服务器等）

        Args:
            message: 客户端消息
            agent: Agent实例
        """
        try:
            # 非前端 chat 消息（第三方 IM 渠道等）不更新 session 配置，避免覆盖已有的模型/版本等设置
            if not message.update_session:
                return

            agent_context = agent.agent_context
            model_context = agent_context.model_context
            current_model_id = model_context.current_text_model_id
            if not current_model_id:
                raise ValueError("Text model id is not configured")

            current_image_model_id = model_context.image_model_id
            current_image_model_sizes = model_context.image.sizes_payload()
            current_video_model_id = model_context.video_model_id
            current_video_generation_config = model_context.video.video_generation_config

            current_agent_mode = None
            msg_agent_mode = message.agent_mode
            if msg_agent_mode is not None:
                if isinstance(msg_agent_mode, AgentMode):
                    current_agent_mode = msg_agent_mode.get_agent_type()
                else:
                    try:
                        current_agent_mode = AgentMode(msg_agent_mode).get_agent_type()
                    except (ValueError, KeyError):
                        pass

            current_agent_code = self._extract_message_agent_code(message)

            agent.chat_history.save_session_config(
                current_model_id,
                current_image_model_id,
                current_image_model_sizes,
                current_video_model_id,
                current_video_generation_config,
                message_version=agent_context.get_message_version() if agent_context else None,
                agent_mode=current_agent_mode,
                agent_code=current_agent_code,
            )
        except Exception as e:
            logger.debug(f"保存会话配置时出错: {e}")
