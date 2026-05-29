import { useEffect } from "react"

import { useTheme } from "@/models/config/hooks"
import { applyMobileDocumentTheme } from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

import { useMobileDocumentThemeState } from "./MobileDocumentThemeContext"

/**
 * Applies default mobile chrome colors globally; sidebar open state comes from context.
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
