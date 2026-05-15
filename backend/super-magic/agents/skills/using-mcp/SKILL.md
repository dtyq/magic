---
name: using-mcp
description: Discover, connect to, and invoke tools on MCP (Model Context Protocol) servers. CRITICAL - When the user message contains [@mcp:...] mention, you MUST load this skill first to use MCP tools correctly.

name-cn: MCP 工具调用技能
description-cn: 发现并调用 MCP（Model Context Protocol）服务器上的工具。关键规则：当用户消息包含 [@mcp:...] 引用时，必须首先加载此技能。
---

# MCP Tools Calling Skill

Use this skill whenever you need to talk to an MCP server: list servers, connect to one, inspect a tool's schema, or invoke a tool.

## How it works

The six MCP capabilities are exposed as Code Mode tools (`mcp_*`). They are NOT directly callable as standalone tool calls. You must invoke them through `run_sdk_snippet` and `sdk.tool.call`:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call('mcp_list_servers', {})
print(result.content)
""")
```

`tool.call(name, params)` returns a `Result` with:
- `result.ok` — boolean, check this first
- `result.content` — complete information for reasoning and next-step decisions

## Available MCP tools

| Tool name | Purpose |
|-----------|---------|
| `mcp_list_servers` | List all MCP servers in the current chat with their connection status. Always start here. |
| `mcp_connect_server` | Connect a server whose status is `disconnected`. Returns the real tool list. |
| `mcp_list_tools` | List tools across connected servers, optionally filtered by `server_name`. |
| `mcp_get_tool_schema` | Fetch the JSON input schema of one or more tools before calling them. |
| `mcp_call_tool` | Invoke a specific tool on a server. The actual remote call. |
| `mcp_add_server` | Register a new MCP server config (stdio or http). Does NOT connect immediately. |
| `mcp_remove_server` | Remove an MCP server: disconnect, unregister tools, and delete persisted config. |

## Standard workflow

Follow this order. Skipping steps will cause failures because tool names and parameters cannot be guessed.

```
1. mcp_list_servers          → pick the server, read its `status`
   ├── status == 'connected'    → go to step 3
   └── status == 'disconnected' → go to step 2
2. mcp_connect_server        → connect; receive the real tool list
3. mcp_get_tool_schema       → fetch input schema(s)
4. mcp_call_tool             → invoke with parameters that match the schema
```

When the user wants to register a brand-new MCP server, run `mcp_add_server` first, then proceed from step 1.

## Rules

1. NEVER fabricate server names, tool names, or parameter names. Always derive them from the previous step's `result.content`.
2. ALWAYS call `mcp_get_tool_schema` before `mcp_call_tool` unless you already saw the schema in this conversation.
3. NEVER call `mcp_*` tools as standalone tool calls. They only work inside `run_sdk_snippet` via `sdk.tool.call`.
4. ALWAYS check `result.ok` before proceeding. Errors should be surfaced to the user, not silently retried.

## End-to-end example

User asks to call a tool on some MCP server. The flow below uses angle-
bracket placeholders (`<server_name>`, `<tool_name>`, `<workspace_dir>`,
etc.); replace every `<...>` with the real value from your context or from
the previous step before running the snippet.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

# 1. Discover servers
servers = tool.call('mcp_list_servers', {})
print(servers.content)
# Parse the server name from content, e.g. "<server_name> (status=connected, N tool(s))"

# 2. Connect if needed
connect = tool.call('mcp_connect_server', {'server_name': '<server_name>'})
if not connect.ok:
    raise SystemExit(f'Connect failed: {connect.content}')
print(connect.content)

# 3. Inspect schema
schema = tool.call('mcp_get_tool_schema', {
    'server_name': '<server_name>',
    'tool_name': '<tool_name>',
})
print(schema.content)

# 4. Call the tool (tool_params is a JSON string matching the schema)
result = tool.call('mcp_call_tool', {
    'server_name': '<server_name>',
    'tool_name': '<tool_name>',
    'tool_params': '{"key": "value"}',
})
print(result.content)
""")
```

## Saving the call result to a file (`output_file_path`)

`mcp_call_tool` accepts an optional `output_file_path` to persist the result
as a JSON file in the workspace, instead of consuming it only in your
reasoning context.

When to set it:

- The result is likely to be large (for example a SQL query without WHERE or
  LIMIT that may return thousands of rows, fetching a full article body, or
  exporting a long list).
- The user expects a concrete file deliverable (a report, dataset dump,
  attachment-like artifact).
- A downstream step needs a stable on-disk path to open later.

When to leave it empty:

- You only need the data for your own reasoning. Small results are returned
  inline; oversized results are auto-persisted in the background to avoid
  flooding the context, so you do not need to manage that yourself.

Rules:

1. The path MUST be absolute. Relative paths are rejected and the call
   silently falls back to the runtime directory.
2. Prefer a location inside the current workspace so the file is easy for
   the user to inspect and accept as a deliverable. The workspace path is
   already available in your context — just prepend it directly, e.g.
   `<workspace_dir>/data/<server>/<tool>.json`. Do not rebuild it from
   `os.getcwd()` or hard-code a path from another machine.
3. The file MUST be JSON. Pick a meaningful filename and a tidy directory
   layout, for example `reports/<topic>/<name>.json` or
   `data/<server>/<tool>.json`.

Example — deliver the call result as a workspace file. Replace every
`<...>` with real values: `<workspace_dir>` is the workspace path already
visible in your context, and `<server_name>` / `<tool_name>` come from the
previous discovery steps:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call('mcp_call_tool', {
    'server_name': '<server_name>',
    'tool_name': '<tool_name>',
    'tool_params': '{"key": "value"}',
    'output_file_path': '<workspace_dir>/data/<server_name>/<tool_name>.json',
})
print(result.content)
""")
```

## Adding a new server

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

# stdio server (npx-based MCP).
# `args` MUST be a real list, not a space-separated string.
add = tool.call('mcp_add_server', {
    'name': 'my-fs-server',
    'server_type': 'stdio',
    'command': 'npx',
    'args': ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    'label_name': 'Filesystem',
})
print(add.content)

# http server example
add = tool.call('mcp_add_server', {
    'name': 'my-api-server',
    'server_type': 'http',
    'url': 'http://localhost:3000/mcp',
    'label_name': 'Custom API',
})
print(add.content)
""")
```

After `mcp_add_server`, the server status is `disconnected`. Run `mcp_connect_server` (or just call any tool on it — connection happens on demand) before invoking its tools.

## Common pitfalls

- Passing `tool_params` to `mcp_call_tool` as a Python dict. It MUST be a JSON object string (e.g. `'{"key": "value"}'`); pass `'{}'` when no parameters are needed.
- Calling `mcp_call_tool` without first checking `mcp_get_tool_schema` and supplying random parameter names. Always look at the schema first.
- Passing `args` to `mcp_add_server` as a single string like `'-y @pkg /tmp'`. It MUST be a list of strings.
- Treating `mcp_list_tools` without `server_name` as a way to "discover" tools on disconnected servers. It only returns tools from already-connected servers; use `mcp_list_servers` + `mcp_connect_server` to see disconnected ones.
- Trying to call `mcp_call_tool` directly as a tool call (without `run_sdk_snippet`). It will be rejected because these tools are Code Mode only.
- Passing `output_file_path` as a relative path like `'reports/data.json'`. It is rejected and the call silently falls back to the runtime directory, so the user never sees the file. Always build an absolute path, and prefer placing it under the current workspace.
