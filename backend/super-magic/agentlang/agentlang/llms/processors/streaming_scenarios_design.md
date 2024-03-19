# 流式处理场景设计文档

## 1. 概述

本文档整理了流式处理中的各种场景，明确每种场景的处理流程和事件触发顺序。

### 问题与修复方案

**现有 Bug**：当前实现中，BEFORE_AGENT_THINK 在 agent.py 每轮 loop 开始时就触发，但此时并不知道本次 LLM 调用是否会返回 reasoning_content。这导致：
1. 即使 LLM 不返回 reasoning_content，也会触发 BEFORE_AGENT_THINK
2. 在多轮场景中，每次 loop 都会触发 BEFORE_AGENT_THINK，但并非每次都有思考
3. 没有考虑思考边界：在一次思考过程中（通过工具调用持续多轮），会重复触发 BEFORE_AGENT_THINK
4. 事件语义不匹配："开始思考"应该在真正有思考内容时才触发，且一次思考只触发一次

**正确的设计**：BEFORE_AGENT_THINK 应该在收到 reasoning_content 且当前没有进行中的思考时触发
- **触发时机**：在流式/非流式处理中，收到 reasoning_content 时
- **触发条件**：`agent_context.get_thinking_correlation_id()` 返回 None（表示当前没有进行中的思考）
- **触发位置**：流式处理器或非流式处理器中
- **思考边界**：一次思考从 BEFORE_AGENT_THINK 开始，到 AFTER_AGENT_THINK 结束，期间使用同一个 correlation_id
- **影响范围**：所有场景的 BEFORE_AGENT_THINK 触发逻辑都需要调整

**修复实现**：
1. **ThinkEventManager（核心封装）**：
   - 在 `trigger_before_think` 内部封装思考边界判断
   - 自动检查 `agent_context.get_thinking_correlation_id()` 是否存在
   - 如果存在（思考进行中），跳过触发，返回现有 correlation_id
   - 外部调用时无需判断，直接调用即可
2. **流式处理器**：
   - 在收到 reasoning_content 时，直接调用 `ThinkEventManager.trigger_before_think()`
   - 在流结束时，补充 AFTER_AGENT_THINK 触发（覆盖"只有 reasoning"和"reasoning + tool_calls"场景）
3. **非流式处理器**：
   - 在检测到 reasoning_content 时，直接调用 `ThinkEventManager.trigger_before_think()`
   - 在处理结束时，补充 AFTER_AGENT_THINK 触发（覆盖"只有 reasoning"和"reasoning + tool_calls"场景）
4. **agent.py**：
   - 移除每轮 loop 开始时的 `ThinkEventManager.trigger_before_think()` 调用
   - 移除 finally 中的保底 `trigger_after_think()` 调用（不再需要）
5. **关键改进**：
   - **思考边界判断内部化**：判断逻辑封装在 ThinkEventManager 内部
   - **场景完整覆盖**：处理器结束时补充触发，覆盖所有场景
   - **无保底依赖**：所有场景都在处理器内部完整处理
   - **事件配对保证**：只有触发了 BEFORE_AGENT_THINK 的场景才触发 AFTER_AGENT_THINK
   - **无思考场景**：只有 content 或 tool_calls 的场景不触发任何 THINK 事件

### 1.1 核心概念

| 概念 | 说明 |
|------|------|
| `reasoning_content` | 思考内容（思考模型特有） |
| `content` | 回复内容 |
| `tool_calls` | 工具调用 |
| `content_type` | 内容类型：`"reasoning"` 或 `"content"` |

### 1.2 流式状态标记

| 状态 | 值 | 说明 |
|------|-----|------|
| 流式开始 | status=0 | 标记一段流式输出的开始 |
| 流式进行中 | status=1 | 流式输出中的每个 chunk |
| 流式结束 | status=2 | 标记一段流式输出的结束 |

### 1.3 关键状态变量

```python
# 流式处理状态（局部变量）
streaming_started = False           # 当前流式输出是否已开始（开始标记已发送）
streaming_content_type = None       # 当前流式输出的类型: "reasoning" | "content"
before_reply_triggered = False      # before_agent_reply 是否已触发
after_think_sent = False            # AFTER_AGENT_THINK 是否已发送（本次流式处理中）

# 累积内容
reasoning_text = ""                 # 累积的思考内容
content_text = ""                   # 累积的回复内容
```

### 1.4 思考边界概念

**什么是思考边界**：
- **思考开始**：触发 BEFORE_AGENT_THINK，生成 correlation_id
- **思考进行**：使用同一个 correlation_id 的所有操作（可能跨越多轮 loop）
- **思考结束**：触发 AFTER_AGENT_THINK，清空 correlation_id

**思考边界的判断**：
```python
# 判断是否有进行中的思考
has_ongoing_thinking = agent_context.get_thinking_correlation_id() is not None

# 如果为 None → 没有进行中的思考 → 可以开始新思考
# 如果不为 None → 有进行中的思考 → 继续当前思考
```

**典型场景**：

| 场景 | Loop 1 | Loop 2 | Loop 3 | 说明 |
|------|--------|--------|--------|------|
| 一次长思考 | BEFORE_THINK<br/>reasoning → tool | reasoning → tool | reasoning → content<br/>AFTER_THINK | 三轮共用一个 correlation_id |
| 两次独立思考 | BEFORE_THINK<br/>reasoning → content<br/>AFTER_THINK | BEFORE_THINK<br/>reasoning → content<br/>AFTER_THINK | - | 每次思考独立的 correlation_id |
| 无思考 | content only | - | - | 不触发任何 THINK 事件 |

### 1.5 AgentContext 思考状态管理

```python
# agent_context 中的状态（跨方法共享）
thinking_correlation_id: Optional[str]  # THINK 事件的 correlation_id
thinking_start_time: Optional[float]    # 思考开始时间
is_thinking_flag: bool                  # 是否有 reasoning_content（由流式处理设置）
```

**状态管理方法**：

| 方法 | 调用时机 | 说明 |
|------|---------|------|
| `set_thinking_correlation_id(id)` | `trigger_before_think()` 内部 | 存储 correlation_id 和开始时间 |
| `get_thinking_correlation_id()` | `trigger_before_think()` 和 `trigger_after_think()` 内部 | 检查是否有进行中的思考（None=无思考） |
| `reset_thinking_state()` | `trigger_after_think()` 内部 | 清空 correlation_id 和开始时间 |

**ThinkEventManager 正确的调用流程**：

