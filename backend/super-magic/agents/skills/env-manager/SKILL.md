---
name: env-manager
description: Use when the user provides API keys, tokens, or other configuration values that should persist across sessions, or when the user asks to query, list, or delete saved environment variables. Manages personal env by default and workspace env only when explicitly requested.

name-cn: 环境变量管理器
description-cn: 当用户提供 API Key、Token 或其他需要跨会话保存复用的配置，或需要查询、查看、删除已保存环境变量时使用。默认管理个人 env，只有用户明确要求当前工作区/项目专用时才管理工作区 env。
---

<!--zh
# 环境变量管理器
-->
# Environment Variable Manager

<!--zh
使用本 skill 时，通过 `run_sdk_snippet` 调用 `sdk.tool.call(...)` 执行 `set_env`、`get_env`、`unset_env`、`list_env`。

默认保存和删除个人级环境变量，保存到 `~/.magic/super-magic.env`，可跨工作区复用。
只有用户明确要求保存或删除当前工作区/项目专用变量时，才传入 `"scope": "workspace"`。

运行时最终生效环境变量会合并工作区 env 与个人 env，个人 env 优先级最高，会覆盖同名工作区变量。
工具展示和返回结果不会回显明文 value。
-->
Use this skill by calling `set_env`, `get_env`, `unset_env`, and `list_env` through `sdk.tool.call(...)` inside `run_sdk_snippet`.

By default, save and delete personal environment variables stored in `~/.magic/super-magic.env` for reuse across workspaces.
Pass `"scope": "workspace"` only when the user explicitly asks to save or delete values for the current workspace/project.

The runtime effective environment merges workspace env and personal env. Personal env has the highest priority and overrides workspace values with the same key.
Tool display and results never echo plaintext values.

<!--zh
## 查询单个环境变量

当只需要确认某个 key 是否已配置时，优先使用 `get_env`。`get_env` 默认查询最终生效 env（`scope=all`）。不要为了查询一个 key 调用 `list_env`，避免把无关环境变量都暴露给模型上下文。
-->
## Get One Env

When you only need to check whether one key is configured, prefer `get_env`. `get_env` queries the final effective env by default (`scope=all`). Do not call `list_env` just to inspect one key, because that exposes unrelated environment variable names and masked values to the model context.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("get_env", {
    "key": "KEY_NAME",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
只有需要检查某个 key 是否存在于特定存储范围时，才显式传入 `"scope": "personal"` 或 `"scope": "workspace"`。
-->
Only pass `"scope": "personal"` or `"scope": "workspace"` when you need to check whether a key exists in a specific storage scope.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("get_env", {
    "key": "KEY_NAME",
    "scope": "workspace",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 设置个人环境变量
-->
## Set Personal Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("set_env", {
    "key": "KEY_NAME",
    "value": "value",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 设置工作区环境变量
-->
## Set Workspace Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("set_env", {
    "key": "KEY_NAME",
    "value": "value",
    "scope": "workspace",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 查看个人环境变量
-->
## List Personal Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("list_env", {})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 查看工作区环境变量
-->
## List Workspace Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("list_env", {
    "scope": "workspace",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 查看最终生效环境变量
-->
## List Effective Env

<!--zh
`"scope": "all"` 表示工作区配置 + 个人配置的最终生效合并结果，个人配置覆盖同名工作区配置。
-->
`"scope": "all"` means the final effective merge of workspace and personal env. Personal env overrides workspace env with the same key.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("list_env", {
    "scope": "all",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 删除个人环境变量
-->
## Unset Personal Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("unset_env", {
    "key": "KEY_NAME",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

<!--zh
## 删除工作区环境变量
-->
## Unset Workspace Env

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("unset_env", {
    "key": "KEY_NAME",
    "scope": "workspace",
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```
