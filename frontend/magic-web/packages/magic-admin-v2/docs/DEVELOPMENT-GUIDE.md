# Magic Admin V2 页面开发规范

> 适用范围：`frontend/magic-web/packages/magic-admin-v2` 下的所有 React、TypeScript、路由、API、国际化、测试和样式代码。
>
> 规范性质：本文件负责架构、目录、代码组织、数据流、权限、版本 Overlay、测试和交付流程。新页面的快速执行入口是 [`AI-PAGE-DEVELOPMENT.md`](./AI-PAGE-DEVELOPMENT.md)，视觉细则见 [`UI-DESIGN.md`](./UI-DESIGN.md)。三者冲突时，以当前共享组件实现、具体页面需求、设计稿和产品确认结果为准，并在 PR 中说明偏差。

## 1. 开发前必须遵守的原则

1. **先找同类页面，再写新代码。** 优先参考已经上线的同类业务模块；`src/features/ui-examples` 仅用于查看示例，不覆盖当前共享组件规范，不要从空白页面自行发明布局、筛选、分页或弹窗交互。
2. **页面按 feature 组织。** 一个业务域的页面、组件、API、Query、Mutation、类型和工具函数放在同一个 `features/<feature-name>/` 目录；只有跨业务复用的能力才放入 `src/components`、`src/hooks`、`src/api` 或 `src/utils`。
3. **新 UI 统一使用 shadcn/ui + Tailwind。** 组件从 `@magic-admin-v2/components/ui/`* 或 `@magic-admin-v2/components/*` 引入；不要在同一组件中混用 Tailwind 与 antd-style，不要新增 Less、CSS Modules、styled-components。
4. **业务逻辑与展示分离。** API 请求写在 `api.ts`，查询写在 `queries.ts`，写操作写在 `mutations.ts`，复杂状态和副作用放到 Hook，页面组件负责组合和交互编排。
5. **用户可见文案必须国际化。** 新增或修改文案时同时更新 `zh_CN` 和 `en_US`；不要在 JSX 中写业务中文或英文硬编码。
6. **权限必须双层保护。** 路由入口使用 `validate` 保护页面访问，页面内使用 `useRights` 控制按钮、行操作和写操作；不能只隐藏按钮而不保护路由，也不能只保护路由而让无权限按钮可操作。
7. **企业版与开源版必须可解释。** 公共实现放 `src`，企业专属实现放 `enterprise/src`；企业 Overlay 使用与 `src` 相同的相对路径覆盖。任何公共文件修改后都必须检查企业目录是否存在同路径文件。
8. **所有异步状态都要有设计。** 至少考虑 loading、fetching、empty、error、permission denied、not found、success、disabled；首屏骨架只覆盖动态内容，不能让标题和静态筛选区域闪烁。
9. **先保证类型安全，再补样式。** 使用严格 TypeScript，API 入参、出参、表单值、枚举映射和组件 Props 都要有明确类型；禁止为了过编译使用 `any`、无意义断言或 `@ts-ignore`。



### 必须遵守

- 用户可见文案使用静态 i18n key，并同步更新 `zh_CN` 与 `en_US`。
- 路由入口使用 `validate`，页面内写操作使用 `useRights`。
- 服务端数据使用 TanStack Query；列表优先使用共享筛选、`ListShell` 和 `ListPagination`。
- 不使用 `any`、无理由的 `@ts-ignore` 或临时硬编码样式绕过。
- 图标按钮提供 `aria-label` 或 Tooltip；异步流程完整处理 loading、empty、error 和权限不足状态。

## 2. 技术基线和路径约定



### 2.1 技术栈

- React 18 + TypeScript + Vite
- React Router 6
- TanStack Query 5：服务端数据、缓存、失效和请求状态
- TanStack Table：复杂业务表格
- React Hook Form + Zod：表单状态和校验
- Zustand：确有跨页面或跨组件需求时使用的客户端状态
- Tailwind CSS + shadcn/ui：新页面唯一默认样式方案
- `react-i18next` / `i18next`：国际化
- `sonner`：异步操作成功和失败提示
- `lucide-react`：默认图标库；只有 Lucide 不具备对应图标时才考虑项目已有的 Tabler 图标



