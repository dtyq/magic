# `src/utils` 依赖审计文档

## 审计目标

分析 `src/utils` 目录下当前全部内容，确认是否存在对以下目录层的依赖：

- `pages`
- `layouts`
- `components`
- `services`

并补充当前 `utils` 的主要跨层依赖情况，便于后续解耦治理。

## 扫描范围与方法

- 扫描目录：`src/utils`
- 扫描对象：源码、测试、文档文件（共检索到 121 个文件）
- 规则：基于 import 路径检索（包含 `@/` 别名路径与相对路径）
- 重点关键词：
  - `pages`
  - `layouts`
  - `components`
  - `services`

## 结论总览

### 1) 对 `pages` 的依赖

- **结论：未发现业务代码依赖**
- 说明：`src/utils` 内未检索到对 `@/pages/*` 或其他真实页面模块的 import
- 补充：仅在 `src/utils/__tests__/path.test.ts` 中出现字符串示例（用于路径计算测试），不属于真实依赖

### 2) 对 `layouts` 的依赖

- **结论：未发现依赖**
- 说明：未检索到对 `@/layouts/*` 的 import

### 3) 对 `services` 的依赖

- **结论：未发现依赖**
- 说明：未检索到对 `@/services/*` 的 import

### 4) 对 `components` 的依赖

- **结论：存在 1 处依赖（`opensource/components`）**
- 文件：`src/utils/react.tsx`
- 依赖：
  - `@/opensource/components/other/DetachComponentProviders`

该依赖意味着 `utils/react.tsx` 并非纯工具层实现，而是带有 UI 组件上下文能力（用于挂载时注入 Providers）。

## 发现的相关跨层依赖（补充）

虽然未依赖 `pages/layouts/services`，但 `src/utils` 存在以下跨层引用：

- `@/opensource/providers/*`（如 `BrowserProvider`）
- `@/opensource/models/*`（如 `configStore`、`userStore`、`clusterStore`）
- `@/opensource/routes/*`（路由常量与类型）
- `@/opensource/apis/*`（例如 `apis/utils`）
- `@/apis/constant`
- `@/opensource/types/*`、`@/opensource/constants/*`

这表明当前 `utils` 中既包含“纯工具函数”，也包含“与运行时上下文绑定的工具模块”。

## 风险与建议

1. `src/utils/react.tsx` 对 `components/providers` 有依赖，建议归类为“UI Runtime Utils”，避免与纯工具混放导致层级边界模糊。
2. 涉及 `store/route/api` 的模块可考虑迁移到更语义化目录（如 `src/opensource/runtime` 或 `src/opensource/app-utils`），降低“工具层”被反向依赖的风险。
3. 建议在 `src/utils` 增加分层约束（ESLint import 规则或文档约束）：
   - 纯工具子目录禁止依赖 `components/pages/layouts/services/models/providers/routes`
   - 允许上下文依赖的模块放入单独子目录并显式标注

## 当前可执行结论

- `src/utils` **当前不依赖** `pages`、`layouts`、`services`
- `src/utils` **当前存在** `components` 依赖（1 处，位于 `react.tsx`）
- 若以“纯工具层”作为目标架构，建议先从 `react.tsx` 与依赖 `models/routes/providers` 的模块做拆分治理