```python
# 1. 流式/非流式处理中检测到 reasoning_content
if reasoning_content:
    # 直接调用 trigger_before_think，内部会自动检查思考边界
    await ThinkEventManager.trigger_before_think(agent_context, model_id, model_name)
    # 内部逻辑：
    #   - 检查 agent_context.get_thinking_correlation_id() 是否存在
    #   - 如果不存在（没有进行中的思考）：
    #       -> 触发 BEFORE_AGENT_THINK 事件
    #       -> agent_context.set_thinking_correlation_id(correlation_id)
    #       -> 返回新生成的 correlation_id
    #   - 如果存在（思考进行中）：
    #       -> 跳过触发，直接返回现有的 correlation_id

# 2. 流式处理中检测到 content（或处理结束时）
await ThinkEventManager.trigger_after_think(agent_context, model_id, model_name)
# 内部逻辑：
#   - 检查 agent_context.get_thinking_correlation_id() 是否存在
#   - 如果不存在 -> 返回 False（已触发过或未触发 BEFORE）
#   - 如果存在 -> 触发事件，调用 reset_thinking_state()（思考结束，清空 correlation_id）
```

**关键要点**：
- **思考边界判断**：`trigger_before_think` 内部自动检查 `agent_context.get_thinking_correlation_id()`
- **外部调用简化**：外部调用时无需判断，直接调用即可，内部自动处理
- **避免重复触发**：如果 correlation_id 已存在（思考进行中），内部自动跳过
- **思考结束清理**：AFTER_AGENT_THINK 内部会调用 `reset_thinking_state()` 清空 correlation_id
- **没有思考的场景**：没有 reasoning_content 的场景不触发 BEFORE_AGENT_THINK

---

## 2. 单次 LLM 调用场景

### 场景一：只有思考内容 (reasoning_content only)

**触发条件**：LLM 只返回 `reasoning_content`，无 `content` 和 `tool_calls`

**实际场景**：较少见，可能是思考模型的异常情况

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ 1. 收到第一个非空 reasoning_content chunk                    │
│    ├── 触发 BEFORE_AGENT_THINK  ← 首次检测到思考内容        │
│    │   └── set_thinking_correlation_id(correlation_id)       │
│    ├── 触发 before_agent_reply(content_type=reasoning)       │
│    ├── 发送流式开始标记(status=0, content_type=reasoning)    │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ 2. 继续收到 reasoning_content chunks                         │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ 3. 流结束                                                    │
│    ├── 发送流式结束标记(status=2, content_type=reasoning)    │
│    ├── 触发 after_agent_reply(content_type=reasoning)        │
│    │                                                          │
│    └── 处理器收尾：触发 AFTER_AGENT_THINK                    │
│        └── ThinkEventManager.trigger_after_think()           │
│            ├── 检查 correlation_id 存在 → 执行触发           │
│            └── reset_thinking_state() 重置所有状态           │
└─────────────────────────────────────────────────────────────┘
```

### 场景二：只有回复内容 (content only)

**触发条件**：LLM 只返回 `content`，无 `reasoning_content` 和 `tool_calls`

**实际场景**：普通模型的正常回复

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ 1. 收到第一个非空 content chunk（无思考过程）                │
│    ├── 无 reasoning_content，不触发任何 THINK 事件           │
│    ├── 触发 before_agent_reply(content_type=content)         │
│    ├── 发送流式开始标记(status=0, content_type=content)      │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 2. 继续收到 content chunks                                   │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 3. 流结束                                                    │
│    ├── 发送流式结束标记(status=2, content_type=content)      │
│    └── 触发 after_agent_reply(content_type=content)          │
│                                                              │
│ 注意：无 reasoning_content，不触发任何 THINK 事件            │
└─────────────────────────────────────────────────────────────┘
```

### 场景三：只有工具调用 (tool_calls only)

**触发条件**：LLM 只返回 `tool_calls`，无 `reasoning_content` 和 `content`

**实际场景**：模型决定直接调用工具，无需回复用户

**关键点**：没有 reasoning_content，不触发任何 THINK 事件

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ 1. 收到 tool_calls 信息                                      │
│    ├── 无 reasoning_content，不触发任何 THINK 事件           │
│    └── 组装 tool_calls 参数（无需发送流式消息）              │
│                                                              │
│ 2. 流结束                                                    │
│    └── 返回组装好的 tool_calls                               │
│                                                              │
│ 注意：无 reasoning_content，不触发任何 THINK 事件            │
│ 注意：无文本内容，不触发 before/after_agent_reply            │
└─────────────────────────────────────────────────────────────┘
```

### 场景四：先思考，再返回工具 (reasoning_content -> tool_calls)

**触发条件**：LLM 先返回 `reasoning_content`，然后返回 `tool_calls`

**实际场景**：思考模型思考后决定调用工具（工具调用仍属于思考过程）

**关键点**：有 reasoning_content，所以这是真正的思考过程

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ ===== 思考阶段（包含工具调用）=====                          │
│                                                              │
│ 1. 收到第一个非空 reasoning_content chunk                    │
│    ├── 触发 BEFORE_AGENT_THINK  ← 首次检测到思考内容        │
│    │   └── set_thinking_correlation_id(correlation_id)       │
│    ├── 触发 before_agent_reply(content_type=reasoning)       │
│    ├── 发送流式开始标记(status=0, content_type=reasoning)    │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ 2. 继续收到 reasoning_content chunks                         │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ ===== 检测到工具调用（仍在思考中，不触发 AFTER_THINK）=====  │
│                                                              │
│ 3. 收到 tool_calls 信息                                      │
│    ├── 发送流式结束标记(status=2, content_type=reasoning)    │
│    ├── 触发 after_agent_reply(content_type=reasoning)        │
│    ├── 注意：此时不触发 AFTER_THINK（工具调用属于思考过程） │
│    └── 组装 tool_calls 参数                                  │
│                                                              │
│ 4. 流结束                                                    │
│    ├── 返回组装好的 tool_calls                               │
│    │                                                          │
│    └── 处理器收尾：不触发 AFTER_AGENT_THINK                  │
│        （工具调用属于思考过程，思考持续到下一轮）           │
│                                                              │
│ 【下一轮 Agent Loop】                                         │
│    └── 工具执行完后，LLM 继续调用                            │
│        ├── 如果返回 content → 检测到 content 时触发 AFTER_THINK │
│        ├── 如果返回 reasoning → 继续思考（使用相同 correlation_id）│
│        └── 如果返回新 tool_calls → 继续思考                  │
└─────────────────────────────────────────────────────────────┘
```

**重要说明**：
- 有 `reasoning_content` = 真正的思考过程
- 工具调用属于思考过程的一部分，思考会持续到下一轮
- 只有在下一轮检测到 `content` 时，才标志着"思考真正结束"
- `get_thinking_correlation_id()` 有值表示思考进行中，下一轮会继续使用相同的 correlation_id

### 场景五：先回复，再返回工具 (content -> tool_calls)

**触发条件**：LLM 先返回 `content`，然后返回 `tool_calls`

