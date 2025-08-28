# Magic Flow - Pacchetto Fondamentale per Flussi ✨

<div align="center">
  <img src="https://img.shields.io/badge/Stato-Sviluppo-blue" alt="Stato: Sviluppo">
  <img src="https://img.shields.io/badge/Framework-React-61dafb" alt="Framework: React">
  <img src="https://img.shields.io/badge/Licenza-MIT-green" alt="Licenza: MIT">
</div>

## 📖 Introduzione al Progetto

Magic Flow è una libreria fondamentale per la gestione di flussi, estratta da Magic Flow e pronta all'uso. Basata su ReactFlow, offre potenti funzionalità di progettazione e gestione di diagrammi di flusso. Il progetto integra componenti di base per i flussi, un editor JSON Schema, componenti per espressioni e UI comuni interne, per aiutarti a costruire rapidamente applicazioni di flusso visuali. 🚀

## ✨ Caratteristiche Principali

- 🔄 Progettazione e gestione di diagrammi di flusso basata su ReactFlow
- 🎯 Gestione ad alte prestazioni di nodi e connessioni (batch e ottimizzazione debounce)
- 🧩 Sistema di tipi di nodi estendibile
- 🔍 Modifica di form basati su JSON Schema
- 🌐 Supporto multilingua
- 🎨 Componenti UI belli e personalizzabili

## 📦 Installazione

```bash
# Installa le dipendenze
npm install @dtyq/magic-flow
```

## 📚 Guida all'Uso

Al momento non esiste una guida rapida unificata. Per usare i componenti, consulta queste risorse:

- Consulta il file `index.md` nella cartella di ciascun componente per istruzioni dettagliate
- Guarda i progetti di esempio nella cartella `examples` per capire gli scenari applicativi
- Ogni componente ha codice di esempio di riferimento

Ad esempio, per imparare a usare il componente `MagicFlow`:
1. Consulta il file `src/MagicFlow/index.md`
2. Guarda i progetti di esempio in `examples/MagicFlow`

## 📚 Documentazione API

### Componenti Principali

- `MagicFlow`: Componente principale per la progettazione dei flussi
- `MagicJsonSchemaEditor`: Generatore di form basato su Schema
- `MagicExpressionWidget`: Componente per la creazione e modifica di espressioni
- `MagicConditionEdit`: Componente per la modifica delle condizioni

### Core Hooks

- `useBaseFlow`: Hook logico principale per la gestione di nodi e connessioni
- `useNodeBatchProcessing`: Hook per il batch dei nodi, migliora le performance con molti nodi

### Documentazione Dettagliata ed Esempi

- Ogni componente ha una documentazione dettagliata: consulta il file `index.md` nella cartella del componente
- Il componente `MagicFlow` offre molti casi reali: guarda i progetti di esempio nella cartella `examples`
- Gli esempi mostrano l'uso pratico del designer di flussi in vari scenari, inclusa la personalizzazione dei nodi e la configurazione dei form

## 🛠️ Sviluppo

```bash
# Installa le dipendenze
npm install

# Avvia la demo della documentazione per lo sviluppo
npm start

# Costruisci la libreria
npm run build
```

## 🤝 Guida al Contributo

Contribuisci con codice o segnala problemi! Fai prima il fork del repository, poi invia una Pull Request. 💡

## 📄 Licenza

MIT

---

<!-- Testo originale (cinese e inglese) — mantenuto sotto: -->

# 神奇流程基础包

<div align="center">
  <img src="https://img.shields.io/badge/状态-开发中-blue" alt="状态：开发中">
  <img src="https://img.shields.io/badge/框架-React-61dafb" alt="框架：React">
  <img src="https://img.shields.io/badge/许可证-MIT-green" alt="许可证：MIT">
</div>

## 📖 项目介绍

神奇流程基础包是基于Magic Flow抽离出来的开箱即用的流程基础库，基于ReactFlow封装，提供强大的流程图设计与管理功能。本项目集成了流程基础包、JSON Schema编辑器、表达式组件及内部通用UI组件，助力快速构建可视化流程应用。

## ✨ 核心特性

- 🔄 基于ReactFlow的流程图设计与管理
- 🎯 高性能节点和边缘处理（批处理和防抖优化）
- 🧩 可扩展的节点类型系统
- 🔍 JSON Schema表单编辑能力
- 🌐 多语言支持
- 🎨 美观且可自定义的UI组件

