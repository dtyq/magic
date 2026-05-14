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
- 显式按需连接指定服务器并一次拿到完整工具清单
- 列出指定服务器的工具（按需触发连接）
- 获取工具的 JSON Schema 定义
- 调用 MCP 工具并获取结果
- 会话维度添加 / 更新 MCP 服务器配置（持久化保存，按需连接）
-->
- Query the MCP server list and their connection status
- Explicitly connect a server on demand and fetch its full tool list in one call
- List tools of a specific server (connection is established on demand)
- Get JSON Schema definitions of tools
- Call MCP tools and get results
- Add / update MCP server configs per chat (persisted to store, connected on demand)

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

`mcp.call()` 是 Python SDK 方法，必须在 `run_sdk_snippet` 工具中执行包含它的 Python 代码。

**错误示例**：
```python
# 错误！不要这样做
tool_call(name="from sdk.mcp import mcp", arguments={})
tool_call(name="mcp.call", arguments={...})
```

**正确示例**：
```python
# 正确！使用 run_sdk_snippet 工具
run_sdk_snippet(
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

`mcp.call()` is a Python SDK method that must be executed within Python code using the `run_sdk_snippet` tool.

**Wrong Example**:
```python
# Wrong! Do NOT do this
tool_call(name="from sdk.mcp import mcp", arguments={})
tool_call(name="mcp.call", arguments={...})
```

**Correct Example**:
```python
# Correct! Use run_sdk_snippet tool
run_sdk_snippet(
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
In Agent environment, use `shell_exec` tool to execute scripts:

```python
# 获取服务器列表
shell_exec(
    command="python scripts/get_servers.py"
)

# 显式连接指定服务器（首次使用未连接的服务器时必须）
shell_exec(
    command="python scripts/connect_server.py --server-name <服务器名称>"
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

在 Agent 环境中，使用 `run_sdk_snippet` 工具执行包含 `mcp.call()` 的 Python 代码（**必须**先通过脚本查询确认服务器和工具存在）：
-->
**Important Note**: `mcp.call()` is NOT a standalone tool, but an SDK method called within Python code.

In Agent environment, use `run_sdk_snippet` tool to execute Python code containing `mcp.call()` (**MUST** first query and confirm server and tool existence via scripts):

```python
# 使用 run_sdk_snippet 工具执行以下 Python 代码
run_sdk_snippet(
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

确认工具和参数后，使用 `run_sdk_snippet` 工具执行包含 `mcp.call()` 的代码：
-->
### Step 3: Call MCP Tool (Required)

After confirming tool and parameters, use `run_sdk_snippet` tool to execute code containing `mcp.call()`:

```python
# 使用 run_sdk_snippet 工具
run_sdk_snippet(
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
[如需添加新服务器]
A. 添加 MCP 服务器配置 (add_server.py) - 可选
   ↓ 仅持久化到当前 chat，不立即建连

[调用已有服务器的工具]
0. [可选] 获取服务器列表 (get_servers.py)
   ↓ 查看全量配置与连接状态（connected / disconnected）
1. 显式连接服务器 (connect_server.py) - 首次使用时必须
   ↓ 一次性拿到该服务器的完整工具清单（name / description），
     避免凭想象拼工具名
2. [可选] 按服务器查工具列表 (get_tools.py) - 作为其它场景的完备入口
3. 获取工具 Schema (get_tool_schema.py) - 必须
   ↓ 了解必填参数和参数类型
4. 验证参数 - 必须
   ↓ 确保所有必填参数都已提供且类型正确
5. 调用工具 (mcp.call) - 必须
```

**警告**：跳过 connect/工具列表/Schema 查询直接调用工具，将因为工具不存在或参数错误而失败。
-->
**MUST follow** this workflow:

```
[If you need to add a new server first]
A. Add MCP server config (add_server.py) - Optional
   ↓ Only persists the config to the current chat; no live connection is made.

[To call tools on an existing server]
0. [Optional] Get server list (get_servers.py)
   ↓ Inspect the full config set and their status (connected / disconnected)
1. Explicitly connect the server (connect_server.py) - REQUIRED on first use
   ↓ Triggers the actual connection and returns the server's real tool list
     (name / description). Use this to confirm what tools exist before calling,
     instead of guessing tool names.
2. [Optional] Get tool list (get_tools.py) - Fallback query entry for other cases
3. Get tool schema (get_tool_schema.py) - REQUIRED
   ↓ Understand required parameters and types
4. Validate parameters - REQUIRED
   ↓ Ensure all required parameters are provided with correct types
5. Call tool (mcp.call) - REQUIRED
```

**WARNING**: Skipping connect / tool list / schema query and calling tools directly will fail because the tool may not exist or the parameters may be wrong.

<!--zh
## 可用脚本
-->
## Available Scripts

<!--zh
### add_server.py - 添加 / 更新 MCP 服务器配置
-->
### add_server.py - Add or Update MCP Server Config

<!--zh
将一个 MCP 服务器配置写入当前 chat 的持久化 store。按需连接模式下不会立即建连。
-->
Persist an MCP server config to the current chat's store. In the lazy-connect model, no live connection is established at this point.

**SYNOPSIS**
```bash
python scripts/add_server.py --name <name> --type stdio|http [OPTIONS]
```

**DESCRIPTION**

<!--zh
支持 stdio（命令行进程）和 http（URL）两种类型的 MCP 服务器。
同名配置会被覆盖。配置会持久化保存到当前 chat；首次调用该服务器的工具时才会触发连接。
-->
Supports both stdio (command-line process) and http (URL) MCP server types.
An existing config with the same name will be overwritten. The config is persisted to
the current chat; the first tool call on this server triggers the actual connection.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--name <name>` | string | 是 | 服务器名称 |
| `--type <type>` | string | 是 | 连接类型：`stdio` 或 `http` |
| `--command <cmd>` | string | stdio 必填 | 启动命令（如 `npx`、`uvx`） |
| `--args <json>` | string | 否 | 命令参数，**必须是 JSON 数组字符串**，例如 `'["-y","@pkg"]'`；禁止直接传 `-y pkg` 格式 |
| `--url <url>` | string | http 必填 | 服务器 URL |
| `--env KEY=VALUE [...]` | string | 否 | 环境变量，支持多个 |
| `--label <name>` | string | 否 | 服务器显示名称 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--name <name>` | string | Yes | Server name |
| `--type <type>` | string | Yes | Connection type: `stdio` or `http` |
| `--command <cmd>` | string | stdio only | Launch command (e.g. `npx`, `uvx`) |
| `--args <json>` | string | No | Command arguments as a **JSON array string**, e.g. `'["-y","@pkg"]'`; do NOT pass raw space-separated args like `-y @pkg` |
| `--url <url>` | string | http only | Server URL |
| `--env KEY=VALUE [...]` | string | No | Environment variables, supports multiple |
| `--label <name>` | string | No | Server display name |

**OUTPUT**

<!--zh
返回 JSON 对象，包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 是否成功 |
| `name` | string | 服务器名称 |
| `status` | string | 连接状态，此接口始终返回 `disconnected`（未触发连接） |
| `tool_count` | number | 已发现的工具数量，未连接时始终为 0 |
| `tools` | array | 已发现的工具名称列表，未连接时始终为空 |
| `error` | string | 失败时的错误信息 |
-->
Returns a JSON object containing:

| Field | Type | Description |
|------|------|------|
| `ok` | boolean | Whether the config was saved |
| `name` | string | Server name |
| `status` | string | Connection status; this endpoint always returns `disconnected` because no connection is made yet |
| `tool_count` | number | Number of discovered tools; always `0` before the server is connected |
| `tools` | array | Discovered tool names; always empty before the server is connected |
| `error` | string | Error message on failure |

**EXAMPLES**

<!--zh
添加 stdio 类型服务器（npx 启动的 MCP）：
注意：--args 必须是 JSON 数组字符串，用单引号包裹整体，内部用双引号。
```bash
python scripts/add_server.py \
    --name my-fs-server \
    --type stdio \
    --command npx \
    --args '["-y","@modelcontextprotocol/server-filesystem","/tmp"]' \
    --label "文件系统"
```

添加 http 类型服务器：
```bash
python scripts/add_server.py \
    --name my-api-server \
    --type http \
    --url http://localhost:3000/mcp \
    --label "自定义 API"
```

带环境变量：
```bash
python scripts/add_server.py \
    --name my-server \
    --type stdio \
    --command npx \
    --args '["-y","some-mcp-server"]' \
    --env API_KEY=your_key BASE_URL=https://example.com
```
-->
Add a stdio server (npx-based MCP).
CRITICAL: `--args` MUST be a JSON array string. Use single quotes around the whole value.
[correct] `--args '["-y","@modelcontextprotocol/server-sequential-thinking"]'`
[wrong]   `--args -y @modelcontextprotocol/server-sequential-thinking`
[wrong]   `--args "-y @modelcontextprotocol/server-sequential-thinking"`
```bash
python scripts/add_server.py \
    --name my-fs-server \
    --type stdio \
    --command npx \
    --args '["-y","@modelcontextprotocol/server-filesystem","/tmp"]' \
    --label "Filesystem"
```

Add an http server:
```bash
python scripts/add_server.py \
    --name my-api-server \
    --type http \
    --url http://localhost:3000/mcp \
    --label "Custom API"
```

Add with environment variables:
```bash
python scripts/add_server.py \
    --name my-server \
    --type stdio \
    --command npx \
    --args '["-y","some-mcp-server"]' \
    --env API_KEY=your_key BASE_URL=https://example.com
```

---

<!--zh
### connect_server.py - 显式连接 MCP 服务器
-->
### connect_server.py - Explicitly Connect an MCP Server

<!--zh
触发指定 MCP 服务器的实际连接与工具发现，并一次性返回该服务器的真实工具清单。
首次使用一个尚未连接的服务器时，**必须**先调用此脚本，以避免凭想象拼凑工具名。
-->
Trigger an actual connection and tool discovery for a specific MCP server, returning
the server's real tool list in a single call. On the first use of a disconnected server
you **MUST** call this script before calling its tools, instead of guessing tool names.

**SYNOPSIS**
```bash
python scripts/connect_server.py --server-name <name>
```

**DESCRIPTION**

<!--zh
前置要求：该服务器配置已经存在于当前 chat 的 MCP store（由用户配置或通过 add_server.py 注入）。
在按需连接模型下，以前的连接是隐式的（get_tools / get_tool_schema / mcp.call 触发）；
这里的 connect_server 是显式入口，用于“先连接、拿到工具清单、再调用工具”的稳定工作流。
-->
Preconditions: the server config already exists in the current chat's MCP store (either
through user configuration or via `add_server.py`).
Under the lazy-connect model, connections were previously implicit (triggered by
`get_tools` / `get_tool_schema` / `mcp.call`). `connect_server.py` is the explicit entry
point for a stable "connect first, read the real tool list, then call" workflow.

**OPTIONS**

<!--zh
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--server-name <name>` | string | 是 | 待连接的 MCP 服务器名称 |
-->
| Option | Type | Required | Description |
|------|------|------|------|
| `--server-name <name>` | string | Yes | MCP server name to connect |

**OUTPUT**

<!--zh
返回 JSON 对象，包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 是否连接成功 |
| `name` | string | 服务器名称 |
| `status` | string | 成功时为 `connected`，失败时为 `failed` |
| `tool_count` | number | 发现的工具数量 |
| `tools` | array | 工具列表，每个元素包含 `name`、`server_name`、`description` |
| `duration` | number | 连接耗时（秒） |
| `error` | string | 失败时的错误信息，成功时为 null |
-->
Returns a JSON object containing:

| Field | Type | Description |
|------|------|------|
| `ok` | boolean | Whether the connection succeeded |
| `name` | string | Server name |
| `status` | string | `connected` on success, `failed` on error |
| `tool_count` | number | Number of discovered tools |
| `tools` | array | Tool list; each element has `name`, `server_name`, `description` |
| `duration` | number | Connection duration in seconds |
| `error` | string | Error message on failure, null on success |

**EXAMPLES**

<!--zh
连接一个已配置的服务器：
```bash
python scripts/connect_server.py --server-name my-fs-server
```

返回示例：
```json
{
  "ok": true,
  "name": "my-fs-server",
  "status": "connected",
  "tool_count": 5,
  "tools": [
    {"name": "read_file", "server_name": "my-fs-server", "description": "Read a file"}
  ],
  "duration": 0.42,
  "error": null
}
```
-->
Connect a server that is already configured:
```bash
python scripts/connect_server.py --server-name my-fs-server
```

Sample response:
```json
{
  "ok": true,
  "name": "my-fs-server",
  "status": "connected",
  "tool_count": 5,
  "tools": [
    {"name": "read_file", "server_name": "my-fs-server", "description": "Read a file"}
  ],
  "duration": 0.42,
  "error": null
}
```

---

<!--zh
### get_servers.py - 获取当前 chat 的 MCP 服务器列表
-->
### get_servers.py - Get MCP Server List of the Current Chat

<!--zh
返回当前 chat 下全量的 MCP 服务器配置及其当前连接状态，包括尚未连接的服务器。
-->
Return all MCP server configs persisted for the current chat along with their current connection status, including servers that have not been connected yet.

**SYNOPSIS**
```bash
python scripts/get_servers.py
```

**DESCRIPTION**

<!--zh
查询当前 chat 下所有已注册的 MCP 服务器，返回名称、显示名、描述、配置来源、连接状态、已发现的工具数量等信息。
-->
Query all registered MCP servers for the current chat and return their name, display label, description, config source, connection status, and discovered tool information.

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
| `description` | string | 服务器用途描述，用于判断是否需要调用该服务器 |
| `source` | string | 配置来源：`global_config` 或 `client_config` |
| `status` | string | 连接状态：`connected`（已连接） 或 `disconnected`（尚未触发连接） |
| `tool_count` | number | 已发现的工具数量，未连接时为 0 |
| `tools` | array | 已发现的工具名称列表，未连接时为空 |
| `error` | string | 错误信息（正常时为 null） |
| `next_action` | string | 面向 agent 的下一步提示：`disconnected` 提示 `connect_server.py`；`connected` 提示直接走 `get_tool_schema` / `mcp.call` |
-->
Returns a JSON array, each element contains:

| Field | Type | Description |
|------|------|------|
| `name` | string | Server internal name |
| `label_name` | string | Server display name |
| `description` | string | Server purpose description; use it to decide whether this server is worth calling |
| `source` | string | Config source: `global_config` or `client_config` |
| `status` | string | Connection status: `connected` or `disconnected` (not yet connected) |
| `tool_count` | number | Number of discovered tools; `0` before connection |
| `tools` | array | Discovered tool name list; empty before connection |
| `error` | string | Error message (null when healthy) |
| `next_action` | string | Next-step hint for the agent: `disconnected` entries hint to run `connect_server.py`; `connected` entries hint to go straight to `get_tool_schema` / `mcp.call` |

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
**重要提示**：`mcp.call()` 是 SDK 方法，不是独立工具。必须在 `run_sdk_snippet` 工具中执行 Python 代码来调用它。

通过 `mcp.call()` 调用 MCP 工具并获取执行结果。
-->
**Important**: `mcp.call()` is an SDK method, NOT a standalone tool. It must be called within Python code executed by the `run_sdk_snippet` tool.

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
# 使用 run_sdk_snippet 工具执行以下代码
run_sdk_snippet(
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
    command="python scripts/get_servers.py"
)
# 从输出中根据 name / description / source 选一个需要用的服务器；
# status 只表示当前是否已连接，disconnected 的服务器可以直接使用（后续步骤会按需连接）

# Step 1: [必须] 获取工具列表（通过 shell_exec）
shell_exec(
    command="python scripts/get_tools.py --server-name <服务器名称>"
)
# 从输出中选择要使用的工具

# Step 2: [必须] 获取工具 Schema（通过 shell_exec）
shell_exec(
    command="python scripts/get_tool_schema.py --server-name <服务器名称> --tool-name <工具名称>"
)
# 查看必填参数和参数类型

# Step 3: [必须] 调用工具（通过 run_sdk_snippet）
run_sdk_snippet(
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
2. **显式连接**: 首次使用一个尚未连接的服务器（`status=disconnected`）时，**必须**先执行 `connect_server.py` 拿到真实工具清单，禁止凭经验直接似写工具名
3. **Schema 验证**: 调用工具前**必须**先执行 `get_tool_schema.py` 获取 Schema 验证必填参数
4. **参数格式**: 确保 `tool_params` 符合工具的 JSON Schema 定义
5. **禁止臆想**: **严格禁止**臆想或猜测工具名称、参数名称，必须以查询结果为准
-->
## Notes

1. **Server Confirmation**: If unsure whether a server is available, run `get_servers.py` first to check server status
2. **Explicit Connect**: On the first use of a disconnected server (`status=disconnected`), you **MUST** run `connect_server.py` to obtain the real tool list before calling any tool; never fabricate tool names from experience
3. **Schema Validation**: **MUST** run `get_tool_schema.py` to get the Schema and validate required parameters before calling tools
4. **Parameter Format**: Ensure `tool_params` conforms to the tool's JSON Schema definition
5. **No Imagination**: **STRICTLY FORBIDDEN** to imagine or guess tool names or parameter names; must follow query results
