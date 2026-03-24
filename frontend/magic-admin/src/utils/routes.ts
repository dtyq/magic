import { RouteName, RoutePath } from "@/const/routes"

/**
 * 替换路由参数
 *
 * @param route 路由
 * @param params 参数
 * @returns 带参数值路由
 */
export const replaceRouteParams = (route: string, params: Record<string, string>) => {
	const reg = /:([^/]+)/g
	return route.replace(reg, (_, key) => params[key])
}

/**
 * 路由名称到路径的映射
 */
const routeNameToPathMap: Record<RouteName, RoutePath> = {
	[RouteName.Admin]: RoutePath.Admin,
	[RouteName.AdminHome]: RoutePath.AdminHome,
	[RouteName.AdminApplicationManager]: RoutePath.AdminApplicationManager,
	[RouteName.AdminKeewood]: RoutePath.Teamshare,

	[RouteName.AdminAILayout]: RoutePath.AI,
	[RouteName.AdminAICustomModel]: RoutePath.AICustomModel,
	[RouteName.AdminAIModel]: RoutePath.AIModel,
	[RouteName.AdminAIDrawing]: RoutePath.AIDrawing,
	[RouteName.AdminAIModelDetails]: RoutePath.AIModelDetail,
	[RouteName.AdminAIDrawingDetails]: RoutePath.AIDrawingDetail,

	[RouteName.AdminPlatformLayout]: RoutePath.Platform,
	[RouteName.AdminPlatformPackage]: RoutePath.PlatformPaidPackage,
	[RouteName.AdminPackageManage]: RoutePath.PlatformPaidPackageManage,
	[RouteName.AdminPackageDetail]: RoutePath.PlatformPaidPackageDetail,
	[RouteName.AdminPackageOrder]: RoutePath.PlatformPaidPackageOrder,

	[RouteName.AdminPlatformModel]: RoutePath.PlatformModel,
	[RouteName.AdminPlatformAIModel]: RoutePath.PlatformAIModel,
	[RouteName.AdminPlatformAIModelDetails]: RoutePath.PlatformAIModelDetail,
	[RouteName.AdminPlatformAIDrawing]: RoutePath.PlatformAIDrawing,
	[RouteName.AdminPlatformAIDrawingDetails]: RoutePath.PlatformAIDrawingDetail,

	[RouteName.AdminAgentEnhancement]: RoutePath.PlatformAgent,
	[RouteName.AdminSystemAgent]: RoutePath.PlatformAgentMode,
	[RouteName.AdminSystemSkill]: RoutePath.PlatformAgentSkill,
	[RouteName.AdminEmployeeReview]: RoutePath.PlatformAgentEmployeeReview,
	[RouteName.AdminSkillMarket]: RoutePath.PlatformAgentSkillMarket,
	[RouteName.AdminEmployeeMarket]: RoutePath.PlatformAgentEmployeeMarket,
	[RouteName.AdminSystemCapability]: RoutePath.PlatformCapability,
	[RouteName.AdminSystemCapabilityDetail]: RoutePath.PlatformCapabilityDetail,

	[RouteName.AdminTenant]: RoutePath.PlatformTenant,
	[RouteName.AdminTenantList]: RoutePath.PlatformTenantList,
	[RouteName.AdminTenantPoints]: RoutePath.PlatformTenantPoints,

	[RouteName.AdminPlatformManage]: RoutePath.PlatformManage,
	[RouteName.AdminProxyServer]: RoutePath.PlatformProxyServer,
	[RouteName.AdminPlatformMaintenance]: RoutePath.PlatformMaintenance,
	[RouteName.AdminPlatformInfoManagement]: RoutePath.PlatformInfoManagement,
	[RouteName.AdminAppMenu]: RoutePath.PlatformAppMenu,
	[RouteName.AdminAIAudit]: RoutePath.PlatformAIAudit,

	[RouteName.AdminEnterpriseLayout]: RoutePath.Enterprise,
	[RouteName.AdminEnterpriseOrganization]: RoutePath.EnterpriseOrganization,
	[RouteName.AdminEnterpriseDepartment]: RoutePath.EnterpriseDepartment,
	[RouteName.AdminEnterpriseUserGroup]: RoutePath.EnterpriseOrganizationGroup,

	[RouteName.AdminUsageControl]: RoutePath.EnterpriseUsageControl,
	[RouteName.AdminAIControl]: RoutePath.EnterpriseAIControl,

	[RouteName.AdminAuthorityControl]: RoutePath.EnterpriseSecurity,
	[RouteName.AdminAuthority]: RoutePath.EnterpriseSecurityAdmin,
	[RouteName.AdminAuthorityLog]: RoutePath.EnterpriseSecurityAdminLog,

	[RouteName.AdminOAApproval]: RoutePath.OAApproval,
	[RouteName.AdminApprovalDesign]: RoutePath.OAApprovalDesign,
	[RouteName.AdminOAApprovalManage]: RoutePath.OAApprovalManage,
	[RouteName.AdminOAApprovalMultiLang]: RoutePath.OAApprovalMultiLang,
	[RouteName.AdminOAApprovalDataView]: RoutePath.OAApprovalDataView,
	[RouteName.AdminOAApprovalWorkflowHandover]: RoutePath.OAApprovalWorkflowHandover,
	[RouteName.AdminOAApprovalTemplateHandover]: RoutePath.OAApprovalTemplateHandover,
	[RouteName.AdminOAApprovalLimitedTime]: RoutePath.OAApprovalLimitedTime,
}

/**
 * 根据路由名称获取路径
 *
 * @param name 路由名称
 * @returns 路由路径
 */
export const getRoutePathByName = (name: RouteName): RoutePath => {
	const path = routeNameToPathMap[name]
	if (!path) {
		// console.warn(`Route name "${name}" not found in route map`)
		return RoutePath.Admin
	}
	return path
}