## 📦 安装

```bash
# 安装依赖
npm install @dtyq/magic-flow
```

## 📚 使用指南

目前暂无统一的快速开始指南，若要使用各组件，请参考以下资源：

- 查看每个组件目录下的 `index.md` 文件获取该组件的详细使用说明
- 参考 `examples` 目录下的示例项目了解实际应用场景
- 每个组件都有对应的示例代码，可作为开发参考

例如，要了解 `MagicFlow` 组件的使用方法，您可以：
1. 查看 `src/MagicFlow/index.md` 文件
2. 参考 `examples/MagicFlow` 目录下的示例项目

## 📚 API文档

### 主要组件

- `MagicFlow`：流程设计器主组件
- `MagicJsonSchemaEditor`：基于Schema的表单生成器
- `MagicExpressionWidget`：表达式构建与编辑组件
- `MagicConditionEdit`：条件编辑组件

### 核心Hooks

- `useBaseFlow`：流程逻辑核心Hook，管理节点和连线状态
- `useNodeBatchProcessing`：节点批处理Hook，提升大量节点渲染性能

### 详细文档与示例

- 每个组件都附带详细的使用文档，请参考组件目录下的 `index.md` 文件获取具体用法
- `MagicFlow` 组件提供了丰富的实际开发案例，可查看 `examples` 目录下的示例项目
- 示例项目展示了流程设计器在不同场景下的实际应用，包括节点自定义、表单配置等

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 启动文档Demo进行开发
npm start

# 构建库代码
npm run build
```

## 🤝 贡献指南

欢迎贡献代码或提交问题！请先fork本仓库，然后提交Pull Request。

## 📄 许可证

MIT

---

# Magic Flow Foundation Package

<div align="center">
  <img src="https://img.shields.io/badge/Status-Development-blue" alt="Status: Development">
  <img src="https://img.shields.io/badge/Framework-React-61dafb" alt="Framework: React">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT">
</div>

## 📖 Project Introduction

Magic Flow Foundation Package is an out-of-the-box flow foundation library extracted from Magic Flow, encapsulated based on ReactFlow, providing powerful flow chart design and management capabilities. This project integrates flow foundation components, JSON Schema editor, expression components, and internal common UI components to help quickly build visual flow applications.

## ✨ Core Features

- 🔄 Flow chart design and management based on ReactFlow
- 🎯 High-performance node and edge handling (batch processing and debounce optimization)
- 🧩 Extensible node type system
- 🔍 JSON Schema form editing capabilities
- 🌐 Multilingual support
- 🎨 Beautiful and customizable UI components

## 📦 Installation

```bash
# Install dependencies
npm install @dtyq/magic-flow
```

## 📚 Usage Guide

Currently, there is no unified quick start guide. To use the components, please refer to the following resources:

- Check the `index.md` file in each component directory for detailed instructions on that component
- Refer to the sample projects in the `examples` directory to understand actual application scenarios
- Each component has corresponding sample code that can serve as a development reference

For example, to learn how to use the `MagicFlow` component, you can:
1. Check the `src/MagicFlow/index.md` file
2. Refer to the sample projects in the `examples/MagicFlow` directory

## 📚 API Documentation

### Main Components

- `MagicFlow`: Flow designer main component
- `MagicJsonSchemaEditor`: Form generator based on Schema
- `MagicExpressionWidget`: Expression building and editing component
- `MagicConditionEdit`: Condition editing component

### Core Hooks

- `useBaseFlow`: Core flow logic hook, managing node and connection states
- `useNodeBatchProcessing`: Node batch processing hook, improving rendering performance for a large number of nodes

### Detailed Documentation and Examples

- Each component comes with detailed usage documentation. Please refer to the `index.md` file in the component directory for specific usage
- The `MagicFlow` component provides rich actual development cases. Check the sample projects in the `examples` directory
- The sample projects demonstrate the practical application of the flow designer in different scenarios, including node customization, form configuration, etc.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start the documentation demo for development
npm start

# Build library code
npm run build
```

## 🤝 Contribution Guide

Contributions of code or issues are welcome! Please fork this repository first, then submit a Pull Request.

## 📄 License

MIT
