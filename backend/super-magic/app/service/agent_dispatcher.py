import asyncio
import os
import json
from typing import Optional
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
from app.service.agent_event.finish_task_listener_service import FinishTaskListenerService
from app.service.agent_event.rag_listener_service import RagListenerService
from app.service.agent_event.stream_listener_service import StreamListenerService
from app.service.agent_event.todo_listener_service import TodoListenerService
from app.service.agent_event.file_listener_service import FileListenerService
from app.paths import PathManager
from app.core.entity.message.client_message import InitClientMessage, TaskMode, ChatClientMessage
from agentlang.logger import get_logger

logger = get_logger(__name__)

class AgentDispatcher:
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
        self.agents = {}  # 用于存储不同类型的agent

        # 设置为单例实例
        self.__class__._instance = self

    async def setup(self):
        """设置Agent上下文和注册监听器"""
        self.agent_context = self.agent_service.create_agent_context(
            stream_mode=False,
            task_id="",
            streams=[StdoutStream()],
            is_main_agent=True,
            sandbox_id=str(config.get("sandbox.id"))
        )

        self.agent_context.update_activity_time()

        # 注册各种监听器
        FileStorageListenerService.register_standard_listeners(self.agent_context)
        TodoListenerService.register_standard_listeners(self.agent_context)
        FinishTaskListenerService.register_standard_listeners(self.agent_context)
        StreamListenerService.register_standard_listeners(self.agent_context)
        RagListenerService.register_standard_listeners(self.agent_context)
        FileListenerService.register_standard_listeners(self.agent_context)

        # 从 entry points 中获取注册的监听器，group=supermagic.listeners.register
        group = 'supermagic.agent_dispatcher.listeners.register'
        listeners_entry_points = list(importlib.metadata.entry_points(group=group))
        for entry_point in listeners_entry_points:
            try:
                logger.info(f"发现 agent_dispatcher 监听器: {entry_point.name}")
                module_name = entry_point.value.split(':')[0]
                method_name = entry_point.value.split(':')[1]
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
        加载初始化客户端消息到agent_context

        Returns:
            bool: 是否成功加载并初始化
        """
        if self.agent_context.get_init_client_message() is not None:
            logger.info("agent_context 已存在客户端初始化消息，跳过文件加载")
            return True

        try:
            init_client_message_file = PathManager.get_init_client_message_file()
            if os.path.exists(init_client_message_file):
                with open(init_client_message_file, 'r', encoding='utf-8') as f:
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

    async def initialize_workspace(self, init_message):
        """初始化工作区"""
        if self.is_workspace_initialized:
            logger.info("工作区已经初始化过，跳过初始化流程")
            return

        self.agent_context.set_init_client_message(init_message)

        if init_message.message_subscription_config and not self.http_stream:
            self.http_stream = HTTPSubscriptionStream(init_message.message_subscription_config)
            self.agent_context.add_stream(self.http_stream)
            logger.info("创建和添加了HTTP订阅流")

        # 从 init_message.metadata 提取并设置关键字段
        if init_message.metadata:
            # 设置 task_id
            if "super_magic_task_id" in init_message.metadata:
                self.agent_context.set_task_id(init_message.metadata["super_magic_task_id"])
                logger.info(f"从 init_message.metadata 设置任务ID: {init_message.metadata['super_magic_task_id']}")
            
            # 设置 sandbox_id
            if "sandbox_id" in init_message.metadata:
                self.agent_context.set_sandbox_id(init_message.metadata["sandbox_id"])
                logger.info(f"从 init_message.metadata 设置沙盒ID: {init_message.metadata['sandbox_id']}")

            # 设置 organization_code
            if "organization_code" in init_message.metadata:
                self.agent_context.set_organization_code(init_message.metadata["organization_code"])
                logger.info(f"从 init_message.metadata 设置组织编码: {init_message.metadata['organization_code']}")

        await self.agent_service.init_workspace(agent_context=self.agent_context)

        self.agents["magic"] = await self.agent_service.create_agent("magic", self.agent_context)
        self.agents["super-magic"] = await self.agent_service.create_agent("super-magic", self.agent_context)

        self.is_workspace_initialized = True
        logger.info("工作区初始化完成")

    async def switch_agent(self, task_mode: TaskMode):
        """
        根据task_mode切换到相应的agent

        Args:
            task_mode: 任务模式，可以是TaskMode.CHAT或TaskMode.PLAN

        Returns:
            Agent: 选择的Agent实例
        """
        if task_mode == TaskMode.CHAT:
            agent_type = "magic"
        elif task_mode == TaskMode.PLAN:
            agent_type = "super-magic"

        if agent_type not in self.agents:
            logger.error(f"未找到agent类型: {agent_type}，使用默认的super-magic")
            agent_type = "super-magic"

        logger.info(f"根据 task_mode({task_mode}) 选择agent类型: {agent_type}")

        return self.agents[agent_type]

    async def run_agent(self, agent: Agent):
        """
        运行Agent处理任务

        Args:
            agent: Agent实例

        Returns:
            bool: 是否成功运行
        """
        await self.agent_service.run_agent(agent=agent)

    async def dispatch_agent(self, message: ChatClientMessage):
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
                await self.agent_context.dispatch_event(EventType.ERROR, ErrorEventData(
                    agent_context=self.agent_context,
                    error_message="智能体未初始化，请先调用工作区初始化"
                ))
                return

        self.agent_context.set_chat_client_message(message)

        agent = await self.switch_agent(message.task_mode)
        await self.run_agent(agent=agent)

        return True
