from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from agentlang.utils.json import json_dumps


# ToolResult.system 字段的 orchestrator 控制信号常量
# 工具在执行前已提前触发了 after_tool_call，外层 tool_call_executor 触发的最终 after 应被屏蔽
TOOL_RESULT_SYSTEM_DISPATCHED = "DISPATCHED"
# 工具提前触发的早期 after_tool_call 标记，表示这是伪事件而非真实完成，消费方应跳过
TOOL_RESULT_SYSTEM_EARLY_AFTER = "EARLY_AFTER"


class ToolResult(BaseModel):
    """工具执行结果。

    字段受众严格区分，不要混用：
    - content    → 大模型：必填，人类可读的执行结果文本
    - data       → 前端/调用方：结构化数据，不进入模型上下文
    - extra_info → Python 内部：进程内流转数据，不出进程、不给大模型
    - system     → orchestrator：特殊控制信号（如 "ASK_USER"），不做普通输出用

    创建错误结果必须用类方法，不要用构造器：
      [正确] ToolResult.error("出错原因")
      [错误] result.error        # 不存在此属性
      [错误] ToolResult(error=x) # 不支持此参数
    """

    content: str = Field(description="给大模型的执行结果文本")
    ok: bool = Field(default=True, description="执行是否成功")
    data: Dict[str, Any] = Field(
        default_factory=dict,
        description="给前端/调用方的结构化数据，不进入模型上下文",
    )
    extra_info: Dict[str, Any] = Field(
        default_factory=dict,
        description="Python 内部流转数据，不出进程、不给大模型",
    )
    system: Optional[str] = Field(
        default=None,
        description="orchestrator 控制信号（如 ASK_USER、COMPACT_HISTORY），不做普通输出用",
    )
    execution_time: float = Field(default=0.0, description="工具执行耗时（秒）")
    tool_call_id: Optional[str] = Field(default=None)
    name: Optional[str] = Field(default=None)
    use_custom_remark: bool = Field(
        default=False,
        description="True 时使用工具自定义的 remark，False 时使用通用错误提示",
    )

    @classmethod
    def error(cls, message: str, **kwargs) -> "ToolResult":
        """创建失败结果。

        Args:
            message: 错误描述，将作为 content 返回给大模型
            **kwargs: 其他字段（extra_info、system、tool_call_id、name 等）

        Example:
            ToolResult.error("文件不存在")
            ToolResult.error("转换失败", extra_info={"path": "/tmp/file"})
        """
        return cls(content=message, ok=False, **kwargs)

    class Config:
        arbitrary_types_allowed = True
        extra = "forbid"

    def __bool__(self) -> bool:
        return any(getattr(self, field) for field in self.model_fields)

    def __add__(self, other: "ToolResult") -> "ToolResult":
        def combine(a: Optional[str], b: Optional[str], concat: bool = True) -> str:
            if a and b:
                if concat:
                    return a + b
                raise ValueError("Cannot combine tool results with conflicting fields")
            return a or b or ""

        return ToolResult(
            content=combine(self.content, other.content),
            system=combine(self.system, other.system),
            tool_call_id=self.tool_call_id or other.tool_call_id,
            name=self.name or other.name,
            execution_time=self.execution_time + other.execution_time,
            ok=self.ok and other.ok,
        )

    def __str__(self) -> str:
        return f"Error: {self.content}" if not self.ok else self.content

    def model_dump_json(self, **kwargs) -> str:
        return json_dumps(self.model_dump(), **kwargs)
