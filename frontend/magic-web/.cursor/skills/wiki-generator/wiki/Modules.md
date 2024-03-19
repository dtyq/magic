# 应用功能模块概览 (Application Modules)

本文档旨在梳理解构本项目（Magic Web）的核心业务模块体系。通过映射产品页面功能点与其底层的代码结构位置，帮助新加入的开发者或者技术架构审查人员快速建立整个大型协同平台的业务地图。

## 一、 核心底座：超级麦吉 (Super Magic)
**产品入口地址：** `https://www.letsmagic.cn`
**代码核心路由包裹：** `src/routes/modules/super.tsx` 或在 `routes.tsx` 中的 `SuperMagicCommonLayout`

“超级麦吉”是本作最重要的 AI 协同空间总入口，并非简单的对话框工具，而是一个集成任务处理、智能写作与应用流转的一站式工作站。其界面通常包含主功能展示区和专属操作侧边栏。

### 1. 工作区环境 (Workspace & Project)
- **描述：** 基于“工作区 - 项目”的层级树提供工作隔离，负责管理项目内的业务流、关联文件资产存储与当前工作链路状态。支持创建不同的 Topic（话题）以保存对话上下文。
- **关联代码域：**
  - `src/opensource/pages/superMagic/lazy/WorkspacePage`
  - `src/opensource/pages/superMagic/lazy/ProjectPage`
  - `src/opensource/pages/superMagic/lazy/TopicPage`

### 2. 多模式 AI 交互 (Multi-Mode AI Chat)
- **描述：** 平台在首页提供了通用、数据分析、PPT模式、录音总结及设计模式等多视角快速启动通道。在具体的会话页中，支持大语言模型流式输出、知识库溯源和工具（Plugins/MCP）的插拔调用。
- **关联代码域：**
  - `src/opensource/pages/superMagic/pages/Assistant` （推断助手展示）
  - 对话消息核心交互引擎往往复用并深度定制于聊天底层包。

### 3. 应用生态 (Agents/MCP/Applications)
- **描述：** 用户可以通过“九宫格”切换至应用生态市场，查找或进入特定的企业应用或者被封装好的 AI 助理。

---

## 二、 基础办公协同模块 (Collaboration & OA)

围绕着核心的“超级麦吉”能力，系统提供了丰富的标准办公与审批流支持模块。

### 1. 审批中心 (Magic Approval / OA)
- **描述：** 聚焦企业工作流闭环。涵盖发起审批、我的待办（审批代理/智能委托）、模板引擎和表单明细数据流。支持在 PC 端与移动平台的数据与布局自适应。
- **关联代码域：** `src/pages/approval`
  - `src/pages/approval/lazy/Approval` (主容器)
  - `src/pages/approval/components/PC/ApprovalTab` (列表)
  - `src/pages/approval/components/Mobile/Detail` (移动端详情)

### 2. 即时通讯与通讯录 (Chat & Contacts)
- **描述：** 供团队协作沟通。既包含私聊/群组体系（可能与大模型聊天存在底层组件继承关系），也包括整个复杂的组织树、部门架构、用户好友展现。
- **关联代码域：**
  - 通信：`src/opensource/pages/chatNew` 和 `src/opensource/pages/chatMobile`
  - 组织关系：`src/opensource/pages/contacts`

### 3. 日程、云盘与收藏 (Calendar & Drive & Favorites)
- **描述：** 提供非结构化文件资产的企业级网盘云存储管理；个人时间的日历管理；以及重要文件和知识词条的云端收藏录入。
- **关联代码域：**
  - `src/pages/calendar`
  - `src/pages/drive`
  - `src/pages/favorites`

---

## 三、 企业级资源管理与平台工程 (Platform & Admin)

此部分为应用的管控大脑部分，承接了系统运作需要的资源供给与安全配置功能。

### 1. 管理后台与算力平台 (Admin & API Platform)
- **描述：** 管理企业付费订阅资源（积分）、分配内部用户的操作权限、配置模型限流额度。对于大模型生态则具备模型（Model）、绘画（Drawing）、应用（Power）的分流治理功能。同时集成如微应用引擎以拓展插件场景。
- **关联代码域：**
  - 路由挂载区参考：`src/routes/modules/admin/routes.ts`
  - `src/pages/microApp/Application`

### 2. 向量知识库 / Flow引擎
- **描述：** 用于支撑复杂的检索增强生成（RAG）方案和 AI 长短记忆管理。将文档碎片化清洗后供回答所用。涵盖知识库搭建、检索增强等相关链路配置页面。
- **关联代码域：** `src/opensource/pages/vectorKnowledge` 和 `src/opensource/pages/flow`

---
> *文档维护策略提示*：此文档的底层信息源于 `src/routes/routes.tsx` 与各主应用页面的物理目录层级，随着页面迭代重构以及 `src/routes/constants.ts` 字典变化，应及时同步此视图映射结构。
