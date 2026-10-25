# Magic Admin V2

Magic Admin V2 is the open-source Magic administration frontend package, built with React, TypeScript, and Vite. It supports both embedded hosting in `magic-web` and independent standalone development.

## Quick start

新增页面、组件或业务模块前，请先阅读：

- [`AGENTS.md`](AGENTS.md)：供 Codex、Claude Code 等代码 Agent 自动发现的近路径入口。
- [`docs/AI-PAGE-DEVELOPMENT.md`](docs/AI-PAGE-DEVELOPMENT.md)：新页面选型、统一页面壳、共享组件和响应式行为的快速执行规范。
- [`docs/DEVELOPMENT-GUIDE.md`](docs/DEVELOPMENT-GUIDE.md)：完整的目录、Feature、API、Query、Mutation、路由、权限、国际化、Overlay、测试和 PR 自检规范。
- [`docs/UI-DESIGN.md`](docs/UI-DESIGN.md)：视觉、间距、表格、表单、状态、Skeleton 和响应式规范。

在 `frontend/magic-web` 作为 Cursor workspace 时，`.cursor/rules/magic-admin-v2-development.mdc` 会按 `packages/magic-admin-v2/**` 路径自动启用，并要求 AI 读取以上文档。

项目支持两种运行方式：

- 通过 `magic-web` 宿主启用
- 在 `magic-admin-v2` 中独立本地启用

## 快速启用项目

### 通过 magic-web 宿主启用（推荐）

如果只是希望快速启动并查看 Admin V2，推荐使用 `magic-web` 宿主运行。

在 `frontend/magic-web` 目录执行：

```bash
cd frontend/magic-web
pnpm install
pnpm dev
```

Open `/admin-v2/` on the host. In embedded mode, `magic-web` supplies authentication, authorization, API clients, organization context, account data, uploads, language, theme, and route mounting.

### Run standalone

```bash
cd frontend/magic-web/packages/magic-admin-v2
pnpm dev:opensource:local
```

Open `http://127.0.0.1:5174/admin-v2/`.

## Open-source layout

```text
magic-admin-v2/
├── src/       # Public application code, routes, runtime, i18n, and styles
├── tests/     # Public unit, component, and integration tests
└── docs/      # Development, UI, and feature configuration guides
```

This package intentionally contains no enterprise overlay or generated `dist/` artifacts.

## Commands

```bash
pnpm types:opensource
pnpm lint
pnpm test:unit
pnpm test:components
pnpm test:integration
pnpm build:opensource
```

当前实际存在的测试目录：

```text
tests/
├── components/
│   ├── oa-approval/
│   ├── organization/
│   ├── platform/
│   └── shared/
├── integration/
│   └── shared/
└── unit/
    ├── access/
    ├── api/
    ├── boundaries/
    ├── filters/
    ├── oa-approval/
    ├── organization/
    ├── permissions/
    ├── platform/
    ├── shared/
    └── utils/
```

测试分层：

- `unit/`：纯函数、权限、API 参数、过滤器和边界测试
- `components/`：React 组件交互测试
- `integration/`：页面、Query、Mutation 与 API Mock 的组合测试

详细测试约定请参考 [tests/README.md](./tests/README.md)。

## 项目目录

```text
src/
├── api/             # API Client 和请求类型
├── capabilities/    # 上传等能力
├── components/      # 通用组件和 UI 组件
├── constants/       # 路由、权限及业务常量
├── features/        # 业务功能模块
├── hooks/           # 公共 Hooks
├── i18n/            # 国际化资源
├── layouts/         # 页面布局
├── pages/           # 页面级组件
├── permissions/     # 权限逻辑
├── routes/          # 路由和菜单
├── runtime/         # RuntimeProvider 和运行时上下文
├── standalone/      # 独立运行入口和本地适配器
├── store/           # 状态管理
├── styles/          # 全局和嵌入式样式
└── utils/           # 工具函数

enterprise/src/
├── api/             # 企业版 API
├── features/        # 企业版业务模块
├── i18n/            # 企业版国际化资源
├── routes/          # 企业版路由
└── standalone/      # 企业版 Standalone 适配
```

