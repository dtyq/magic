# bugfix.md 模板

```md
# 缺陷修复：[简短标题]

## 概要
- 受影响区域：
- 严重程度：
- 复现状态：
- 已知约束：

## Current Behavior (Defect)
1. WHEN [触发条件]
   THEN the system [错误行为]。
2. WHEN [触发条件]
   THEN the system [错误行为]。

## Expected Behavior (Correct)
1. WHEN [相同或等价条件]
   THEN the system SHALL [正确行为]。
2. WHEN [相同或等价条件]
   THEN the system SHALL [正确行为]。

<!-- 如存在相邻行为风险、共享逻辑或明确需要防回归时，再填写 -->
## Unchanged Behavior (Regression Prevention)
1. WHEN [相邻且当前本来正常的场景]
   THEN the system SHALL CONTINUE TO [既有行为]。
2. WHEN [另一个非缺陷场景]
   THEN the system SHALL CONTINUE TO [既有行为]。

<!-- 以下章节按需填写；信息不足或没有额外约束时可省略 -->

## 复现说明
- 输入：
- 前置条件：
- 操作步骤：
- 实际结果：
- 期望结果：

## 范围边界
- 范围内：
- 范围外：
- 不应改动的代码或模块：

## 证据
- 相关文件：
- 归档资料（assets）：
- 日志 / 截图 / 失败测试：
- 已知假设：
```

## 要求

- `Current Behavior` 和 `Expected Behavior` 尽量一一对应
- `概要`、三段行为定义是核心内容
- `Unchanged Behavior` 是按需项；只有在存在相邻行为风险、共享逻辑或明确防回归目标时再写
- `复现说明`、`范围边界`、`证据` 是按需补充项，不要为了凑模板硬写
- 特殊输入触发的 bug，要把输入条件写完整
- 用户明确说“不动某块逻辑”时，再写进 `范围边界`
- 截图、代码片段、复现 HTML、失败日志等，只有在确实帮助说明问题时再归档到 `archives/<bug-id>/assets/` 并引用
