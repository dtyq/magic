# 系统包与前端引擎工程 (Packages)

内部版除主线 `src` 的巨无霸体积外，还在 `packages/` 目录下对纯逻辑或极底层的黑盒引擎进行了物理抽离。这是典型的 Monorepo (基于 Pnpm workspace) 的横向解耦实践。

## `@magic-web/html2pptx`
> **核心职能**：HTML 到标准 PPTX 幻灯片的逆向渲染编译引擎。

- **业务背景**：在 `SuperMagic` 乃至大模型生成的流式富文本（由 Tiptap 渲染出的大量 HTML 节点中），有极高频的“一键转演示文稿”的强诉求。
- **实现原理**：它并非简单地调用浏览器打印或者图像切割，而是作为一个 Node / Browser 同构库。它深度解析传入的复杂 DOM 树（包括段落、行内样式、各种定制的 block 插件标识），剥离 CSS 属性，然后利用 `pptxgenjs` 此类底层工具，精准将其等比甚至重排映射为 Office Open XML 标准对象结构。
- **解耦意义**：这套繁重且纯算法向的代码完全不需要和 React 或者内部业务组件存在任何耦合，打包为单独的包极大提升了维护性，并可以直接在独立的 Web Worker 或服务端 (BFF)中运行以避免阻断主线程渲染。

## `@magic-web/logger`
> **核心职能**：异构多端环境的统一打点遥测和防腐监控平台层。

- **业务背景**：随着项目推向不同形态的大客户或 SaaS 公有云，运维侧需要监控性能与排查链路。某些局点使用火山引擎 (Volcengine Web APMPlus)，某些使用阿里云 (Aliyun ARMS RUM)。
- **实现原理**：提供一致性的 `log()`, `trace()`, `reportError()` API 接口。在内部通过适配器模式 (Adapter)，根据打包注入的 `appId` 或环境标识 `isVolcengine`，动态派发数据给不同的底层监控 SDK。
- **解耦意义**：让 `src` 下几千个 React 业务组件免受繁杂打点 SDK 初始化和 API 不一致的毒害，彻底抽离为项目级的运维基架。
