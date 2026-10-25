/**
 * 开源版路由常量。
 *
 * 用于路由定义、菜单元数据和导航判断。企业版路由常量放在
 * `enterprise/src/constants/edition-routes.ts`，由 `routes.ts` 合并。
 */
export const BaseRouteName = {
	/* ---------- 通用路由 ---------- */

	/** 应用根路由。 */
	Root: "root",
	/** 应用默认索引路由。 */
	Index: "index",
	/** 管理后台概览。 */
	Overview: "overview",
	/** 无权限提示页。 */
	Forbidden: "forbidden",
	/** 404 兜底页。 */
	NotFound: "not-found",

	/* ---------- 平台管理 ---------- */

	/** 平台信息。 */
	PlatformInfo: "platform-info",
	/** 平台应用菜单。 */
	PlatformAppMenu: "platform-app-menu",
	/** 平台模型列表。 */
	PlatformModelList: "platform-model-list",
	/** 平台模型服务商列表。 */
	PlatformProviderList: "platform-provider-list",
	/** 系统能力管理。 */
	PlatformSystemCapabilities: "platform-system-capabilities",
	/** PPT 模板管理。 */
	PlatformSlidesTemplate: "platform-slides-template",
	/** 官方员工管理。 */
	PlatformOfficialStaff: "platform-official-staff",
	/** 官方员工市场。 */
	PlatformOfficialMarketplace: "platform-official-marketplace",
	/** 平台发布审核。 */
	PlatformPublishReview: "platform-publish-review",

	/* ---------- 开发示例 ---------- */

	/** 示例仪表盘。 */
	ExamplesDashboard: "examples-dashboard",
	/** 示例列表。 */
	ExamplesList: "examples-list",
	/** 示例卡片。 */
	ExamplesCards: "examples-cards",
	/** 示例表单。 */
	ExamplesForm: "examples-form",
	/** 示例单列表单。 */
	ExamplesFormSingle: "examples-form-single",
	/** 示例多列表单。 */
	ExamplesFormMulti: "examples-form-multi",
	/** 示例设置页。 */
	ExamplesSettings: "examples-settings",
	/** 示例详情页。 */
	ExamplesDetail: "examples-detail",
	/** 示例详情编辑页。 */
	ExamplesDetailEdit: "examples-detail-edit",
	/** 示例空状态页。 */
	ExamplesEmpty: "examples-empty",
	/** 示例分步表单。 */
	ExamplesWizard: "examples-wizard",
	/** 示例弹窗表单。 */
	ExamplesDialog: "examples-dialog",
	/** 示例抽屉详情。 */
	ExamplesSheet: "examples-sheet",
} as const satisfies Record<string, string>

/** 开源版一级菜单分区。 */
export const BaseRouteSection = {
	/** 概览入口；不进入常规侧边栏分组。 */
	Overview: "overview",
	/** 平台管理。 */
	Platform: "platform",
	/** 开发示例。 */
	Examples: "examples",
} as const satisfies Record<string, string>

/** 开源版二级菜单分组。 */
export const BaseRouteGroup = {
	/* ---------- 通用路由 ---------- */

	/** 概览入口；不进入常规侧边栏分组。 */
	Overview: "overview",

	/* ---------- 平台管理 ---------- */

	/** 基础设置。 */
	BasicSettings: "basic-settings",
	/** 智能体管理。 */
	AgentManagement: "agent-management",
	/** 模型管理。 */
	ModelManagement: "model-management",

	/* ---------- 开发示例 ---------- */

	/** 示例仪表盘。 */
	ExampleDashboard: "example-dashboard",
	/** 数据展示示例。 */
	ExampleData: "example-data",
	/** 表单流程示例。 */
	ExampleForms: "example-forms",
	/** 设置页面示例。 */
	ExampleSettings: "example-settings",
	/** 详情展示示例。 */
	ExampleDetails: "example-details",
	/** 状态反馈示例。 */
	ExampleStates: "example-states",
} as const satisfies Record<string, string>

/**
 * 开源版路由 path。
 *
 * 值均为 React Router 路由定义使用的相对路径。
 */
export const BaseRoutePath = {
	/* ---------- 通用路由 ---------- */

	/** 管理后台概览。 */
	Overview: "overview",
	/** 无权限提示页。 */
	Forbidden: "403",
	/** 404 兜底匹配。 */
	NotFound: "*",

	/* ---------- 平台管理 ---------- */

	/** 平台信息。 */
	PlatformInfo: "platform/basic/platform-info",
	/** 平台应用菜单。 */
	PlatformAppMenu: "platform/operations/app-menu",
	/** 平台模型列表。 */
	PlatformModelList: "platform/models/model-list",
	/** 平台模型服务商列表。 */
	PlatformProviderList: "platform/models/provider-list",
	/** 系统能力管理。 */
	PlatformSystemCapabilities: "platform/agents/system-capabilities",
	/** PPT 模板管理。 */
	PlatformSlidesTemplate: "platform/agents/slides-template",
	/** 官方员工管理。 */
	PlatformOfficialStaff: "platform/agents/official-staff",
	/** 官方员工市场。 */
	PlatformOfficialMarketplace: "platform/agents/official-marketplace",
	/** 平台发布审核。 */
	PlatformPublishReview: "platform/agents/publish-review",

	/* ---------- 开发示例 ---------- */

	/** 示例仪表盘。 */
	ExamplesDashboard: "examples/dashboard",
	/** 示例列表。 */
	ExamplesList: "examples/list",
	/** 示例卡片。 */
	ExamplesCards: "examples/cards",
	/** 示例表单。 */
	ExamplesForm: "examples/form",
	/** 示例单列表单。 */
	ExamplesFormSingle: "examples/form-single",
	/** 示例多列表单。 */
	ExamplesFormMulti: "examples/form-multi",
	/** 示例设置页。 */
	ExamplesSettings: "examples/settings",
	/** 示例详情页。 */
	ExamplesDetail: "examples/detail",
	/** 示例详情编辑页。 */
	ExamplesDetailEdit: "examples/detail-edit",
	/** 示例空状态页。 */
	ExamplesEmpty: "examples/empty",
	/** 示例分步表单。 */
	ExamplesWizard: "examples/wizard",
	/** 示例弹窗表单。 */
	ExamplesDialog: "examples/dialog-form",
	/** 示例抽屉详情。 */
	ExamplesSheet: "examples/sheet-detail",
} as const satisfies Record<string, string>

/** 开源版非路由声明 pattern 使用的相对重定向目标。 */
export const BaseRouteRedirectPath = {
	/** 根路由进入概览页。 */
	Overview: BaseRoutePath.Overview,
	/** 示例表单父路由进入单列表单页。 */
	ExamplesFormSingle: "../form-single",
} as const satisfies Record<string, string>

/** 开源版同级页面之间导航时使用的相对路径。企业版路径由 Overlay 补充。 */
export const BaseRouteRelativePath = {} as const

/** 开源版路由声明外使用的应用内绝对链接。 */
export const BaseRouteHref = {
	/** 管理后台概览绝对链接。 */
	Overview: `/${BaseRoutePath.Overview}`,
} as const satisfies Record<string, string>