**实际场景**：模型先输出一些内容，然后决定调用工具

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ ===== 回复阶段（直接收到 content = 无思考过程）=====          │
│                                                              │
│ 1. 收到第一个非空 content chunk                              │
│    ├── 无 reasoning_content，不触发任何 THINK 事件           │
│    ├── 触发 before_agent_reply(content_type=content)         │
│    ├── 发送流式开始标记(status=0, content_type=content)      │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 2. 继续收到 content chunks                                   │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ ===== 检测到工具调用 =====                                   │
│                                                              │
│ 3. 收到 tool_calls 信息                                      │
│    ├── 发送流式结束标记(status=2, content_type=content)      │
│    ├── 触发 after_agent_reply(content_type=content)          │
│    └── 组装 tool_calls 参数                                  │
│                                                              │
│ 4. 流结束                                                    │
│    └── 返回组装好的 tool_calls                               │
│                                                              │
│ 注意：无 reasoning_content，不触发任何 THINK 事件            │
└─────────────────────────────────────────────────────────────┘
```

### 场景六：先思考，再回复 (reasoning_content -> content)

**触发条件**：LLM 先返回 `reasoning_content`，然后返回 `content`

**实际场景**：思考模型的标准回复流程

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ ===== 思考阶段 =====                                         │
│                                                              │
│ 1. 收到第一个非空 reasoning_content chunk                    │
│    ├── 触发 BEFORE_AGENT_THINK  ← 首次检测到思考内容        │
│    │   └── set_thinking_correlation_id(correlation_id)       │
│    ├── 触发 before_agent_reply(content_type=reasoning)       │
│    ├── 发送流式开始标记(status=0, content_type=reasoning)    │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ 2. 继续收到 reasoning_content chunks                         │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ ===== 检测到 content，思考结束 =====                         │
│                                                              │
│ 3. 收到第一个非空 content chunk                              │
│    ├── 发送流式结束标记(status=2, content_type=reasoning)    │
│    ├── 触发 after_agent_reply(content_type=reasoning)        │
│    ├── ThinkEventManager.trigger_after_think()  ← 流式中触发 │
│    │   └── reset_thinking_state() 重置状态                   │
│    │                                                         │
│    ├── 触发 before_agent_reply(content_type=content)         │
│    ├── 发送流式开始标记(status=0, content_type=content)      │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 4. 继续收到 content chunks                                   │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 5. 流结束                                                    │
│    ├── 发送流式结束标记(status=2, content_type=content)      │
│    └── 触发 after_agent_reply(content_type=content)          │
│                                                              │
│ 6. agent.py finally 保底调用                                 │
│    └── ThinkEventManager.trigger_after_think()               │
│        └── 检查 correlation_id 不存在 → 跳过（已触发过）     │
└─────────────────────────────────────────────────────────────┘
```

### 场景七：先思考，再回复，最后返回工具 (reasoning_content -> content -> tool_calls)

**触发条件**：LLM 先返回 `reasoning_content`，然后返回 `content`，最后返回 `tool_calls`

**实际场景**：思考模型思考后先回复用户，然后调用工具

```
流程图：
┌─────────────────────────────────────────────────────────────┐
│ ===== 思考阶段 =====                                         │
│                                                              │
│ 1. 收到第一个非空 reasoning_content chunk                    │
│    ├── 触发 BEFORE_AGENT_THINK  ← 首次检测到思考内容        │
│    │   └── set_thinking_correlation_id(correlation_id)       │
│    ├── 触发 before_agent_reply(content_type=reasoning)       │
│    ├── 发送流式开始标记(status=0, content_type=reasoning)    │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ 2. 继续收到 reasoning_content chunks                         │
│    └── 发送流式中消息(status=1, content_type=reasoning)      │
│                                                              │
│ ===== 检测到 content，思考结束 =====                         │
│                                                              │
│ 3. 收到第一个非空 content chunk                              │
│    ├── 发送流式结束标记(status=2, content_type=reasoning)    │
│    ├── 触发 after_agent_reply(content_type=reasoning)        │
│    ├── ThinkEventManager.trigger_after_think()  ← 流式中触发 │
│    │   └── reset_thinking_state() 重置状态                   │
│    │                                                         │
│    ├── 触发 before_agent_reply(content_type=content)         │
│    ├── 发送流式开始标记(status=0, content_type=content)      │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ 4. 继续收到 content chunks                                   │
│    └── 发送流式中消息(status=1, content_type=content)        │
│                                                              │
│ ===== 检测到工具调用 =====                                   │
│                                                              │
│ 5. 收到 tool_calls 信息                                      │
│    ├── 发送流式结束标记(status=2, content_type=content)      │
│    ├── 触发 after_agent_reply(content_type=content)          │
│    └── 组装 tool_calls 参数                                  │
│                                                              │
│ 6. 流结束                                                    │
│    └── 返回组装好的 tool_calls                               │
│                                                              │
│ 7. agent.py finally 保底调用                                 │
│    └── ThinkEventManager.trigger_after_think()               │
│        └── 检查 correlation_id 不存在 → 跳过（已触发过）     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 多轮对话场景

### 重要说明

在多轮对话中，一次"思考+工具+回复"实际上涉及**多次 LLM 调用**：

```
多轮对话流程：
┌───────────────────────────────────────────────────────────────┐
│ Agent Loop 第 1 轮                                            │
│   └── LLM 调用 1: reasoning_content + tool_calls              │
│                                                               │
│ 执行工具调用                                                   │
│                                                               │
│ Agent Loop 第 2 轮                                            │
│   └── LLM 调用 2: reasoning_content + content                 │
│                    或                                          │
│                   content (普通模型)                           │
└───────────────────────────────────────────────────────────────┘
```

### 场景八：多轮对话 - 思考+工具 -> 继续思考+回复

**完整流程**：

```
时间线：
════════════════════════════════════════════════════════════════

【Agent Loop 第 1 轮】

    ├── LLM 调用开始
    │   │
    │   │   # 思考阶段（首次收到 reasoning_content，没有进行中的思考）
    │   ├── BEFORE_AGENT_THINK(correlation_id="think-001")  ← 思考开始
    │   ├── before_agent_reply(content_type=reasoning, parent_correlation_id="think-001")
    │   ├── 流式开始(status=0, content_type=reasoning)
    │   ├── 流式中(status=1, content_type=reasoning): "让我分析一下..."
    │   ├── 流式中(status=1, content_type=reasoning): "需要搜索相关信息..."
    │   │
    │   │   # 检测到工具调用（思考未结束）
    │   ├── 流式结束(status=2, content_type=reasoning)
    │   ├── after_agent_reply(content_type=reasoning, parent_correlation_id="think-001")
    │   │
    │   └── LLM 调用结束（返回 tool_calls）
    │
    │   注意：此时不触发 AFTER_AGENT_THINK，工具调用属于思考过程
    │
    ├── BEFORE_TOOL_CALL(tool_name="web_search", parent_correlation_id="think-001")
    ├── 执行工具...
    └── AFTER_TOOL_CALL(tool_name="web_search", parent_correlation_id="think-001")

════════════════════════════════════════════════════════════════

