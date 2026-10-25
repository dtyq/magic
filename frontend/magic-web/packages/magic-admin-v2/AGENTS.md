# Magic Admin V2 Open Source Agent Guide

This directory is the open-source Admin V2 package. Before changing pages or components, read `docs/DEVELOPMENT-GUIDE.md` and `docs/UI-DESIGN.md`.

## 开始任何页面或组件开发前

必须先阅读：

1. [`docs/AI-PAGE-DEVELOPMENT.md`](docs/AI-PAGE-DEVELOPMENT.md)：新页面选型、统一页面壳、共享组件和桌面/移动端行为的唯一快速入口。
2. [`docs/DEVELOPMENT-GUIDE.md`](docs/DEVELOPMENT-GUIDE.md)：架构、目录、数据流、路由、权限、i18n、Overlay、测试和交付规范。
3. [`docs/UI-DESIGN.md`](docs/UI-DESIGN.md)：页面视觉、间距、表格、表单、状态、Skeleton、响应式和共享组件规范。
4. 与任务最接近的已上线业务 feature；`src/features/ui-examples` 仅作为展示目录，不能覆盖上述规范，也不能作为新页面模板直接复制。

## 不可违反的硬规则

- 新 UI 使用 shadcn/ui + Tailwind；不要在一个组件里混用 Tailwind 与 antd-style，不新增 Less、CSS Modules、styled-components。
- 业务按 `features/<feature-name>` 组织：`api.ts`、`queries.ts`、`mutations.ts`、`types.ts`、`components/` 分层；页面不要直接拼 API 请求。
- 用户可见文案必须使用静态 i18n key，并同时更新 `zh_CN` 和 `en_US`。
- 新导航页面必须同步路由常量、路由注册、菜单元数据/icon/排序、访问权限和 `nav.*` 文案。
- 路由用 `validate` 做访问保护，页面内用 `useRights` 做按钮和写操作保护。
- 公共代码放 `src`，企业差异放 `enterprise/src` 的同路径 Overlay；改公共文件后必须检查是否有企业同路径实现。
- 服务端数据使用 TanStack Query；列表优先使用 `useListQueryParams`、共享 `ListShell`、筛选组件和 `ListPagination`。
- 异步操作成功/失败使用顶部居中的 `sonner`；loading、empty、error、permission denied、not found 等状态不能省略。
- 图标按钮有 `aria-label`/Tooltip；移动端使用现有 `useIsMobile`；表格短值不换行，长文本 truncate。
- 不使用 `any`、无理由的 `@ts-ignore` 或页面内临时硬编码样式绕过规范。

## 常用验证

```bash
cd frontend/magic-web/packages/magic-admin-v2
pnpm lint
pnpm types:enterprise
pnpm types:opensource
pnpm test:unit
pnpm test:components
pnpm test:integration
```

只运行与改动相关的命令也可以，但交付时必须说明执行了什么、未执行什么以及原因。
