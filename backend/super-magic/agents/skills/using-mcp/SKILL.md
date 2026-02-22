---
name: using-mcp
description: Query MCP servers, list available MCP tools, get tool schemas, and call MCP tools programmatically. CRITICAL - When user message contains [@mcp:...] mention, you MUST load this skill first to properly use MCP tools.

name-cn: MCP 工具调用技能
description-cn: 查询 MCP 服务器、列出可用的 MCP 工具、获取工具 Schema，并通过编程方式调用 MCP 工具。关键规则 - 当用户消息包含 [@mcp:...] 引用时，必须首先加载此技能以正确使用 MCP 工具。
---

<!--zh
# MCP 工具调用技能
-->
# MCP Tools Calling Skill

<!--zh
通过脚本查询 MCP 服务器信息、工具列表和 Schema，并通过 SDK 调用 MCP 工具。
-->
Query MCP server information, tool lists, and schemas through scripts, and call MCP tools via SDK.

<!--zh
## 核心能力
-->
## Core Capabilities

<!--zh
- 查询 MCP 服务器列表和状态
- 列出所有可用的 MCP 工具
- 获取工具的 JSON Schema 定义
- 调用 MCP 工具并获取结果
-->
- Query MCP server list and status
- List all available MCP tools
- Get JSON Schema definitions of tools
- Call MCP tools and get results

<!--zh
## 重要规则
-->
## Important Rules

<!--zh
### 1. 禁止臆想工具名称和参数

在调用 `mcp.call()` 之前，**必须**先通过脚本查询确认：
1. 工具是否存在于该服务器（通过 `get_tools.py`）- **必须**
2. 工具的参数定义（通过 `get_tool_schema.py`）- **必须**
3. 服务器列表（通过 `get_servers.py`）- 可选，通常在用户提示词中已提供

**严格禁止**在没有查询确认的情况下，凭想象或经验直接调用 MCP 工具。即使你认为某个工具"应该"存在，也必须先通过脚本查询确认。
-->
### 1. DO NOT imagine tool names and parameters

Before calling `mcp.call()`, you **MUST** first query and confirm through scripts:
1. Whether the tool exists on that server (via `get_tools.py`) - **REQUIRED**
2. The tool's parameter definition (via `get_tool_schema.py`) - **REQUIRED**
3. Server list (via `get_servers.py`) - Optional, usually provided in user prompts

**STRICTLY FORBIDDEN** to call MCP tools based on imagination or experience without querying first. Even if you think a tool "should" exist, you must query to confirm it first.

<!--zh
### 2. mcp.call() 不是工具名称

**严格禁止**将以下内容当作工具名称调用：
- `from sdk.mcp import mcp`
- `mcp.call`
- `mcp.call()`

`mcp.call()` 是 Python SDK 方法，必须在 `run_skills_snippet` 工具中执行包含它的 Python 代码。

**错误示例**：
```python
# 错误！不要这样做
tool_call(name="from sdk.mcp import mcp", arguments={})
tool_call(name="mcp.call", arguments={...})
```

**正确示例**：
```python
# 正确！使用 run_skills_snippet 工具
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp
result = mcp.call(...)
"""
)
```
-->
### 2. mcp.call() is NOT a tool name

**STRICTLY FORBIDDEN** to call the following as tool names:
- `from sdk.mcp import mcp`
- `mcp.call`
- `mcp.call()`

`mcp.call()` is a Python SDK method that must be executed within Python code using the `run_skills_snippet` tool.

**Wrong Example**:
```python
# Wrong! Do NOT do this
tool_call(name="from sdk.mcp import mcp", arguments={})
tool_call(name="mcp.call", arguments={...})
```

**Correct Example**:
```python
# Correct! Use run_skills_snippet tool
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp
result = mcp.call(...)
"""
)
```

<!--zh
## 关键原则
-->
## Key Principles

<!--zh
### 脚本执行
-->
### Script Execution

