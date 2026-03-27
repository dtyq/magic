from app.i18n import i18n
import asyncio
import os
import json
from typing import Dict, Optional, Union
import importlib
import importlib.metadata
import inspect

from app.core.context.agent_context import AgentContext
from agentlang.event.data import ErrorEventData
from agentlang.event.event import EventType
from app.core.stream.http_subscription_stream import HTTPSubscriptionStream
from app.core.stream.stdout_stream import StdoutStream
from agentlang.config.config import config
from app.magic.agent import Agent
from app.service.agent_service import AgentService
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService

from app.service.agent_event.rag_listener_service import RagListenerService
from app.service.agent_event.resource_cleanup_listener_service import ResourceCleanupListenerService
from app.service.agent_event.stream_listener_service import StreamListenerService
from app.service.agent_event.checkpoint_listener_service import CheckpointListenerService
from app.infrastructure.observability import install_tool_monitoring_listener
from app.service.mcp_service import MCPService
from app.path_manager import PathManager
from app.channel.startup import auto_connect_channels_for_current_sandbox
from app.core.entity.message.client_message import InitClientMessage, ChatClientMessage, AgentMode
from agentlang.logger import get_logger
from app.core.base_service import Base

logger = get_logger(__name__)


class AgentDispatcher(Base):
    SERVICE_TYPE = "dispatcher"
    TRACE_EXCLUDE_METHODS = {"get_instance"}
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
        self.http_stream: Optional[HTTPSubscriptionStream] = None
        self.is_workspace_initialized: bool = False  # 工作区初始化状态标志
        self.agent_service = AgentService()  # 创建AgentService实例
        self.agents: Dict[str, Agent] = {}  # 用于存储不同类型的agent

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
        ResourceCleanupListenerService.register_standard_listeners(self.agent_context)

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

        # TODO： 更优雅的方式管理所有需要自启的设施
        # 自动重连上次保存的 IM 渠道（connect 内部已非阻塞，此处 await 仅等待参数传递）
        await auto_connect_channels_for_current_sandbox()

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

        # ========== 配置更新阶段 - 每次都执行 ==========
        # 保存初始化消息到文件
        from app.utils.init_client_message_util import InitClientMessageUtil
        InitClientMessageUtil.save_init_client_message(init_message)

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

        # 设置 Agent Profile（如果提供）
        if init_message.agent and init_message.agent.name.strip():
            from app.core.entity.agent_profile import AgentProfile

            agent_profile = AgentProfile(
                name=init_message.agent.name.strip(),
                description=init_message.agent.description.strip(),
            )
            self.agent_context.set_agent_profile(agent_profile)
            logger.info(f"设置自定义 Agent: name={agent_profile.name}, description={agent_profile.description[:50]}...")
        elif init_message.agent:
            logger.info("INIT 未提供有效 agent name，保持默认 AgentProfile")

        # ========== 资源初始化阶段 - 仅首次执行 ==========
        if self.is_workspace_initialized:
            logger.info("工作区已经初始化过，跳过资源创建和工作区初始化")
            return

        logger.info("首次初始化工作区，开始创建资源...")

        # HTTP订阅流 - 通过环境变量控制是否启用
        enable_http_stream = os.getenv("ENABLE_HTTP_SUBSCRIPTION_STREAM", "true").lower() == "true"
        if init_message.message_subscription_config and not self.http_stream:
            if enable_http_stream:
                self.http_stream = HTTPSubscriptionStream(init_message.message_subscription_config)
                self.agent_context.add_stream(self.http_stream)
                logger.info("创建和添加了HTTP订阅流")
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

    async def switch_agent(self, agent_mode: Union[AgentMode, str], agent_code: str = None):
        """
        根据agent_mode切换到相应的agent

        Args:
            agent_mode: Agent模式，可以是AgentMode枚举或者自定义Agent的字符串ID
            agent_code: (optional) crew agent code, used when agent_mode == "custom_agent"

        Returns:
            Agent: 选择的Agent实例
        """
        # 如果是字符串，仅支持 custom_agent + agent_code 或内置 AgentMode
        if isinstance(agent_mode, str):
            normalized_mode = agent_mode.strip()

            # 0. custom_agent + agent_code => compiled crew agent
            if normalized_mode == "custom_agent":
                if agent_code and agent_code.strip():
                    agent_type = agent_code.strip()
                    if agent_type in self.agents:
                        logger.info(f"清理已缓存的 crew Agent: {agent_type}")
                        del self.agents[agent_type]
                    logger.info(f"使用编译后的 crew agent: {agent_type}.agent")
                else:
                    logger.warning("custom_agent 未提供 agent_code，回退到默认模式")
                    agent_type = AgentMode.GENERAL.get_agent_type()

            # 0b. magiclaw + agent_code => compiled claw agent (from agents/claws/<claw_code>/)
            elif normalized_mode == "magiclaw":
                if agent_code and agent_code.strip():
                    agent_type = agent_code.strip()
                    if agent_type in self.agents:
                        del self.agents[agent_type]
                    logger.info(f"magiclaw 模式，使用编译后的 claw agent: {agent_type}.agent")
                else:
                    logger.warning("magiclaw 未提供 agent_code，回退到默认模式")
                    agent_type = AgentMode.GENERAL.get_agent_type()

            else:
                try:
                    resolved_mode = AgentMode(normalized_mode)
                    logger.info(f"识别为内置 AgentMode: {resolved_mode}")
                    agent_type = resolved_mode.get_agent_type()
                except ValueError:
                    logger.warning(f"未识别的 agent_mode='{normalized_mode}'，回退到默认模式")
                    agent_type = AgentMode.GENERAL.get_agent_type()
        else:
            # 使用 AgentMode 的 get_agent_type 方法
            agent_type = agent_mode.get_agent_type()

        # 按需创建agent
        self.agents[agent_type] = await self.agent_service.create_agent(agent_type, self.agent_context)

        # 获取选中的agent实例
        selected_agent = self.agents[agent_type]

        return selected_agent

    async def run_agent(self, agent: Agent):
        """
        运行Agent处理任务

        Args:
            agent: Agent实例

        Returns:
            bool: 是否成功运行
        """
        await self.agent_service.run_agent(agent=agent)

    async def _prepare_crew_agent(self, agent_code: str) -> None:
        """Download crew files (if needed), compile into .agent, set AgentProfile."""
        from app.path_manager import PathManager
        from app.service.crew_downloader import CrewDownloader
        from app.service.crew_agent_compiler import CrewAgentCompiler
        from app.core.entity.agent_profile import AgentProfile
        from app.utils.async_file_utils import async_read_markdown

        crew_dir = PathManager.get_crew_agent_dir(agent_code)
        output_agent_file = PathManager.get_compiled_agent_file(agent_code)
        identity_file = PathManager.get_crew_identity_file(agent_code)
        compiler = CrewAgentCompiler()

        if output_agent_file.exists():
            logger.info(f"Crew .agent already exists, skip download/compile: {output_agent_file}")
            if not identity_file.exists():
                logger.warning(f"IDENTITY.md not found for existing crew agent, skip profile setup: {identity_file}")
                return
            identity_meta = (await async_read_markdown(identity_file)).meta
        else:
            if not identity_file.exists():
                logger.info(f"Crew files not found locally, downloading: {agent_code}")
                downloader = CrewDownloader()
                await downloader.download_and_extract(agent_code, crew_dir)
            identity_meta = await compiler.compile(agent_code, crew_dir)

        name        = identity_meta.get("name", "")
        role        = identity_meta.get("role", "")
        description = identity_meta.get("description", "")

        if name:
            profile = AgentProfile(name=name, role=role, description=description)
            self.agent_context.set_agent_profile(profile)
            logger.info(f"Set crew agent profile: name={name}, role={role}")

    async def _prepare_claw_agent(self, claw_code: str) -> None:
        """Compile claw definition files into .agent (if needed) and set AgentProfile.

        Source files live in the workspace .magic/ directory. On first run the
        template is copied from agents/claws/<claw_code>/ with SKIP strategy so
        that existing workspace files are never overwritten.
        """
        from datetime import date
        from app.path_manager import PathManager
        from app.service.claw_agent_compiler import ClawAgentCompiler
        from app.core.entity.agent_profile import AgentProfile
        from app.utils.async_file_utils import async_copytree, async_read_markdown, CopyConflict

        magic_dir = PathManager.get_magic_dir()
        output_agent_file = PathManager.get_compiled_agent_file(claw_code)

        # 始终补全缺失的模板文件，已有文件不会被覆盖
        claw_src = PathManager.get_claw_agent_dir(claw_code)
        await async_copytree(claw_src, magic_dir, on_conflict=CopyConflict.SKIP)

        # Rename the placeholder memory file to today's date so the agent starts
        # with a correctly named daily log file instead of the template sentinel.
        placeholder = magic_dir / "memory" / "1900-01-01-none.md"
        if placeholder.exists():
            today_file = magic_dir / "memory" / f"{date.today().isoformat()}.md"
            if not today_file.exists():
                placeholder.rename(today_file)
                logger.info(f"Renamed memory placeholder to: {today_file.name}")
            else:
                placeholder.unlink()
                logger.info(f"Removed memory placeholder (today's file already exists: {today_file.name})")

        if output_agent_file.exists():
            logger.info(f"Claw .agent already exists, skip compile: {output_agent_file}")
            identity_meta = (await async_read_markdown(magic_dir / "IDENTITY.md")).meta
        else:
            compiler = ClawAgentCompiler()
            identity_meta = await compiler.compile(claw_code, magic_dir)

        name        = identity_meta.get("name", "")
        role        = identity_meta.get("role", "")
        description = identity_meta.get("description", "")

        if name:
            self.agent_context.set_agent_profile(AgentProfile(name=name, role=role, description=description))
            logger.info(f"Set claw agent profile: name={name}, role={role}")

    async def _prepare_agent(self, agent_mode: str, agent_code: Optional[str]) -> None:
        """Compile + set AgentProfile for modes that need it (crew / magiclaw)."""
        try:
            if agent_mode == "custom_agent" and agent_code:
                await self._prepare_crew_agent(agent_code)
            elif agent_mode == "magiclaw" and agent_code:
                await self._prepare_claw_agent(agent_code)
        except Exception as e:
            logger.error(f"Agent preparation failed (mode={agent_mode}, code={agent_code}): {e}")
            logger.info("Falling back to default agent profile")

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

    async def _save_last_dispatch_message(self, message: ChatClientMessage) -> None:
        """保存本次 dispatch 的完整消息快照到文件（.chat_history/last_dispatch_message.json）。"""
        from app.utils.async_file_utils import async_write_json
        new_data = message.model_dump(mode="json")
        # 合并策略：以上次快照为基础，新值非 None 才覆盖，防止空值抹掉已存的有效配置
        existing = await self.get_last_dispatch_message() or {}
        merged = {**existing, **{k: v for k, v in new_data.items() if v is not None}}
        try:
            await async_write_json(self._last_dispatch_message_file(), merged, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"[AgentDispatcher] 保存 dispatch 消息快照失败，忽略: {e}")

    async def submit_message(self, message: ChatClientMessage) -> None:
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
        # 用上次保存的消息快照补全本次未显式设置的字段（白名单控制，后续扩展在此处加 case）
        last = await self.get_last_dispatch_message() or {}
        if last:
            # agent_mode：当前未携带时从 last 取
            if not message.agent_mode and last.get("agent_mode"):
                message.agent_mode = last["agent_mode"]
            # agent_code：当前未携带时从 last 取
            current_agent_code = (message.dynamic_config or {}).get("agent_code")
            last_agent_code = (last.get("dynamic_config") or {}).get("agent_code")
            if not current_agent_code and last_agent_code:
                message.dynamic_config = {**(message.dynamic_config or {}), "agent_code": last_agent_code}

        await self.agent_context.stop_run(reason="new message")
        self.agent_context.reset_run_state()

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
        from app.i18n import i18n
        metadata = self.agent_context.get_init_client_message_metadata()
        if metadata and metadata.language:
            i18n.set_language(metadata.language)
        else:
            i18n.set_language("zh_CN")

        try:
            await self.dispatch_message(message)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"[AgentDispatcher] dispatch task failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                from agentlang.event.data import ErrorEventData
                from agentlang.event.event import EventType
                if self.agent_context:
                    await self.agent_context.dispatch_event(
                        EventType.ERROR,
                        ErrorEventData(
                            agent_context=self.agent_context,
                            error_message="Failed to process the request. Please contact the administrator.",
                            exception=e,
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
                await self.agent_context.dispatch_event(
                    EventType.ERROR,
                    ErrorEventData(
                        agent_context=self.agent_context, error_message="智能体未初始化，请先调用工作区初始化"
                    ),
                )
                return

        self.agent_context.set_chat_client_message(message)

        # Extract agent_code for crew agent dispatching
        agent_code = None
        if message.dynamic_config:
            agent_code_val = message.dynamic_config.get("agent_code")
            if agent_code_val and isinstance(agent_code_val, str) and agent_code_val.strip():
                agent_code = agent_code_val.strip()

        # Compile agent files and set AgentProfile before loading the agent instance
        await self._prepare_agent(str(message.agent_mode), agent_code)

        # 保存本次 dispatch 的完整消息快照（存储全量，补全侧用白名单控制应用范围）
        await self._save_last_dispatch_message(message)

        # 使用 agent_mode 进行 agent 选择
        agent = await self.switch_agent(message.agent_mode, agent_code=agent_code)

        # 初始化 MCP 配置
        logger.info("正在初始化 MCP 配置...")
        await MCPService.initialize_from_config(message.mcp_config, self.agent_context)

        # 保存当前模型配置（在 MCP 初始化之后，以便保存正确的 MCP 服务器信息）
        self._save_session_config(message, agent)

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

    def _save_session_config(self, message: ChatClientMessage, agent: Agent):
        """
        保存当前会话配置到聊天历史中（包括模型、图片模型、MCP服务器等）

        Args:
            message: 客户端消息
            agent: Agent实例
        """
        try:
            current_model_id = message.model_id or agent.llm_id
            current_image_model_id = None
            current_image_model_sizes = None
            current_mcp_servers = None

            if message.dynamic_config:
                image_model_config = message.dynamic_config.get("image_model")
                if image_model_config and isinstance(image_model_config, dict):
                    current_image_model_id = image_model_config.get("model_id")
                    current_image_model_sizes = image_model_config.get("sizes")

            # 获取当前 MCP 服务器信息（仅在加载了 using-mcp skill 时）
            agent_context = agent.agent_context
            if agent_context and agent_context.has_skill("using-mcp"):
                from app.mcp.manager import get_global_mcp_manager
                manager = get_global_mcp_manager()
                if manager:
                    current_mcp_servers = {}
                    for server_name in manager.get_connected_servers():
                        tools = manager.get_server_tools(server_name)
                        current_mcp_servers[server_name] = tools

            agent.chat_history.save_session_config(current_model_id, current_image_model_id, current_image_model_sizes, current_mcp_servers)
        except Exception as e:
            logger.debug(f"保存会话配置时出错: {e}")