### 2.2 导入别名

Admin V2 使用 `@magic-admin-v2/*` 作为源码别名。新代码优先使用绝对别名，不要跨多级目录写脆弱的 `../../../` 相对路径。

```tsx
import { PageHeader } from "@magic-admin-v2/components/page-header"
import { Button } from "@magic-admin-v2/components/ui/button"
import { useAppMenuListQuery } from "@magic-admin-v2/features/platform-app-menu/queries"
```



### 2.3 目录职责

```text
packages/magic-admin-v2/
├── src/                         # 公共实现、开源版 baseline
│   ├── api/                     # API 工厂、公共 API 类型和 URL
│   ├── components/              # 跨 feature 复用的页面壳、业务组件、ui 组件
│   ├── constants/               # 开源路由/权限、合并入口和运行模式
│   ├── features/                # 按业务域组织的页面和模块
│   ├── hooks/                   # 跨 feature 复用的 Hook
│   ├── i18n/                    # i18n provider、loader、消息目录
│   ├── layouts/                 # Dashboard 外壳和全局布局
│   ├── pages/                   # 404、无权限、首页等框架级页面
│   ├── permissions/             # 权限判断纯函数
│   ├── routes/                  # 公共路由、菜单、访问控制
│   ├── runtime/                 # Embedded/Standalone 运行时上下文
│   ├── store/                   # 客户端全局状态
│   └── utils/                   # 跨业务纯工具函数
├── enterprise/src/              # 企业版 Overlay；只放企业差异实现
├── tests/
│   ├── unit/                    # 纯函数、权限、API 参数、边界
│   ├── components/              # React 组件交互
│   ├── integration/             # 页面 + Query/Mutation + API mock
│   ├── e2e/                     # 路由级、关键业务链路
│   ├── helpers/                 # 测试辅助
│   └── fixtures/                # 稳定测试数据
└── docs/                        # 开发规范、模块说明和操作指南
```

目录命名使用 kebab-case，例如 `platform-tenant-list`、`filter-sheet`。页面文件使用 `*-page.tsx`，组件文件使用 kebab-case，Hook 文件使用 `use-*.ts`。

## 3. Feature 模块标准

新页面默认创建如下结构，按实际复杂度增减文件，不要为了形式创建空目录：

```text
src/features/<feature-name>/
├── <feature-name>-page.tsx       # 路由页面入口；通常由路由 lazy 加载
├── components/                   # 仅本 feature 使用的 UI
├── api.ts                         # API factory，接收 HttpClient
├── queries.ts                     # useQuery、query keys
├── mutations.ts                   # useMutation、成功后的 cache invalidation
├── types.ts                       # 接口、表单、状态、联合类型
├── constants.ts                   # feature 私有常量和映射
├── utils.ts                       # feature 私有纯函数
├── hooks/                         # 复杂的 feature Hook
└── permissions.ts                 # feature 特有权限组合（需要时创建）
```

判断是否应抽到共享目录：

- 只被一个 feature 使用：留在该 feature。
- 被两个以上 feature 使用且语义稳定：抽到 `src/components` 或 `src/hooks`。
- 只是为了“以后可能复用”：不要提前抽象。
- 抽到共享目录后，必须保证不依赖某个业务域的 API、文案或状态。



### 3.1 页面组件写法

页面组件应负责：读取路由/权限/i18n 上下文、组装 Query/Mutation、管理页面级 UI 状态、组合子组件。不要在页面文件中堆积 API URL、请求转换、复杂表格列计算或重复校验逻辑。

推荐骨架：

