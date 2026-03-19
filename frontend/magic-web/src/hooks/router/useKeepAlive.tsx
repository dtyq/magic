import { useLocation, useOutlet, Outlet } from "react-router"
import { useEffect, useMemo, useReducer, useCallback } from "react"
import {
	keepAliveRoutes as KeepAliveRoutes,
	shouldKeepAlive,
	type KeepAliveRoute,
} from "@/constants/keepAliveRoutes"
import LoadingFallback from "@/components/fallback/LoadingFallback"

// 缓存状态类型
type CacheState = Record<string, React.ReactNode>

// 缓存action类型
type CacheAction =
	| { type: "ADD_CACHE"; path: string; outlet: React.ReactNode }
	| { type: "REMOVE_CACHE"; path: string }

/**
 * 使用keepAlive，根据配置的keepAliveRoutes，页面切换时，不卸载页面，改为隐藏，主要为了解决重新挂载的渲染性能问题
 * 支持字符串精确匹配和正则表达式匹配
 * @returns { Content } - 渲染缓存的组件
 */
export const useKeepAlive = ({
	keepAliveRoutes = KeepAliveRoutes,
}: {
	keepAliveRoutes?: KeepAliveRoute[]
} = {}) => {
	const location = useLocation()
	const outlet = useOutlet()

	// 缓存reducer - 使用useCallback优化
	const cacheReducer = useCallback((state: CacheState, action: CacheAction): CacheState => {
		switch (action.type) {
			case "ADD_CACHE":
				return { ...state, [action.path]: action.outlet }
			case "REMOVE_CACHE":
				const newState = { ...state }
				delete newState[action.path]
				return newState
			default:
				return state
		}
	}, [])

	const [caches, dispatch] = useReducer(cacheReducer, {})

	// 根据配置的keepAliveRoutes，判断是否需要缓存 - 使用useMemo优化，支持正则表达式匹配
	const shouldCache = useMemo(
		() => shouldKeepAlive(location.pathname, keepAliveRoutes),
		[keepAliveRoutes, location.pathname],
	)

	// 监听路由变化，管理缓存 - 优化依赖
	useEffect(() => {
		if (shouldCache && outlet) {
			// 只在缓存不存在时添加，避免重复更新
			if (!caches[location.pathname]) {
				dispatch({
					type: "ADD_CACHE",
					path: location.pathname,
					outlet,
				})
			}
		} else if (!shouldCache && caches[location.pathname]) {
			// 非缓存路径，从缓存中移除
			dispatch({ type: "REMOVE_CACHE", path: location.pathname })
		}
	}, [shouldCache, location.pathname, outlet, caches])

	// 渲染缓存的内容 - 使用useMemo优化
	const Content = useMemo(() => {
		// 获取所有缓存的页面内容
		const cachedOutlets = Object.entries(caches).map(([path, cachedOutlet]) => {
			const isActive = path === location.pathname
			return (
				<div
					key={path}
					style={{
						display: isActive ? "block" : "none",
						height: "100%",
						overflow: "hidden",
						// 使用更简单的隐藏方式，减少layout计算
						...(isActive
							? {}
							: {
								position: "absolute",
								top: -9999,
								left: -9999,
								visibility: "hidden",
							}),
					}}
					data-keepalive-id={`keepalive-${path}`}
				>
					{cachedOutlet}
				</div>
			)
		})

		return (
			<LoadingFallback>
				{cachedOutlets}
				{!shouldCache && <Outlet />}
			</LoadingFallback>
		)
	}, [shouldCache, location.pathname, caches])

	return { Content }
}
