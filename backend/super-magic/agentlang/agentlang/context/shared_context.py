"""
共享上下文模块

提供 AgentSharedContext 类型、全局共享实例和独立实例工厂。
"""

from typing import Dict, Any, Optional, Type, TypeVar, Generic, List, Tuple, Union
from datetime import datetime, timedelta
import json
from agentlang.logger import get_logger

logger = get_logger(__name__)

T = TypeVar('T')

class AgentSharedContext:
    """共享上下文类

    提供全局统一的共享状态，支持字段扩展
    """

    def __init__(self):
        """初始化共享数据"""
        logger.debug("初始化AgentSharedContext")
        # 初始化字段
        self._initialize_fields()

        # 字段字典
        self._fields = {}

        # 字段类型字典
        self._field_types = {}

        # 初始化状态标记
        self._initialized = False

    def _initialize_fields(self):
        """初始化字段"""
        # 设置活动时间相关字段
        self.last_activity_time = datetime.now()

        # 设置默认超时时间
        default_timeout = 3600  # 默认1小时
        timeout_seconds = default_timeout

        try:
            from agentlang.environment import Environment
            timeout_seconds = Environment.get_agent_idle_timeout()
        except (ImportError, AttributeError) as e:
            logger.warning(f"获取超时设置失败: {str(e)}，使用默认值 {default_timeout}秒")

        self.idle_timeout = timedelta(seconds=timeout_seconds)

    def is_initialized(self) -> bool:
        """检查是否已完成初始化

        Returns:
            bool: 是否已初始化
        """
        return self._initialized

    def set_initialized(self, value: bool = True) -> None:
        """设置初始化状态

        Args:
            value: 初始化状态值，默认为True
        """
        self._initialized = value
        logger.debug(f"设置初始化状态为: {value}")

    def update_activity_time(self) -> None:
        """更新活动时间"""
        current_time = datetime.now()
        previous_activity_time = self.last_activity_time
        idle_duration = current_time - previous_activity_time

        # 更新活动时间
        self.last_activity_time = current_time

        # 打印详细的活动时间信息
        logger.info(f"上次活动时间 {previous_activity_time}, 更新后活动时间 {current_time}，已空闲：{idle_duration}")

    def get_idle_duration_seconds(self) -> float:
        """获取当前闲置时间（秒）

        Returns:
            float: 从最后活动时间到现在的秒数
        """
        current_time = datetime.now()
        idle_duration = current_time - self.last_activity_time
        return idle_duration.total_seconds()

    def is_idle_timeout(self) -> bool:
        """检查是否超时"""
        current_time = datetime.now()
        is_timeout = (current_time - self.last_activity_time) > self.idle_timeout
        if is_timeout:
            logger.info(f"代理已超时: 上次活动时间 {self.last_activity_time}, 当前时间 {current_time}")
        return is_timeout

    def register_field(self, field_name: str, field_value: Any, field_type: Optional[Type[T]] = None) -> None:
        """注册字段

        Args:
            field_name: 字段名称
            field_value: 字段值
            field_type: 字段类型，可选
        """
        if field_name in self._fields:
            logger.warning(f"字段 '{field_name}' 已存在，将被覆盖")

        self._fields[field_name] = field_value

        if field_type is not None:
            self._field_types[field_name] = field_type
            logger.debug(f"注册字段 '{field_name}' 类型为 {field_type.__name__}")
        elif field_value is not None:
            self._field_types[field_name] = type(field_value)
            logger.debug(f"根据值自动推断字段 '{field_name}' 类型为 {type(field_value).__name__}")

        logger.debug(f"注册字段 '{field_name}' 成功")

    def register_fields(self, fields: Dict[str, Union[Any, Tuple[Any, Type]]]) -> None:
        """批量注册多个字段

        Args:
            fields: 字段字典，键为字段名，值可以是字段值或者(字段值, 字段类型)元组

        Examples:
            >>> shared_context.register_fields({
            >>>     "streams": {},
            >>>     "task_id": (None, str),
            >>>     "attachments": ({}, Dict[str, Attachment])
            >>> })
        """
        for field_name, field_data in fields.items():
            if isinstance(field_data, tuple) and len(field_data) == 2:
                field_value, field_type = field_data
                self.register_field(field_name, field_value, field_type)
            else:
                self.register_field(field_name, field_data)

        logger.debug(f"批量注册了 {len(fields)} 个字段")

    def update_field(self, field_name: str, field_value: Any, field_type: Optional[Type[T]] = None) -> None:
        """更新字段值，如果字段不存在则自动注册

        Args:
            field_name: 字段名称
            field_value: 新的字段值
            field_type: 字段类型，可选，仅当字段不存在时使用
        """
        if not self.has_field(field_name):
            logger.info(f"字段 '{field_name}' 不存在，自动注册")
            self.register_field(field_name, field_value, field_type)
            return

        self._fields[field_name] = field_value
        logger.debug(f"更新字段 '{field_name}' 成功")

    def get_field(self, field_name: str) -> Any:
        """获取字段

        Args:
            field_name: 字段名称

        Returns:
            字段值

        Raises:
            KeyError: 如果字段不存在
        """
        if field_name not in self._fields:
            logger.error(f"字段 '{field_name}' 不存在")
            raise KeyError(f"字段 '{field_name}' 不存在")

        return self._fields[field_name]

    def has_field(self, field_name: str) -> bool:
        """检查字段是否存在

        Args:
            field_name: 字段名称

        Returns:
            字段是否存在
        """
        return field_name in self._fields

    def get_field_type(self, field_name: str) -> Optional[Type]:
        """获取字段类型

        Args:
            field_name: 字段名称

        Returns:
            字段类型，如果未指定则返回None
        """
        return self._field_types.get(field_name)

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
        if isinstance(value, datetime) or isinstance(value, timedelta):
            return str(value)

        # 处理字典
        if isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}

        # 处理列表或元组
        if isinstance(value, (list, tuple)):
            return [self._serialize_value(item) for item in value]

        # 处理类型对象，如 Type[T]
        if isinstance(value, type):
            return value.__name__

        # 尝试直接转换为 str
        try:
            json.dumps(value)
            return value
        except (TypeError, OverflowError, ValueError):
            # 如果无法序列化，则返回类型和ID信息
            return f"<{type(value).__name__}:{id(value)}>"

    def to_dict(self) -> Dict[str, Any]:
        """将上下文转换为字典

        Returns:
            Dict[str, Any]: 包含上下文信息的字典
        """
        result = {
            "_initialized": self._initialized,
            "last_activity_time": str(self.last_activity_time),
            "idle_timeout": str(self.idle_timeout),
        }

        # 添加所有字段和字段类型
        fields_info = {}
        for field_name, field_value in self._fields.items():
            fields_info[field_name] = {
                "value": self._serialize_value(field_value),
                "type": self._serialize_value(self._field_types.get(field_name))
            }

        result["fields"] = fields_info

        return result

    def __str__(self) -> str:
        """自定义字符串表示

        Returns:
            str: 字典形式的字符串表示
        """
        try:
            return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
        except Exception as e:
            return f"<AgentSharedContext object at {hex(id(self))}: {str(e)}>"

    def __repr__(self) -> str:
        """自定义对象表示

        Returns:
            str: 字典形式的对象表示
        """
        return self.__str__()

    @classmethod
    def reset_global_instance(cls):
        """重置全局共享上下文实例"""
        global GLOBAL_AGENT_SHARED_CONTEXT
        # 记录旧实例的id
        old_id = id(GLOBAL_AGENT_SHARED_CONTEXT)

        # 直接创建一个新的实例
        GLOBAL_AGENT_SHARED_CONTEXT = cls()

        # 确保不共享引用
        new_id = id(GLOBAL_AGENT_SHARED_CONTEXT)
        if old_id == new_id:
            logger.error(f"重置失败：新旧实例是同一个对象 (id={old_id})")
        else:
            logger.info(f"重置共享上下文成功：旧id={old_id}, 新id={new_id}")
            # 新实例的初始化状态已经是 False，这里记录一下日志
            logger.debug("新的共享上下文初始化状态已重置为 False")


def create_agent_shared_context() -> AgentSharedContext:
    """创建一个新的独立共享上下文实例。"""
    return AgentSharedContext()


# 全局单例实例：主 Agent 默认共享它，子 Agent 可按需创建独立实例。
GLOBAL_AGENT_SHARED_CONTEXT = create_agent_shared_context()