```tsx
import { useTranslation } from "react-i18next"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import { useFeatureListQuery } from "@magic-admin-v2/features/example/queries"

export default function ExamplePage() {
	const { t } = useTranslation()
	const canEdit = useRights("admin.example.edit")
	const query = useFeatureListQuery(/* 已序列化的查询参数 */)

	return (
		<ListShell title={t("nav.item.example")} description={t("nav.desc.example")}>
			{/* Toolbar / filters */}
			{/* Dynamic table or content */}
			{/* ListPagination */}
		</ListShell>
	)
}
```

说明：路由当前采用 `lazy(() => import(...))`，页面入口保留 `default export` 与现有路由写法一致；普通组件、Hook、工具函数优先使用 named export。

### 3.2 组件拆分

- 页面壳、筛选区、表格、单元格、Dialog、Sheet 分开拆分。
- 表格列定义、状态 Badge、表单 schema 和数据转换不要全部塞进页面 JSX。
- 复杂组件应至少拆出 `types.ts`、`utils.ts` 或 `hooks/` 中的一项；纯展示组件不强行引入状态管理。
- 组件 Props 使用明确的 interface/type；事件命名使用动词，例如 `onEdit`、`onDelete`、`onStatusChange`。
- 图标按钮必须有 `aria-label` 或 Tooltip；图标仅作为装饰时使用 `aria-hidden="true"`。



## 4. 页面类型和布局



### 4.1 列表页

默认结构：`ListShell/PageHeader → Toolbar/FilterBar → DataTable/List → ListPagination`。

- 使用共享 `ListShell`；不要每个页面重新实现标题、分割线和滚动容器。
- 标题和描述优先使用路由对应的 `nav.item.*`、`nav.desc.*` 文案。
- 搜索区统一使用 `ListFilterPanel`：页面通过 `renderFields` 提供字段，桌面端 4 列网格、移动端底部 Sheet；搜索输入使用 `FilterSearchInput` 或同类共享控件，文本输入短 debounce（`useListQueryParams` 的 `debounceFields`），Select 即时更新。
- 搜索/筛选控件必须有可见 label；不能只依赖 placeholder 或当前值解释用途。
- API 只有分字段搜索参数时，每个字段使用独立的搜索控件并映射到对应参数，不使用“搜索字段 Select + 单一输入框”的合并控件，也不伪造 `keyword`。
- 输入有值时提供清除按钮。
- 分页使用共享 `ListPagination`；页码从 1 开始；切换筛选条件后重置到第一页。
- 表格使用固定列宽：每列设置 `size`，核心列宽总和形成 `minWidth`；不足时允许横向滚动。
- 状态、类型、日期、数字和短枚举使用 `whitespace-nowrap`；长名称、ID、路径使用 `truncate`。
- 行操作统一放在右侧 `DropdownMenu`，危险操作放在分隔线后并使用 destructive 语义。
- 业务列表不让表格父容器独立纵向滚动；页面主内容自然滚动，局部弹窗/抽屉才允许内部纵向滚动。



### 4.2 详情页、配置页和表单页

- 详情页：`PageHeader → Summary/Status → Tabs 或分区 → 关键操作`。
- 配置型页面默认预览态，点击“编辑”后进入编辑态；预览与编辑保持相同分区结构。
- 编辑态必须有保存和取消；取消恢复最近一次服务端数据或进入编辑前数据。
- 配置状态、启停状态、维护状态使用共享 `Badge`，不要用裸文本。
- 表单字段必须有 label；输入控件提供有信息量的 placeholder；校验错误靠近字段。
- CRUD Dialog 参考应用菜单表单：`DialogContent overflow-visible sm:max-w-2xl`、`form.grid.gap-4`、共享 `DialogFormField`、Footer 位于 form 内。
- 日期范围使用共享 Range Picker；不要拆成两个散落输入框。
- 复杂表单按业务分组；提交区域位置稳定；危险操作明确区分并要求确认。



### 4.3 Dashboard、设置、向导和 Sheet

- Dashboard 先明确指标、时间范围和空态，再决定卡片和图表；不为了“丰富”添加装饰卡片。
- 设置页优先使用 `SectionNavigation` 或同类左导航 + 右内容结构。
- Wizard 明确当前步骤、可返回性、提交条件和失败恢复路径。
- 移动端搜索条件统一收起到 `ListFilterPanel` 的底部 Sheet（草稿 + “重置/应用”）；详情等其他场景按上下文使用 `Sheet`。

