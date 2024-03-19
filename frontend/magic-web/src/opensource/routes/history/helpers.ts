import type { RouteObject } from "react-router"
import { matchRoutes, matchPath } from "react-router"
import { isNil, keyBy } from "lodash-es"
import { Params, RouteParams } from "./types"
import { registerRoutes } from "@/opensource/routes/routes"
import { configStore } from "@/opensource/models/config"
import { RouteName } from "@/opensource/routes/constants"
import { defaultClusterCode } from "@/opensource/routes/helpers"

/**
 * @description 扁平化路由数组
 * @param {Array<RouteObject>} routes
 * @returns {Array<RouteObject>}
 */
function flattenRoutes(routes: Array<RouteObject>): Array<RouteObject> {
	const flatRoutes: Array<RouteObject> = []

	routes.forEach((route) => {
		// 将当前路由加入到扁平数组中
		flatRoutes.push(route)

		// 如果存在子路由，则递归调用（兼容 react-router@6）
		if (route.children) {
			flatRoutes.push(...flattenRoutes(route.children))
		}
	})

	return flatRoutes
}

/**
 * @description 填充路由 params 参数，生成可用路由 Path
 * @param {string} path 路径
 * @param {Record<string, string>} params 参数集
 * @return {string}
 */
export function fillRoute(path: string, params: Record<string, string>): string {
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

const routes = registerRoutes({ isPersonalOrganization: false })
const routesMap = keyBy(flattenRoutes(routes), "name")

/**
 * @description 获取路由链接
 * @param {RouteParams} props
 * @returns {string|null}
 */
export function getRoutePath(props: RouteParams): string | null {
	const { name, query = {}, params = {} } = props
	// 根据路由名称获取路由定义的 path，再根据 path 与 params 生成可用的路由，再拼接 query
	const realPath = routesMap[name]?.path
	if (realPath) {
		/** 路径参数处理 */
		const clusterCode = (params?.clusterCode ?? configStore.cluster.clusterCode) as string
		const path = fillRoute(realPath, {
			...params,
			clusterCode: clusterCode ? clusterCode : defaultClusterCode,
		})
		/** 查询参数处理 */
		const url = new URL(path, "https://a.com")
		Object.keys(query || {}).forEach((key) => {
			url.searchParams.append(key, `${query[key] || ""}`)
		})
		return url.pathname + url.search
	} else {
		console.error("路由命名不存在，请检查路由配置", realPath)
	}
	return null
}

/** 转换查询参数 */
export function convertSearchParams(params: URLSearchParams): Record<string, string> {
	const query: Record<string, string> = {}
	params?.forEach((value: string, key: string) => {
		query[key] = value
	})
	return query
}

/** 根据当前 pathname 获取路由元数据 */
export function routesMatch(pathname: string):
	| {
			params: Params<string>
			pathname: string
			pathnameBase: string
			route: RouteObject
	  }
	| undefined {
	const matches = matchRoutes(routes, pathname, "/")
	if (matches?.[matches.length - 1]?.route?.index) {
		return matches?.[matches.length - 2]
	}
	return matches?.[matches.length - 1]
}

/**
 * @description 根据当前路由别名、pathname 是否匹配
 * @param {RouteName} routeName 路由别名
 * @param {string} pathname 当前路径
 * @param {boolean} includeChildRoutes 是否包括匹配子路由
 */
export function routesPathMatch(
	routeName: RouteName,
	pathname: string,
	includeChildRoutes?: boolean,
): boolean {
	const info = routesMap?.[routeName]
	if (info.path) {
		if (includeChildRoutes && info.children && !matchPath(info.path, pathname)) {
			return info.children.some(
				(o) => o.name && routesPathMatch(o.name as RouteName, pathname, includeChildRoutes),
			)
		}
		return !!matchPath(info.path, pathname)
	}
	return false
}
