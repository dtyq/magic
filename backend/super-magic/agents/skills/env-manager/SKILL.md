---
name: env-manager
description: Use when the user provides API keys, tokens, or other configuration values that should persist across sessions, or when the user asks to list or delete saved environment variables. Manages personal env by default and workspace env only when explicitly requested.

name-cn: 环境变量管理器
description-cn: 当用户提供 API Key、Token 或其他需要跨会话保存复用的配置，或需要查看、删除已保存环境变量时使用。默认管理个人 env，只有用户明确要求当前工作区/项目专用时才管理工作区 env。
---

<!--zh
# 环境变量管理器
-->
# Environment Variable Manager

<!--zh
使用本 skill 时，通过 `run_sdk_snippet` 调用 `sdk.tool.call(...)` 执行 `set_env`、`unset_env`、`list_env`。

默认管理个人级环境变量，保存到 `~/.magic/super-magic.env`，可跨工作区复用。
只有用户明确要求保存到当前工作区/项目时，才传入 `"scope": "workspace"`。

运行时最终生效环境变量会合并工作区 env 与个人 env，个人 env 优先级最高，会覆盖同名工作区变量。
工具展示和返回结果不会回显明文 value。
-->
Use this skill by calling `set_env`, `unset_env`, and `list_env` through `sdk.tool.call(...)` inside `run_sdk_snippet`.

By default, manage personal environment variables saved in `~/.magic/super-magic.env` for reuse across workspaces.
Pass `"scope": "workspace"` only when the user explicitly asks to save values for the current workspace/project.

The runtime effective environment merges workspace env and personal env. Personal env has the highest priority and overrides workspace values with the same key.
Tool display and results never echo plaintext values.

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
