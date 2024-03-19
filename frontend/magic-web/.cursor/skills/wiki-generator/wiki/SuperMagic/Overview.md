# SuperMagic Overview

SuperMagic 是应用中最为瞩目也是数据结构最为复杂的战区，坐落于 `src/opensource/pages/superMagic/`。作为内容与协作管理的中枢，大量引用了高级第三方库（`@univerjs/*` 和 `@tiptap/*` 系扩展）。

## 功能版图

- **项目/话题视图联动 (Topic/Project/Workspace)**：提供了多层次的数据视图 `ProjectPage`, `TopicPage`, `WorkspacePage`。这不仅仅是 UI 的呈现，底层必须借助像 Zustand 进行树形状态管理以及通过 LocalStorage 甚至是 IndexedDB (利用 `dexie`) 实现草稿 / 历史纪录的大规模缓冲。
- **富文本引擎的降维控制**：
  引入了基于 `Prosemirror` 的重量级二次开发框架 `Tiptap`。为了应对极高复杂的定制业务诉求，安装了海量的扩展：包括 `@tiptap/extension-table`（复杂表格编排）、`@tiptap/extension-mathematics` (Katex公式)、代码高亮 (`shiki` / `prismjs`) 甚至是自定义的 Drag-handle 拖拽互操作。
- **电子文档矩阵引擎 (Univer 接入)**：
  在更为生猛的数据处理点，抛弃传统的富文本表格，而整活并挂载了 `@univerjs` 系列（涵盖了 Sheets/Docs/Drawing），用于在协作界面内直接开启高负荷的 Excel 计算和矢量图表呈现。

## 架构阵痛与平衡
超级麦吉拥有近千个前端组件。在其内部设计上，极其考验组件的按需加载。
它的根节点 `SuperMagicCommonLayout` (`MainLayout`) 被挂载在大规模动态路由下，任何依赖它的外部页面跳转，都会触发相关 `Lazy` 机制的渲染阻断。必须依赖于内部高度解耦的 Provider-Consumer 上下文（React Context），来实现富文本当中不同 Toolbar 和 Menu 间的通信流转，而不至于触发整棵 DOM 树暴跌卡顿。