【Agent Loop 第 2 轮】

    ├── LLM 调用开始
    │   │
    │   │   # 继续思考阶段（收到 reasoning_content，但思考还在进行中）
    │   │   # correlation_id="think-001" 仍然存在，不触发新的 BEFORE_AGENT_THINK
    │   ├── before_agent_reply(content_type=reasoning, parent_correlation_id="think-001")
    │   ├── 流式开始(status=0, content_type=reasoning)
    │   ├── 流式中(status=1, content_type=reasoning): "根据搜索结果..."
    │   ├── 流式结束(status=2, content_type=reasoning)
    │   ├── after_agent_reply(content_type=reasoning, parent_correlation_id="think-001")
    │   │
    │   │   # 回复阶段（收到 content，思考结束）
    │   ├── AFTER_AGENT_THINK(correlation_id="think-001", is_thinking=True)  ← 思考结束
    │   ├── before_agent_reply(content_type=content, parent_correlation_id="think-001")
    │   ├── 流式开始(status=0, content_type=content)
    │   ├── 流式中(status=1, content_type=content): "根据我的搜索..."
    │   ├── 流式中(status=1, content_type=content): "结果如下..."
    │   ├── 流式结束(status=2, content_type=content)
    │   ├── after_agent_reply(content_type=content, parent_correlation_id="think-001")
    │   │
    │   └── LLM 调用结束
    │
    └── Agent Loop 结束

════════════════════════════════════════════════════════════════
```

**关键要点**：
- **思考边界**：一次思考从 BEFORE_AGENT_THINK 开始，到 AFTER_AGENT_THINK 结束
- **思考持续**：第 1 轮触发 BEFORE_AGENT_THINK 后，只要没触发 AFTER_AGENT_THINK，思考就还在继续
- **不重复触发**：第 2 轮虽然有 reasoning_content，但因为 correlation_id 还存在（思考未结束），所以不会再次触发 BEFORE_AGENT_THINK
- **同一次思考**：两轮使用同一个 correlation_id="think-001"，表示这是同一次思考过程
- **工具调用属于思考**：调用工具不会结束思考，只有收到 content 才结束

### 场景九：多轮工具调用 - 一次长思考过程

**完整流程**：

```
时间线：
════════════════════════════════════════════════════════════════

【Agent Loop 第 1 轮】

LLM 调用：
    ├── 收到 reasoning_content，没有进行中的思考
    ├── 触发 BEFORE_AGENT_THINK(correlation_id="think-001")  ← 思考开始
    ├── 思考: "我需要先搜索..."
    ├── 流式输出思考内容
    └── 返回 tool_calls（思考未结束）

    ├── 工具调用: web_search
    └── 执行工具

════════════════════════════════════════════════════════════════

【Agent Loop 第 2 轮】

LLM 调用：
    ├── 收到 reasoning_content，但思考还在进行中（correlation_id="think-001" 存在）
    ├── 不触发 BEFORE_AGENT_THINK（继续同一次思考）
    ├── 思考: "搜索结果不够，需要进一步查询..."
    ├── 流式输出思考内容（parent_correlation_id="think-001"）
    └── 返回 tool_calls（思考未结束）

    ├── 工具调用: read_file
    └── 执行工具

════════════════════════════════════════════════════════════════

【Agent Loop 第 3 轮】

LLM 调用：
    ├── 收到 reasoning_content，但思考还在进行中（correlation_id="think-001" 存在）
    ├── 不触发 BEFORE_AGENT_THINK（继续同一次思考）
    ├── 思考: "现在我有足够的信息了..."
    ├── 流式输出思考内容（parent_correlation_id="think-001"）
    ├── 检测到 content，触发 AFTER_AGENT_THINK(correlation_id="think-001")  ← 思考结束
    ├── 回复: "根据我的分析..."
    ├── 流式输出回复内容
    └── Agent Loop 结束

════════════════════════════════════════════════════════════════
```

**关键要点**：
- **一次完整的思考**：三轮 loop 实际上是一次完整的思考过程，只触发一次 BEFORE_AGENT_THINK
- **思考边界**：从第 1 轮的 BEFORE_AGENT_THINK 到第 3 轮的 AFTER_AGENT_THINK
- **同一个 correlation_id**：三轮都使用 correlation_id="think-001"
- **持续思考**：第 2、3 轮虽然有 reasoning_content，但因为思考还在进行中，不会再次触发 BEFORE_AGENT_THINK
- **思考结束条件**：只有收到 content 才标志着思考结束

### 场景十：多次独立思考 - 思考+回复 -> 思考+回复

**完整流程**：

```
时间线：
════════════════════════════════════════════════════════════════

【Agent Loop 第 1 轮】

LLM 调用：
    ├── 收到 reasoning_content，没有进行中的思考
    ├── 触发 BEFORE_AGENT_THINK(correlation_id="think-001")  ← 第一次思考开始
    ├── 思考: "让我分析一下用户的问题..."
    ├── 流式输出思考内容
    ├── 检测到 content，触发 AFTER_AGENT_THINK(correlation_id="think-001")  ← 第一次思考结束
    ├── 回复: "我需要更多信息才能回答，请问..."
    ├── 流式输出回复内容
    └── LLM 调用结束

════════════════════════════════════════════════════════════════

【用户提供更多信息】

════════════════════════════════════════════════════════════════

【Agent Loop 第 2 轮】

LLM 调用：
    ├── 收到 reasoning_content，没有进行中的思考（上一次已结束）
    ├── 触发 BEFORE_AGENT_THINK(correlation_id="think-002")  ← 第二次思考开始
    ├── 思考: "根据用户补充的信息..."
    ├── 流式输出思考内容
    ├── 检测到 content，触发 AFTER_AGENT_THINK(correlation_id="think-002")  ← 第二次思考结束
    ├── 回复: "明白了，答案是..."
    ├── 流式输出回复内容
    └── Agent Loop 结束

