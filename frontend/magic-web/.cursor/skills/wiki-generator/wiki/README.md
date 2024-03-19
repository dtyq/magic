# Magic Web - Wiki 主页

---

## 🧭 Wiki 导航目录

为方便你的查阅，本 Wiki 按照技术抽象的维度及业务领域的颗粒度严格切分如下：

### 核心架构层 (Core Architecture)
👉 **[点击查阅系统前端架构设计](./Architecture.md)**
剖析 Magic Web 是如何基于 React 18 搭配 Vite 6 构建出这座庞大堡垒的。涵盖了前端项目的物理目录拓扑、路由动态加载边界引擎、统一的主题/多语言基建以及混合状态管理法则（Zustand + MobX）。

### 业务领域模块体系 (Domain Modules)
前端应用包含了几大独立且互相咬合的模块：

1. 💻 **[Super Magic 工作站剖析](./SuperMagic/Overview.md)**
   深入解读内部融合版的皇冠级特性——囊括 Workspace、Project 与 Topic 话题的数据体系，以及深度耦合的富文本生态引擎（Tiptap/Univer等）。

2. 📝 **[Magic Approval 极速审批流](./MagicApproval/Overview.md)**
   探索极为复杂的组织级表单审批组件体系。涵盖 PC 管理台与 H5 响应式的双端自适应组件架构。

3. 🤖 **[Flow & Agent大模型应用矩阵](./FlowAndAgent/Overview.md)**
   专门针对 B 端 AI 落地的可视化工作流（Flow）、大模型交互点（MCP）以及企业向量知识库体系解析。

4. 💬 **[Chat & Contacts 协同通讯内核](./ChatAndContacts/Overview.md)**
   解读单群聊会话窗体 (ChatMobile / ChatNew) 与深度结合的组织架构、星标联系人渲染隔离。

### 工具链与子包 (Toolchain & Packages)
📦 **[系统前端引擎库与子工程剖析](./Packages.md)**
针对 Monorepo 内 `@magic-web/html2pptx` 等下沉剥离的核心能力包，以及统一的数据监控上报 `@magic-web/logger` 的底层运作解析。

---
> *本 Wiki 由 wiki-generator Skill 自动构建。*