<!--zh
脚本使用标准命令行参数，例如：
-->
Scripts use standard command-line arguments, for example:
- `python scripts/get_servers.py`
- `python scripts/get_tools.py --server-name <服务器名称>`

<!--zh
在 Agent 环境中，使用 `shell_exec` 工具执行脚本：
-->
In Agent environment, use `shell_exec` tool to execute scripts. Note: `shell_exec` defaults to the workspace root as the working directory.

```python
# 获取服务器列表
shell_exec(
    command="python scripts/get_servers.py"
)

# 获取指定服务器的工具列表
shell_exec(
    command="python scripts/get_tools.py --server-name <服务器名称>"
)

# 获取工具 Schema
shell_exec(
    command="python scripts/get_tool_schema.py --server-name <服务器名称> --tool-name <工具名称>"
)
```

<!--zh
### MCP 工具调用
-->
### MCP Tool Calling

<!--zh
**重要说明**：`mcp.call()` 不是一个独立的工具，而是在 Python 代码中调用的 SDK 方法。

在 Agent 环境中，使用 `run_skills_snippet` 工具执行包含 `mcp.call()` 的 Python 代码（**必须**先通过脚本查询确认服务器和工具存在）：
-->
**Important Note**: `mcp.call()` is NOT a standalone tool, but an SDK method called within Python code.

In Agent environment, use `run_skills_snippet` tool to execute Python code containing `mcp.call()` (**MUST** first query and confirm server and tool existence via scripts):

```python
# 使用 run_skills_snippet 工具执行以下 Python 代码
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp

result = mcp.call(
    server_name="<服务器名称>",  # 必须是通过 get_servers.py 查询到的真实服务器名
    tool_name="<工具名称>",      # 必须是通过 get_tools.py 查询到的真实工具名
    tool_params={"参数": "值"}  # 必须符合 get_tool_schema.py 返回的 Schema
)

if result.ok:
    print(result.content)
else:
    print(f"调用失败: {result.content}")
"""
)
```

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
### 第零步：查询服务器列表（可选）

如果不确定有哪些可用的 MCP 服务器，可以运行脚本查询：
-->
### Step 0: Query Server List (Optional)

If unsure which MCP servers are available, run the script to query:

```bash
python scripts/get_servers.py
```

<!--zh
### 第一步：查询工具列表（必须）

**必须**查询指定服务器的可用工具列表：
-->
### Step 1: Query Tool List (Required)

**MUST** query the available tool list for the specified server:

```bash
python scripts/get_tools.py --server-name <服务器名称>
```

<!--zh
### 第二步：获取工具 Schema（必须）

**必须**获取工具的参数定义：
-->
### Step 2: Get Tool Schema (Required)

**MUST** get the tool's parameter definition:

```bash
python scripts/get_tool_schema.py --server-name <服务器名称> --tool-name <工具名称>
```

<!--zh
### 第三步：调用 MCP 工具（必须）

确认工具和参数后，使用 `run_skills_snippet` 工具执行包含 `mcp.call()` 的代码：
-->
### Step 3: Call MCP Tool (Required)

After confirming tool and parameters, use `run_skills_snippet` tool to execute code containing `mcp.call()`:

```python
# 使用 run_skills_snippet 工具
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp

result = mcp.call(
    server_name="<服务器名称>",  # 从用户提示词或 Step 0 中获取
    tool_name="<工具名称>",      # 从 Step 1 查询结果中获取
    tool_params={"参数": "值"}  # 根据 Step 2 的 Schema 定义构造
)

if result.ok:
    print(result.content)
else:
    print(f"调用失败: {result.content}")
"""
)
```

<!--zh
## 工作流程
-->
## Workflow

<!--zh
**必须遵循**的工作流程：

```
0. [可选] 获取服务器列表 (get_servers.py)
   ↓ 如果不确定有哪些服务器，可以先查询
1. 查看工具列表 (get_tools.py) - 必须
   ↓ 确认工具存在于该服务器
2. 获取工具 Schema (get_tool_schema.py) - 必须
   ↓ 了解必填参数和参数类型
3. 验证参数 - 必须
   ↓ 确保所有必填参数都已提供且类型正确
4. 调用工具 (mcp.call) - 必须
```