════════════════════════════════════════════════════════════════
```

**关键要点**：
- **两次独立的思考**：每次都有完整的 BEFORE_AGENT_THINK 和 AFTER_AGENT_THINK
- **思考已结束**：第 1 轮触发了 AFTER_AGENT_THINK，correlation_id 被清空
- **新的思考**：第 2 轮检测到没有进行中的思考，触发新的 BEFORE_AGENT_THINK
- **不同的 correlation_id**：两次思考分别使用 "think-001" 和 "think-002"

---

## 4. 统一处理逻辑（伪代码）

### 4.1 核心处理函数

```python
async def process_stream_chunks(stream, agent_context, model_id, model_name, ...):
    """处理流式响应的核心函数"""

    # ===== 状态初始化 =====
    reasoning_text = ""
    content_text = ""
    tool_calls = {}

    # 流式输出状态
    current_streaming_type = None    # 当前正在流式输出的类型: "reasoning" | "content"
    streaming_started = False        # 当前类型的流式是否已开始

    # 事件状态
    reasoning_reply_started = False  # reasoning 的 before_reply 是否已触发
    content_reply_started = False    # content 的 before_reply 是否已触发
    after_think_sent = False         # AFTER_AGENT_THINK 是否已发送

    # parent_correlation_id 初始为 None
    # 会在触发 BEFORE_AGENT_THINK 时设置，或从 agent_context 获取已存在的值
    parent_correlation_id = None

    async for chunk in stream:
        # 解析 chunk
        reasoning_content = get_reasoning_content(chunk)
        content = get_content(chunk)
        has_tool_call = has_tool_calls(chunk)

        # ===== 处理 reasoning_content =====
        if reasoning_content:
            # 检查是否需要触发 BEFORE_AGENT_THINK
            # 条件：当前没有进行中的思考（correlation_id 不存在）
            if not agent_context.get_thinking_correlation_id():
                await ThinkEventManager.trigger_before_think(
                    agent_context=agent_context,
                    model_id=model_id,
                    model_name=model_name
                )

            # 获取 parent_correlation_id（可能是刚创建的，也可能是之前就存在的）
            if not parent_correlation_id:
                parent_correlation_id = agent_context.get_thinking_correlation_id()

            # 首次收到思考内容
            if not reasoning_reply_started:
                await trigger_before_agent_reply(content_type="reasoning", parent_correlation_id)
                reasoning_reply_started = True

            # 开始流式输出（如果还没开始）
            if current_streaming_type != "reasoning":
                if current_streaming_type is not None:
                    # 先结束之前的流式输出（不应该发生）
                    await send_stream_end(current_streaming_type)
                await send_stream_start(content_type="reasoning")
                current_streaming_type = "reasoning"
                streaming_started = True

            # 发送流式中消息
            reasoning_text += reasoning_content
            await send_stream_chunk(content=reasoning_content, content_type="reasoning")
            continue

        # ===== 处理 content（思考结束的唯一标志）=====
        if content:
            # 如果之前在输出思考内容，需要先结束思考
            if current_streaming_type == "reasoning":
                # 1. 结束 reasoning 流式输出
                await send_stream_end(content_type="reasoning")
                await trigger_after_agent_reply(content_type="reasoning", parent_correlation_id)

                # 2. 重置流式状态
                current_streaming_type = None
                streaming_started = False

            # 3. 检测到 content = 思考结束，触发 AFTER_AGENT_THINK
            if not after_think_sent:
                await trigger_after_agent_think(
                    is_thinking=agent_context.is_thinking(),  # 之前是否有 reasoning
                    reasoning_content=reasoning_text
                )
                after_think_sent = True

            # 首次收到回复内容
            if not content_reply_started:
                await trigger_before_agent_reply(content_type="content", parent_correlation_id)
                content_reply_started = True

            # 开始 content 流式输出
            if current_streaming_type != "content":
                await send_stream_start(content_type="content")
                current_streaming_type = "content"
                streaming_started = True

            # 发送流式中消息
            content_text += content
            await send_stream_chunk(content=content, content_type="content")
            continue

        # ===== 处理 tool_calls =====
        if has_tool_call:
            # 如果有正在进行的流式输出，先结束
            if streaming_started and current_streaming_type:
                await send_stream_end(content_type=current_streaming_type)

                if current_streaming_type == "reasoning":
                    await trigger_after_agent_reply(content_type="reasoning", parent_correlation_id)
                elif current_streaming_type == "content":
                    await trigger_after_agent_reply(content_type="content", parent_correlation_id)

                streaming_started = False
                current_streaming_type = None

            # 注意：没有 reasoning_content 就不会触发 BEFORE_AGENT_THINK
            # 因此也不需要触发 AFTER_AGENT_THINK

            # 组装 tool_calls
            process_tool_call(chunk, tool_calls)

    # ===== 流结束后的收尾处理 =====

    # 1. 如果还有未结束的流式输出
    if streaming_started and current_streaming_type:
        await send_stream_end(content_type=current_streaming_type)

        if current_streaming_type == "reasoning":
            await trigger_after_agent_reply(content_type="reasoning", parent_correlation_id)
        elif current_streaming_type == "content":
            await trigger_after_agent_reply(content_type="content", parent_correlation_id)

    # 2. 保底：如果 AFTER_AGENT_THINK 未发送
    # 注意：实际代码中，AFTER_AGENT_THINK 通常在 agent.py 的 finally 中保底触发

    return (reasoning_text, content_text, tool_calls)
```

### 4.2 辅助函数

```python
async def send_stream_start(content_type: str):
    """发送流式开始标记 (status=0)"""
    chunk_data = ChunkData(
        delta=ChunkDelta(status=0),
        metadata=ChunkMetadata(content_type=content_type)
    )
    await streaming_driver.push(chunk_data)


async def send_stream_chunk(content: str, content_type: str):
    """发送流式中消息 (status=1)"""
    chunk_data = ChunkData(
        content=content,
        delta=ChunkDelta(status=1),
        metadata=ChunkMetadata(content_type=content_type)
    )
    await streaming_driver.push(chunk_data)


async def send_stream_end(content_type: str):
    """发送流式结束标记 (status=2)"""
    chunk_data = ChunkData(
        delta=ChunkDelta(status=2),
        metadata=ChunkMetadata(content_type=content_type)
    )
    await streaming_driver.push(chunk_data)


async def trigger_before_agent_reply(content_type: str, parent_correlation_id: str):
    """触发 before_agent_reply 事件"""
    await agent_context.dispatch_event(
        EventType.BEFORE_AGENT_REPLY,
        BeforeAgentReplyEventData(
            content_type=content_type,
            parent_correlation_id=parent_correlation_id
        )
    )


async def trigger_after_agent_reply(content_type: str, parent_correlation_id: str):
    """触发 after_agent_reply 事件"""
    await agent_context.dispatch_event(
        EventType.AFTER_AGENT_REPLY,
        AfterAgentReplyEventData(
            content_type=content_type,
            parent_correlation_id=parent_correlation_id
        )
    )


async def trigger_after_agent_think(is_thinking: bool, reasoning_content: str):
    """触发 AFTER_AGENT_THINK 事件"""
    await agent_context.dispatch_event(
        EventType.AFTER_AGENT_THINK,
        AfterAgentThinkEventData(
            is_thinking=is_thinking,
            reasoning_content=reasoning_content
        )
    )