视觉、颜色、间距、Badge、Avatar、Skeleton、响应式和滚动细则必须同时遵守 [UI-DESIGN.md](UI-DESIGN.md)。

## 5. 数据、Query 和 Mutation



### 5.1 API 层

`api.ts` 只负责把业务 API 封装成可注入的 API factory，不直接读取 React 状态，不调用 Toast，不操作 Query cache。

```ts
export function createExampleApi(client: HttpClient) {
	return {
		getList(params: ExampleListParams, options?: RequestOptions) {
			return client.post<ExamplePageResult>(RequestUrl.exampleList, params, options)
		},
		update(id: string, values: ExampleFormValues, options?: RequestOptions) {
			return client.post<ExampleItem>(RequestUrl.exampleUpdate, { id, ...values }, options)
		},
	}
}
```

- API 出参和入参分别建模；不要在页面内直接拼请求对象。
- 服务端枚举使用 `as const` 对象 + union type，保持与现有 feature 一致；不要新建数字 enum。
- 需要兼容后端可选字段时，在 API 转换函数中归一化，不把大量 `?.` 传播到 JSX。
- 请求支持 `AbortSignal` 时把 Query 提供的 `signal` 传入 client。
- API factory 创建后，注册到 `src/api/base/createApis.ts` 或 `src/api/edition.ts`；企业 API 不得注册到公共 base。



### 5.2 Query 层

```ts
export const exampleKeys = {
	all: ["example"] as const,
	list: (params: ExampleListParams) => [...exampleKeys.all, "list", params] as const,
	detail: (id: string) => [...exampleKeys.all, "detail", id] as const,
}

export function useExampleListQuery(params: ExampleListParams) {
	const { example } = useApis()
	return useQuery({
		queryKey: exampleKeys.list(params),
		queryFn: ({ signal }) => example.getList(params, { signal }),
	})
}
```

- Query key 必须稳定、包含所有影响请求结果的参数。
- `enabled` 用于 detail 等依赖 ID 的请求，避免空 ID 请求。
- 首屏 `isLoading` 与已有数据刷新 `isFetching` 分开处理。
- 列表筛选、分页优先使用 `useListQueryParams`，让 URL 参数、debounce 和页码重置行为一致。



### 5.3 Mutation 层

- Mutation 只负责调用 API 和失效相关 Query；成功后使用 `queryClient.invalidateQueries({ queryKey: featureKeys.all })` 或更精确的 key。
- 页面负责根据业务展示 `toast.success` / `toast.error`，避免 API 或 Mutation 层直接弹 Toast。
- 删除、状态切换、批量操作必须在请求期间禁用相关按钮，并在 `finally` 中恢复局部 pending 状态。
- 错误信息优先展示服务端可读 message，没有时回退到 `common.requestFailed`。



## 6. 路由、菜单和权限

新增可导航页面必须同时完成以下事项：

1. 开源路由加在 `src/constants/route-keys.ts`，企业路由加在 `enterprise/src/constants/edition-routes.ts`。`src/constants/routes.ts` 只负责合并，调用方继续从这里取值。
2. 在正确的公共 `src/routes/routes.tsx` 或企业 `enterprise/src/routes/edition.tsx` 注册路由，并使用 `lazy` 加载页面。
3. 设置 `titleKey`、`meta.section`、`meta.group`；详情、编辑、内部跳转等不显示菜单的路由使用 `meta.menuVisible: false`。
4. 开源菜单图标和排序留在 `src/routes/menu.ts`；企业菜单加在 `enterprise/src/routes/edition-menu.ts`。Sidebar icon 必须全局唯一。
5. 开源访问表达式加在 `src/routes/route-access.ts`，企业访问表达式加在 `enterprise/src/routes/route-access.ts`；页面内使用 `useRights` 控制细粒度操作。
6. 在对应 i18n `nav.json` 中同时增加导航名称和描述。
7. 企业权限 key 加在 `enterprise/src/constants/edition-permissions.ts`，企业 API 放在 `enterprise/src`。不要把企业 key、路由或菜单写回 `src`。

