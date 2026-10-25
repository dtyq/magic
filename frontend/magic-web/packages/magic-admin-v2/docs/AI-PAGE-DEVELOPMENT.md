# Admin V2 新页面开发规范（AI 快速入口）

> 本文件是 Admin V2 新页面的快速执行规范，按当前共享组件实现和已上线业务页面整理。目标是让 AI 和开发同事在新增页面时，默认得到与现有页面一致的页面壳、间距、筛选、表格和响应式行为。
>
> 架构、API、权限、Overlay、测试等细节见 [`DEVELOPMENT-GUIDE.md`](./DEVELOPMENT-GUIDE.md)；颜色、排版、状态和视觉细节见 [`UI-DESIGN.md`](./UI-DESIGN.md)。

## 0. 规范来源和判断顺序

开发前按以下顺序判断，不要从旧示例或个人习惯重新设计页面：

1. `src/components` 中当前共享组件的实际实现和 props。
2. 与需求最接近的已上线业务 feature，优先参考它的页面结构、信息分组和移动端行为。
3. 本文件、[`DEVELOPMENT-GUIDE.md`](./DEVELOPMENT-GUIDE.md) 和 [`UI-DESIGN.md`](./UI-DESIGN.md)。
4. `src/features/ui-examples` 只用于展示组件状态，不是新页面模板；其中的旧 `ExamplePageShell`、`FilterSheet` 和本地设置分区实现不能覆盖共享组件规范。

如果实现、已上线页面和文档不一致，以当前共享组件实现及已上线页面为准，并在同一个变更中同步修正文档。旧 admin、历史示例和旧文档只用于理解业务字段、枚举、接口或迁移背景，不作为新 UI 形态的依据。

## 1. 唯一页面基线

除全屏编辑器、工作流画布等确实需要独立工作区的特殊页面外，所有路由入口业务页面统一使用：

```text
DashboardLayout
└── ListShell
    ├── PageHeader
    ├── Separator
    └── page content
```

不要在业务页面内重新实现页面标题区、页面级滚动容器、分割线或外层页面间距。标准页面外壳由以下共享组件负责：

