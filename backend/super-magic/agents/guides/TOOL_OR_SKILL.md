# 工具还是 Skill？—— 双活与 CodeModeOnly 单活

本文说明本项目中 Agent 能力的入口策略：什么时候保持 "Skill + Tool 双活"，什么时候使用 "CodeModeOnly 单活"，以及两种写法各自的维护要求。

---

## 背景：Code Mode 的底层仍然是工具

将能力从直接挂载工具迁移到 Skill + Code Mode 后，表面上模型不再直接调用工具，而是写代码。但这段代码最终仍然通过 `sdk.tool.call(...)` 把请求发回服务端，由服务端精确路由到对应工具执行。

**工具并没有消失，它变成了 Code Mode 的执行底座。**

这意味着：

- 每个通过 Skill + Code Mode 暴露的能力，底层仍然需要一个完整的 Tool 实现
- 工具的所有业务逻辑、前端展示方法（`get_before_tool_call_friendly_action_and_remark`、`get_before_tool_detail`、`get_tool_detail` 等）依然生效
- 前端看到的不是"模型在写 Python 代码"，而是"模型在调用一个工具"——工具调用的完整展示链路得以保留

这是本项目与市场上通行做法的关键区别：**大多数采用 Skill 的系统会放弃工具体系；本项目通过 Code Mode 的远程调用，实现了 Skill 动态加载与工具展示体验的双重继承。**

---

## 两种入口策略

### 双活

"双活"指同一个能力在两个层面同时保持完整和可用：

**Skill 层（Code Mode 入口）**

- SKILL.md 包含完整的工具参数说明、使用方式、示例代码
- 模型读取 Skill 后能独立写出正确的调用代码，不依赖工具自身的提示词
- 这是 Code Mode 下模型的唯一信息来源

**Tool 层（执行底座 + 直接挂载备用）**

- Tool 的 docstring、`Field(description=...)`、`get_prompt_hint()` 保持完整
- 工具的前端展示方法（action/remark/detail）完整实现
- 任何时候需要把这个工具直接挂载给模型，无需修改工具代码，直接可用

两层都完整，是这套机制的核心要求。**不能因为"已经写进 Skill"就删减工具自身的提示词**，否则一旦需要直接挂载，模型将看不到任何说明。

适用场景：

- 工具未来可能被直接挂载给模型
- 工具高频、原子、参数边界清晰
- 需要保留从 Skill 入口到直接 Tool 入口的切换能力

### CodeModeOnly 单活

"CodeModeOnly 单活"指工具只作为 Code Mode 的执行底座，不出现在 agent 的 `tools:` 列表中，也不允许被直接挂载调用。模型通过 Skill 学会如何写 `sdk.tool.call(...)`，工具层只负责执行、参数校验和前端展示。

适用场景：

- 能力低频、复杂，主要通过 Skill 按需加载
- 工具数量较多，不希望常驻占用主上下文
- 工具返回数据较大，需要 Code Mode 在执行环境里处理和筛选中间结果
- 不希望模型直接看到供应商、底层接口或内部数据通道

CodeModeOnly 的工具类必须声明：

```python
code_mode_only = True
```

运行时要求：

- 框架会把 `code_mode_only = True` 的工具从 LLM tools 列表中排除
- Code Mode 的 `sdk.tool.call(...)` 仍可调用这些工具
- 如果误把 CodeModeOnly 工具挂到 agent 的 `tools:` 列表，执行层会拦截，工具开发者不需要额外处理
- 对应 Skill 是唯一 Agent-facing 入口，必须完整说明参数、示例、返回结构和常见错误

---

## 为什么保留工具底座

### 1. 前端体验完整保留

工具体系有一套完善的前端展示机制：调用前的动作描述、执行中的详情面板、执行后的结果展示。这些都通过工具类的方法实现，与工具调用深度绑定。

Code Mode 通过服务端路由复用了这套机制——模型写代码调工具，前端看到的是正常的工具调用界面，而不是一段 Python 脚本的执行输出。如果放弃工具体系，改用纯 Skill + 脚本，前端展示就必须重新实现一套。

### 2. 双活工具可灵活切换，无需重构

一个能力的使用频率可能随业务变化：今天是低频复杂工作流，适合 Skill；明天变成高频原子操作，需要直接挂载。

双活机制保证了这种切换的零成本：工具提示词完整 → 直接加进工具列表即可，无需补写说明；Skill 完整 → 保持 Code Mode 路径不变。两个方向随时可切，互不影响。

CodeModeOnly 单活不承诺这种切换能力。若未来要改成可直接挂载，必须补齐工具 docstring、参数 description、`get_prompt_hint()`，并移除 `code_mode_only = True`。

### 3. 两套信息服务不同读者，且互不相通

| | 读者 | 触发时机 |
|--|--|--|
| Tool 提示词（docstring、description、prompt hint） | 模型 | 工具出现在 agent 的 tools 列表中 |
| Skill 文件（SKILL.md 及 reference） | 模型 | 主动读取 Skill，或通过 preload 注入系统提示词 |

两套信息面向同一个使用场景（调用这个工具），但触发时机不同，读者的信息来源不同，因此必须各自完整，不能相互依赖。

**关键：这两条路径的信息在运行时完全隔离。**