```

---

## 5. 场景对照表

| 场景 | reasoning | content | tool | 流式输出 | BEFORE_THINK 触发 | AFTER_THINK 触发位置 | is_thinking |
|------|-----------|---------|------|---------|------------------|---------------------|-------------|
| 一 | ✅ | ❌ | ❌ | 1 (reasoning) | 首次收到 reasoning | finally 保底 | true |
| 二 | ❌ | ✅ | ❌ | 1 (content) | 不触发 | 不触发 | N/A |
| 三 | ❌ | ❌ | ✅ | 0 | 不触发 | 不触发 | N/A |
| 四 | ✅ | ❌ | ✅ | 1 (reasoning) | 首次收到 reasoning | finally 保底 | true |
| 五 | ❌ | ✅ | ✅ | 1 (content) | 不触发 | 不触发 | N/A |
| 六 | ✅ | ✅ | ❌ | 2 | 首次收到 reasoning | 流式中（检测到 content） | true |
| 七 | ✅ | ✅ | ✅ | 2 | 首次收到 reasoning | 流式中（检测到 content） | true |

**触发规则总结**：

**BEFORE_AGENT_THINK 触发**：
- **触发时机**：首次收到非空 `reasoning_content` 时立即触发
- **触发位置**：流式处理器或非流式处理器中
- **触发次数**：每次 LLM 返回 reasoning_content 都会触发一次（多轮场景会触发多次）
- **不触发情况**：没有 reasoning_content 的场景（场景二、三、五）不触发

**AFTER_AGENT_THINK 触发**：
- **流式中触发（content）**：检测到 `content` 时立即触发（`content` 是思考结束的唯一标志）
- **finally 保底调用**：agent.py finally 中一定会调用 `trigger_after_think`，但内部会判断是否已触发过
- **不触发情况**：未触发 BEFORE_AGENT_THINK 的场景不会触发 AFTER_AGENT_THINK
- **关键理解**：
  - 有 `reasoning_content` + 工具调用 = 真正的思考过程（is_thinking=true）
  - 工具调用后必须等待下一轮 LLM 返回 `content` 才算思考真正结束
  - 只有 content 或只有 tool_calls 的场景 = 不触发任何 THINK 事件

**实现机制**：
```python
# 流式处理器中
if reasoning_content and not before_think_triggered:
    await ThinkEventManager.trigger_before_think(...)
    before_think_triggered = True

# agent.py finally 中一定会调用
await ThinkEventManager.trigger_after_think(...)

# ThinkEventManager 内部判断
if not agent_context.get_thinking_correlation_id():
    # correlation_id 不存在 = 未触发 BEFORE 或已触发过 AFTER，跳过
    return False
# 否则执行实际触发
```

### 5.1 非流式模式的处理逻辑

非流式模式下，LLM 响应一次性返回，事件触发逻辑与流式模式保持一致：

| 场景 | reasoning | content | tool | REPLY 事件 | AFTER_THINK 触发 |
|------|-----------|---------|------|-----------|-----------------|
| 一 | ✅ | ❌ | ❌ | reasoning REPLY | finally 保底 |
| 二 | ❌ | ✅ | ❌ | content REPLY | 响应处理中 |
| 三 | ❌ | ❌ | ✅ | 无 | finally 保底 |
| 四 | ✅ | ❌ | ✅ | reasoning REPLY | finally 保底 |
| 五 | ❌ | ✅ | ✅ | content REPLY | 响应处理中 |
| 六 | ✅ | ✅ | ❌ | reasoning + content REPLY | 响应处理中 |
| 七 | ✅ | ✅ | ✅ | reasoning + content REPLY | 响应处理中 |

**非流式处理伪代码**：

```python
async def _trigger_response_events(response, agent_context, model_id, model_name, ...):
    """非流式响应事件触发"""
    message = response.choices[0].message

    # 提取内容
    reasoning_content = getattr(message, 'reasoning_content', None)
    content = message.content
    has_tool_calls = bool(message.tool_calls)

    has_reasoning = bool(reasoning_content and reasoning_content.strip())
    has_content = bool(content and content.strip())

    # ===== 处理 reasoning_content =====
    if has_reasoning:
        # 1. 触发 BEFORE_AGENT_THINK
        await ThinkEventManager.trigger_before_think(
            agent_context=agent_context,
            model_id=model_id,
            model_name=model_name
        )

        # 2. 标记有思考内容

        # 3. 触发 REPLY 事件 (content_type=reasoning)
        parent_correlation_id = agent_context.get_thinking_correlation_id()
        await ReplyEventManager.trigger_before_reply(..., content_type="reasoning", parent_correlation_id)
        await ReplyEventManager.trigger_after_reply(..., content_type="reasoning", parent_correlation_id)

    # ===== 处理 content（思考结束的唯一标志）=====
    if has_content:
        # 1. 如果之前有思考，触发 AFTER_AGENT_THINK
        if has_reasoning:
            await ThinkEventManager.trigger_after_think(...)

        # 2. 触发 REPLY 事件 (content_type=content)
        parent_correlation_id = agent_context.get_thinking_correlation_id() if has_reasoning else None
        await ReplyEventManager.trigger_before_reply(..., content_type="content", parent_correlation_id)
        await ReplyEventManager.trigger_after_reply(..., content_type="content", parent_correlation_id)

    # ===== 只有 tool_calls 的情况 =====
    # 没有 reasoning_content，不触发任何 THINK 事件
    # 注意：不触发 REPLY 事件（无文本内容）
