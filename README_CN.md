<div align="left">
  <a href="./README.md"><img alt="README in English" src="https://img.shields.io/badge/English-d9d9d9"></a>
  <a href="./README_CN.md"><img alt="简体中文版自述文件" src="https://img.shields.io/badge/简体中文-d9d9d9"></a>
</div>

![麦吉开源产品矩阵](https://public-cdn.letsmagic.ai/static/img/super-magic-publish-header.png?v=20250819)

# 🔥 麦吉 - 首个开源一站式 AI 生产力平台

<div align="center">
  <p align="center">
    <a href="https://www.letsmagic.cn" target="_blank">
      <img alt="Static Badge" src="https://img.shields.io/badge/官网-301AD2">
    </a>
    <a href="https://github.com/dtyq/magic/releases">
      <img src="https://poser.pugx.org/dtyq/magic/v/stable" alt="Stable Version">
    </a>
    <a href="https://github.com/dtyq/magic/graphs/commit-activity" target="_blank">
      <img alt="Commits last month" src="https://img.shields.io/github/commit-activity/m/dtyq/magic?labelColor=%20%2332b583&color=%20%2312b76a">
    </a>
    <a href="https://github.com/dtyq/magic/" target="_blank">
      <img alt="Issues closed" src="https://img.shields.io/github/issues-search?query=repo%3Adtyq%2Fmagic%20is%3Aclosed&label=issues%20closed&labelColor=%20%237d89b0&color=%20%235d6b98">
    </a>
    <a href="https://github.com/dtyq/magic/discussions/" target="_blank">
      <img alt="Discussion posts" src="https://img.shields.io/github/discussions/dtyq/magic?labelColor=%20%239b8afb&color=%20%237a5af8">
    </a>
    <a href="https://www.letsmagic.cn" target="_blank">
      <img alt="Static Badge" src="https://img.shields.io/badge/Build with Magic 🔮-301AD2">
    </a>
  </p>
</div>

麦吉(Magic) 旨在帮助各种规模的企业快速构建和落地 AI 应用，以实现生产力百倍的提升。

## 麦吉产品矩阵

麦吉是首个 **"开源的一站式 AI 生产力平台"**，它不是一个单一的 AI 产品，而是一个涵盖了丰富能力的全面的产品矩阵。

![产品矩阵](https://public-cdn.letsmagic.ai/static/img/super-magic-open-source-projects.png?v=20250819)

- **[超级麦吉 Super Magic](https://github.com/dtyq/super-magic)** - 一个专为复杂任务场景设计的 **通用型 AI Agent**
- **[麦吉聊天 Magic IM](https://github.com/dtyq/magic)** - 企业级的即时通讯系统，融合 AI Agent 对话与企业内部沟通
- **[神奇流程 Magic Flow](https://github.com/dtyq/magic)** - 强大的可视化 AI 流程编排系统
- **天书办公协同系统 Teamshare OS** (即将发布) - 企业级的在线协同办公系统

除了上述的 AI 产品，我们还把我们构建这些产品的一些基础设施也都开源了出来：

- **[Agentlang](https://github.com/dtyq/agentlang)** - Language-first AI Agent Framework 以自然语言为核心构建 AI 智能体的框架 (当前为 Python 语言的版本，基于 TypeScript 的版本也即将上线)
- **[Magic Lens](https://github.com/dtyq/magiclens)** - 一个强大而灵活的 HTML 到 Markdown 转换工具，它使用可扩展的规则系统，能够准确地将复杂的 HTML 文档转换为简洁的 Markdown 格式
- **Magic Use** (即将发布) - 一个革命性的专门面向 AI Agent 的浏览器操作工具
- **Magic Space** (即将发布) - 一个全新性的专门面向 AI Agent 的静态内容托管管理系统
- **Sandbox OS** (即将发布) - 一个强大的面向 AI Agent 运行时的沙箱系统

### 超级麦吉 Super Magic

一个强大的**通用型 AI Agent**，专门面向复杂任务场景设计。通过多 Agent 设计体系以及丰富的工具能力支持，超级麦吉支持**自主任务理解**、**自主任务规划**、**自主行动**、**自主纠错**等智能的能力。它能够理解自然语言指令，执行各类业务流程，并交付最终的目标结果。作为麦吉产品矩阵的旗舰产品，超级麦吉通过开源的方式提供了强大的二次开发能力，让企业能够快速构建和部署符合特定业务需求的智能助手，大幅提升决策效率和决策质量。

![Super Magic](https://public-cdn.letsmagic.ai/static/img/super-magic-buffett.gif)

#### 超级麦吉部分案例
- [巴菲特 2025 年股东大会投资启示解析](https://www.letsmagic.cn/share/777665156986277889)
- [北京人形机器人半马相关股票分析](https://www.letsmagic.cn/share/774280936479625217)
- [《思考，快与慢》书籍的核心观点总结](https://www.letsmagic.cn/share/777461325648195584)
- [沪上阿姨 IPO 分析与投资建议](https://www.letsmagic.cn/share/777604044873928705)
- [SKU 销量预测需求](https://www.letsmagic.cn/share/771022574397648897)
- 更多案例请查阅 [官网](https://www.letsmagic.cn)

### 神奇流程 Magic Flow

神奇流程是一个强大的可视化 AI 流程编排系统，让用户能够在自由的画布上构建复杂的 AI Agent 工作流。它具有以下核心特点：

- **可视化编排**：直观的拖拽式界面，无需编写代码即可设计复杂的 AI 工作流程，通过节点连接轻松实现各种功能组合。
- **丰富的组件库**：内置多种预设组件，包括文本处理、图像生成、代码运行等模块，满足多样化的业务需求。
- **全面的模型支持**：兼容任何遵循 OpenAI API 协议的大模型，灵活选择适合业务场景的 AI 能力。
- **系统集成能力**：支持与 Magic IM 及其他三方 IM 系统（企业微信、钉钉、飞书）无缝对接，实现跨平台协作。
- **自定义扩展**：支持自定义工具节点开发，满足特定业务场景的专属需求。
- **实时调试监控**：提供完善的调试和监控功能，帮助快速识别和解决工作流中的问题，确保 AI 应用稳定运行。

![Magic Flow](https://public-cdn.letsmagic.ai/static/img/magic-flow.png)

作为麦吉产品矩阵的重要组成部分，神奇流程可与其他麦吉产品无缝集成，打造完整的企业级 AI 应用生态。

![Magic Multi-Agents and Events](https://public-cdn.letsmagic.ai/static/img/super-magic-multi-agents-and-events.png?v=20250819)

### 麦吉对话 Magic IM

麦吉对话是一个企业级的 AI Agent 对话系统，专为企业内部知识管理和智能客服场景设计。它提供了丰富的对话能力，支持多轮对话、上下文理解、知识库检索等功能，让企业能够快速构建智能客服、知识助手等应用。

麦吉对话系统具有以下核心特点：

- **知识库管理**：强大的知识库管理功能，支持多种格式文档的导入、自动索引和语义检索，确保 AI 回答基于企业真实知识。
- **对话管理**：完善的对话管理，支持通过话题来区分不同的对话内容，在支持与 AI Agent 对话的同时也支持与组织内的人对话。
- **群聊能力**：强大的群组聊天功能，支持多人实时协作讨论，AI 智能参与群聊并提供即时解答，促进团队高效沟通与知识共享。
- **多组织架构**：支持多组织部署和严格的组织数据隔离，每个组织拥有独立的数据空间和访问权限。
- **数据安全**：严格的数据隔离和访问控制机制，多层次权限管理，保障企业敏感信息安全，确保组织间数据不互相泄露。

![Magic IM](https://public-cdn.letsmagic.ai/static/img/magic-im-group-chat.png?v=20250819)

## 天书办公协同系统 Teamshare OS

天书办公协同系统是一个现代化的企业级协同办公平台，专为提升团队协作效率和知识管理而设计。作为麦吉产品矩阵的重要组成部分，天书系统将 AI 能力深度融入日常办公场景，实现智能化的工作流程和知识管理。

天书办公协同系统具有以下核心特点：

- **智能文档管理**：支持多种格式文档的在线编辑、协作和版本控制，AI 辅助内容生成和优化，让团队文档管理更高效。
- **神奇表格**：强大的多维度数据管理工具，支持自定义字段类型、多样化视图和自动化工作流，结合 AI 能力实现智能的数据处理，满足多样化的数据管理需求。
- **项目协作管理**：直观的项目看板和任务管理，支持自定义工作流，结合 AI 智能分析提供项目进度预测和资源优化建议。
- **知识库构建**：强大的知识沉淀和检索系统，自动对企业内部文档进行结构化处理，形成可持续积累的企业知识资产。
- **全面集成能力**：与麦吉产品矩阵无缝集成，同时支持对接主流办公软件和企业应用，打造统一的工作平台。

### 神奇表格

https://gist.github.com/user-attachments/assets/6ef46e66-292c-4a8a-8a00-a3b9fb7beec7

### 神奇文档

https://gist.github.com/user-attachments/assets/7327f331-be7d-4aeb-8e19-0949adde66b2

## 🚀 使用超级麦吉

### 云服务

我们为 [超级麦吉](https://www.letsmagic.cn)、[麦吉 IM](https://www.letsmagic.cn) 和 [麦吉 Flow](https://www.letsmagic.cn) 提供了 [云服务]((https://www.letsmagic.cn))，任何人都可以零设置开始尝试和使用，它提供了开源版本的所有功能。
*现阶段仍需通过邀请码进入使用，可在线申请邀请码，通过后即可试用。*

### 面向企业/组织的 麦吉

我们为团队和企业提供了更强大的管理能力和功能，可[给我们发送电子邮件](mailto:bd@dtyq.com?subject=[GitHub]Business%20License%20Inquiry)讨论企业需求。

### 自托管社区版

#### 系统要求
- Docker 24.0+
- Docker Compose 2.0+

#### 使用 Docker 启动系统

```bash
# 克隆仓库
git clone https://github.com/dtyq/magic.git
cd magic

# 前台启动服务
./bin/magic.sh start
```

##### 其他命令

```bash
# 后台启动服务
./bin/magic.sh daemon

# 查看服务状态
./bin/magic.sh status

# 查看日志
./bin/magic.sh logs
```

##### 配置环境变量

```bash
# 配置magic 环境变量, 必须配置任意一种大模型的环境变量才可正常使用magic
cp .env.example .env


# 配置超级麦吉 环境变量,必须配置任意一种支持openai 格式的大模型环境变量, 才可正常使用使用
./bin/magic.sh status
cp config/.env_super_magic.example .env_super_magic

```



##### 访问服务
- API 服务: http://localhost:9501
- Web 应用: http://localhost:8080
  - 账号 `13812345678`：密码为 `letsmagic.ai`
  - 账号 `13912345678`：密码为 `letsmagic.ai`
- RabbitMQ 管理界面: http://localhost:15672
  - 用户名: admin
  - 密码: magic123456

## 📚 官网与文档

官网 [https://www.letsmagic.cn](https://www.letsmagic.cn)
文档 [https://docs.letsmagic.cn/zh](https://docs.letsmagic.cn/zh)

## 贡献

对于想要贡献代码的人，请参阅我们的[贡献指南](https://github.com/dtyq/magic/blob/master/CONTRIBUTING_CN.md)。
同时，请考虑通过社交媒体、活动和会议来支持麦吉，麦吉的发展离不开你的支持。

## 安全漏洞

如果您发现 Magic 中存在安全漏洞，请发送电子邮件至 Magic 官方团队，电子邮件地址为 [team@dtyq.com](mailto:team@dtyq.com) ，所有安全漏洞都会被及时的解决。

## 📄 许可证

本仓库遵循 [Magic Open Source License](LICENSE) 开源协议，该许可证本质上是 Apache 2.0，但有一些额外的限制。

## 🙏 致谢

感谢所有为 Magic 做出贡献的开发者！

[![Star History Chart](https://api.star-history.com/svg?repos=dtyq/magic&type=Date)](https://star-history.com/#dtyq/magic&Date)
