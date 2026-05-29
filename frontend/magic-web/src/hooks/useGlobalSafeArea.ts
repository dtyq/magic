import { useEffect } from "react"
import { useLocation } from "react-router"
import { applyRouteGlobalSafeAreaStyle } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles"
import { useMobileDocumentThemeState } from "@/pages/superMagicMobile/components/MobileDocumentTheme"
import { applyMobileGlobalSafeAreaForSidebar } from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

export { applyRouteGlobalSafeAreaStyle } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles"

/**
 * 根据当前路由自动设置全局安全边距样式
 * 解决路由缓存导致的样式无法重置问题
 */
export function useGlobalSafeArea() {
	const location = useLocation()
	const { isSidebarOpen } = useMobileDocumentThemeState()

	useEffect(() => {
		if (isSidebarOpen) {
			applyMobileGlobalSafeAreaForSidebar(true)
			return
		}

		applyRouteGlobalSafeAreaStyle(location.pathname)
	}, [location.pathname, isSidebarOpen])
}
