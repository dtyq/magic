---
name: env-manager
description: Manage persistent environment variables. Use when the user provides API keys or other configuration values that need to be saved and reused across sessions.

name-cn: 环境变量管理器
description-cn: 管理持久化环境变量。当用户提供 API Key 或其他需要跨会话保存并复用的配置时使用。
---

<!--zh
# 环境变量管理器
-->
# Environment Variable Manager

<!--zh
## 设置环境变量
-->
## Set

```python
shell_exec(
    command="python scripts/env.py set KEY_NAME 'value'"
)
```

<!--zh
## 查看已设置的环境变量
-->
## List

```python
shell_exec(
    command="python scripts/env.py list"
)
```

<!--zh
## 删除环境变量
-->
## Unset

```python
shell_exec(
    command="python scripts/env.py unset KEY_NAME"
)
```
