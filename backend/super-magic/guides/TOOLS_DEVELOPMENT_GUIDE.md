# 工具开发指南

## 目录

- [快速上手](#快速上手)
- [工具名称规则](#工具名称规则)
- [Docstring 双语格式](#docstring-双语格式)
- [ToolResult 使用规范](#toolresult-使用规范)
- [参数设计](#参数设计)
- [可选扩展点](#可选扩展点)
- [WorkspaceTool](#workspacetool)
- [文件操作](#文件操作)
- [工具目录结构](#工具目录结构)
- [生成工具定义文件](#生成工具定义文件)

---

## 快速上手

最小可用工具：

```python
from pydantic import Field
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseTool, BaseToolParams, tool


class MyToolParams(BaseToolParams):
    target: str = Field(..., description="<!--zh: 目标路径-->\nTarget path to process")


@tool()
class MyTool(BaseTool[MyToolParams]):
    """<!--zh: 工具的一句话说明，这里是给大模型看的-->
    One-line description of what this tool does.
    """

    async def execute(self, tool_context: ToolContext, params: MyToolParams) -> ToolResult:
        result = do_something(params.target)
        return ToolResult(content=result)
```

---

## 工具名称规则

工具名取自**文件名**（不是类名），自动转为小写。文件 `my_tool.py` → 工具名 `my_tool`。

类名只用于代码组织，不影响注册名。

---

## Docstring 双语格式

进入模型上下文的内容（docstring、参数 description）统一使用双语格式：中文放注释块，英文是实际有效内容。

**类 docstring**（多行）：

```python
@tool()
class MyTool(BaseTool[MyToolParams]):
    """<!--zh
    中文说明，多行可以写在这里
    -->
    English description that goes into the model context.
    Can also be multi-line.
    """
```

**参数 description**（单行用行内格式，多行用块格式）：

```python
class MyToolParams(BaseToolParams):
    path: str = Field(
        ...,
        description="<!--zh: 文件路径-->\nFile path to process"
    )
    mode: str = Field(
        "read",
        description="""<!--zh
        操作模式：read 只读，write 写入
        -->
        Operation mode: read (read-only) or write"""
    )
```

---

## ToolResult 使用规范

`ToolResult` 的四个字段受众严格区分：

| 字段 | 给谁 | 说明 |
|------|------|------|
| `content` | 大模型 | 必填，自然语言文本，英文 |
| `data` | 前端/调用方 | 结构化数据，不进入模型上下文 |
| `extra_info` | Python 内部 | 进程内流转，不出进程、不给模型 |
| `system` | orchestrator | 控制信号（如 `ASK_USER`），非普通输出 |

**创建结果：**

```python
# 成功
return ToolResult(content="File written successfully.")

# 成功，附带前端结构化数据
return ToolResult(
    content="Found 3 results.",
    data={"results": [...]}
)

# 失败 —— 必须用类方法，禁止用构造器传 error 参数
return ToolResult.error("File not found: path/to/file")
return ToolResult.error("Connection failed", extra_info={"retry_after": 5})
```

**禁止写法：**

```python
# 错误：ToolResult 没有 error 参数，会触发 ValidationError
return ToolResult(error="something went wrong")
```

---

## 参数设计

所有参数类继承 `BaseToolParams`，它自带 `explanation` 字段（让模型说明调用意图）。

```python
from typing import Optional
from pydantic import Field
from app.tools.core import BaseToolParams


class ExampleParams(BaseToolParams):
    # 必填参数
    file_path: str = Field(..., description="<!--zh: 文件相对路径-->\nRelative file path")

    # 可选参数，给默认值
    encoding: str = Field("utf-8", description="<!--zh: 文件编码-->\nFile encoding")

    # 枚举用 Literal
    mode: str = Field("read", description='<!--zh: 操作模式-->\nOperation mode: "read" or "write"')

    # 自定义参数校验错误提示（可选）
    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        if field_name == "file_path" and error_type == "missing":
            return "file_path is required. Provide a path relative to the workspace root."
        return None
```

---

## 可选扩展点

### get_prompt_hint()

向模型注入额外上下文（静态 prompt 补充），工具被加载时生效：

```python
def get_prompt_hint(self) -> str:
    return """\
    <!--zh
    补充说明：调用此工具前确保文件已存在
    -->
    Note: Ensure the file exists before calling this tool.
    """
```

### get_after_tool_call_friendly_action_and_remark()

控制工具调用完成后前端展示的动作和备注（走 i18n，不要硬编码）：

```python
from typing import Any, Dict
from app.i18n import i18n

async def get_after_tool_call_friendly_action_and_remark(
    self,
    tool_name: str,
    tool_context: ToolContext,
    result: ToolResult,
    execution_time: float,
    arguments: Dict[str, Any] = None,
) -> Dict:
    action = i18n.translate(self.name, category="tool.actions")
    if not result.ok:
        return {
            "action": action,
            "remark": i18n.translate("my_tool.error", category="tool.messages"),
        }
    return {
        "action": action,
        "remark": arguments.get("file_path", "") if arguments else "",
    }
```

### get_tool_detail()

返回给前端的结构化展示数据（如文件树、图片等）：

```python
from typing import Any, Dict, Optional
from app.core.entity.message.server_message import DisplayType, ToolDetail

async def get_tool_detail(
    self,
    tool_context: ToolContext,
    result: ToolResult,
    arguments: Dict[str, Any] = None,
) -> Optional[ToolDetail]:
    if not result.ok:
        return None
    return ToolDetail(type=DisplayType.FILE_TREE, data={"...": "..."})
```

### is_available()

按需检查工具是否可用（如依赖环境变量）：

```python
def is_available(self) -> bool:
    import os
    return bool(os.getenv("MY_API_KEY"))
```

---

## WorkspaceTool

需要访问工作区路径的工具，继承 `WorkspaceTool` 而不是 `BaseTool`：

```python
from app.tools.workspace_tool import WorkspaceTool


class MyParams(BaseToolParams):
    relative_path: str = Field(..., description="<!--zh: 相对工作区路径-->\nPath relative to workspace root")


@tool()
class MyTool(WorkspaceTool[MyParams]):
    """..."""

    async def execute(self, tool_context: ToolContext, params: MyParams) -> ToolResult:
        # resolve_path 将相对路径转换为绝对路径，并验证在工作区内
        abs_path = self.resolve_path(params.relative_path)
        ...
```

---

## 文件操作

**禁止**使用 `open()`、`os`、`shutil` 的同步接口。统一使用 `app/utils/async_file_utils.py`：

```python
from app.utils.async_file_utils import (
    async_read_text,
    async_write_text,
    async_read_json,
    async_write_json,
    async_exists,
    async_mkdir,
    async_unlink,
)

content = await async_read_text(path)
await async_write_text(path, content)
exists = await async_exists(path)
```

完整接口见 `app/utils/async_file_utils.py`。

---

## 工具目录结构

```
app/tools/
├── core/               # 框架核心，不放业务工具
│   ├── base_tool.py
│   ├── base_tool_params.py
│   ├── tool_factory.py
│   ├── tool_executor.py
│   └── tool_call_executor.py
├── channel/            # IM 渠道工具（不挂载到 LLM，仅 Skill snippet 调用）
├── design/             # 设计画布工具
├── data_analyst_dashboard_tools/
├── my_tool.py          # 普通工具直接放这层
└── workspace_tool.py   # WorkspaceTool 基类
```

工具放在 `app/tools/` 或其子目录，`@tool()` 即自动注册，无需手动添加。

不挂载到 LLM、只供 Skill snippet 调用的工具，在 docstring 里注明：

```python
@tool()
class MyInternalTool(BaseTool[BaseToolParams]):
    """<!--zh: 仅供 Skill snippet 调用，不挂载到 LLM-->
    For skill snippets only. Not exposed as an LLM tool.
    """
```

---

## 生成工具定义文件

新增或修改工具后，需重新生成 JSON 定义文件，否则工具 schema 不会更新：

```bash
cd backend/super-magic
source .venv/bin/activate
python -m app.tools.core.tool_definition
```