| 组件                     | 统一负责的内容                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardLayout`        | Sidebar、Header、主滚动区域和运行时品牌。                                                                                                |
| `ListShell`              | 页面高度、页面级滚动、`PageHeader`、`Separator` 和内容区间距。                                                                           |
| `PageHeader`             | 标题、描述、标题附加状态和右侧操作。通过 `ListShell.actions` 传入操作。                                                                  |
| `PageHeaderActionButton` | 页面头部主要操作及响应式按钮。                                                                                                           |
| `ListFilterPanel`        | 桌面端筛选网格、移动端筛选入口和底部 Sheet。                                                                                             |
| `ListPagination`         | 业务列表统一分页。                                                                                                                       |
| `DataTable`              | 桌面表格、移动端行卡片、详情 Sheet 和响应式列布局。移动端卡片是 `DataTable` 内部能力，不要直接寻找或新增 `MobileDataCard` 作为页面组件。 |
| `SectionNavigation`      | 设置页、详情页的响应式分区导航：移动端 Select、中等宽度 Tabs、宽屏侧边导航。                                                             |

## 2. 页面类型选择

| 需求              | 默认结构                                                        | 首选组件                                                                              |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 数据管理列表      | `ListShell → ListFilterPanel → DataTable/List → ListPagination` | `ListShell`、`ListFilterPanel`、`DataTable`、`ListPagination`                         |
| 简单卡片/资源列表 | `ListShell → ListFilterPanel → Card/List → ListPagination`      | `ListShell`、`ListFilterPanel`、`Card` 或简单列表；不额外创建移动端卡片组件           |
| 详情页            | `ListShell → Summary/Status → Tabs/Sections → Actions`          | `ListShell`、`Badge`、`Tabs`、`SectionNavigation`；详情 Sheet 仅用于局部详情          |
| 配置/设置页       | `ListShell → SectionNavigation → Card/分区容器`                 | `ListShell`、`SectionNavigation`、`Card` 和现有表单组件                               |
| 创建/编辑表单     | `ListShell → Form sections → stable footer`                     | React Hook Form、Zod、`DialogFormField`；复杂长表单按现有页面选择 `Dialog` 或 `Sheet` |
| 指标看板          | `ListShell → metrics → charts/activity`                         | `Card`、现有图表和活动列表组件                                                        |
| 多步骤流程        | `ListShell → step indicator → current step → actions`           | 复用现有步骤结构；没有现成结构时先参考最接近的已上线页面                              |
| 全屏编辑器/画布   | 特殊全屏工作区                                                  | 只有确有空间需求时例外，并在 PR 中说明原因                                            |

如果需求同时符合多个类型，优先选择最接近的已上线页面，不要自行组合新的页面壳。

## 3. 可复制的标准模板

### 3.1 列表页

```tsx
return (
  <ListShell
    title={t("nav.item.example")}
    description={t("nav.desc.example")}
    actions={
      <PageHeaderActionButton>
        {t("common.create")}
      </PageHeaderActionButton>
    }
  >
    <ListFilterPanel
      value={filters}
      onChange={handleFilterChange}
      onApply={handleMobileFilterApply}
      onReset={resetFilters}
      createDefaultValue={createDefaultFilters}
      title={t("common.filter")}
      resetLabel={t("common.reset")}
      applyLabel={t("common.apply")}
      renderFields={({ value, onChange, layout }) => (
        <>
          {/* 每个控件使用 FilterControlField，并填满所在网格单元。 */}
        </>
      )}
    />

    <DataTable ... />
    <ListPagination ... />
  </ListShell>
)
```

### 3.2 详情、配置和表单页

```tsx
return (
  <ListShell
    title={t("nav.item.example")}
    description={t("nav.desc.example")}
    actions={...}
  >
    <SectionNavigation ... />
    <Card>
      {/* 详情值、配置分区或表单字段 */}
    </Card>
  </ListShell>
)
```

配置和详情默认先展示预览态；进入编辑态后，保持相同的分区结构，并提供稳定的保存和取消操作。移动端不要另起一套信息层级，只把导航和内容调整为 `SectionNavigation` 的响应式表现。

## 4. 列表筛选和响应式行为

### 桌面端

1. 使用 `ListFilterPanel`，不要自行实现筛选工具栏。
2. 字段使用响应式网格：宽屏最多 4 列，较窄桌面 2 列；当前共享实现对应 `sm:grid-cols-2 xl:grid-cols-4`。
3. 每个字段由 `FilterControlField` 包裹，控件使用 `w-full` 填满网格单元。
4. 文本字段使用 `useListQueryParams` 的短 debounce；Select 和时间筛选即时更新。
5. 重置按钮固定在筛选区域最后一列。
6. 页面级操作通过 `ListShell.actions` 或 `ListFilterPanel.actions` 放置，不新增另一套工具栏。

### 移动端

1. 筛选字段收起到一个 Lucide `Filter` 图标按钮；必须有 `aria-label`，不要额外显示重复的文本或数字 Badge。
2. `ListFilterPanel` 使用当前实现的底部 Sheet：`side="bottom"`、约 `85vh` 高度、顶部圆角。
3. Sheet 内编辑草稿；关闭时丢弃未应用修改，点击“应用”后才写入页面筛选状态并重新请求列表。
4. Sheet Footer 固定提供“重置”和“应用”，并处理底部安全区。
5. 页面级操作通过共享 `actions` 插槽提供，移动端与筛选入口并列展示。
6. 表格无法在小屏完整呈现时，使用 `DataTable` 内置的移动端行卡片和详情 Sheet；确有需要时保留横向滚动，不得压缩到表头、状态、日期和短标签换行。

## 5. 统一样式、布局和状态

- 页面外边距、标题区、分割线和内容滚动由 `ListShell` 统一负责；业务页面不要再套页面级 `overflow-y-auto`。
- 标题使用路由对应的 `nav.item.*`，描述使用 `nav.desc.*`；不要在页面中另写一套标题和描述。
- 新 UI 使用 shadcn/ui + Tailwind，并使用语义化颜色 token；不要新增 Less、CSS Modules 或 styled-components。
- 用户可见文案必须使用 i18n，并同时维护 `zh_CN`、`en_US`。
- 状态使用共享 `Badge`；图标按钮必须有 `aria-label` 或 Tooltip。
- 列表长文本使用 `truncate`；状态、类型、日期、数字和短枚举使用 `whitespace-nowrap`。
- 页面必须设计 Loading、Empty、Error、Permission denied、Not found、Disabled 和 Success 状态。
- 首屏 Skeleton 只覆盖动态内容，不能替换标题、筛选器、Tabs 或设置导航；刷新和筛选时尽量保留已有页面结构，避免整页闪烁。
- 异步操作成功/失败统一使用顶部居中的 `sonner`。
- 表格、卡片、详情和配置分区保持稳定的信息密度；不要为了“丰富”增加无业务价值的 Hero、宣传卡片或卡片套卡片。

## 6. 已废弃的页面规则

以下旧规则不再适用于新页面：

| 旧规则/旧实现                                     | 当前统一规则                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 右侧 `Sheet` 作为列表筛选面板                     | 使用 `ListFilterPanel` 当前实现的底部 Sheet。                                                                                             |
| 新页面直接使用 `FilterSheet`                      | `FilterSheet` 仅供尚未迁移的旧页面维护，新页面不得新增引用。                                                                              |
| `ExamplePageShell` 作为页面模板                   | 使用 `ListShell`；`ui-examples` 只作为展示参考。                                                                                          |
| `MobileDataCard` 作为页面级共享组件               | 使用 `DataTable` 的内置移动端行卡片能力；非表格页面根据内容使用 `Card` 或简单列表。                                                       |
| `SettingsSurface`、`SettingsSection` 作为共享组件 | 使用 `ListShell`、`SectionNavigation`、`Card` 和现有表单/分区容器；不要把 UI 示例中的本地函数当作公共 API。                               |
| 筛选字段最多 4 个                                 | 当前 `useListQueryParams` 支持的文本 debounce 字段按实际实现维护；目前页面规范按最多 5 个字段编排，需要更多字段时先扩展共享 hook 和测试。 |
| 每个页面自行实现标题、分割线、滚动容器和分页器    | 统一复用 `ListShell`、`PageHeader`、`Separator`、`ListPagination`。                                                                       |

只有全屏编辑器、工作流画布等确实需要独立工作区的页面可以例外；例外必须复用基础 token 和共享组件，并在 PR 中说明为什么不能使用 `ListShell`。

## 7. 开发完成检查

- [ ] 已选择正确的页面类型，并参考同类已上线业务页面。
- [ ] 路由入口使用 `ListShell`，或已说明特殊页面例外。
- [ ] 标题/描述使用 `nav.item.*`、`nav.desc.*`。
- [ ] 列表使用 `ListFilterPanel`、共享表格/卡片和 `ListPagination`。
- [ ] 桌面端和移动端行为都已实现，并与共享组件当前实现一致。
- [ ] Loading、Empty、Error、Permission denied、Not found、Disabled、Success 等状态完整。
- [ ] 中英文 i18n 已同步。
- [ ] 未新增页面级临时样式、重复页面壳或旧筛选组件。
- [ ] 已运行与改动相关的 lint、types 和测试，并区分已有基线失败。
