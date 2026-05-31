# 新增 iframe FS/LLM API 检查清单

新增或修改 iframe API 时，需要同步更新以下文件（以 `fs.moveFile` 为例）：

## 1. 协议层 — 消息类型与接口定义

- **`iframe-api/types/index.ts`**
    - 在 `FS_MESSAGE_TYPES` 中添加 `REQUEST` / `RESPONSE` 常量
    - 添加对应的 Request / Response 接口（如 `FSMoveFileRequest`）

## 2. HTTP API — 后端接口调用

- **`iframe-api/iframeApi.ts`**
    - 新增封装函数（如 `moveIframeFile`），调用 `iframeClient.post(...)` 发起请求

## 3. 服务层 — 消息处理逻辑

- **`iframe-api/services/IframeFSService.ts`**
    - 添加处理函数类型（如 `MoveFileFn`）
    - 在 `IframeFSServiceConfig` 中增加配置字段
    - 实现 `handleXxx` 方法处理来自 iframe 的消息
    - 在 `handleMessage` 的 switch 中注册新的消息类型

## 4. Hook 层 — React 集成

- **`iframe-api/hooks/useIframeFS.ts`**
    - 在 hook options 中添加新的函数参数
    - 传递给 `IframeFSService` 构造函数

## 5. 组件层 — 调用接入

- **`IsolatedHTMLRenderer.tsx`**
    - 导入新的 API 函数
    - 在 `useIframeFS` 调用处传入实际的函数实现

## 6. iframe 客户端 SDK — iframe 内注入

- **`iframe-runtime/src/magic-api/MagicFSApi.ts`**
    - 在 `window.Magic.fs` 对象上挂载新方法，通过 `this.request(...)` 发送 postMessage

## 7. 类型声明 — TypeScript 全局类型

- **`iframe-runtime/src/index.ts`**
    - 在 `declare global { interface Window { Magic: { fs?: { ... } } } }` 中添加新方法签名

## 8. 单元测试

- **`iframe-runtime/src/magic-api/__tests__/MagicFSApi.test.ts`**
    - 添加新方法的测试用例（成功调用 + 参数校验）

## 9. 文档 — 面向开发者/AI

- **`backend/super-magic/agents/skills/html-api-sdk/SKILL.md`**
    - 在对应章节添加方法说明和示例
    - 更新末尾的 Quick Reference 表格
- **`.cursor/skills/wiki-generator/wiki/SuperMagic/HTML/MagicApiReference.md`**
    - 添加方法文档、协议表格条目和使用示例
