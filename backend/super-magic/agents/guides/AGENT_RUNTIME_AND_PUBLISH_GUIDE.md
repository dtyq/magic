# Agent 运行时与发布链路

本文解释三条链路：**Crew 运行时**、**Claw 运行时**、**发布（/workspace/export）**。

这三条链路常被混淆。读完本文你应该能回答：

- "用户配置的工具列表是怎么生效的？"
- "发布数字员工和数字员工跑起来是两件事吗？"
- "我要改 `crew.template.agent`，会影响什么？"

---

## 核心心智模型

先理解两个概念的区别：

```
运行时链路   用户发消息 → Agent 要跑起来 → 编译 .agent → 运行
发布链路     用户点发布 → 把工作区打包 → 上传对象存储 → 供前端展示
```

**运行时**解决"现在能跑吗"，**发布**解决"别人能用吗"。两条链路读的文件可能一样，但目的完全不同，代码不要混写。

---

## Crew 运行时链路

**触发条件：** 用户发消息时 `agent_mode = custom_agent`

**代码位置：**
- `app/service/agent_dispatcher.py` → `_prepare_crew_agent()`
- `app/service/crew_agent_compiler.py`

```
用户发消息
    │
    ▼
_prepare_crew_agent(agent_code)
    │
    ├─ 本地有 .agent 缓存？─── 是 ──► 直接用，跳过下载和编译
    │
    └─ 否
        │
        ├─ 本地有定义文件？─── 否 ──► 从远端下载 crew 文件到 agents/crews/<agent_code>/
        │
        ▼
    CrewAgentCompiler.compile()
        │
        ├─ 读取 agents/crew.template.agent    ← 基底模板
        ├─ 读取 IDENTITY.md                   ← 身份、角色
        ├─ 读取 AGENTS.md                     ← 工作规则
        ├─ 读取 SOUL.md                       ← 性格
        ├─ 读取 TOOLS.md                      ← 额外工具 / 排除工具
        └─ 读取 SKILLS.md                     ← 技能配置
            │
            ▼
        agents/<agent_code>.agent             ← 编译输出，运行时真正加载这个
            │
            ▼
        Agent 运行起来
```

### crew.template.agent 是什么

它是 Crew Agent 的**基底模板**，不只是工具列表。最终 `.agent` 是：

```
crew.template.agent（基底）
+ 用户定义文件（IDENTITY / AGENTS / SOUL / TOOLS / SKILLS）
= 编译后的 .agent
```

工具的合成规则：

```
模板里的默认工具
  + TOOLS.md 里的 tools（追加）
  - TOOLS.md 里的 exclude_builtin_tools（排除）
= 最终工具列表
```

如果 `TOOLS.md` 不存在，就只用模板默认工具。

---

## Claw / magiclaw 运行时链路

**触发条件：** 用户发消息时 `agent_mode = magiclaw`

**代码位置：**
- `app/service/agent_dispatcher.py` → `_prepare_claw_agent()`
- `app/service/claw_agent_compiler.py`

```
用户发消息
    │
    ▼
_prepare_claw_agent(claw_code)
    │
    ├─ 把 agents/claws/<claw_code>/ 同步到 .workspace/.magic/
    │  （SKIP 策略：用户已有的文件不覆盖）
    │
    │  首次初始化：全量复制
    │  后续启动：只补充缺失文件
    │
    ▼
ClawAgentCompiler.compile()
    │
    ├─ 读取 agents/claw.template.agent         ← 基底模板
    ├─ 读取 .workspace/.magic/IDENTITY.md      ← 身份（用户可自定义）
    ├─ 读取 .workspace/.magic/SOUL.md          ← 性格（用户可自定义）
    ├─ 读取 .workspace/.magic/AGENTS.md        ← 工作规则（用户可自定义）
    └─ 读取 .workspace/.magic/TOOLS.md         ← 额外工具 / 排除工具
        │
        ▼
    agents/<claw_code>.agent                   ← 每次启动都重新编译
        │
        ▼
    Agent 运行起来，并被要求在响应前读取 SOUL.md / AGENTS.md 等文件
```

### Claw 和 Crew 的关键区别

| | Crew | Claw |
|---|---|---|
| 定义文件来源 | 从远端下载 | 从 `agents/claws/<code>/` 复制到 `.workspace/.magic/` |
| `.agent` 缓存 | 存在就复用 | 每次都重新编译 |
| 用户文件位置 | `agents/crews/<code>/` | `.workspace/.magic/` |
| 系统提示方式 | 直接内嵌到 `.agent` | 运行时要求 Agent 主动去读文件 |

工具合成规则和 Crew 相同：

```
模板里的默认工具
  + .magic/TOOLS.md 里的 tools（追加）
  - .magic/TOOLS.md 里的 exclude_builtin_tools（排除）
= 最终工具列表
```

---

## 发布链路：/workspace/export

**触发条件：** 前端调用 `POST /workspace/export`，由 `crew-creator.agent` 或 `skill-creator.agent` 在用户点发布时触发

**代码位置：**
- `app/api/routes/workspace.py`
- `app/service/workspace_export_service.py`

```
前端发起发布请求
    │
    ▼
export_workspace(type, code, upload_config, source_path)
    │
    ├─ 读取工作区 frontmatter 元数据
    │     IDENTITY.md → name / role / description
    │     TOOLS.md    → tools 列表
    │     SKILLS.md   → skills 列表
    │
    ├─ 把工作区目录打包成 <code>_<timestamp>.zip
    │
    └─ 上传到对象存储（TOS / 阿里云 OSS / MinIO）
        │
        ▼
    返回 { file_key, metadata }
        │
        ▼
    上游发布流程
        ├─ metadata → 数据库（前端展示、检索用）
        └─ file_key → 对象存储中的 zip 地址（安装 / 分发用）
```

### 这条链路不会做什么

- 不读 `crew.template.agent`
- 不读 `claw.template.agent`
- 不编译 `.agent`
- 不复用运行时的工具合成规则

它只关心"把工作区文件原样打包，顺手读一下 frontmatter 元数据"，就这么多。

---

## 常见误解对照

| 误解 | 真相 |
|------|------|
| `/workspace/export` 应该也去读 `crew.template.agent` | 不应该。发布链路只是打包，不是编译 |
| 改了 `crew.template.agent` 里的工具，用户发布后就能更新工具 | 不对。发布链路不读模板，只读工作区 frontmatter |
| `crew.template.agent` 就是个工具清单 | 不对。它是 Crew 的基底模板，工具只是其中一个字段 |
| Claw 的 `.agent` 文件可以缓存复用 | 不对。Claw 每次启动都重新编译，保证总是用最新模板 |

---

## 改代码前的自检

| 你要改的地方 | 先看这里 |
|---|---|
| 运行时准备逻辑 | `agent_dispatcher.py` 的 `_prepare_crew_agent` / `_prepare_claw_agent` |
| Crew 工具合成规则 | `crew_agent_compiler.py` 的 `resolve_crew_tools` |
| Claw 工具合成规则 | `claw_agent_compiler.py` 的 `resolve_claw_tools` |
| 发布打包与元数据 | `workspace_export_service.py` |
| Crew 创建流程 | `agents/crew-creator.agent` 及 `agents/skills/crew-creator/` |
| Skill 创建流程 | `agents/skill-creator.agent` 及 `agents/skills/skill-creator/` |
