"""
SDK Result 类型定义

提供简化的、独立的 Result 类型，用于 SDK 返回结果
"""
from typing import Any, Dict, Optional


class Result:
    """SDK 调用结果类型

    用于封装 SDK 方法的执行结果，保持 SDK 的独立性

    Examples:
        成功结果:
        >>> result = Result(ok=True, content="执行成功")
        >>> if result.ok:
        ...     print(result.content)

        错误结果:
        >>> result = Result.error("执行失败")
        >>> if not result.ok:
        ...     print(result.content)
    """

    def __init__(
        self,
        ok: bool = True,
        content: str = "",
        execution_time: float = 0.0,
        tool_call_id: Optional[str] = None,
        name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ):
        """初始化 Result 对象

        Args:
            ok: 执行是否成功
            content: 结果内容
            execution_time: 执行时间（秒）
            tool_call_id: 工具调用 ID
            name: 工具名称
            data: 结构化数据（可选）
        """
        self.ok = ok
        self.content = content
        self.execution_time = execution_time
        self.tool_call_id = tool_call_id
        self.name = name
        self.data = data or {}

    @classmethod
    def error(cls, message: str, **kwargs) -> "Result":
        """创建错误结果的快捷方法

        Args:
            message: 错误消息
            **kwargs: 其他可选参数

        Returns:
            Result: 错误结果对象，ok=False

        Examples:
            >>> result = Result.error("文件不存在")
            >>> result.ok
            False
        """
        return cls(ok=False, content=message, **kwargs)

    def __bool__(self) -> bool:
        """支持布尔判断

        Returns:
            bool: 执行是否成功
        """
        return self.ok

    def __str__(self) -> str:
        """字符串表示

        Returns:
            str: 结果内容
        """
        return f"Error: {self.content}" if not self.ok else self.content

    def __repr__(self) -> str:
        """对象表示

        Returns:
            str: 对象的字符串表示
        """
        return f"Result(ok={self.ok}, content='{self.content[:50]}...')" if len(self.content) > 50 else f"Result(ok={self.ok}, content='{self.content}')"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典

        Returns:
            Dict[str, Any]: 包含所有字段的字典
        """
        return {
            "ok": self.ok,
            "content": self.content,
            "execution_time": self.execution_time,
            "tool_call_id": self.tool_call_id,
            "name": self.name,
            "data": self.data,
        }


__all__ = ["Result"]
