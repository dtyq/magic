# Magic Web 前端架构全景

Magic Web（企业级 AI 协同平台）的前端作为整个系统的门面，采用典型的大型应用分层架构（Layered Architecture）设计。整体从端侧的用户访问，到具体的页面表现层、业务逻辑控制、以及向下直连的基础设施服务等，被划分为七个明确的水平拓展层与横向增强插件切面。

以下为结构和数据流转的整体概览：

![Magic Web 前端架构图](./assets/magic-web-architecture.png)

## 架构辅助说明

本架构的核心目的在于**高度解耦与复用**，以下是图中部分关键层级的设计思想补充：

1. **表现层 (Presentation Layer)**:
   这里承载了整个应用的所有视图实体。通过将 Layout（基座结构） 与 Pages（具体业务如 Chat、Approval、Drive 等）彻底剥离，保证了各种复杂模态环境（如 SSR直出、微前端挂载、甚至是部分套壳 Mobile H5）中，业务视图能够无缝嵌入特定的包裹层中。组件库通过整合 Tailwind/shadcn-ui 原子能力与 Ant Design 商业级沉淀，外加一系列特重型的生态组件（Tiptap/Univer/Monaco/MCP Agent 等），为多维度的业务赋能。
2. **业务逻辑层 (Business Logic Layer) 与 DDD**:
   此层是对复杂的前端业务（如工作流流转验证、超大型表单验证、长文档协同同步过滤等）做数据脱水与聚合的场所。它抽离于 UI 之外，结合了 Hooks 注入以及六边形架构原则。利用此层，前端开发人员能在完全不用启动浏览器的情况下完成核心业务函数的 100% 单元测试。
3. **“双擎”状态管理 (State Management Layer)**:
   不同于传统单库梭哈，架构采用 **MobX + Zustand** 的混合策略。MobX 作为开源核心及底层应用级 Store（例如全量用户信息、几万条的高频更新聊天会话大池子），支撑深层繁杂状态与高频渲染场景；Zustand 则以切片化的姿态负责各自顶层业务模块闭环内的数据收展（如独立的各类 Approval 审批流转、各种模态框弹层的即抛状态等）。
4. **统一增强与基建网络 (Infrastructure & Enhance Layer)**:
   底部的组件承担了所有重体力“脏活”，包括基于 Dexie 的海量 indexedDB 前端沙盒（提升二次加载断网缓存、消息防丢等场景），由基于 Web Worker 跑分的后台常驻服务、自定义 Vite 插件优化分包体积以及 Electron 与原生 App SDK 的定制桥接。
