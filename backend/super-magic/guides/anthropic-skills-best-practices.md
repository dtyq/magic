# Anthropics Skills 实践提炼：优秀 Skill 的方法与特点

> 基于对 [anthropics/skills](https://github.com/anthropics/skills) 仓库、`template/SKILL.md`、多个官方示例 skill（如 `skill-creator`、`webapp-testing`、`frontend-design`、`mcp-builder`、`internal-comms`）以及 [Agent Skills Specification](https://agentskills.org/specification/) / 最佳实践页面的归纳。

## 1. 什么是“优秀的 Skill”

优秀 skill 不是“把知识塞进长文档”，而是把模型在某类任务上的行为约束成：

1. 触发准确：该用时一定用，不该用时不误触发。
2. 执行稳定：步骤可复现，输入变化不容易跑偏。
3. 结果可验收：输出格式和质量标准明确，可评估、可迭代。
4. 成本可控：上下文加载按需展开，避免一次性注入过多内容。

## 2. Skill 结构模板介绍（目录 + 字段 + 骨架）

## 2.1 推荐目录结构

```text
your-skill/
├── SKILL.md
├── references/         # 规则、规范、知识库（按需读取）
├── examples/           # 正例/反例、输入输出样本
└── scripts/            # 可执行脚本（解析、校验、生成等）
```

最小可用版本只需要：

```text
your-skill/
└── SKILL.md
```

## 2.2 `SKILL.md` 的最小结构

```markdown
---
name: your-skill-name
description: Use when ... Triggers: "...". NOT for: ...
---

# Your Skill

## Use this skill when
- ...

## Do not use this skill for
- ...

## Workflow
1. ...
2. ...
3. ...
```

## 2.3 Frontmatter 字段说明（必须先写对）

1. `name`：skill 唯一名称，简短、可读、可检索。
2. `description`：触发决策核心字段，建议包含三段：
- `Use when ...`（适用场景）
- `Triggers: "...", "...", "..."`
- `NOT for: ...`（排除边界）

## 2.4 增强版模板（推荐）

```markdown
---
name: your-skill-name
description: Use when ... Triggers: "...", "...". NOT for: ...
---

# Your Skill

## Use this skill when
- ...

## Do not use this skill for
- ...

## Inputs you need
- 必要输入 1
- 必要输入 2

## Workflow
1. 预检查（完整性 / 权限 / 上下文）
2. 执行主流程（含条件分支）
3. 结果验证（按检查清单）
4. 输出结果（固定结构）

## Expected output
- Section A: ...
- Section B: ...

## Validation checklist
- [ ] 关键字段齐全
- [ ] 逻辑一致
- [ ] 可执行/可落地

## Failure / fallback
- 信息不足时：...
- 外部依赖失败时：...

## References
- `references/...`

## Examples
- `examples/...`

## Scripts
- `scripts/...`
```

## 2.5 结构设计原则（为什么这样分层）

1. `SKILL.md` 放“决策与流程”，保证模型先拿到可执行主路径。
2. `references/` 放“事实与规则”，减少 SKILL.md 冗长。
3. `examples/` 放“行为示范”，降低输出漂移。
4. `scripts/` 放“确定性步骤”，提升稳定性与复现性。

## 3. 一套可执行的方法（7 步）

## 步骤 1：先做“任务单元化”，一个 skill 只解决一个高频问题

- 选择范围：高价值 + 可重复 + 有明确输入输出。
- 避免把多个异质任务塞进同一 skill（例如“写代码 + 发邮件 + 做报表”）。

产出标准：
- 用一句话能说清楚：`这个 skill 帮用户在什么场景下完成什么结果`。

## 步骤 2：写好 Description（触发质量的核心）

`description` 决定“会不会被调用”和“什么时候被调用”。官方实践强调：

1. 包含具体触发词（用户常说法、别名、同义表达）。
2. 说明 Use when / Not for（正反边界）。
3. 兼顾召回与精度：既不要漏掉高价值请求，也不要抢不相关请求。

可复用写法：
- `Use when ...`
- `Triggers: "...", "...", "..."`
- `NOT for: ...`

## 步骤 3：在 SKILL.md 中采用“渐进披露”结构

不要一上来灌大量细节。推荐层次：

1. 快速判断：何时用、何时不用。
2. 核心流程：3-7 步主路径。
3. 条件分支：常见异常/边界处理。
4. 深入材料：references、examples、scripts 按需读取。

这对应官方强调的上下文效率：先让模型拿到“足够行动的信息”，再在需要时加载更多细节。

## 步骤 4：把“行为”写成可执行指令，而不是泛泛建议

优秀 skill 的指令特征：

1. 明确先后顺序（先检查 A，再执行 B，最后验证 C）。
2. 给出决策条件（如果 X 则走路径 1，否则路径 2）。
3. 提供 Do / Don’t（防止常见偏航）。

反例：`尽量完善结果`  
正例：`先确认输入完整性；若缺失关键字段则先提取最小补充信息；再输出固定模板`

## 步骤 5：把可复用能力外置到 references / examples / scripts

官方仓库示例普遍采用三件套：

1. `references/`：规范、规则、知识库。
2. `examples/`：高质量输入输出样例。
3. `scripts/`：可执行脚本（解析、转换、校验、生成）。

经验：
- 重复计算/固定规则尽量脚本化，减少模型自由发挥带来的波动。
- 示例优先放“好样本 + 反例对照”，帮助模型学习边界。

## 步骤 6：定义输出契约（Output Contract）

优秀 skill 要提前定义：

1. 输出结构（标题、字段、顺序、必填项）。
2. 质量门槛（完整性、可读性、可执行性）。
3. 失败处理（信息不足时如何降级、如何说明假设）。

建议在 SKILL.md 中加入：
- `Expected Output`
- `Validation Checklist`
- `Failure / Fallback`

## 步骤 7：评估驱动迭代（Eval-first）

官方实践强调对 skill 做专项评估，而非仅凭主观感受：

1. 准备真实请求集（覆盖正常、边界、对抗样本）。
2. 记录假阳性/假阴性（是否误触发、漏触发）。
3. 迭代顺序：先调 `description`，再调流程指令，最后补充示例/脚本。
4. 小步快跑，每次只改一个关键变量并复测。

## 4. 优秀 Skill 的关键特点（检查清单）

发布前可用下面 checklist 自检：

1. 目标单一：一句话可定义该 skill 的唯一主任务。
2. 触发明确：description 含触发词 + 非适用场景。
3. 指令可执行：有顺序、有条件、有边界。
4. 渐进加载：核心短、细节按需加载。
5. 可复用资产：references/examples/scripts 完整且有代表性。
6. 输出可验收：格式固定、质量标准明确。
7. 失败可处理：缺信息时有降级路径。
8. 有评估闭环：有数据集、有指标、有迭代记录。

## 5. 推荐的 SKILL.md 骨架（可直接套用）

```markdown
---
name: your-skill-name
description: Use when ... Triggers: "...", "...". NOT for: ...
---

# Your Skill

## Use this skill when
- ...

## Do not use this skill for
- ...

## Inputs you need
- 必要输入 1
- 必要输入 2

## Workflow
1. 预检查（完整性 / 权限 / 上下文）
2. 执行主流程（含条件分支）
3. 结果验证（按检查清单）
4. 输出结果（固定结构）

## Expected output
- Section A: ...
- Section B: ...

## Validation checklist
- [ ] 关键字段齐全
- [ ] 逻辑一致
- [ ] 可执行/可落地

## Failure / fallback
- 信息不足时：...
- 外部依赖失败时：...

## References
- `references/...`

## Examples
- `examples/...`

## Scripts
- `scripts/...`
```

## 6. 常见失败模式（反面模式）

1. 描述过泛：导致 skill 抢占无关请求。
2. 说明过长无结构：模型读完仍不知道先做什么。
3. 没有输出契约：结果风格漂移，难以验收。
4. 全靠自然语言推理：可脚本化步骤未脚本化，稳定性差。
5. 无评估数据：改动后不知道是真优化还是退化。

## 7. 实践建议：从“能用”到“好用”的演进路径

1. V0：先完成最小可用版（清晰触发 + 主流程 + 输出模板）。
2. V1：补样例和边界处理（高频异常先覆盖）。
3. V2：把重复步骤脚本化（降低波动）。
4. V3：建立评估集并持续迭代（把经验变成指标）。

---

## 参考来源

- anthropics/skills 仓库  
  https://github.com/anthropics/skills
- 模板：`template/SKILL.md`  
  https://github.com/anthropics/skills/blob/main/template/SKILL.md
- 示例：`skill-creator`  
  https://github.com/anthropics/skills/blob/main/skill-creator/SKILL.md
- 示例：`webapp-testing`  
  https://github.com/anthropics/skills/blob/main/webapp-testing/SKILL.md
- 示例：`frontend-design`  
  https://github.com/anthropics/skills/blob/main/frontend-design/SKILL.md
- 示例：`mcp-builder`  
  https://github.com/anthropics/skills/blob/main/mcp-builder/SKILL.md
- 示例：`internal-comms`  
  https://github.com/anthropics/skills/blob/main/internal-comms/SKILL.md
- Agent Skills Specification  
  https://agentskills.org/specification/
- Best Practices: Description Optimization  
  https://agentskills.org/best-practices/description-optimization
- Best Practices: Evaluating Skills  
  https://agentskills.org/best-practices/evaluating-skills
- Best Practices: Using Scripts  
  https://agentskills.org/best-practices/using-scripts
