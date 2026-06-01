import { useEffect } from "react"
import { useTheme } from "@/models/config/hooks"
import { applyMobileDocumentTheme } from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

import { useMobileDocumentThemeState } from "./MobileDocumentThemeContext"

/**
 * Applies default mobile chrome colors globally; GlobalSafeArea sync is handled separately.
 */
export function MobileDocumentThemeSync() {
	const { prefersColorScheme } = useTheme()
	const { isSidebarOpen } = useMobileDocumentThemeState()

	useEffect(() => {
		applyMobileDocumentTheme({
			isSidebarOpen,
			colorScheme: prefersColorScheme,
		})
	}, [isSidebarOpen, prefersColorScheme])

	return null
}
