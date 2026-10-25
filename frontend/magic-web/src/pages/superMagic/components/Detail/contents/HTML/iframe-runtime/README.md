# Iframe runtime installers / iframe 注入模块

这些模块是在 iframe 内执行的 TypeScript 源码。它们只依赖浏览器 API，
不能导入宿主 React、状态、后端适配器，也不在模块加载时安装副作用。

Each module exports an installer accepting a typed options object. The production
Vite plugin bundles each entry into an isolated IIFE. `create-script.ts` appends
HTML-safe JSON arguments; callers never replace source text or stringify functions.

## 构建与调用

- `plugins/vite-plugin-iframe-runtime.ts` 编译入口并提供 `virtual:magic-iframe-runtime`。
- `createIframeRuntimeScript(name, options)` 通过源码参数类型检查调用，统一转义 HTML 和 Unicode 分隔符。
- `full-content.ts` 负责选择模块、安装顺序及传入参数；模块负责浏览器内行为。
- 正式 Vite、Vitest 和本地 HTML runner 复用同一编译器；产物不手工维护、不提交。
- 编译器记录全部依赖，依赖修改时清除缓存并使虚拟模块重新加载。

The generated installer namespace is local to each call. Rewriting a document does
not leak compiler globals. Existing protocol flags and legacy memory properties
retain their names; this extraction does not introduce a new public SDK protocol.

## 当前边界

已迁移遥测、页面尺寸、ServiceWorker fallback、导航初始化、PPT 预览双指手势，以及 standalone
模式的 Cookie、Storage、IndexedDB fallback。正式虚拟存储桥继续拥有有显式
存储上下文的渲染，不会被 legacy 模块覆盖。

Keep legacy quirks until a separate behavioral change is approved and tested.
In particular, the legacy IndexedDB fallback is deliberately incomplete; moving
it into TypeScript does not make it equivalent to native IndexedDB.

fetch、DOM 资源代理、嵌套 iframe、导航拦截等较复杂的字符串模块尚未迁移。
后续沿用同一编译与参数入口，先补对应失败、恢复、卸载测试，再逐模块迁移；
不要为一次重构同时改变消息协议、权限或存储数据格式。

## 验证

在 `frontend/magic-web` 运行 `pnpm test:html-sandbox`，包含此目录的严格类型检查、
方法/组件/编译器测试及同源、跨源的真实 HTML 实例。
`pnpm test:html-sandbox:types` 只检查这些模块，不运行全仓类型检查。
