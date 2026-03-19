import "@fontsource/geist-sans/400.css" // Regular
import "@fontsource/geist-sans/500.css" // Medium
import "@fontsource/geist-sans/600.css" // SemiBold
import { useEffect } from "react"

/**
 * Geist Sans font styles for the MentionPanel and other components
 * Using fontsource package for optimal loading
 */
const geistFontStyles = `
	@font-face {
		font-family: "Geist";
		src: local("Geist Sans");
		font-display: swap;
		font-weight: 400 600;
	}
`

let isLoaded = false
let styleElement: HTMLStyleElement | null = null

/**
 * Hook to load Geist Sans font on demand
 * Use this in components that need the Geist font family
 *
 * @example
 * ```tsx
 * function MentionPanel() {
 *   useGeistFont() // Load Geist when this component mounts
 *   return <div style={{ fontFamily: 'Geist' }}>Menu Item</div>
 * }
 * ```
 */
function useGeistFont() {
	useEffect(() => {
		if (isLoaded) return

		// Create style element and inject font-face rules
		styleElement = document.createElement("style")
		styleElement.setAttribute("data-font", "geist")
		styleElement.textContent = geistFontStyles
		document.head.appendChild(styleElement)

		isLoaded = true

		// Cleanup function (optional, fonts remain loaded)
		return () => {
			// Note: We don't remove the style element on unmount
			// to avoid re-downloading fonts when component remounts
		}
	}, [])
}

export default useGeistFont
