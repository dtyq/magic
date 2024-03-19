---
name: bugfix-workflow
description: 用结构化的 bugfix spec 工作流修复缺陷：先定义 `Current Behavior`、`Expected Behavior` 和 `Unchanged Behavior`，再做根因分析、修复设计、回归测试与实现任务。适用于复杂缺陷、关键链路回归风险高、或需要沉淀修复文档的场景。
---

# Bugfix Workflow

## 何时使用

- 用户要修 bug，而不是加功能
- bug 不容易直接定位，需要先做根因分析
- 修复范围必须可控

不适用：

- 新功能、重构、架构升级
- 有意改变现有产品行为
- 仅改文案、格式、注释或依赖版本
- 过于简单、可直接修复的 bug

## 归档约定

默认归档到：

- `.cursor/skills/bugfix-workflow/archives/<bug-id>/bugfix.md`
- `.cursor/skills/bugfix-workflow/archives/<bug-id>/design.md`
- `.cursor/skills/bugfix-workflow/archives/<bug-id>/tasks.md`
- `.cursor/skills/bugfix-workflow/archives/<bug-id>/assets/`

要求：

- `<bug-id>` 使用唯一、简短、语义明确的 kebab-case
- 命名聚焦缺陷本身，优先用“受影响对象 + 错误行为”
- 若用户指定归档名或路径，遵从用户要求
- 若只是临时分析且用户明确不归档，可跳过
- 截图、日志、复现 HTML、代码片段、diff 摘录等辅助资料默认放入 `assets/`
- 文档优先引用归档内 `assets/`，不要继续引用 issue 临时目录或外部路径
- 只归档与当前缺陷直接相关的资料

默认不要读取历史归档；只有用户明确要求、当前 bug 与某归档高度相似、或需要比对某次回归来源时，才读取最相关的少量归档。

## 工作流

### 1. Bugfix Analysis

先写 `bugfix.md`。核心必填：

- `Current Behavior (Defect)`
- `Expected Behavior (Correct)`
- 如有必要，再补 `Unchanged Behavior (Regression Prevention)`

写法尽量接近 EARS：

- `WHEN [条件] THEN the system [错误行为]`
- `WHEN [条件] THEN the system SHALL [正确行为]`
- `WHEN [条件] THEN the system SHALL CONTINUE TO [必须保持的行为]`

按需补充：

- 复现条件
- 输入边界或前置条件
- 受影响模块
- 明确不希望被修改的代码或行为
- 已有截图或复现片段的 `assets/` 引用

模板见 [bugfix-template.md](./references/bugfix-template.md)。

### 2. Design

在 `bugfix.md` 边界明确后，再写 `design.md`。核心必填：

- 根因是什么
- 根因如何验证
- 最小修复面在哪里

按需补充：

- 哪些 `Unchanged Behavior` 需要测试证明
- 哪些 `assets/` 资料支撑根因判断

若有多个方案，优先比较改动面、回归风险和对现有 API / UI / 状态机的影响。

模板见 [design-template.md](./references/design-template.md)。

### 3. Tasks (可选)

如果需要写 `tasks.md`，任务必须覆盖三类验证：

- bug 确实存在
- bug 已被修复
- 若存在相邻行为风险，再补未受影响场景继续正常

优先添加自动化测试；若无法自动化，必须写清手工验证步骤和观察点。若有测试阻断日志、失败截图或最小复现片段，也应归档到 `assets/` 并在文档中引用。

模板见 [tasks-template.md](./references/tasks-template.md)。

## 执行要求

1. 先确认 bug 范围，再写文档，再改代码。
2. 若有辅助资料，先整理到 `archives/<bug-id>/assets/` 并统一命名。
3. 实施后运行最小必要测试集；若存在相邻行为风险，再覆盖相邻不变场景。
4. 汇报时明确根因、改动边界、新增或更新的测试、以及仍未验证的风险。

## 硬规则

- 不要把“猜测的根因”写成既定事实；先标注证据
- 不要用泛泛的“优化”替代 bugfix
- 不要顺手重构无关模块，除非修复本身被其阻塞