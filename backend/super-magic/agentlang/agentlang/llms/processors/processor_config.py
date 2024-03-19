"""LLM处理器配置类"""

from typing import Optional, Dict, Any
from dataclasses import dataclass
from ...streaming.drivers.socketio.config import SocketIODriverConfig
from ...streaming.message_builder import MessageBuilderInterface
from ...streaming.driver_types import DriverType


@dataclass
class ProcessorConfig:
    """LLM处理器配置

    用于封装所有处理器相关的参数，避免方法签名参数过多。
    """

    # 流式模式控制
    use_stream_mode: bool = False
    """是否启用流式响应模式"""

    streaming_push_mode: Optional[DriverType] = None
    """推流方式，如 DriverType.SOCKETIO，None 表示不启用推流"""

    # 流式结束块控制
    stream_end_include_full_content: bool = True
    """结束消息是否包含完整内容（默认包含以保持兼容）"""

    # 消息构建器
    message_builder: Optional[MessageBuilderInterface] = None
    """消息构建器实例，用于构建推送消息格式"""

    # Socket.IO driver 配置
    socketio_driver_config: Optional[SocketIODriverConfig] = None
    """Socket.IO driver 配置，用于自定义 Socket.IO 推送行为"""

    # 模型信息
    model_id: Optional[str] = None
    """模型 ID"""

    model_name: Optional[str] = None
    """模型名称"""

    @classmethod
    def create_default(cls) -> 'ProcessorConfig':
        """创建默认配置（不启用流式）"""
        return cls()

    @classmethod
    def create_streaming_only(cls) -> 'ProcessorConfig':
        """创建仅流式响应的配置（不推流）"""
        return cls(use_stream_mode=True)

    @classmethod
    def create_with_socketio_push(
        cls,
        message_builder: Optional[MessageBuilderInterface] = None,
        socketio_driver_config: Optional[SocketIODriverConfig] = None
    ) -> 'ProcessorConfig':
        """创建带Socket.IO推流的配置"""
        return cls(
            use_stream_mode=True,
            streaming_push_mode=DriverType.SOCKETIO,
            message_builder=message_builder,
            socketio_driver_config=socketio_driver_config
        )

    def is_streaming_enabled(self) -> bool:
        """检查是否启用了流式响应"""
        return self.use_stream_mode

    def is_push_enabled(self) -> bool:
        """检查是否启用了推流功能"""
        return self.use_stream_mode and self.streaming_push_mode is not None

    def get_effective_streaming_config(self) -> Dict[str, Any]:
        """获取有效的流式配置字典

        Returns:
            配置字典，用于传递给流式驱动的initialize方法
        """
        # 从SocketIODriverConfig开始（如果有的话）
        if self.socketio_driver_config:
            config = self.socketio_driver_config.to_dict()
        else:
            # 使用默认配置
            config = SocketIODriverConfig.create_default().to_dict()

        # 如果提供了消息构建器，添加到配置中（会覆盖SocketIODriverConfig中的设置）
        if self.message_builder is not None:
            config["message_builder"] = self.message_builder

        # 确保启用推流（因为调用了这个方法说明要推流）
        config["enabled"] = self.is_push_enabled()

        return config
