import { RoutePath } from "@/constants/routes"

// Keep alive 路由配置类型
export type KeepAliveRouteConfig = {
	/** 路径，支持字符串精确匹配或正则表达式 */
	path: string | RegExp
	/** 描述信息（可选） */
	description?: string
}

// 简化的路由匹配类型（向后兼容）
export type KeepAliveRoute = RoutePath | string | RegExp | KeepAliveRouteConfig

// 需要keepAlive的路由配置
export const keepAliveRoutes: KeepAliveRoute[] = [RoutePath.Chat, RoutePath.SuperAssistant]

/**
 * 检查路径是否匹配keep alive配置
 * @param pathname - 当前路径
 * @param route - keep alive 路由配置
 * @returns 是否匹配
 */
export function isKeepAliveRoute(pathname: string, route: KeepAliveRoute): boolean {
	// 字符串或 RoutePath 类型
	if (typeof route === "string") {
		// 兼容带集群参数前缀的路由匹配
		return pathname === route || pathname.endsWith(route)
	}

	// 正则表达式类型
	if (route instanceof RegExp) {
		return route.test(pathname)
	}

	// KeepAliveRouteConfig 对象类型
	if (typeof route === "object" && "path" in route) {
		if (typeof route.path === "string") {
			return pathname === route.path
		}
		if (route.path instanceof RegExp) {
			return route.path.test(pathname)
		}
	}

	return false
}

/**
 * 检查路径是否需要keep alive
 * @param pathname - 当前路径
 * @param routes - keep alive 路由配置数组
 * @returns 是否需要keep alive
 */
export function shouldKeepAlive(
	pathname: string,
	routes: KeepAliveRoute[] = keepAliveRoutes,
): boolean {
	return routes.some((route) => isKeepAliveRoute(pathname, route))
}
