# 即时通讯与组织枢纽 (Chat & Contacts)

大厂内部或是 B 端协作中， IM (Instant Messaging) 与通讯录 (`Contacts`) 往往是串接所有子模块流动性的基础设施。`magic-web` 前端对此投入了极其庞大的支撑线。

## 聊天场 (ChatNew & ChatMobile)
不同于普通的单页展示，这是基于复杂状态树 (`Zustand` 加上 `MobX` 管理视图刷新) 以及 WebSocket 断线重联与海量长列表优化的硬核基建区。
- **数据结构与会话管理 (Session/Message)**：
  为了实现毫秒级的切流与历史回溯，聊天层 `ChatNew` 不仅做了基于 `react-virtuoso` 或 `rc-virtual-list` 的极强滑动长列表。还在数据流转点大量依赖 `IndexedDB` (`dexie`) 对庞大的漫游消息记录进行前端沙盒落地。
- **移动双端差异**：
  同样存在分化的源码组织 (`chatMobile` 与 `chatNew` 拆离)。移动端需要照顾如 `safe-area-inset`（Tailwind 配置注入）、软键盘挤压高度与触摸缩放防御 (`useDisabledTouchpadZoom`)。
- **扩展卡片流 (Message Card)**：
  为了使得如 `Approval` 或 `Flow` 执行结果能够回显甚至在气泡内操作，采用解耦的 ComponentRender 中心机制注入了大量富交互消息模板（Magic Toaster, Markdown 解析卡片等）。

## 通讯录生态板 (Contacts)
它不仅仅是简单的用户列表展示。
- **组织单元树阵 (`ContactsOrganization` / `ContactsMyGroups`)**：内部采用了针对大型树级结构与扁平化列表转换的渲染技术，保障海量部门人员的检索 (Search Hook) 和交互流畅度。
- **AI 助手池 (`ContactsAiAssistant`)**：通讯录打破了传统的“全真人类”刻板印象，引入了特有的虚拟员工列表。这也佐证了这个项目的 Agent 应用矩阵地位。
- **跨模块召唤**：由通讯录孵化出了贯穿系统骨架的通用选择器 (`UserSelector`)。在审批节点流转、或者在协同文档指派人员时进行无缝嵌套拉起。
