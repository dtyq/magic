# 极速审批系统 (Magic Approval)

作为面向 B 端或者内部大厂管理的中枢动脉之一，Magic Approval 系统包含了一整套完整的流转与配置中心，其核心物理模块潜藏在 `src/pages/approval/` 中。

## 双端解耦呈现体系 (PC & Mobile)
这是区别于其他业务线的一大明显特征，审批因为“极度需要移动端实时触达”而天然裂变为双管齐下的交互流。
在源码路径 `components/` 中出现了极其明显的物理分割：
- **`components/PC/`**: 承载于桌面端应用（可能是一个 iframe 内嵌或者单行路由）。这里集结了 `ApprovalTab` (审批中心)、`List` (流转中心)、`SmartDelegate` (高级智能委托与数据台) 等沉重数据维度的后台管控。
- **`components/Mobile/`**: 针对移动端 H5 响应式特化，包含精简化的 `Detail` (审批单核准界面)、`AssistantHistory` (移动代班纪录)、`SettingAssistant` (委托控制面板)。这里使用了 `antd-mobile` 的控件与交互隐喻，区别于 PC 的标准 `antd`。

## 流转节点与功能域
1. **ApprovalInitiate (发起核心)**：并非简单挂载在审批目录中，而是反向借调或内嵌在了如 `chatNew/components/ApprovalStartPage`，意味着审批同 IM 聊天面板存在深度的链路打通。
2. **文档审批同频 (FilePreview)**：审批并非仅仅通过表单数据流流转，更是承载着像 DOCX/XLSX（利用 `docx-preview` / `exceljs` 等）的原生预览解析核验。全屏预览屏 (`ApprovalDetailFull`) 被拉高到了顶级路由节点。
3. **委托与管控中枢 (Agent / Delegate)**：实现对其他用户执行决策权的让渡策略，这是一个典型的深层权限校验与跨用户会话穿帮的防御核心机制。