访问控制建议：

```ts
export const exampleAccess = and(
	denyPersonalOrganization,
	allowMagic(PERMISSION_KEY_MAP.EXAMPLE_QUERY, PERMISSION_KEY_MAP.EXAMPLE_EDIT),
)
```

- `validate` 决定是否能进入路由，也决定默认菜单是否展示。
- `meta.menuVisible` 只控制菜单展示，不代替访问控制。
- 写操作必须同时检查权限、目标对象状态和接口返回结果。
- 权限不足使用统一的 Access Denied 页面或禁用控件，不自行实现另一套错误页。



## 7. 国际化



### 7.1 文件位置

- 公共文案：`src/i18n/messages/base/{zh_CN,en_US}`。
- 企业文案：`enterprise/src/i18n/messages/edition/{zh_CN,en_US}`。
- 开发示例或仅开发环境文案：对应 `development-base` / `development-edition`。
- 业务域使用独立 namespace JSON，例如 `platformAppMenu.json`、`dataDashboard.json`。



### 7.2 Key 规则

- 使用静态完整 key，例如 `t("common.requestFailed")`、`t("nav.item.appMenu")`。
- 不用变量拼接 key；确需动态 key 时添加注释说明原因。
- 同一业务域的 action、message、confirm、field、status 分组组织。
- 页面标题/描述优先复用导航 key，避免菜单、页面标题和空态文案口径不一致。
- 修改文案必须同步 `zh_CN`、`en_US`，并检查开发环境合并目录是否需要更新。



## 8. 状态、错误和可访问性

每个动态页面至少明确以下状态：


| 状态                | 默认处理                                         |
| ----------------- | -------------------------------------------- |
| 首次 loading        | 使用共享 `Skeleton` / `ListPageSkeleton`，只覆盖动态区域 |
| 后续 fetching       | 保留已有内容，只在按钮、表格或局部区域显示 loading                |
| empty             | 说明当前没有什么，并给出下一步动作                            |
| error             | 展示可读错误和重试入口；不要吞掉异常                           |
| permission denied | 统一权限页或禁用对应操作                                 |
| not found         | 使用统一 Not Found 页面或明确详情空态                     |
| success           | 异步操作成功后 `toast.success`                      |


其他要求：

- 全局 Sonner 使用顶部居中位置，不在业务页面覆盖原生 toast 样式。
- 图标按钮有可访问名称；表单控件有 label；弹窗关闭和焦点行为符合共享组件默认实现。
- 移动端优先，使用项目已有 `useIsMobile`；不要新增另一套 viewport 检测 Hook。
- 不能依赖 hover 才能完成核心操作；触摸端操作目标要足够大。



## 9. 测试和质量门禁

测试放在 `tests/` 对应分层，业务域目录与 feature 对齐：

- `tests/unit/`：权限表达式、参数转换、过滤器、分页工具、纯函数。
- `tests/components/`：表格、表单、Dialog、Sheet、共享组件交互；文件名 `*.component.test.tsx`。
- `tests/integration/`：页面与 Query/Mutation/API mock 组合。
- `tests/e2e/`：路由级和关键链路。

新增页面至少补充：

1. 参数转换或权限逻辑的 unit test。
2. 关键组件交互测试（打开、保存、删除、筛选、分页、禁用态）。
3. 有 API 串联时补一条 integration test，覆盖成功和失败路径。

提交前按改动范围运行：

```bash
cd frontend/magic-web/packages/magic-admin-v2
pnpm lint
pnpm types:enterprise       # 企业版改动
pnpm types:opensource       # 公共/开源版改动
pnpm test:unit
pnpm test:components        # 涉及 React 组件时
pnpm test:integration       # 涉及页面数据流时
```

