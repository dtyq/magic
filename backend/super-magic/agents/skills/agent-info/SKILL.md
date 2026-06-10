---
name: agent-info
description: Query the list of all agents (employees) available to the current user. Use when generating code that requires a real agentId, or when the user asks "which agents/employees do I have".

name-cn: 员工信息查询
description-cn: 查询当前用户可用的所有员工（Agent）列表。当需要生成包含 agentId 的代码、或用户询问"我有哪些员工"时使用。
---

<!--zh
# 查询可用员工列表
-->

# List Available Agents

<!--zh
查询当前用户可访问的所有员工（Agent），返回每个员工的 code（agentId）、名称、描述和类型。
-->

Query all agents accessible to the current user. Returns each agent's code (agentId), name, description and type.

<!--zh
## 核心能力
-->

## Core Capabilities

<!--zh
- 获取用户所有可用员工列表（包括内置、自定义、公开员工）
- 支持按名称模糊过滤
- 返回 code 字段即 agentId，可直接用于 `createTopicAndSend` 等 API 调用
-->

- Get all available agents for the user (including built-in, custom, and public)
- Support fuzzy filtering by name
- The returned `code` field is the agentId, usable directly in `createTopicAndSend` and similar APIs

<!--zh
## 快速开始
-->

## Quick Start

<!--zh
### 典型工作流
```
1. 查询全部员工 (list.py)
   ↓ 获取 code / name / type
2. 在代码生成中直接使用 code 作为 agentId
```
-->

### Typical Workflow

```
1. Query all agents (list.py)
   ↓ Get code / name / type
2. Use code directly as agentId in code generation
```

<!--zh
## 可用脚本
-->

## Available Scripts

---

<!--zh
### list.py - 查询员工列表
-->

### list.py - List Agents

<!--zh
查询当前用户可用的所有员工列表。
-->

Query all agents available to the current user.

**SYNOPSIS**

```bash
python scripts/list.py [OPTIONS]
```

**OPTIONS**

<!--zh
|选项|类型|必填|说明|
|---|---|---|---|
|`--name-filter <keyword>`|string|否|按员工名称模糊过滤（不区分大小写）|
|`--type-filter <type>`|string|否|按类型过滤：official / custom / public|
-->

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `--name-filter <keyword>` | string | No | Fuzzy filter by agent name (case-insensitive) |
| `--type-filter <type>` | string | No | Filter by type: official / custom / public |

**OUTPUT**

<!--zh
成功返回 JSON：
```json
{
  "total": 5,
  "agents": [
    {
      "code": "SMA-xxxx",
      "name": "数据分析师",
      "description": "专业的数据分析助手",
      "type": "custom"
    }
  ]
}
```

- `code` 即 agentId，可直接传入 `window.Magic.project.createTopicAndSend(msg, {agentId: code})`
- `type` 取值：official（内置官方）、custom（用户自定义）、public（团队/公开共享）
-->

On success, returns JSON:
```json
{
  "total": 5,
  "agents": [
    {
      "code": "SMA-xxxx",
      "name": "Data Analyst",
      "description": "Professional data analysis assistant",
      "type": "custom"
    }
  ]
}
```

- `code` is the agentId, pass directly to `window.Magic.project.createTopicAndSend(msg, {agentId: code})`
- `type` values: official (built-in), custom (user-created), public (team/public shared)

**EXAMPLES**

```bash
# 查询全部员工
python scripts/list.py

# 按名称过滤
python scripts/list.py --name-filter "数据分析"

# 按类型过滤
python scripts/list.py --type-filter custom
```

---

<!--zh
## 使用场景
-->

## Use Cases

<!--zh
### 1. 微应用代码生成中获取真实 agentId

在生成需要派发任务给员工的微应用代码前，先运行脚本获取员工列表，再将真实 code 写入代码：

```bash
python scripts/list.py --name-filter "研究员"
```

返回结果中的 `code` 即可直接用于：
```javascript
const { topicId } = await window.Magic.project.createTopicAndSend(
  message,
  { agentId: "SMA-xxxx" }  // 从 list.py 获取的真实 code
);
```

### 2. 用户询问可用员工

当用户问"我有哪些员工"或"帮我看看有什么可用的 Agent"时，运行脚本即可获取完整列表。
-->

### 1. Get real agentId for micro-app code generation

Before generating micro-app code that dispatches tasks to agents, run the script to get the agent list, then use the real code in generated code:

```bash
python scripts/list.py --name-filter "researcher"
```

Use the returned `code` directly:
```javascript
const { topicId } = await window.Magic.project.createTopicAndSend(
  message,
  { agentId: "SMA-xxxx" }  // real code from list.py
);
```

### 2. User asks about available agents

When user asks "what agents do I have" or "show me available agents", run the script to get the full list.
