import type { EnhancedNavigateFunction } from "@/provider/AdminProvider/types"
import { useCallback } from "react"
import type { NavigateOptions } from "react-router-dom"
import { useNavigate as useBaseNavigate } from "react-router-dom"
import type { RouteName, RoutePath } from "@/const/routes"
import { getRoutePathByName, replaceRouteParams } from "@/utils/routes"

/**
 * 构建查询字符串
 */
const buildQueryString = (query?: Record<string, string | number>): string => {
	if (!query || Object.keys(query).length === 0) {
		return ""
	}

	const params = new URLSearchParams()
	Object.entries(query).forEach(([key, value]) => {
		if (value !== null && value !== undefined) {
			params.append(key, String(value))
		}
	})

	const queryString = params.toString()
	return queryString ? `?${queryString}` : ""
}

/**
 * 使用导航 Hook
 * 本地模拟外层传入的 navigate 函数
 * 支持通过路由名称（name）查找对应的路径并跳转
 */
export default function useNavigate() {
	const baseNavigate = useBaseNavigate()

	return useCallback(
		(to: EnhancedNavigateFunction | string | number, options?: NavigateOptions) => {
			// 处理 delta（历史记录导航）
			if (typeof to === "number") {
				baseNavigate(to)
				return
			}

			// 处理字符串路径
			if (typeof to === "string") {
				baseNavigate(to, options)
				return
			}

			// 处理对象参数
			const navigateProps = to as EnhancedNavigateFunction
			const { name, params, query, state, delta, replace, ...navigateOptions } = navigateProps

			// 处理 delta
			if (delta !== undefined) {
				baseNavigate(delta)
				return
			}

			// 处理 name（路由名称）
			if (name) {
				// 获取路由路径
				const routePath = getRoutePathByName(name as RouteName)

				// 替换路径参数
				let finalPath: string = routePath
				if (params && Object.keys(params).length > 0) {
					// 将 params 转换为字符串类型
					const stringParams: Record<string, string> = {}
					Object.entries(params).forEach(([key, value]) => {
						if (value !== null && value !== undefined) {
							stringParams[key] = String(value)
						}
					})
					finalPath = replaceRouteParams(routePath, stringParams)
				}

				// 添加查询参数
				const queryString = buildQueryString(query)
				finalPath = `${finalPath}${queryString}` as RoutePath

				// 执行导航
				baseNavigate(finalPath, {
					replace,
					state,
					...navigateOptions,
					...options,
				} as NavigateOptions)
				return
			}

			// 默认情况：直接传递路径或对象给 baseNavigate
			baseNavigate(to as any, options)
		},
		[baseNavigate],
	)
}