如果完整命令因环境或已有问题无法执行，必须在 PR/交付说明中写清楚未执行项和替代验证方式。

## 10. 新页面实施流程



### 第一步：明确边界

- 判断页面属于公共版还是企业版。
- 确认页面类型：列表、详情、配置、Dashboard、向导或混合页面。
- 明确查询参数、写操作、权限键、组织范围、空态和错误态。



### 第二步：找参考实现

优先阅读：

- 列表：`features/platform-app-menu`、`features/platform-model-list`。
- 配置/详情：`features/platform-info`、`features/enterprise-info`。
- Dashboard：`enterprise/src/features/data-dashboard`；`features/ui-examples` 只用于查看展示状态。
- 表单/Dialog：应用菜单表单组件和最近的业务表单；不要直接复制 UI 示例页面。
- 设置/详情：`features/platform-info`、`features/enterprise-info`、`features/platform-packages`。
- 共享壳：`components/list-shell.tsx`、`page-header.tsx`、`list-filter-panel.tsx`、`list-pagination/`、`data-table.tsx`、`section-navigation.tsx`。`filter-sheet.tsx` 仅用于尚未迁移的旧页面维护。



### 第三步：先搭骨架再接接口

先完成 feature 目录、类型、路由、页面壳、空态/loading 和静态 i18n，再实现 API、Query、Mutation 和表单细节。不要用页面内假数据掩盖未定义的接口契约。

### 第四步：接入完整链路

API factory → API registry → Query/Mutation → 页面组合 → 路由访问 → 菜单 → i18n → 测试。每一步都检查公共/企业 Overlay 是否正确。

### 第五步：验证和自检

- 桌面和移动宽度检查：标题、筛选、表格、分页、Dialog、Sheet 不溢出、不跳动。
- 中英文检查：长标题、长单词、状态和按钮不换行破坏布局。
- 权限检查：无权限用户不能访问路由或执行写操作。
- 状态检查：首次 loading、刷新 fetching、空数据、接口错误、保存失败、删除确认。
- 构建检查：企业版和开源版 TypeScript 至少各执行一次（按改动范围）。



## 11. AI 协作时的推荐提示词

同事开始新页面时，建议直接把下面内容作为第一条任务说明发给 AI；AI 仍必须读取仓库中的规则文件：

```text
我要在 frontend/magic-web/packages/magic-admin-v2 新增一个页面。
请先读取并遵守：
1. packages/magic-admin-v2/AGENTS.md
2. packages/magic-admin-v2/docs/AI-PAGE-DEVELOPMENT.md
3. packages/magic-admin-v2/docs/DEVELOPMENT-GUIDE.md
4. packages/magic-admin-v2/docs/UI-DESIGN.md
5. 与本页面最接近的现有 feature 和 tests

开始编码前先输出：页面类型、所属 edition、目录计划、路由/菜单/权限/i18n/API 影响面、参考文件和测试计划。
编码时必须沿用已有共享组件和同类页面模式，不要自行发明筛选、分页、弹窗或状态样式；完成后运行受影响的 lint、types 和 tests，并列出未执行项。
```



## 12. PR 自检清单

- [ ] 已阅读本规范和 `UI-DESIGN.md`，并参考至少一个同类页面。
- [ ] feature 目录职责清晰，页面没有堆积 API、复杂转换或重复 UI。
- [ ] 路由、路由常量、菜单分组/顺序、icon、权限和 i18n 已完整接入。
- [ ] API / Query / Mutation 已分层，Query key 包含完整参数，Mutation 成功后正确失效缓存。
- [ ] 公共版/企业版边界明确，已检查同路径 Overlay。
- [ ] loading、fetching、empty、error、permission denied、not found、success 已处理。
- [ ] 所有用户文案同时有 `zh_CN` 和 `en_US`，没有硬编码业务文案。
- [ ] 移动端、键盘、aria-label、tooltip、长文本和横向滚动已验证。
- [ ] 已补充必要的 unit/component/integration tests。
- [ ] 已执行相关 lint、types、tests，并记录结果。
