# agentlang/agentlang/streaming/drivers/socketio/config.py
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from ...message_builder import MessageBuilderInterface
from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SocketIODriverConfig:
    """Socket.IO driver 配置类（精简版）

    这是 Socket.IO 驱动的专用配置类，提供 Socket.IO 推送功能的基本配置。
    采用轻量化设计，只包含必要的配置项。
    """
    # 基础开关
    enabled: bool = False

    # Socket.IO 连接配置
    base_url: str = ""  # 基础 WebSocket URL
    socketio_path: str = "/socket.io/"  # SocketIO 路径
    transports: list[str] = field(default_factory=lambda: ['websocket'])  # 传输协议，默认仅使用 WebSocket
    connection_timeout: int = 10  # 连接超时（秒）
    push_timeout: float = 2.0     # 推送超时（秒）

    # Socket.IO 协议配置
    namespace: str = "/im"        # Socket.IO 命名空间
    event_name: str = "intermediate"  # Socket.IO 事件名

    # 连接生命周期管理
    max_connection_age: int = 300  # 最大连接年龄（秒），超过后重新连接

    # 消息构建器（可选，由外部注入）
    message_builder: Optional[MessageBuilderInterface] = None
    message_builder_class: Optional[str] = None  # 消息构建器类名（用于配置）

    def update_from_dict(self, config_data: Dict[str, Any]) -> None:
        """从字典更新配置

        Args:
            config_data: 配置字典
        """
        for key, value in config_data.items():
            if hasattr(self, key):
                setattr(self, key, value)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于传递给驱动）

        Returns:
            配置字典
        """
        return {
            "enabled": self.enabled,
            "base_url": self.base_url,
            "socketio_path": self.socketio_path,
            "transports": self.transports,
            "connection_timeout": self.connection_timeout,
            "push_timeout": self.push_timeout,
            "namespace": self.namespace,
            "event_name": self.event_name,
            "max_connection_age": self.max_connection_age,
            "message_builder": self.message_builder,
            "message_builder_class": self.message_builder_class,
        }

    def get_message_builder(self) -> Optional[MessageBuilderInterface]:
        """获取消息构建器实例

        优先级：
        1. 直接注入的 message_builder（需要是 MessageBuilderInterface 类型）
        2. 通过类名动态创建的实例

        Returns:
            消息构建器实例，如果无法获取则返回 None
        """
        # 优先使用直接注入的消息构建器（需要类型检查）
        if self.message_builder is not None:
            if isinstance(self.message_builder, MessageBuilderInterface):
                return self.message_builder
            # 如果不是正确的类型，忽略它

        # 尝试通过类名动态创建
        if self.message_builder_class:
            try:
                # 支持模块路径格式：module.submodule.ClassName
                if '.' in self.message_builder_class:
                    module_name, class_name = self.message_builder_class.rsplit('.', 1)
                    module = __import__(module_name, fromlist=[class_name])
                    builder_class = getattr(module, class_name)
                    return builder_class()
                else:
                    # 简单类名，这里需要具体的实现，暂时返回None
                    # 对于简单类名的动态加载，需要在具体使用时实现
                    pass
            except Exception:
                # 静默失败，返回 None
                pass

        return None

    def validate(self) -> bool:
        """验证配置的有效性

        Returns:
            True 如果配置有效，False 否则
        """
        if not self.enabled:
            return True  # 禁用状态下总是有效

        # 检查必要的配置项
        if not self.base_url:
            logger.warning("SocketIO configuration validation failed: base_url is required when enabled")
            return False

        if self.connection_timeout <= 0:
            logger.warning(f"SocketIO configuration validation failed: connection_timeout must be positive, got {self.connection_timeout}")
            return False

        if self.push_timeout <= 0:
            logger.warning(f"SocketIO configuration validation failed: push_timeout must be positive, got {self.push_timeout}")
            return False

        if self.max_connection_age <= 0:
            logger.warning(f"SocketIO configuration validation failed: max_connection_age must be positive, got {self.max_connection_age}")
            return False

        return True

    @classmethod
    def create_default(cls) -> "SocketIODriverConfig":
        """创建默认配置实例

        Returns:
            具有默认值的配置实例
        """
        return cls()

    @classmethod
    def create_enabled(cls, base_url: str, socketio_path: str = "/socket.io/", **kwargs) -> "SocketIODriverConfig":
        """创建启用状态的配置实例

        Args:
            base_url: 基础 WebSocket URL
            socketio_path: SocketIO 路径
            **kwargs: 其他配置参数

        Returns:
            启用状态的配置实例
        """
        config = cls(enabled=True, base_url=base_url, socketio_path=socketio_path, **kwargs)
        return config
