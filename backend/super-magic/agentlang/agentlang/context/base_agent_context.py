"""
基础代理上下文类

提供代理上下文基本功能的实现，不包含业务逻辑
"""

import os
import asyncio
from typing import Any, Callable, Dict, Optional

from agentlang.context.base_context import BaseContext
from agentlang.event.interface import EventDispatcherInterface
from agentlang.interface.context import AgentContextInterface
from agentlang.event.dispatcher import EventDispatcher
from agentlang.logger import get_logger
from agentlang.context.shared_context import AgentSharedContext, GLOBAL_AGENT_SHARED_CONTEXT

logger = get_logger(__name__)

class BaseAgentContext(BaseContext, AgentContextInterface):
    """基础代理上下文实现

    提供核心接口的基本实现，不包含业务逻辑
    """

    _workspace_dir: str
    _resources: Dict[str, Any]
    _user_id: Optional[str]

    def __init__(self, shared_context: Optional[AgentSharedContext] = None):
        """初始化基础代理上下文"""
        super().__init__()
        # 主 Agent 默认共享全局实例；子 Agent 可显式传入独立实例。
        self.shared_context = shared_context or GLOBAL_AGENT_SHARED_CONTEXT

        self._workspace_dir = ""
        self._resources: Dict[str, Any] = {}
        self._user_id = None

                # 框架层基础属性
        self.agent_name = "base_agent"  # 默认代理名称
        self.is_main_agent = False  # 是否为主代理
        self.stream_mode = False  # 流模式开关
        self.llm = None  # 当前使用的LLM模型
        self.use_dynamic_prompt = True  # 动态提示词开关
        self.chat_history_dir = ""  # 聊天历史目录

        # 初始化共享字段
        self._init_shared_fields()

    def _init_shared_fields(self):
        """初始化共享字段并注册到 shared_context"""
        # 检查是否已经初始化
        if self.shared_context.has_field("event_dispatcher"):
            return

        self.shared_context.register_fields({
            "event_dispatcher": (EventDispatcher(), EventDispatcherInterface),
            "dynamic_model_id": (None, Optional[str]),       # 动态 LLM 模型 ID
            "dynamic_image_model_id": (None, Optional[str]), # 动态图片生成模型 ID
            "non_human_options": (None, Optional[Any]),      # 非人类限流配置
            "user_timezone": (None, Optional[str]),          # 用户时区（IANA 名称），None 时回落系统时区
        })

    def get_workspace_dir(self) -> str:
        """获取工作空间目录"""
        return self._workspace_dir

    def set_workspace_dir(self, workspace_dir: str) -> None:
        """设置工作空间目录"""
        self._workspace_dir = workspace_dir
        logger.debug(f"设置工作空间目录: {workspace_dir}")

    def ensure_workspace_dir(self) -> str:
        """确保工作空间目录存在"""
        if not self._workspace_dir:
            raise ValueError("工作空间目录未设置")

        os.makedirs(self._workspace_dir, exist_ok=True)
        return self._workspace_dir

    def set_agent_name(self, agent_name: str) -> None:
        """设置代理名称

        Args:
            agent_name: 代理名称
        """
        self.agent_name = agent_name
        logger.debug(f"设置代理名称: {agent_name}")

    def get_agent_name(self) -> str:
        """获取代理名称"""
        return self.agent_name

    def set_main_agent(self, is_main: bool) -> None:
        """设置是否为主代理

        Args:
            is_main: 是否为主代理
        """
        self.is_main_agent = is_main
        logger.debug(f"设置是否为主代理: {is_main}")

    def set_stream_mode(self, enabled: bool) -> None:
        """设置是否使用流式输出

        Args:
            enabled: 是否启用
        """
        self.stream_mode = enabled
        logger.debug(f"设置流式输出模式: {enabled}")

    def is_stream_mode(self) -> bool:
        """获取流式输出模式"""
        return self.stream_mode

    def set_llm(self, model: str) -> None:
        """设置LLM模型

        Args:
            model: 模型名称
        """
        self.llm = model
        logger.debug(f"设置LLM模型: {model}")

    def get_llm(self) -> str:
        """获取LLM模型"""
        return self.llm

    def get_real_model_id(self) -> Optional[str]:
        """获取实际使用的模型ID（优先级：dynamic_model_id > llm）

        Returns:
            Optional[str]: 实际使用的模型ID，如果都未设置则返回 None
        """
        return (
            (self.get_dynamic_model_id() if self.has_dynamic_model_id() else None)
            or self.llm
        )

    def set_use_dynamic_prompt(self, enabled: bool) -> None:
        """设置是否使用动态提示词

        Args:
            enabled: 是否启用
        """
        self.use_dynamic_prompt = enabled
        logger.debug(f"设置动态提示词: {enabled}")

    def is_use_dynamic_prompt(self) -> bool:
        """获取是否使用动态提示词"""
        return self.use_dynamic_prompt

    def set_chat_history_dir(self, directory: str) -> None:
        """设置聊天历史目录

        Args:
            directory: 聊天历史目录路径
        """
        self.chat_history_dir = directory
        os.makedirs(directory, exist_ok=True)
        logger.debug(f"设置聊天历史目录: {directory}")

    def get_chat_history_dir(self) -> str:
        """获取聊天历史目录"""
        return self.chat_history_dir

    def get_event_dispatcher(self) -> EventDispatcherInterface:
        """获取事件分发器

        Returns:
            EventDispatcherInterface: 事件分发器
        """
        return self.shared_context.get_field("event_dispatcher")


    async def dispatch_event(self, event_type: str, data: Any) -> Any:
        """分发事件"""
        from agentlang.event.event import Event
        event = Event(event_type, data)
        logger.debug(f"分发事件: {event_type}")
        return await self.get_event_dispatcher().dispatch(event)

    def add_event_listener(self, event_type: str, listener: Callable) -> None:
        """添加事件监听器"""
        self.get_event_dispatcher().add_listener(event_type, listener)
        logger.debug(f"添加事件监听器: {event_type}")

    async def get_resource(self, name: str, factory=None) -> Any:
        """获取资源，如不存在则创建"""
        # 资源不存在且提供了工厂函数，则创建
        if name not in self._resources and factory is not None:
            try:
                # 如果工厂是异步函数，等待其完成
                if asyncio.iscoroutinefunction(factory):
                    self._resources[name] = await factory()
                else:
                    self._resources[name] = factory()
                logger.debug(f"创建资源: {name}")
            except Exception as e:
                logger.error(f"创建资源 {name} 时出错: {e}")
                raise RuntimeError(f"创建资源 {name} 时出错: {e}")

        # 返回资源（可能为None）
        return self._resources.get(name)

    def add_resource(self, name: str, resource: Any) -> None:
        """添加资源"""
        self._resources[name] = resource
        logger.debug(f"添加资源: {name}")

    async def close_resource(self, name: str) -> None:
        """关闭并移除资源"""
        if name not in self._resources:
            return

        resource = self._resources[name]
        try:
            # 尝试关闭资源（如果它有close方法）
            if hasattr(resource, "close") and callable(getattr(resource, "close")):
                if asyncio.iscoroutinefunction(resource.close):
                    await resource.close()
                else:
                    resource.close()
                logger.debug(f"关闭资源: {name}")

            # 移除资源
            del self._resources[name]
        except Exception as e:
            logger.error(f"关闭资源 {name} 时出错: {e}")
            # 尽管出错，仍然从字典中移除
            if name in self._resources:
                del self._resources[name]
            raise RuntimeError(f"关闭资源 {name} 时出错: {e}")

    async def close_all_resources(self) -> None:
        """关闭并移除所有资源"""
        # 复制键列表，因为在迭代过程中会修改字典
        resource_names = list(self._resources.keys())
        for name in resource_names:
            await self.close_resource(name)
        logger.debug(f"关闭所有资源 ({len(resource_names)} 个)")

    def set_user_id(self, user_id: str) -> None:
        """设置用户ID"""
        self._user_id = user_id

    def get_user_id(self) -> Optional[str]:
        """获取用户ID"""
        return self._user_id

    def get_metadata(self) -> Dict[str, Any]:
        """获取上下文元数据

        继承自BaseContext，返回所有元数据
        """
        return {**self._metadata}

    # 实现动态模型ID管理接口（使用shared_context）
    def set_dynamic_model_id(self, model_id: str) -> None:
        """设置动态模型ID（会覆盖Agent默认模型选择）

        Args:
            model_id: 动态指定的模型ID
        """
        self.shared_context.update_field("dynamic_model_id", model_id)
        logger.info(f"已设置动态模型ID: {model_id}")

    def get_dynamic_model_id(self) -> Optional[str]:
        """获取动态模型ID

        Returns:
            Optional[str]: 动态模型ID，如果未设置则返回None
        """
        return self.shared_context.get_field("dynamic_model_id")

    def has_dynamic_model_id(self) -> bool:
        """检查是否设置了动态模型ID

        Returns:
            bool: 是否设置了动态模型ID
        """
        model_id = self.shared_context.get_field("dynamic_model_id")
        return model_id is not None and model_id.strip() != ""

    def clear_dynamic_model_id(self) -> None:
        """清除动态模型ID设置"""
        self.shared_context.update_field("dynamic_model_id", None)
        logger.debug("已清除动态模型ID设置")

    def set_dynamic_image_model_id(self, model_id: str) -> None:
        """设置动态图片模型ID（生图工具优先使用此值，覆盖 dynamic_config.yaml 的配置）"""
        self.shared_context.update_field("dynamic_image_model_id", model_id)
        logger.info(f"已设置动态图片模型ID: {model_id}")

    def get_dynamic_image_model_id(self) -> Optional[str]:
        """获取图片生成模型ID。

        优先返回通过 set_dynamic_image_model_id 设置的值；
        未设置时回落到 dynamic_config.yaml 的 image_model.model_id；
        均未配置时返回 None。
        """
        model_id = self.shared_context.get_field("dynamic_image_model_id")
        if model_id and isinstance(model_id, str) and model_id.strip():
            return model_id.strip()
        try:
            from agentlang.config.dynamic_config import dynamic_config
            config_data = dynamic_config.read_dynamic_config()
            if config_data:
                image_model_config = config_data.get("image_model", {})
                if isinstance(image_model_config, dict):
                    cfg_id = image_model_config.get("model_id")
                    if cfg_id and isinstance(cfg_id, str) and cfg_id.strip():
                        return cfg_id.strip()
        except Exception:
            pass
        return None

    # 非人类限流配置管理接口（使用shared_context）
    def set_non_human_options(self, options: Any) -> None:
        """设置非人类限流配置

        Args:
            options: 非人类限流配置对象（NonHumanOptions）
        """
        self.shared_context.update_field("non_human_options", options)
        logger.debug(f"已设置非人类限流配置: enabled={options.is_enabled() if options else False}")

    def get_non_human_options(self) -> Optional[Any]:
        """获取非人类限流配置

        Returns:
            Optional[NonHumanOptions]: 非人类限流配置对象，如果未设置则返回 None
        """
        return self.shared_context.get_field("non_human_options")

    def has_non_human_options(self) -> bool:
        """检查是否设置了非人类限流配置

        Returns:
            bool: 是否设置了非人类限流配置
        """
        options = self.shared_context.get_field("non_human_options")
        return options is not None

    def clear_non_human_options(self) -> None:
        """清除非人类限流配置"""
        self.shared_context.update_field("non_human_options", None)
        logger.debug("已清除非人类限流配置")

    # ====== 中断控制相关方法的默认实现 ======

    def set_interruption_request(self, requested: bool, reason: str = "用户主动中断") -> None:
        """设置/恢复终止信号（默认实现：无操作）

        子类应该重写此方法以提供具体实现

        Args:
            requested: 是否请求中断
            reason: 中断原因
        """
        logger.debug(f"BaseAgentContext.set_interruption_request called: requested={requested}, reason={reason}")

    def is_interruption_requested(self) -> bool:
        """检查是否有终止信号（默认实现：始终返回False）

        子类应该重写此方法以提供具体实现

        Returns:
            bool: 默认返回False
        """
        return False

    def get_interruption_reason(self) -> Optional[str]:
        """获取中断原因（默认实现：始终返回None）

        子类应该重写此方法以提供具体实现

        Returns:
            Optional[str]: 默认返回None
        """
        return None

    def get_interruption_event(self):
        """获取中断事件（默认实现：返回新的事件对象）

        子类应该重写此方法以提供具体实现

        Returns:
            asyncio.Event: 默认返回一个新的Event对象（永远不会被触发）
        """
        logger.debug("BaseAgentContext.get_interruption_event called - returning dummy event")
        return asyncio.Event()  # 返回一个永远不会被set的事件

    def increment_cancel_blocker(self) -> None:
        """增加阻止cancel的操作计数（默认实现：无操作）

        子类应该重写此方法以提供具体实现
        """
        logger.debug("BaseAgentContext.increment_cancel_blocker called")

    def decrement_cancel_blocker(self) -> None:
        """减少阻止cancel的操作计数（默认实现：无操作）

        子类应该重写此方法以提供具体实现
        """
        logger.debug("BaseAgentContext.decrement_cancel_blocker called")

    def is_cancelable(self) -> bool:
        """检查当前是否可以cancel（默认实现：始终返回True）

        子类应该重写此方法以提供具体实现

        Returns:
            bool: 默认返回True
        """
        return True

    def get_cancel_blocker_count(self) -> int:
        """获取当前阻止cancel的操作计数（默认实现：始终返回0）

        子类应该重写此方法以提供具体实现

        Returns:
            int: 默认返回0
        """
        return 0

    async def stop_run(self, reason: str = "") -> None:
        """停止当前 run（默认实现：子类应重写以提供具体流程）。"""
        raise NotImplementedError

    # ====== LLM Request ID 相关方法 ======

    def set_current_llm_request_id(self, request_id: str) -> None:
        """设置当前 LLM 请求的 request_id（默认实现：存储到共享上下文）

        Args:
            request_id: LLM 请求的唯一标识符
        """
        self.shared_context.update_field("current_llm_request_id", request_id)
        logger.debug(f"BaseAgentContext设置 LLM request_id: {request_id}")

    def get_current_llm_request_id(self) -> Optional[str]:
        """获取当前 LLM 请求的 request_id（默认实现：从共享上下文获取）

        Returns:
            Optional[str]: 当前 LLM 请求的 request_id，如果没有则返回 None
        """
        return self.shared_context.get_field("current_llm_request_id")

    # ====== 时区 ======

    def set_user_timezone(self, tz: str) -> None:
        """设置用户时区（IANA 名称，如 Asia/Shanghai）。"""
        self.shared_context.update_field("user_timezone", tz)

    def get_user_timezone(self) -> str:
        """获取用户时区（IANA 名称）。

        优先返回通过 set_user_timezone() 设置的值，未设置时回落到系统时区。
        """
        from agentlang.utils.timezone_utils import get_system_timezone
        tz = self.shared_context.get_field("user_timezone")
        return tz if tz else get_system_timezone()

    def get_message_version(self) -> str:
        """获取当前会话的消息版本号，默认返回 'v1'。"""
        return "v1"
