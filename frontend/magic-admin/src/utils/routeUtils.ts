import type { RouteObject } from "react-router-dom"
import type { Route } from "@/routes/routes"
import type { SideMenuItem } from "components"
import { isNil } from "lodash-es"
import { PERMISSION_KEY_MAP } from "../const/common"

interface RouteUtilsOptions {
	buildBreadcrumb?: boolean
	onRouteMatch?: (route: Route, currentPath: string) => void
}

export function findRouteByPathname(
	paths: string[],
	routeList: (Route | RouteObject)[],
	options: RouteUtilsOptions = {},
	currentIndex = 0,
): Route | null {
	if (currentIndex >= paths.length) return null

	const currentPath = paths[currentIndex]
	let matchedRoute: Route | null = null

	routeList.forEach((route) => {
		if (matchedRoute) return

		const routePathSegment = route?.path?.split("/").pop()

		if (routePathSegment === currentPath) {
			matchedRoute = route

			// 如果设置了构建面包屑的回调
			if (options.onRouteMatch) {
				options.onRouteMatch(route, currentPath)
			}

			// 如果还有下一级路径，继续查找子路由
			if (currentIndex < paths.length - 1 && route.children) {
				const childMatch = findRouteByPathname(
					paths,
					route.children,
					options,
					currentIndex + 1,
				)
				if (childMatch) {
					matchedRoute = childMatch
				}
			}
		}
	})

	return matchedRoute
}

// 权限检查辅助函数
export const checkItemPermission = (
	item: SideMenuItem | Route,
	isTeamshare: boolean,
	teamshareUserPermissions: string[],
	userPermissions: string[],
) => {
	if (!item?.validate) return true

	// 如果是OA审批，则使用天书功能权限
	const permissions = isTeamshare ? teamshareUserPermissions : userPermissions

	const hasAllPermissions = isTeamshare
		? teamshareUserPermissions.includes(PERMISSION_KEY_MAP.TEAMSHARE_ALL_PERMISSIONS) ||
		  teamshareUserPermissions.includes(PERMISSION_KEY_MAP.ORGANIZATION_OWNER)
		: userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS) ||
		  userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS) ||
		  userPermissions.includes(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS)

	return item.validate(permissions, hasAllPermissions)
}

export /**
 * @description 填充路由 params 参数，生成可用路由 Path
 * @param {string} path 路径
 * @param {Record<string, string>} params 参数集
 * @return {string}
 */
function fillRoute(path: string, params: Record<string, string>): string {
	return path
		.replace(/:(\w+)\??/g, (match: string, key: string) => {
			// 检查 params 中是否有对应 key
			if (!isNil(params[key])) {
				return params[key]
			}
			// 如果没有值且参数是可选的，返回空字符串
			if (match.endsWith("?")) {
				return ""
			}
			return ""
			// throw new Error(`Missing required parameter: ${ key }`)
		})
		.replace(/\/+/g, "/")
		.replace(/\/$/, "") // 确保不出现多余的斜杠
}
