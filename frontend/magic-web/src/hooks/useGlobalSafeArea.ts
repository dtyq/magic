import { useEffect } from "react"
import { useLocation } from "react-router"

import { useMobileDocumentThemeState } from "@/pages/superMagicMobile/components/MobileDocumentTheme"
import { syncGlobalSafeArea } from "./globalSafeArea"

/**
 * 根据当前路由自动设置全局安全边距样式
 * 解决路由缓存导致的样式无法重置问题；sidebar 打开态在这里统一覆盖 route 样式。
 */
export function useGlobalSafeArea() {
	const location = useLocation()
	const { isSidebarOpen } = useMobileDocumentThemeState()

	useEffect(() => {
		syncGlobalSafeArea({
			pathname: location.pathname,
			isSidebarOpen,
		})
	}, [location.pathname, isSidebarOpen])
}

export function GlobalSafeAreaSync() {
	useGlobalSafeArea()
	return null
}
