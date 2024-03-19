# 缺陷修复：HTML 编辑模式拖动命中错误兄弟节点

## 概要
- 受影响区域：HTML 在线编辑 V2 的元素选中与拖动链路
- 严重程度：高
- 复现状态：可稳定复现
- 已知约束：本次只修 selector 唯一性，不引入新的稳定标识或重构其它编辑链路

## Current Behavior (Defect)
1. WHEN 页面中存在两个相邻且同 tag 的卡片节点，后一个节点的 class 是前一个节点 class 的子集
   THEN the system 为后一个节点生成的 selector 可能同时命中两个节点。
2. WHEN 用户在编辑模式拖动“月度销售详细数据”卡片
   THEN the system 实际移动的是文档流中更靠前的“产品综合性能评分”卡片。（可以将./assets/selector-collision-snippet.html copy 到 编辑器中作为复现页面）

## Expected Behavior (Correct)
1. WHEN 页面中存在两个相邻且同 tag 的卡片节点，后一个节点的 class 是前一个节点 class 的子集
   THEN the system SHALL 为目标节点生成只命中自身的唯一 selector。
2. WHEN 用户在编辑模式拖动“月度销售详细数据”卡片
   THEN the system SHALL 只移动“月度销售详细数据”卡片本身。

## Unchanged Behavior (Regression Prevention)
1. WHEN 目标节点本身带有唯一 `id`
   THEN the system SHALL CONTINUE TO 优先使用 `id` 生成 selector，并在命中到该 `id` 后停止向上拼接路径。
2. WHEN 节点没有同 tag 兄弟节点
   THEN the system SHALL CONTINUE TO 生成原有的 `tag + class` 路径，而不是额外附加位置索引。
3. WHEN 命中的是真实业务节点内部的标题或文本节点
   THEN the system SHALL CONTINUE TO 通过祖先路径唯一命中对应业务容器，而不是误命中前一个相似兄弟节点。

## 复现说明
- 输入：
  - 页面样例：`assets/index-processed.html`
  - 归档复现片段：`assets/selector-collision-snippet.html`
- 前置条件：
  - 进入 HTML 文件编辑模式
  - V2 选中与拖动链路使用 `getElementSelector()` 生成 selector
- 操作步骤：
  - 选中并拖动“月度销售详细数据”模块
- 实际结果：
  - 拖动样式写回到了前一个“产品综合性能评分”模块
- 期望结果：
  - 拖动样式只写回当前被选中的“月度销售详细数据”模块

## 证据
- 相关文件：
  - `src/opensource/pages/superMagic/components/Detail/contents/HTML/iframe-runtime/src/utils/dom.ts`
  - `src/opensource/pages/superMagic/components/Detail/contents/HTML/iframe-runtime/src/utils/__tests__/dom.test.ts`
- 归档资料（assets）：
  - `assets/repro-screenshot.png`：用户问题截图
  - `assets/selector-collision-snippet.html`：最小相邻卡片结构
  - `assets/get-element-selector-diff.md`：关键修复代码摘录
