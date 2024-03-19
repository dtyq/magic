# 工作流应用与大模型交互 (Flow & Agent & MCP)

对于包含高级功能的融合版本应用，`Flow` 与 `Agent` 是这台机器上的大模型生产力底座。相关路由统一收口至 `/:clusterCode/flow/` 及其子模块，物理层挂载于 `src/opensource/pages/flow/` 以及知识库中心 `src/opensource/pages/vectorKnowledge/`。

## Flow 工作流引擎
不同于传统的串行管理逻辑，内部大模型的“工作流”体现为高度可编排可视化的系统：
- **链路拓扑呈现**：依赖底层强大的拖拽（如 `@dnd-kit` / `react-draggable`）或画布插件（`konva` 或 `mermaid` 等方案），实现各种 AI 原子能力节点的自由连线组装与数据传输。
- **MCP 控制网关 (Model Context Protocol)**：路由配置 `pages/mcp`，即大模型协议层接入节点，统一统筹针对大模型上下文管理或各类知识库接口的跨端联调接口。
- **Agent 列表工厂**：能够快速查验通过多条 Flow 编定好的智能体实例。结合了应用权限或组间分享的功能。

## 探索市场与知识库 (Explore & VectorKnowledge)
这是给 AI 提供语料炮弹不可或缺的组件。
1. **探索中心 (Explore)**：提供如同技能市场般的模块。这里聚合了公域已经训练或组装好的智能体模板组件，支持用户端的高频查询、分类。
2. **向域知识管控 (Vector Knowledge)**：这是比普通“云盘”更为深度结构化的文件系统：
   - 支持大量的文档源预解析（结合了像 `@magic-web/html2pptx` 等核心算法以及 `file-type`, `pako` 解压等手段）。
   - 用户上传的高密版文档不仅是预览，而是要转投送给 `Server` 层打好 Embedding 向量，回传到前端页面呈现类似文件系统的组织结构，作为针对大模型的私有化记忆投喂库。