**警告**：跳过工具列表和 Schema 查询步骤直接调用工具，将会因为工具不存在或参数错误而失败。
-->
**MUST follow** this workflow:

```
0. [Optional] Get server list (get_servers.py)
   ↓ Query if unsure which servers are available
1. View tool list (get_tools.py) - REQUIRED
   ↓ Confirm tool exists on that server
2. Get tool schema (get_tool_schema.py) - REQUIRED
   ↓ Understand required parameters and types
3. Validate parameters - REQUIRED
   ↓ Ensure all required parameters are provided with correct types
4. Call tool (mcp.call) - REQUIRED
```

**WARNING**: Skipping tool list and schema query steps and calling tools directly will fail due to non-existent tools or incorrect parameters.

<!--zh
## 可用脚本

所有脚本位于 `agents/skills/using-mcp` 目录下。
-->
## Available Scripts

All scripts are located in the `agents/skills/using-mcp` directory.

<!--zh
### get_servers.py - 获取 MCP 服务器列表
-->
### get_servers.py - Get MCP Server List

<!--zh
获取所有 MCP 服务器的列表和状态。
-->
Get the list and status of all MCP servers.

**SYNOPSIS**
```bash
python scripts/get_servers.py
```

**DESCRIPTION**

<!--zh
查询所有已注册的 MCP 服务器，返回服务器名称、状态、工具数量等信息。
-->
Query all registered MCP servers and return server name, status, tool count, and other information.

**OPTIONS**

<!--zh
无参数。
-->
No parameters.

**OUTPUT**

<!--zh
返回 JSON 数组，每个元素包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务器内部名称 |
| `label_name` | string | 服务器显示名称 |
| `status` | string | 状态：`success`（成功）、`failed`（失败）、`timeout`（超时）|
| `tool_count` | number | 工具数量 |
| `tools` | array | 工具名称列表 |
-->
Returns a JSON array, each element contains:

| Field | Type | Description |
|------|------|------|
| `name` | string | Server internal name |
| `label_name` | string | Server display name |
| `status` | string | Status: `success`, `failed`, `timeout` |
| `tool_count` | number | Tool count |
| `tools` | array | Tool name list |

**EXAMPLES**

<!--zh
运行脚本：
```bash
python scripts/get_servers.py
```

返回 JSON 数组，每个元素包含 `label_name`、`tool_count` 等字段。
-->
Run the script:
```bash
python scripts/get_servers.py
```

Returns a JSON array, each element contains fields like `label_name`, `tool_count`, etc.

---

<!--zh
### get_tools.py - 获取 MCP 工具列表
-->
### get_tools.py - Get MCP Tool List

<!--zh
获取 MCP 工具列表，支持按服务器过滤。
-->
Get MCP tool list with optional server filtering.

**SYNOPSIS**
```bash
python scripts/get_tools.py [OPTIONS]
```

**DESCRIPTION**

<!--zh
查询所有可用的 MCP 工具或指定服务器的工具列表。返回工具名称和描述等基本信息。
-->
Query all available MCP tools or tools from a specific server. Returns tool name, description, and other basic information.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--server-name <name>` | string | 否 | 服务器名称，省略时返回所有工具 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--server-name <name>` | string | No | Server name, returns all tools if omitted |

**OUTPUT**

<!--zh
返回 JSON 数组，每个元素包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 工具名称 |
| `server_name` | string | 所属服务器名称 |
| `description` | string | 工具功能描述 |
-->
Returns a JSON array, each element contains:

| Field | Type | Description |
|------|------|------|
| `name` | string | Tool name |
| `server_name` | string | Server name |
| `description` | string | Tool function description |

**EXAMPLES**

<!--zh
获取所有工具：
```bash
python scripts/get_tools.py
```

获取指定服务器的工具：
```bash
python scripts/get_tools.py --server-name 高德地图
```

