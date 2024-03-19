"""
工具上下文类

为工具提供执行环境所需的上下文信息
"""

import uuid
from typing import Any, Dict, Optional, TypeVar, Type, cast

from agentlang.context.base_context import BaseContext

# 定义泛型类型变量，用于扩展类型
T = TypeVar('T')

class ToolContext(BaseContext):
    """
    工具上下文类，提供工具执行所需的上下文信息
    """

    def __init__(
        self, tool_call_id: str = "", tool_name: str = "", arguments: Dict[str, Any] = None, metadata: Dict[str, Any] = None
    ):
        """
        初始化工具上下文

        Args:
            tool_call_id: 工具调用ID
            tool_name: 工具名称
            arguments: 工具参数
            metadata: 初始元数据，通常继承自 AgentContext 的 metadata
        """
        super().__init__()

        self.id = str(uuid.uuid4())

        # 工具特定属性
        self.tool_call_id = tool_call_id
        self.tool_name = tool_name
        self.arguments = arguments or {}

        # 初始化元数据
        self._metadata = metadata.copy() if metadata else {}

        # 扩展上下文字典，用于存储各类扩展
        self._extensions: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        """
        将工具上下文转换为字典格式

        Returns:
            Dict[str, Any]: 上下文的字典表示
        """
        result = super().to_dict()

        # 添加基本工具信息
        result.update({
            "tool_call_id": self.tool_call_id,
            "tool_name": self.tool_name,
        })

        # 添加任务ID和工作目录（如果元数据中存在）
        if "task_id" in self._metadata:
            result["task_id"] = self._metadata["task_id"]
        if "workspace_dir" in self._metadata:
            result["workspace_dir"] = self._metadata["workspace_dir"]

        # 添加扩展信息
        extensions_dict = {}
        for ext_name, ext_obj in self._extensions.items():
            if hasattr(ext_obj, 'to_dict') and callable(ext_obj.to_dict):
                extensions_dict[ext_name] = ext_obj.to_dict()
            else:
                extensions_dict[ext_name] = str(ext_obj)

        if extensions_dict:
            result["extensions"] = extensions_dict

        return result

    def get_argument(self, name: str, default: Any = None) -> Any:
        """
        获取工具参数

        Args:
            name: 参数名
            default: 默认值

        Returns:
            Any: 参数值或默认值
        """
        return self.arguments.get(name, default)

    def has_argument(self, name: str) -> bool:
        """
        检查是否存在指定的参数

        Args:
            name: 参数名

        Returns:
            bool: 是否存在参数
        """
        return name in self.arguments

    @property
    def task_id(self) -> str:
        """获取任务ID"""
        return self._metadata.get("task_id", "")

    @property
    def sandbox_id(self) -> str:
        """获取沙盒ID"""
        return self._metadata.get("sandbox_id", "")

    @property
    def topic_id(self) -> str:
        """获取话题ID"""
        return self._metadata.get("topic_id", "")

    @property
    def base_dir(self) -> str:
        """获取基础目录"""
        return self._metadata.get("workspace_dir", "")

    # 扩展上下文相关方法

    def register_extension(self, name: str, extension: Any) -> None:
        """
        注册一个扩展上下文

        Args:
            name: 扩展名称
            extension: 扩展上下文对象
        """
        self._extensions[name] = extension

    def get_extension(self, name: str) -> Optional[Any]:
        """
        获取指定名称的扩展上下文

        Args:
            name: 扩展名称

        Returns:
            Optional[Any]: 扩展上下文对象，如果不存在则返回None
        """
        return self._extensions.get(name)

    def get_extension_typed(self, name: str, extension_type: Type[T]) -> Optional[T]:
        """
        获取指定名称和类型的扩展上下文

        泛型版本的get_extension方法，可以自动推断返回类型，
        在IDE中提供更好的代码补全支持

        Args:
            name: 扩展名称
            extension_type: 扩展类型，例如：EventContext

        Returns:
            Optional[T]: 符合类型的扩展上下文对象，如果不存在或类型不匹配则返回None

        Examples:
            ```python
            # IDE将能正确识别event_context的类型为EventContext
            event_context = tool_context.get_extension_typed("event_context", EventContext)
            if event_context:
                # 这里能获得EventContext所有方法的自动补全
                event_context.add_attachment(attachment)
            ```
        """
        extension = self._extensions.get(name)
        if extension is not None and isinstance(extension, extension_type):
            # 使用cast帮助IDE识别返回类型
            return cast(T, extension)
        return None

    def has_extension(self, name: str) -> bool:
        """
        检查是否存在指定名称的扩展

        Args:
            name: 扩展名称

        Returns:
            bool: 是否存在该扩展
        """
        return name in self._extensions

    def is_skill_agent(self) -> bool:
        """
        检查当前 agent 是否有 skill

        Returns:
            bool: 如果 agent 加载了任何 skill 返回 True，否则返回 False
        """
        agent_context = self.get_extension("agent_context")
        if agent_context and hasattr(agent_context, 'get_loaded_skills'):
            return bool(agent_context.get_loaded_skills())
        return False