| 信息来源 | 属于哪套系统 | 工具在 tools 列表时 | Skill 被读取或 preload 时 |
|---------|------------|:---:|:---:|
| `get_prompt_hint()` 返回值 | Tool 层（Python 方法） | 是 | 否 |
| `Field(description=...)` | Tool 层（Python 参数定义） | 是 | 否 |
| SKILL.md 正文 | Skill 层 | 否 | 是 |
| `reference/*.md` | Skill 层（Markdown 文档） | 否 | 是 |

**关于 preload：** `.agent` 文件的 `skills.preload` 字段支持通过 `files` 指定 Skill 目录下的任意文件，SKILL.md 和 `reference/` 下的文档均可 preload，内容会在 agent 启动时直接注入系统提示词，无需模型主动读取。示例：

```yaml
skills:
  preload:
    - name: canvas-designer
      files:
        - SKILL.md
        - reference/image-search.md
```

**常见误用：** 某个工具的参数格式复杂（如 XML），开发者以为"在 `get_prompt_hint()` 里写清楚就够了"——但 `get_prompt_hint()` 只在工具出现在 tools 列表时才对模型可见，如果这个工具是通过 Skill 调用的，模型根本看不到。正确做法是把说明写进 SKILL.md 或 `reference/` 里对应的文件。反过来，把本应写进 SKILL.md 的内容塞进 `get_prompt_hint()`，在 Skill 路径下同样无效。

---

## 操作要求

### 双活工具

将一个工具从直接挂载迁移到 Skill + Code Mode，且仍可能直接挂载时，按以下清单执行。

#### 必须迁移到 SKILL.md 的内容

以下内容在 Code Mode 下不会自动进入模型上下文，必须手动整合进 SKILL.md（或其 reference 文件）：

- **工具的整体用途**：对应 `@tool()` 的 docstring 或工具类的 class docstring
- **每个参数的语义**：对应 `Field(description=...)` 的完整说明
- **工具的使用约束和注意事项**：对应 `get_prompt_hint()` 的返回内容
- **正确的调用方式**：代码示例，包括参数构造方式、返回值处理方式
- **边界条件和常见错误**：任何"不填/填错会出问题"的参数行为

#### 必须在 Tool 层保持完整的内容

以下内容不因迁移到 Skill 而减少：

- `@tool()` 的 docstring（工具核心用途描述）
- 所有参数的 `Field(description=...)`（参数语义完整说明）
- `get_prompt_hint()` 返回内容（高层工作流指引）
- `get_before_tool_call_friendly_action_and_remark()`（调用前的前端展示）
- `get_before_tool_detail()` 和 `get_tool_detail()`（执行前后的详情展示）

**判断标准**：假设有人把这个工具直接挂载给模型，模型仅凭工具定义能否正确理解和使用它？如果不能，说明工具层的提示词不完整。

#### 禁止的做法

- 把 `get_prompt_hint()` 的内容清空，只保留一句"详见 SKILL.md"
- 删除参数的 `description`，理由是"Skill 里写了"
- 工具的 docstring 只写"由 Skill 调用，不需要说明"

这些做法会破坏双活机制，导致工具只能通过 Skill 使用，失去直接挂载的能力。

### CodeModeOnly 工具

CodeModeOnly 工具只服务 Code Mode，不维护直接挂载入口。实现时按以下清单执行：

- 工具类声明 `code_mode_only = True`
- Tool 层保留执行逻辑、参数校验、`get_before_tool_call_friendly_action_and_remark()`、`get_before_tool_detail()`、`get_tool_detail()`
- Tool 层的 docstring 和参数 description 保留必要语义即可，不需要为直接挂载场景写完整教学提示
- Skill 中必须完整写明工具用途、参数、返回值、代码示例、边界条件和常见错误
- 如果工具会被直接挂载给模型，不能使用 CodeModeOnly，必须改走双活

判断标准：如果模型不读 Skill，只看工具定义，是否应该能使用这个工具？如果答案是"应该"，它不是 CodeModeOnly；如果答案是"不应该，必须先读 Skill"，它可以是 CodeModeOnly。

---

## 信息重复与收缩策略

双活机制必然导致同一段信息出现在两个地方：SKILL.md 里写一遍工具参数，Tool 的 `Field(description=...)` 里也写一遍。

这种重复是有意为之的，不是设计失误。原因：

- 两套信息服务不同的触发场景，一个场景失效不影响另一个
- 重复的成本是维护时需要同步更新两处；不重复的代价是某一个场景下模型完全失明
- 如果某个工具确认永久不再直接挂载，应明确标记 `code_mode_only = True`，再压缩工具层提示词

---

## 与市场通行做法的对比

| | 通行做法 | 本项目双活 | 本项目 CodeModeOnly |
|--|--|--|--|
| Skill 迁移后工具的角色 | 工具废弃或退化为内部函数 | 工具作为执行底座 + 直接挂载备用 | 工具只作为 Code Mode 执行底座 |
| 前端展示 | 需要重新实现展示层 | 完整继承工具展示体系 | 完整继承工具展示体系 |
| 能力切换成本 | 高 | 低 | 高，切换前需补齐工具提示词 |
| 提示词维护 | 只维护 Skill | Skill 和 Tool 两处都完整维护 | Skill 完整维护，Tool 保留必要执行说明 |
| 灵活性 | 固定为 Skill 路径 | 可随时直接挂载 | 明确禁止直接挂载 |