返回 JSON 数组，每个元素包含 `name`、`server_name`、`description` 等字段。
-->
Get all tools:
```bash
python scripts/get_tools.py
```

Get tools from a specific server:
```bash
python scripts/get_tools.py --server-name 高德地图
```

Returns a JSON array, each element contains fields like `name`, `server_name`, `description`, etc.

---

<!--zh
### get_tool_schema.py - 获取工具 Schema
-->
### get_tool_schema.py - Get Tool Schema

<!--zh
获取指定工具的 JSON Schema 定义，支持批量获取多个工具。
-->
Get the JSON Schema definition of specific tool(s), supports batch retrieval.

**SYNOPSIS**
```bash
python scripts/get_tool_schema.py --server-name <server> --tool-name <tool1> [tool2] [tool3] ...
```

**DESCRIPTION**

<!--zh
查询指定 MCP 工具的 JSON Schema 定义，包含参数说明、类型定义和必填字段。支持同时获取多个工具的 Schema。
-->
Query the JSON Schema definition of specific MCP tool(s), including parameter descriptions, type definitions, and required fields. Supports retrieving multiple tools at once.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--server-name <name>` | string | 是 | 服务器名称 |
| `--tool-name <name> [name2...]` | string | 是 | 工具名称，支持多个 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--server-name <name>` | string | Yes | Server name |
| `--tool-name <name> [name2...]` | string | Yes | Tool name(s), supports multiple |

**OUTPUT**

<!--zh
返回 JSON 数组，每个元素包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `tool_name` | string | 工具名称 |
| `server_name` | string | 服务器名称 |
| `schema` | object | Schema 对象（包含 `type`、`properties`、`required`）|
| `error` | string | 错误信息（仅在工具不存在时出现）|
-->
Returns a JSON array, each element contains:

| Field | Type | Description |
|------|------|------|
| `tool_name` | string | Tool name |
| `server_name` | string | Server name |
| `schema` | object | Schema object (with `type`, `properties`, `required`) |
| `error` | string | Error message (only appears when tool not found) |

**EXAMPLES**

<!--zh
获取单个工具的 Schema：
```bash
python scripts/get_tool_schema.py --server-name 高德地图 --tool-name maps_text_search
```

获取多个工具的 Schema：
```bash
python scripts/get_tool_schema.py --server-name 高德地图 --tool-name maps_text_search maps_weather maps_geo
```

无论单个还是多个工具，都返回 JSON 数组，每个元素包含 `tool_name`、`server_name` 和 `schema` 字段。
-->
Get schema for a single tool:
```bash
python scripts/get_tool_schema.py --server-name 高德地图 --tool-name maps_text_search
```

Get schemas for multiple tools:
```bash
python scripts/get_tool_schema.py --server-name 高德地图 --tool-name maps_text_search maps_weather maps_geo
```

Returns a JSON array regardless of single or multiple tools, each element containing `tool_name`, `server_name`, and `schema` fields.

<!--zh
## mcp.call 方法
-->
## mcp.call Method

<!--zh
**重要提示**：`mcp.call()` 是 SDK 方法，不是独立工具。必须在 `run_skills_snippet` 工具中执行 Python 代码来调用它。

通过 `mcp.call()` 调用 MCP 工具并获取执行结果。
-->
**Important**: `mcp.call()` is an SDK method, NOT a standalone tool. It must be called within Python code executed by the `run_skills_snippet` tool.

Call MCP tools via `mcp.call()` and get execution results.

<!--zh
### 参数说明

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `server_name` | 是 | string | MCP 服务器名称 |
| `tool_name` | 是 | string | 工具名称 |
| `tool_params` | 是 | dict | 工具参数字典，根据工具 Schema 定义传入 |
-->
### Parameters

| Parameter | Required | Type | Description |
|------|------|------|------|
| `server_name` | Yes | string | MCP server name |
| `tool_name` | Yes | string | Tool name |
| `tool_params` | Yes | dict | Tool parameter dict, passed according to tool Schema definition |

<!--zh
### 返回值

