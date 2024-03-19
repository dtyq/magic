"""
代理上下文接口

定义获取用户信息和基础功能的抽象接口，用于解耦框架与具体实现
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable, TypeVar

T = TypeVar('T')  # 用于泛型类型

class AgentContextInterface(ABC):
    """
    代理上下文基础接口

    定义框架层必要的核心功能，包括用户信息、工作空间、事件系统和资源管理
    """

    @abstractmethod
    def get_user_id(self) -> Optional[str]:
        """获取用户ID

        Returns:
            Optional[str]: 用户ID，如果不存在则返回None
        """
        pass

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """获取元数据

        Returns:
            Dict[str, Any]: 上下文元数据
        """
        pass

    @abstractmethod
    def get_task_id(self) -> Optional[str]:
        """获取任务ID

        Returns:
            Optional[str]: 任务ID
        """
        pass

    @abstractmethod
    def get_sandbox_id(self) -> str:
        """获取沙盒ID

        Returns:
            str: 沙盒ID
        """
        pass

    @abstractmethod
    def get_next_seq_id(self) -> int:
        """获取当前任务的下一个序列号

        Returns:
            int: 下一个序列号
        """
        pass

    @abstractmethod
    def set_metadata(self, key: str, value: Any) -> None:
        """设置元数据

        Args:
            key: 元数据键
            value: 元数据值
        """
        pass

    @abstractmethod
    def get_workspace_dir(self) -> str:
        """获取工作空间目录

        Returns:
            str: 工作空间目录的绝对路径
        """
        pass

    @abstractmethod
    def ensure_workspace_dir(self) -> str:
        """确保工作空间目录存在，并返回路径

        Returns:
            str: 工作空间目录的绝对路径
        """
        pass

    @abstractmethod
    async def dispatch_event(self, event_type: str, data: Any) -> Any:
        """分发事件

        Args:
            event_type: 事件类型
            data: 事件数据

        Returns:
            Any: 事件处理结果
        """
        pass

    @abstractmethod
    def add_event_listener(self, event_type: str, listener: Callable[[Any], None]) -> None:
        """添加事件监听器

        Args:
            event_type: 事件类型
            listener: 事件监听函数，接收一个事件参数
        """
        pass

    @abstractmethod
    async def get_resource(self, name: str, factory=None) -> Any:
        """获取资源，如不存在则使用工厂创建

        Args:
            name: 资源名称
            factory: 资源创建工厂函数，仅在资源不存在时调用

        Returns:
            Any: 请求的资源实例
        """
        pass

    @abstractmethod
    def add_resource(self, name: str, resource: Any) -> None:
        """添加资源

        Args:
            name: 资源名称
            resource: 资源实例
        """
        pass

    @abstractmethod
    async def close_resource(self, name: str) -> None:
        """关闭并移除资源

        Args:
            name: 资源名称
        """
        pass

    # 🔥 新增：动态模型ID管理接口
    @abstractmethod
    def set_dynamic_model_id(self, model_id: str) -> None:
        """设置动态模型ID

        Args:
            model_id: 动态指定的模型ID
        """
        pass

    @abstractmethod
    def get_dynamic_model_id(self) -> Optional[str]:
        """获取动态模型ID

        Returns:
            Optional[str]: 动态模型ID，如果未设置则返回None
        """
        pass

    @abstractmethod
    def has_dynamic_model_id(self) -> bool:
        """检查是否设置了动态模型ID

        Returns:
            bool: 是否设置了动态模型ID
        """
        pass

    @abstractmethod
    def clear_dynamic_model_id(self) -> None:
        """清除动态模型ID设置"""
        pass

    # 非人类限流配置管理接口
    @abstractmethod
    def set_non_human_options(self, options: Any) -> None:
        """设置非人类限流配置

        Args:
            options: 非人类限流配置对象（NonHumanOptions）
        """
        pass

    @abstractmethod
    def get_non_human_options(self) -> Optional[Any]:
        """获取非人类限流配置

        Returns:
            Optional[Any]: 非人类限流配置对象，如果未设置则返回 None
        """
        pass

    @abstractmethod
    def has_non_human_options(self) -> bool:
        """检查是否设置了非人类限流配置

        Returns:
            bool: 是否设置了非人类限流配置
        """
        pass

    @abstractmethod
    def clear_non_human_options(self) -> None:
        """清除非人类限流配置"""
        pass

    @abstractmethod
    def clear_attachments(self) -> None:
        """清除附件"""
        pass

    # ====== 中断控制相关接口 ======

    @abstractmethod
    def set_interruption_request(self, requested: bool, reason: str = "用户主动中断") -> None:
        """设置/恢复终止信号

        Args:
            requested: 是否请求中断
            reason: 中断原因
        """
        pass

    @abstractmethod
    def is_interruption_requested(self) -> bool:
        """检查是否有终止信号

        Returns:
            bool: 是否有终止信号
        """
        pass

    @abstractmethod
    def get_interruption_event(self):
        """获取中断事件，用于异步等待中断信号

        Returns:
            asyncio.Event: 中断事件对象，可用于 await event.wait()
        """
        pass

    @abstractmethod
    def get_interruption_reason(self) -> Optional[str]:
        """获取中断原因

        Returns:
            Optional[str]: 中断原因，如果没有中断请求则返回None
        """
        pass

    @abstractmethod
    def increment_cancel_blocker(self) -> None:
        """增加阻止cancel的操作计数"""
        pass

    @abstractmethod
    def decrement_cancel_blocker(self) -> None:
        """减少阻止cancel的操作计数"""
        pass

    @abstractmethod
    def is_cancelable(self) -> bool:
        """检查当前是否可以cancel（计数为0时可以cancel）

        Returns:
            bool: 计数为0时返回True，否则返回False
        """
        pass

    @abstractmethod
    def get_cancel_blocker_count(self) -> int:
        """获取当前阻止cancel的操作计数

        Returns:
            int: 当前阻止cancel的操作计数
        """
        pass

    @abstractmethod
    async def handle_user_interruption(self, cancel_task_func, reason: str = "用户主动中断", timeout: float = 10.0) -> bool:
        """处理用户中断请求，包含完整的中断流程

        Args:
            cancel_task_func: 取消任务的函数
            reason: 中断原因
            timeout: 等待超时时间（秒）

        Returns:
            bool: 是否成功处理了中断请求
        """
        pass

    # ====== LLM Request ID 相关接口 ======

    @abstractmethod
    def set_current_llm_request_id(self, request_id: str) -> None:
        """设置当前 LLM 请求的 request_id

        Args:
            request_id: LLM 请求的唯一标识符
        """
        pass

    @abstractmethod
    def get_current_llm_request_id(self) -> Optional[str]:
        """获取当前 LLM 请求的 request_id

        Returns:
            Optional[str]: 当前 LLM 请求的 request_id，如果没有则返回 None
        """
        pass

    # ====== 思考状态管理相关接口 ======

    @abstractmethod
    def get_thinking_correlation_id(self) -> Optional[str]:
        """获取当前思考块的 correlation_id（用作其他事件的 parent_correlation_id）

        Returns:
            Optional[str]: 当前思考块的 correlation_id
        """
        pass

    @abstractmethod
    def set_thinking_correlation_id(self, correlation_id: Optional[str]) -> None:
        """设置当前思考块的 correlation_id（BEFORE_AGENT_THINK 时调用）

        Args:
            correlation_id: 思考块的 correlation_id
        """
        pass

    @abstractmethod
    def get_thinking_duration_ms(self) -> float:
        """获取当前思考持续时间（毫秒）

        Returns:
            float: 思考持续时间（毫秒）
        """
        pass

    @abstractmethod
    def reset_thinking_state(self) -> None:
        """重置思考状态（AFTER_AGENT_THINK 后调用）"""
        pass