## Feature 模块约定

业务模块通常采用以下结构：

```text
features/example/
├── api.ts
├── constants.ts
├── types.ts
├── queries.ts
├── mutations.ts
├── utils.ts
├── components/
└── example-page.tsx
```

建议：

- API 请求和类型分离
- 服务端状态使用 TanStack Query
- 业务逻辑放在 Feature 内部
- 公共组件放在 `src/components`
- 企业专属实现放在 `enterprise/src`
- 页面入口、菜单、权限和国际化保持同步

## 路由、菜单和权限

新增页面时，需要同步检查：

```text
src/constants/routes.ts
src/routes/menu.ts
src/routes/route-access.ts
enterprise/src/routes/edition.tsx
```

通常需要完成：

1. 定义 `RouteName`
2. 定义 `RoutePath`
3. 注册页面路由
4. 配置访问权限
5. 添加菜单图标和排序
6. 添加中英文文案
7. 验证 Embedded 和 Standalone 两种模式

## UI 开发规范

新组件优先使用：

- Tailwind CSS
- shadcn/ui
- 共享 `cn()` 工具
- 语义化颜色 Token

页面优先复用：

- `PageHeader`
- `DataTable`
- `ListPagination`
- `ListShell`
- `ListFilterPanel`
- `Dialog`
- `Badge`
- `Avatar`

详细视觉、布局和交互规则请参考 [UI-DESIGN.md](./UI-DESIGN.md)。

## API 与 Runtime

- API Client 通过 Runtime 注入
- 功能模块不要自行创建全局 Axios 实例
- API URL、请求类型和 Query 分层维护
- 企业版 API 可以在 `enterprise/src/api` 中覆盖
- 宿主模式使用宿主提供的 API Client
- Standalone 模式使用 `src/standalone` 创建本地 API Client

## Package 导出

```text
@dtyq/magic-admin-v2
@dtyq/magic-admin-v2/upload
@dtyq/magic-admin-v2/embedded.css
@dtyq/magic-admin-v2/styles.css
```

对应文件：

```text
src/index.ts
src/capabilities/upload.ts
src/styles/embedded.css
src/styles/globals.css
```

## 常见问题

### 宿主模式和 Standalone 模式有什么区别？

宿主模式依赖 `magic-web` 提供登录态、API Client、组织上下文和路由；Standalone 模式由 Admin V2 自己完成初始化，适合独立开发和联调。

### 企业版代码在开源版中不可用

这是预期行为。开源版构建只解析 `src`，不会加载 `enterprise/src`。

### HTTPS 证书找不到

检查 `DEV_HTTPS_KEY` 和 `DEV_HTTPS_CERT`，并确认对应证书文件存在。

### 443 端口无法启动

使用普通端口：

```bash
pnpm dev:enterprise:local
```

### Standalone 页面提示未认证

检查以下配置：

```env
VITE_DEV_AUTH_ENABLED=
VITE_DEV_MAGIC_AUTH_TOKEN=
VITE_DEV_MAGIC_ORGANIZATION_CODE=
```

同时确认 API 地址、Token 和组织编码正确。

### 修改 Tailwind class 后样式没有生效

确认新增文件所在目录已被 Tailwind 扫描，并检查修改的是正确版本层：

- 开源版：`src`
- 企业版：`enterprise/src`

## 相关文档

- [AI 页面开发快速规范](./AI-PAGE-DEVELOPMENT.md)
- [UI 设计规范](./UI-DESIGN.md)
- [测试目录约定](./tests/README.md)
- [平台系统能力配置指南](./docs/platform-system-capabilities-config-guide.md)
- [Magic Web README](../../README.md)
- [贡献指南](../../../../CONTRIBUTING_CN.md)
