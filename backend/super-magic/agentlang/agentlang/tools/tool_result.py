import json
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator
from agentlang.utils.json import json_dumps

class ToolResult(BaseModel):
    """Represents the result of a tool execution.

    正确的使用方式:
    1. 成功结果:
       ```python
       # 返回成功结果
       return ToolResult(
           content="操作成功的结果内容",  # 必填，结果内容
           system="可选的系统信息，不会展示给用户",  # 可选
           name="工具名称"  # 可选
       )
       ```

    2. 带结构化数据的结果:
       ```python
       # 返回结构化数据（会传给前端，可供前端或调用方使用）
       return ToolResult(
           content="查询到元素信息",
           data={
               "element_id": "abc123",
               "element_name": "产品图",
               "width": 1920,
               "height": 1080
           }
       )
       ```

    3. 错误结果:
       ```python
       # 使用 error 参数
       return ToolResult(
           error="发生了错误: xxx"  # 验证器会自动设置 content 并将 ok 设为 False
       )
       ```

    注意:
    - 不能同时设置 error 和 content 参数
    - error 参数会被自动转换为 content 内容，并将 ok 设为 False
    - 在异常处理中，推荐使用 error 参数来标记错误
    - data 字段会传给前端，适合放前端或调用方可能需要的结构化数据
    - extra_info 字段仅用于 Python 项目内部，不会展示给用户，也不会传给 AI 大模型
    """

    content: str = Field(description="工具执行的结果内容，将作为输出返回给 AI 大模型")
    ok: bool = Field(default=True, description="工具执行是否成功")
    data: Dict[str, Any] = Field(default_factory=dict, description="结构化数据，会传给前端，适合存放前端或调用方可能需要使用的数据")
    extra_info: Dict[str, Any] = Field(default_factory=dict, description="工具执行的额外信息，仅用于 Python 项目内部，不会展示给用户，也不会传给 AI 大模型")
    system: Optional[str] = Field(default=None)
    tool_call_id: Optional[str] = Field(default=None)
    name: Optional[str] = Field(default=None)
    execution_time: float = Field(default=0.0, description="工具执行耗时（秒）")
    explanation: Optional[str] = Field(default=None, description="大模型执行此工具的意图解释")
    use_custom_remark: bool = Field(default=False, description="是否使用工具自定义的 remark，默认 False 使用通用错误提示")

    # 方案：在 ToolResult 类中添加一个模型验证器，当通过 error 参数传入值时，自动设置 content 字段并将 ok 置为 false。
    @model_validator(mode='before')
    @classmethod
    def handle_error_parameter(cls, data):
        if not isinstance(data, dict):
            return data

        if 'error' in data and data['error'] is not None:
            if data.get('content') and data['content'] != "":
                raise ValueError("不能同时设置 'error' 和 'content' 参数")

            # 将 error 的值设置到 content
            data['content'] = data.pop('error')
            # 将 ok 设为 False
            data['ok'] = False

        return data

    @classmethod
    def error(cls, message: str, **kwargs) -> 'ToolResult':
        """创建错误结果的快捷方法

        Args:
            message: 错误消息
            **kwargs: 其他可选参数 (extra_info, system, tool_call_id, name 等)

        Returns:
            ToolResult: 错误结果对象，ok=False

        Example:
            >>> ToolResult.error("文件不存在")
            >>> ToolResult.error("转换失败", extra_info={"file_path": "/path/to/file"})
        """
        return cls(content=message, ok=False, **kwargs)

    class Config:
        arbitrary_types_allowed = True

    def __bool__(self):
        return any(getattr(self, field) for field in self.model_fields)

    def __add__(self, other: "ToolResult"):
        def combine_fields(field: Optional[str], other_field: Optional[str], concatenate: bool = True):
            if field and other_field:
                if concatenate:
                    return field + other_field
                raise ValueError("Cannot combine tool results")
            return field or other_field or ""

        return ToolResult(
            content=combine_fields(self.content, other.content),
            system=combine_fields(self.system, other.system),
            tool_call_id=self.tool_call_id or other.tool_call_id,
            name=self.name or other.name,
            execution_time=self.execution_time + other.execution_time,  # 累加执行时间
            explanation=self.explanation or other.explanation,  # 保留第一个非空的explanation
            ok=self.ok and other.ok,  # 只有两者都成功才算成功
        )

    def __str__(self):
        return f"Error: {self.content}" if not self.ok else self.content

    def model_dump_json(self, **kwargs) -> str:
        """将ToolResult对象转换为JSON字符串

        Args:
            **kwargs: 传递给json.dumps的参数

        Returns:
            str: JSON字符串
        """
        return json_dumps(self.model_dump(), **kwargs)
