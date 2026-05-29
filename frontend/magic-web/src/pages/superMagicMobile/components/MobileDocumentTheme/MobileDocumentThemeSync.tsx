import { useEffect } from "react"
import { useLocation } from "react-router"

import { applyRouteGlobalSafeAreaStyle } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles"
import { useTheme } from "@/models/config/hooks"
import {
	applyMobileDocumentTheme,
	applyMobileGlobalSafeAreaForSidebar,
} from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

import { useMobileDocumentThemeState } from "./MobileDocumentThemeContext"

/**
 * Applies default mobile chrome colors globally; sidebar open state comes from context.
 */
export function MobileDocumentThemeSync() {
	const { prefersColorScheme } = useTheme()
	const { isSidebarOpen } = useMobileDocumentThemeState()
	const location = useLocation()

	useEffect(() => {
		applyMobileDocumentTheme({
			isSidebarOpen,
			colorScheme: prefersColorScheme,
		})

		if (isSidebarOpen) {
			applyMobileGlobalSafeAreaForSidebar(true)
			return
		}

		applyRouteGlobalSafeAreaStyle(location.pathname)
	}, [isSidebarOpen, prefersColorScheme, location.pathname])

	return null
}
