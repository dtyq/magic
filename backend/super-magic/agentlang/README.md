<div align="center">

# AgentLang

**Language-first AI Agent Framework**
*以自然语言为核心构建 AI 智能体*

[![Python Version](https://img.shields.io/badge/python-3.8%20%7C%203.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)
[![Latest Stable Version](http://poser.pugx.org/dtyq/agentlang/v)](https://packagist.org/packages/dtyq/agentlang)
[![Status](https://img.shields.io/badge/status-beta-yellow)](https://github.com/dtyq/agentlang)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-orange.svg)](https://github.com/dtyq/agentlang)

</div>

## 📖 简介

AgentLang 是一个革命性的 AI 智能体框架，它将"**自然语言优先**"的理念置于设计核心。不同于传统智能体框架以代码结构和工程范式为主导，AgentLang 以自然语言为核心驱动力，让开发者能够通过自然语言定义、配置和控制智能体的行为。

在 AgentLang 中，语言不仅是输入和输出的媒介，更是智能体行为逻辑的主要表达形式。这种范式转变使 AI 智能体的开发变得更加直观、高效和灵活，让非专业开发者也能轻松创建复杂的智能体系统。

通过简化 LLM 集成、工具调用、会话管理和事件处理等关键功能，AgentLang 大幅降低了构建复杂 AI 智能体所需的技术门槛，使您能够专注于智能体的行为逻辑和用户价值。

## ✨ 核心特性

### 🔤 语言优先架构
- **自然语言配置**：直接通过自然语言描述定义智能体行为和能力
- **语义驱动开发**：智能体的行为逻辑主要通过语义描述而非传统编码实现
- **动态指令系统**：灵活调整智能体行为的运行时指令机制
- **上下文感知能力**：深度理解对话上下文，保持长期一致性

### 🧠 智能体系统
- **灵活的智能体架构**：支持各种智能体模式，包括对话式、任务式和混合式
- **上下文管理**：智能的会话上下文管理，保持智能体的记忆和状态
- **自适应逻辑**：智能体可根据情境调整其行为和响应策略

### 🔌 LLM 集成
- **统一接口**：封装了不同 LLM 提供商的 API 差异，提供统一的调用接口
- **多模型支持**：原生支持 OpenAI GPT 系列，轻松扩展到其他模型
- **Token 管理**：内置 token 计数和优化功能，帮助控制成本

### 🛠️ 工具与插件
- **语义工具定义**：通过自然语言描述定义工具功能和参数
- **工具调用追踪**：全面记录工具调用和响应，便于调试和审计
- **丰富的扩展点**：可在智能体工作流程的各个阶段注入自定义逻辑

### ⚡ 事件驱动架构
- **事件总线**：基于发布/订阅模式的事件系统，实现组件间的松耦合
- **中间件支持**：可添加中间件处理事件，用于日志、监控或拦截
- **可扩展事件类型**：支持自定义事件类型及其处理逻辑

### 📝 对话管理
- **会话持久化**：自动保存和恢复对话历史
- **智能摘要**：长对话的自动压缩和摘要功能
- **会话分析**：提供会话数据分析和可视化工具

## 📐 架构理念

AgentLang 的"自然语言优先"设计理念体现在以下几个方面：

1. **语言即接口**：自然语言作为人机交互的主要接口，无需复杂的GUI或专用DSL
2. **语言即配置**：通过自然语言描述配置智能体行为，减少繁琐的配置文件
3. **语言即逻辑**：智能体的决策逻辑主要通过语言模型的推理能力实现
4. **语言即扩展**：新功能可以通过语言描述进行定义和集成

这种设计使得 AgentLang 特别适合:
- **跨领域专家**：无需深厚的编程背景也能创建专业领域的智能体
- **快速原型开发**：缩短从概念到原型的时间
- **自适应系统**：快速适应新的需求和场景变化

## 🧩 项目结构

AgentLang 的代码组织遵循清晰的模块化结构:

- **agent** - 包含智能体的核心实现，处理智能体的生命周期和行为
- **llms** - 管理与各种大型语言模型的集成和交互
- **tools** - 定义工具接口并提供常用工具实现
- **event** - 实现事件驱动系统，使不同组件能够通过事件通信
- **chat_history** - 管理对话历史的存储、检索和优化
- **context** - 提供上下文管理能力，包括全局和会话级上下文
- **interface** - 定义系统各组件之间的接口和协议
- **utils** - 包含各种辅助功能和实用工具

## 📄 许可证

本项目采用 Apache License 2.0 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 📞 联系方式

- **Email**: dev@letsmagic.ai
- **GitHub**: [https://github.com/dtyq/agentlang](https://github.com/dtyq/agentlang)
- **问题追踪**: [https://github.com/dtyq/agentlang/issues](https://github.com/dtyq/agentlang/issues)

---

<div align="center">
<b>AgentLang: 让自然语言成为开发 AI 智能体的核心</b>

由 SuperMagic Team 开发 ❤️
</div> 