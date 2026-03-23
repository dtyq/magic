/**
 * 管理后台 SEO 路由配置
 * 与前端 src/pages/magicAdmin/const/routes.ts、各模块 routes 的 path/title 保持一致，
 * 用于服务端直出 HTML 时注入正确的 og:title 等 SEO 信息。
 *
 * 每条配置：path 为 Express 路由路径，titleKey 为 server/locales 中的 i18n key。
 */

const ADMIN_ROUTES = [
	// 根与首页
	{ path: "/admin", titleKey: "admin.routes.admin" },
	{ path: "/admin/home", titleKey: "admin.routes.home" },
	{ path: "/admin/no-authorized", titleKey: "admin.noAuth.title" },
	{ path: "/admin/application/management", titleKey: "admin.nav.application" },
	{ path: "/admin/approval-design", titleKey: "admin.capability.approvalDesign" },

	// AI 管理（独立入口）
	{ path: "/admin/ai", titleKey: "admin.nav.ai" },
	{ path: "/admin/ai/control", titleKey: "admin.nav.aiSubMenu.controlStrategy" },

	// 功能管理
	{ path: "/admin/capability", titleKey: "admin.nav.capability" },
	{ path: "/admin/capability/approval", titleKey: "admin.nav.capabilitySubMenu.oaApproval" },
	{
		path: "/admin/capability/approval/manage",
		titleKey: "admin.nav.capabilitySubMenu.oaApprovalManagement",
	},
	{
		path: "/admin/capability/approval/data-view",
		titleKey: "admin.nav.capabilitySubMenu.oaApprovalDataView",
	},
	{
		path: "/admin/capability/approval/workflow-handover",
		titleKey: "admin.nav.capabilitySubMenu.oaApprovalWorkflowHandover",
	},
	{
		path: "/admin/capability/approval/template-handover",
		titleKey: "admin.nav.capabilitySubMenu.oaApprovalTemplateHandover",
	},
	{
		path: "/admin/capability/approval/limited-time",
		titleKey: "admin.nav.capabilitySubMenu.oaApprovalLimitedTime",
	},

	// 平台管理 - 套餐
	{ path: "/admin/platform", titleKey: "admin.nav.platform" },
	{
		path: "/admin/platform/paid-package",
		titleKey: "admin.nav.platformSubMenu.paidPackage",
	},
	{
		path: "/admin/platform/paid-package/manage",
		titleKey: "admin.nav.platformSubMenu.packageManagement",
	},
	{
		path: "/admin/platform/paid-package/manage/detail",
		titleKey: "admin.nav.platformSubMenu.packageDetail",
	},
	{
		path: "/admin/platform/paid-package/order",
		titleKey: "admin.nav.platformSubMenu.orderManagement",
	},
	// 平台 - 系统设置
	{ path: "/admin/platform/system", titleKey: "admin.nav.platformSubMenu.system" },
	{
		path: "/admin/platform/system/platform-info-management",
		titleKey: "admin.nav.platformSubMenu.platformInfo",
	},
	{
		path: "/admin/platform/system/info-management",
		titleKey: "admin.nav.platformSubMenu.infoManagement",
	},
	{
		path: "/admin/platform/system/proxy-server",
		titleKey: "admin.nav.platformSubMenu.proxyServer",
	},
	// 平台 - AI
	{ path: "/admin/platform/ai", titleKey: "admin.nav.ai" },
	{
		path: "/admin/platform/ai/model",
		titleKey: "admin.nav.aiSubMenu.modelManagement",
	},
	{
		path: "/admin/platform/ai/model/:id",
		titleKey: "admin.nav.aiSubMenu.modelManagement",
	},
	{
		path: "/admin/platform/ai/drawing",
		titleKey: "admin.nav.aiSubMenu.intelligentDrawing",
	},
	{
		path: "/admin/platform/ai/drawing/:id",
		titleKey: "admin.nav.aiSubMenu.intelligentDrawing",
	},
	{
		path: "/admin/platform/ai/mode",
		titleKey: "admin.nav.platformSubMenu.modeManagement",
	},
	{
		path: "/admin/platform/ai/audit",
		titleKey: "admin.nav.platformSubMenu.audit",
	},
	{
		path: "/admin/platform/ai/capability",
		titleKey: "admin.nav.aiSubMenu.powerManagement",
	},
	{
		path: "/admin/platform/ai/capability/:code",
		titleKey: "admin.nav.aiSubMenu.powerManagement",
	},
	// 平台 - 组织
	{
		path: "/admin/platform/organization",
		titleKey: "admin.nav.platformSubMenu.organizationManagement",
	},
	{
		path: "/admin/platform/organization/list",
		titleKey: "admin.nav.platformSubMenu.organizationList",
	},
	{
		path: "/admin/platform/organization/points",
		titleKey: "admin.nav.platformSubMenu.organizationPoints",
	},

	// 企业管理
	{ path: "/admin/enterprise", titleKey: "admin.nav.enterprise" },
	{
		path: "/admin/enterprise/organization",
		titleKey: "admin.nav.enterpriseSubMenu.organization",
	},
	{
		path: "/admin/enterprise/organization/department",
		titleKey: "admin.nav.enterpriseSubMenu.memberAndDepartment",
	},
	{
		path: "/admin/enterprise/organization/group",
		titleKey: "admin.nav.enterpriseSubMenu.userGroup",
	},
	{ path: "/admin/enterprise/ai", titleKey: "admin.nav.ai" },
	{
		path: "/admin/enterprise/ai/control",
		titleKey: "admin.nav.aiSubMenu.controlStrategy",
	},

	// 安全管控
	{ path: "/admin/security", titleKey: "admin.nav.security" },
	{
		path: "/admin/security/authority",
		titleKey: "admin.nav.securitySubMenu.authorityControl",
	},
	{
		path: "/admin/security/authority/admin",
		titleKey: "admin.nav.securitySubMenu.adminAuthority",
	},
	{
		path: "/admin/security/authority/log",
		titleKey: "admin.nav.securitySubMenu.adminLog",
	},
]

/**
 * 创建管理后台 SEO 处理器：根据 titleKey 返回 title/description/keywords，并标记使用默认产品名
 * @param {string} titleKey - server/locales 中的 key，如 admin.routes.home
 * @returns {(req: Request, res: Response, next: NextFunction) => Promise<{ title: string, description: string, keywords: string, useDefaultPlatformTitle: boolean }>}
 */
function createAdminSeoHandler(titleKey) {
	return async function adminSeoHandler(req, res, next) {
		const title = req.__(titleKey) || req.__("admin.routes.admin")
		return {
			title,
			description: title,
			keywords: title,
			useDefaultPlatformTitle: true,
		}
	}
}

/**
 * 返回供 SEOHandler 注册用的 [path, handler][] 列表（无 clusterCode 前缀）
 * @returns {Array<[string, Function]>}
 */
function getAdminSeoRoutes() {
	return ADMIN_ROUTES.map(({ path, titleKey }) => [path, createAdminSeoHandler(titleKey)])
}

/**
 * 返回带 /:clusterCode 前缀的管理后台 SEO 路由，用于 /:clusterCode/admin/* 访问场景
 * @returns {Array<[string, Function]>}
 */
function getAdminSeoRoutesWithClusterCode() {
	return ADMIN_ROUTES.map(({ path, titleKey }) => [
		`/:clusterCode${path}`,
		createAdminSeoHandler(titleKey),
	])
}

module.exports = {
	ADMIN_ROUTES,
	createAdminSeoHandler,
	getAdminSeoRoutes,
	getAdminSeoRoutesWithClusterCode,
}
