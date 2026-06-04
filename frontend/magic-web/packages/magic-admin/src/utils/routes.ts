import { RouteName, RoutePath } from "@admin/const/routes"

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
	[RouteName.AdminKeewood]: RoutePath.AdminHome,

	[RouteName.AdminAILayout]: RoutePath.AI,
	[RouteName.AdminAICustomModel]: RoutePath.AICustomModel,
	[RouteName.AdminAIModel]: RoutePath.AIModel,
	[RouteName.AdminAIDrawing]: RoutePath.AIDrawing,
	[RouteName.AdminAIModelDetails]: RoutePath.AIModelDetail,
	[RouteName.AdminAIDrawingDetails]: RoutePath.AIDrawingDetail,
	[RouteName.AdminAIVideo]: RoutePath.AIVideo,
	[RouteName.AdminAIVideoDetails]: RoutePath.AIVideoDetail,
	[RouteName.AdminAIInternalEmployeeSkill]: RoutePath.AIInternalEmployeeSkill,
	[RouteName.AdminAIEmployeeReview]: RoutePath.AIEmployeeReview,
	[RouteName.AdminAISkillReview]: RoutePath.AISkillReview,

	[RouteName.AdminPlatformLayout]: RoutePath.Platform,
	[RouteName.AdminPlatformModel]: RoutePath.PlatformModel,
	[RouteName.AdminPlatformAIModel]: RoutePath.PlatformAIModel,
	[RouteName.AdminPlatformAIModelDetails]: RoutePath.PlatformAIModelDetail,
	[RouteName.AdminPlatformAIDrawing]: RoutePath.PlatformAIDrawing,
	[RouteName.AdminPlatformAIDrawingDetails]: RoutePath.PlatformAIDrawingDetail,
	[RouteName.AdminPlatformVideoModel]: RoutePath.PlatformVideoModel,
	[RouteName.AdminPlatformVideoModelDetails]: RoutePath.PlatformVideoModelDetail,
	[RouteName.AdminPlatformProviderAccess]: RoutePath.PlatformProviderAccess,

	[RouteName.AdminAgentEnhancement]: RoutePath.PlatformAgent,
	[RouteName.AdminSystemAgent]: RoutePath.PlatformAgentMode,
	[RouteName.AdminSystemSkill]: RoutePath.PlatformAgentSkill,
	[RouteName.AdminEmployeeReview]: RoutePath.PlatformAgentEmployeeReview,
	[RouteName.AdminSkillMarket]: RoutePath.PlatformAgentSkillMarket,
	[RouteName.AdminEmployeeMarket]: RoutePath.PlatformAgentEmployeeMarket,
	[RouteName.AdminSystemCapability]: RoutePath.PlatformCapability,
	[RouteName.AdminSystemCapabilityDetail]: RoutePath.PlatformCapabilityDetail,

	[RouteName.AdminPlatformManage]: RoutePath.PlatformManage,
	[RouteName.AdminPlatformMaintenance]: RoutePath.PlatformMaintenance,
	[RouteName.AdminPlatformInfoManagement]: RoutePath.PlatformInfoManagement,
	[RouteName.AdminAppMenu]: RoutePath.PlatformAppMenu,
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
		return RoutePath.Admin
	}
	return path
}