```

**非流式与流式的区别**：
1. **无需流式状态管理**：不需要 `StreamingState` 状态跟踪
2. **无需发送流式消息**：不调用 `send_stream_start/chunk/end`
3. **事件立即触发**：响应返回后立即触发所有相关事件
4. **事件顺序相同**：遵循与流式相同的事件触发顺序（reasoning REPLY → AFTER_THINK → content REPLY）

---

## 6. 关键设计要点

### 6.1 状态转换规则

**BEFORE_AGENT_THINK 触发规则**：
1. **触发条件**：收到 reasoning_content **且** 当前没有进行中的思考（`agent_context.get_thinking_correlation_id()` 返回 None）
2. **判断依据**：通过检查 `correlation_id` 是否存在来判断是否有进行中的思考
3. **无 reasoning_content**：不触发 BEFORE_AGENT_THINK（场景二、三、五）
4. **多轮场景**：
   - 如果上一轮触发了 AFTER_AGENT_THINK（思考已结束），本轮可以触发新的 BEFORE_AGENT_THINK
   - 如果上一轮没有触发 AFTER_AGENT_THINK（思考仍在进行），本轮不触发 BEFORE_AGENT_THINK，继续使用同一个 correlation_id

**AFTER_AGENT_THINK 触发规则**：
1. **reasoning -> content**：先结束 reasoning 流式，触发 AFTER_AGENT_THINK（流式中），再开始 content 流式
2. **reasoning -> tool**：先结束 reasoning 流式，**不触发** AFTER_AGENT_THINK（工具调用仍属于思考）
3. **content -> tool**：不涉及 THINK 事件（无 reasoning_content）
4. **only reasoning**：流结束后由 finally 保底触发 AFTER_AGENT_THINK（is_thinking=true）
5. **only tool**：不触发任何 THINK 事件（无 reasoning_content）
6. **only content**：不触发任何 THINK 事件（无 reasoning_content）
7. **reasoning + tool**：流结束后由 finally 保底触发 AFTER_AGENT_THINK（is_thinking=true）

**核心原则**：
- **思考开始**：收到 `reasoning_content` 且当前没有进行中的思考时，触发 BEFORE_AGENT_THINK
- **思考结束**：收到 `content` 时，触发 AFTER_AGENT_THINK
- **思考持续**：工具调用属于思考过程，不结束思考；后续轮次的 reasoning_content 也属于同一次思考
- **思考边界**：一次思考从 BEFORE_AGENT_THINK 开始，到 AFTER_AGENT_THINK 结束，期间共用同一个 correlation_id
- **无思考场景**：没有 reasoning_content = 没有思考 = 不触发任何 THINK 事件

### 6.2 事件触发原则

1. **BEFORE_AGENT_THINK**：在首次收到非空 reasoning_content 时触发
2. **before_agent_reply**：在每种类型的第一个非空 chunk 到来时触发
3. **after_agent_reply**：在每种类型的流式结束时触发
4. **AFTER_AGENT_THINK**：在检测到 content 开始或流结束时触发（前提是已触发 BEFORE_AGENT_THINK）

### 6.3 parent_correlation_id 传递

- 所有事件和流式消息都需要携带 `parent_correlation_id`
- `parent_correlation_id` 用于前端按 Agent 循环周期分组展示
- 每轮 Agent Loop 生成新的 `parent_correlation_id`

---

## 7. 测试用例建议

```python
# 测试场景覆盖
test_cases = [
    # 场景一：只有思考（应触发 BEFORE/AFTER_THINK）
    {"reasoning": "思考内容...", "content": None, "tools": None, "expect_think_events": True},

    # 场景二：只有回复（不应触发 THINK 事件）
    {"reasoning": None, "content": "回复内容...", "tools": None, "expect_think_events": False},

    # 场景三：只有工具（不应触发 THINK 事件）
    {"reasoning": None, "content": None, "tools": [{"name": "search"}], "expect_think_events": False},

    # 场景四：思考+工具（应触发 BEFORE/AFTER_THINK）
    {"reasoning": "思考内容...", "content": None, "tools": [{"name": "search"}], "expect_think_events": True},

    # 场景五：回复+工具（不应触发 THINK 事件）
    {"reasoning": None, "content": "回复内容...", "tools": [{"name": "search"}], "expect_think_events": False},

    # 场景六：思考+回复（应触发 BEFORE/AFTER_THINK）
    {"reasoning": "思考内容...", "content": "回复内容...", "tools": None, "expect_think_events": True},

    # 场景七：思考+回复+工具（应触发 BEFORE/AFTER_THINK）
    {"reasoning": "思考内容...", "content": "回复内容...", "tools": [{"name": "search"}], "expect_think_events": True},

    # 场景八：一次长思考过程（多轮，但只触发一次 BEFORE/AFTER_THINK）
    {"multi_round": [
        {"reasoning": "第一轮思考...", "tools": [{"name": "search"}]},  # BEFORE_AGENT_THINK
        {"reasoning": "第二轮思考...", "tools": [{"name": "read"}]},   # 继续同一次思考
        {"reasoning": "第三轮思考...", "content": "最终回复..."}         # AFTER_AGENT_THINK
    ], "expect_think_count": 1, "expect_same_correlation_id": True},

    # 场景九：多次独立思考（每次都有完整的 BEFORE/AFTER_THINK）
    {"multi_round": [
        {"reasoning": "第一次思考...", "content": "第一次回复..."},  # BEFORE + AFTER (think-001)
        {"reasoning": "第二次思考...", "content": "第二次回复..."}   # BEFORE + AFTER (think-002)
    ], "expect_think_count": 2, "expect_different_correlation_ids": True},
]
```

---

## 8. Bug 修复方案与影响分析

### 8.1 需要修改的文件

#### 1. agent.py
**当前实现（Bug）**：
```python
# 每轮 loop 开始就触发（错误：此时还不知道是否有思考）
await ThinkEventManager.trigger_before_think(agent_context, model_id, model_name)

# LLM 调用...

# finally 保底
await ThinkEventManager.trigger_after_think(...)
```

**修复后的实现**：
```python
# 移除 loop 开始时的 trigger_before_think 调用

# LLM 调用...

# finally 保底（保持不变）
await ThinkEventManager.trigger_after_think(...)
```

**影响**：
- 移除每轮 loop 开始时的 BEFORE_AGENT_THINK 触发
- finally 中的 AFTER_AGENT_THINK 保底调用保持不变

#### 2. 流式处理器（streaming processor）
**当前实现（Bug）**：
```python
# 从 context 获取 parent_correlation_id（错误：此时可能还没有）
parent_correlation_id = agent_context.get_thinking_correlation_id()

# 处理 reasoning_content
if reasoning_content:
    await trigger_before_agent_reply(...)
```

**修复后的实现**：
```python
# parent_correlation_id 初始为 None
parent_correlation_id = None

# 处理 reasoning_content
if reasoning_content:
    # 检查是否需要触发 BEFORE_AGENT_THINK
    # 条件：当前没有进行中的思考（correlation_id 不存在）
    if not agent_context.get_thinking_correlation_id():
        await ThinkEventManager.trigger_before_think(agent_context, model_id, model_name)

    # 获取 parent_correlation_id（可能是刚创建的，也可能是之前就存在的）
    if not parent_correlation_id:
        parent_correlation_id = agent_context.get_thinking_correlation_id()

    await trigger_before_agent_reply(...)
```

**影响**：
- 需要传递 `model_id` 和 `model_name` 参数到流式处理函数
- `parent_correlation_id` 初始为 None，在首次收到 reasoning_content 时动态获取
- 通过 `agent_context.get_thinking_correlation_id()` 判断是否有进行中的思考

#### 3. 非流式处理器（non-streaming processor）
**当前实现（Bug）**：
```python
# 从 context 获取 parent_correlation_id（错误：此时可能还没有）
parent_correlation_id = agent_context.get_thinking_correlation_id()

# 处理 reasoning_content
if has_reasoning:
    await trigger_before_reply(...)
```

**修复后的实现**：

**1. ThinkEventManager 内部封装思考边界判断**：
```python
# think_event_manager.py
@staticmethod
async def trigger_before_think(agent_context, model_id, model_name) -> str:
    # 检查是否已经在思考中（思考边界检查）
    existing_correlation_id = agent_context.get_thinking_correlation_id()
    if existing_correlation_id:
        logger.debug(f"思考进行中，跳过 BEFORE_AGENT_THINK 触发")
        return existing_correlation_id

    # 触发 BEFORE_AGENT_THINK 事件...
    agent_context.set_thinking_correlation_id(correlation_id)
    return correlation_id
```

**2. 流式/非流式处理器直接调用**：
```python
# 处理 reasoning_content（流式处理器 streaming_context.py）
if has_reasoning_content and not state.reasoning_reply_started:
    # 直接调用，内部会自动检查思考边界
    await ThinkEventManager.trigger_before_think(
        agent_context=agent_context,
        model_id=model_id,
        model_name=model_name
    )
    # ...
