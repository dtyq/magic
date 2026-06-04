import { useLocation } from "react-router-dom"
import { useMemo } from "react"
import { findRouteByPathname } from "@admin/utils/routeUtils"
import { routes } from "@admin/routes"

export const useGetCurrentRouteInfo = () => {
	const { pathname } = useLocation()
	/* 根据路由项的 hidden 属性，判断是否隐藏顶部菜单 */
	const currentRouteItems = useMemo(() => {
		const pathSegments = pathname.split("/").filter(Boolean)
		return findRouteByPathname(pathSegments, routes)
	}, [pathname])

	/* 根据路由项的 hidden 属性，判断是否隐藏顶部菜单 */
	const hiddenMenu = useMemo(() => {
		return currentRouteItems && currentRouteItems?.hiddenMenu
	}, [currentRouteItems])

	return {
		currentRouteItems,
		hiddenMenu,
	}
}