返回 `Result` 对象，包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 执行是否成功 |
| `content` | string | 成功时为结果内容，失败时为错误信息 |
| `execution_time` | float | 执行时间（秒）|
| `tool_call_id` | string | 工具调用 ID |
| `name` | string | 工具完整名称 |
-->
### Return Value

Returns a `Result` object containing the following fields:

| Field | Type | Description |
|------|------|------|
| `ok` | boolean | Whether execution succeeded |
| `content` | string | Result content on success, error message on failure |
| `execution_time` | float | Execution time (seconds) |
| `tool_call_id` | string | Tool call ID |
| `name` | string | Full tool name |

<!--zh
### 使用示例
-->
### Usage Examples

<!--zh
**基本调用：**
-->
**Basic Call:**

```python
# 注意：服务器名和工具名必须是通过脚本查询确认的真实值，不能臆想！
# 使用 run_skills_snippet 工具执行以下代码
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp

# 调用 MCP 工具
result = mcp.call(
    server_name="<服务器名称>",  # 必须从 get_servers.py 查询结果中获取
    tool_name="<工具名称>",      # 必须从 get_tools.py 查询结果中获取
    tool_params={"参数名": "参数值"}  # 必须符合 get_tool_schema.py 返回的 Schema
)

# 检查执行结果
if result.ok:
    print(f"调用成功: {result.content}")
    print(f"执行时间: {result.execution_time}秒")
else:
    print(f"调用失败: {result.content}")
"""
)
```

<!--zh
**完整工作流：**
-->
**Complete Workflow:**

```python
# Step 0: [可选] 获取服务器列表（通过 shell_exec）
# 如果不确定有哪些服务器，可执行:
shell_exec(
    command="python scripts/get_servers.py",
)
# 从输出中选择一个状态为 success 的服务器

# Step 1: [必须] 获取工具列表（通过 shell_exec）
shell_exec(
    command="python scripts/get_tools.py --server-name <服务器名称>",
)
# 从输出中选择要使用的工具

# Step 2: [必须] 获取工具 Schema（通过 shell_exec）
shell_exec(
    command="python scripts/get_tool_schema.py --server-name <服务器名称> --tool-name <工具名称>",
)
# 查看必填参数和参数类型

# Step 3: [必须] 调用工具（通过 run_skills_snippet）
run_skills_snippet(
    python_code="""
from sdk.mcp import mcp

# 根据 Schema 构造参数
tool_params = {
    "参数1": "值1",
    "参数2": "值2"
}

# 调用工具
result = mcp.call(
    server_name="<服务器名称>",  # 从用户提示词或 Step 0 中获取
    tool_name="<工具名称>",      # 从 Step 1 查询结果中获取
    tool_params=tool_params    # 根据 Step 2 的 Schema 构造
)

# 处理结果
if result.ok:
    print(f"调用成功: {result.content}")
else:
    print(f"调用失败: {result.content}")
"""
)
```

<!--zh
## 注意事项

1. **服务器确认**: 如果不确定服务器是否可用，可以先执行 `get_servers.py` 检查服务器状态
2. **工具确认**: 调用工具前**必须**先执行 `get_tools.py` 确认工具存在于该服务器
3. **Schema 验证**: 调用工具前**必须**先执行 `get_tool_schema.py` 获取 Schema 验证必填参数
4. **参数格式**: 确保 `tool_params` 符合工具的 JSON Schema 定义
5. **禁止臆想**: **严格禁止**臆想或猜测工具名称、参数名称，必须以查询结果为准
-->
## Notes

1. **Server Confirmation**: If unsure whether server is available, run `get_servers.py` to check server status first
2. **Tool Confirmation**: **MUST** run `get_tools.py` to confirm tool exists on that server before calling
3. **Schema Validation**: **MUST** run `get_tool_schema.py` to get Schema and validate required parameters before calling tools
4. **Parameter Format**: Ensure `tool_params` conforms to the tool's JSON Schema definition
5. **No Imagination**: **STRICTLY FORBIDDEN** to imagine or guess tool names or parameter names; must follow query results