```

```python
# 处理 reasoning_content（非流式处理器 regular_call_processor.py）
if has_reasoning:
    # 直接调用，内部会自动检查思考边界
    await ThinkEventManager.trigger_before_think(
        agent_context=agent_context,
        model_id=model_id,
        model_name=model_name
    )
    # ...
```

**3. 处理器结束时补充 AFTER_AGENT_THINK 触发**：
```python
# 流式处理器收尾（streaming_context.py）
# 覆盖场景：只有 reasoning 或 reasoning + tool_calls（无 content）
if not state.after_think_sent and should_trigger_events and agent_context:
    await ThinkEventManager.trigger_after_think(
        agent_context=agent_context,
        model_id=model_id,
        model_name=model_name
    )
    state.after_think_sent = True
```

```python
# 非流式处理器收尾（regular_call_processor.py）
# 覆盖场景：只有 reasoning 或 reasoning + tool_calls（无 content）
if has_reasoning and not has_content:
    await ThinkEventManager.trigger_after_think(
        agent_context=agent_context,
        model_id=model_id,
        model_name=model_name,
        request_id=request_id
    )
```

**4. 移除 agent.py 中的保底触发**：
```python
# agent.py - 移除了 finally 中的保底代码
# 不再需要，因为所有场景都在处理器中完整覆盖了
```

**影响**：
- 在检测到 reasoning_content 时触发 BEFORE_AGENT_THINK
- 外部调用简化，无需判断，内部自动处理思考边界
- 处理器结束时补充 AFTER_AGENT_THINK，覆盖所有场景
- 移除 agent.py 保底，逻辑更清晰

### 8.2 连带影响

#### 1. 事件数量变化
**场景二、三、五（无 reasoning_content）**：
- **Bug 表现**：触发 BEFORE_AGENT_THINK + AFTER_AGENT_THINK（is_thinking=False）
- **修复后**：不触发任何 THINK 事件
- **影响**：前端/监听器需要适配，不再收到这些场景的 THINK 事件

#### 2. 事件配对
**Bug 表现**：
- 每轮 loop 都保证有 BEFORE_AGENT_THINK
- AFTER_AGENT_THINK 可能触发也可能不触发

**修复后**：
- BEFORE_AGENT_THINK 只在有 reasoning_content 时触发
- AFTER_AGENT_THINK 必然在 BEFORE_AGENT_THINK 后触发（配对保证）
- 无 reasoning_content 的场景不触发任何 THINK 事件

#### 3. 多轮场景
**Bug 表现**：
- 每轮 loop 都触发 BEFORE_AGENT_THINK（无论是否有思考）

**修复后**：
- 只有返回 reasoning_content 的轮次才触发 BEFORE_AGENT_THINK
- 更准确地反映"思考"的实际发生

### 8.3 向后兼容性

**Bug 修复带来的变化**：
1. 无 reasoning_content 的场景不再触发 THINK 事件
2. BEFORE_AGENT_THINK 的触发时机从 loop 开始改为首次收到 reasoning_content

**需要适配的地方**：
1. 前端代码：处理 THINK 事件的逻辑需要适配（某些场景不再收到事件）
2. 事件监听器：依赖 THINK 事件的监听器需要检查是否会受影响
3. 日志/监控：依赖事件计数的监控指标需要更新

### 8.4 修复后的优势

1. **语义准确**：只有真正有思考时才触发思考事件
2. **减少误触发**：避免无思考场景的空事件触发
3. **事件配对保证**：BEFORE/AFTER 严格配对，更容易理解和调试
4. **支持多轮思考**：每次思考都有独立的事件对，更清晰

### 8.5 修复步骤

1. **修改 ThinkEventManager（核心封装）**：
   - 在 `trigger_before_think` 内部添加思考边界检查
   - 检查 `agent_context.get_thinking_correlation_id()` 是否存在
   - 如果存在（思考进行中），跳过触发，返回现有 correlation_id
   - 如果不存在，触发事件并返回新生成的 correlation_id

2. **修改流式处理器（streaming_context.py）**：
   - 在收到 reasoning_content 时，直接调用 `ThinkEventManager.trigger_before_think()`
   - 无需外部判断，内部会自动处理思考边界
   - 在流结束时，补充 AFTER_AGENT_THINK 触发（覆盖"只有 reasoning"和"reasoning + tool_calls"场景）

3. **修改非流式处理器（regular_call_processor.py）**：
   - 在检测到 reasoning_content 时，直接调用 `ThinkEventManager.trigger_before_think()`
   - 无需外部判断，内部会自动处理思考边界
   - 在处理结束时，补充 AFTER_AGENT_THINK 触发（覆盖"只有 reasoning"和"reasoning + tool_calls"场景）

4. **修改 agent.py**：
   - 移除 loop 开始时的 trigger_before_think 调用
   - 移除 finally 中的保底 trigger_after_think 调用（不再需要）

5. **更新测试用例**：
   - 测试单次思考场景（BEFORE/AFTER 配对）
   - 测试一次长思考过程（多轮但同一个 correlation_id）
   - 测试多次独立思考（每次都有独立的 correlation_id）
   - 测试"只有 reasoning"场景（确保触发 AFTER_AGENT_THINK）
   - 测试"reasoning + tool_calls"场景（确保触发 AFTER_AGENT_THINK）
   - 确保事件触发正确，correlation_id 使用正确

6. **前端适配**：更新前端处理逻辑（如果需要）
7. **监控更新**：更新相关监控指标
8. **文档更新**：更新 API 文档和事件说明，强调思考边界概念

### 8.6 修复后的场景覆盖

所有场景的 AFTER_AGENT_THINK 触发位置：

| 场景 | 触发位置 | 说明 |
|------|---------|------|
| 场景一：只有 reasoning | 处理器结束时 | ✅ 补充触发（无 tool_calls） |
| 场景二：只有 content | 无需触发 | ✅ 没有 BEFORE，所以不需要 AFTER |
| 场景三：只有 tool_calls | 无需触发 | ✅ 没有 BEFORE，所以不需要 AFTER |
| 场景四：reasoning + tool_calls | 下一轮检测到 content 时 | ⚠️ 思考持续到下一轮 |
| 场景五：content + tool_calls | 无需触发 | ✅ 没有 BEFORE，所以不需要 AFTER |
| 场景六：reasoning + content | 检测到 content 时 | ✅ 已有触发 |
| 场景七：reasoning + content + tool_calls | 检测到 content 时 | ✅ 已有触发 |

**关键改进**：
- 场景一：在处理器结束时补充 AFTER_AGENT_THINK 触发（仅当无 tool_calls）
- 场景四：思考持续到下一轮，在下一轮检测到 content 时或处理器结束时触发
- 所有场景都在处理器内部完整覆盖，逻辑清晰明确
