import type { RouteObject } from "react-router"
import { RouteName } from "@/routes/constants"
import { lazy } from "react"

/** 默认集群编码 */
export const defaultClusterCode = "global"

/**
 * 打开新标签
 * @param url 跳转地址
 */
export const openNewTab = (url?: string, base?: string) => {
	if (!url) return
	window.open(base ? `${base}${url}` : url, "_blank")
}

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/routes/components/Navigate"))

/**
 * @description 兼容旧版本路由重定向
 * @param routes
 */
export function routesRedirection(routes: Array<RouteObject>): Array<RouteObject> {
	return routes.reduce<Array<RouteObject>>((array, route) => {
		if (route.path?.startsWith("/:clusterCode")) {
			array.push({
				path: route.path?.replace("/:clusterCode", "") || "/",
				element: <Navigate name={route.name} replace />,
			})
			if (route?.children) {
				array.push(...routesRedirection(route.children))
			}
		}

		return array
	}, [])
}

/**
 * @description 团队功能路由转个人功能路由
 * @param {Array<RouteObject>} routes
 */
export function teamEditionRedirection(routes: Array<RouteObject>): Array<RouteObject> {
	return routes.map((route) => {
		const newRoute: RouteObject = {
			name: route.name,
			path: route.path,
			element: <Navigate name={RouteName.Super} />,
		}
		if (route.children) {
			newRoute.children = teamEditionRedirection(route.children)
		}
		return newRoute
	})
}

/**
 * 使用 a 标签打开新标签
 * @param url 跳转地址
 * @param base 基础地址
 */
export const openTabByALink = (url?: string, base?: string) => {
	if (!url) return
	const a = document.createElement("a")
	a.href = base ? `${base}${url}` : url
	a.target = "_blank"
	a.rel = "noopener noreferrer"
	a.style.display = "none"
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

/**
 * 获取携带新参数的 url
 * @param query
 * @returns
 */
export const getUrlWithNewSearchQuery = (url: string, query: Record<string, string>) => {
	const querys = new URLSearchParams(window.location.search)

	Object.entries(query).forEach(([key, value]) => {
		querys.append(key, value)
	})

	return `${url}?${querys.toString()}`
}
