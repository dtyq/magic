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

	[RouteName.AdminPlatformLayout]: RoutePath.Platform,
	[RouteName.AdminPlatformModel]: RoutePath.PlatformModel,
	[RouteName.AdminPlatformAIModel]: RoutePath.PlatformAIModel,
	[RouteName.AdminPlatformAIModelDetails]: RoutePath.PlatformAIModelDetail,
	[RouteName.AdminPlatformAIDrawing]: RoutePath.PlatformAIDrawing,
	[RouteName.AdminPlatformAIDrawingDetails]: RoutePath.PlatformAIDrawingDetail,
	[RouteName.AdminPlatformVideoModel]: RoutePath.PlatformVideoModel,
	[RouteName.AdminPlatformVideoModelDetails]: RoutePath.PlatformVideoModelDetail,

	[RouteName.AdminAgentEnhancement]: RoutePath.PlatformAgent,
	[RouteName.AdminSystemAgent]: RoutePath.PlatformAgentMode,
	[RouteName.AdminSystemSkill]: RoutePath.PlatformAgentSkill,
	[RouteName.AdminEmployeeReview]: RoutePath.PlatformAgentEmployeeReview,
	[RouteName.AdminSkillMarket]: RoutePath.PlatformAgentSkillMarket,
	[RouteName.AdminEmployeeMarket]: RoutePath.PlatformAgentEmployeeMarket,
	[RouteName.AdminSystemCapability]: RoutePath.PlatformCapability,
	[RouteName.AdminSystemCapabilityDetail]: RoutePath.PlatformCapabilityDetail,
	[RouteName.AdminSlidesTemplate]: RoutePath.PlatformSlidesTemplate,

	[RouteName.AdminPlatformManage]: RoutePath.PlatformManage,
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
