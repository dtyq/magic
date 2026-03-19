import InterFont from "@/assets/fonts/Inter-VariableFont.ttf"
import { useEffect } from "react"

// Inter font styles for lazy loading (only loads when components need font-weight 600/700)
const interFontStyles = `
	@font-face {
		font-family: "Inter";
		src: url(${InterFont});
		font-display: swap;
		font-weight: 100 900;
	}
`

let isLoaded = false
let styleElement: HTMLStyleElement | null = null

/**
 * Hook to load Inter Variable Font on demand
 * Use this in components/pages that need font-weight 600 or 700
 *
 * @example
 * ```tsx
 * function ModelName() {
 *   useInterFont() // Load Inter when this component mounts
 *   return <div style={{ fontWeight: 700 }}>Model Name</div>
 * }
 * ```
 */
function useInterFont() {
	useEffect(() => {
		if (isLoaded) return

		// Create style element and inject font-face rules
		styleElement = document.createElement("style")
		styleElement.setAttribute("data-font", "inter")
		styleElement.textContent = interFontStyles
		document.head.appendChild(styleElement)

		isLoaded = true

		// Cleanup function (optional, fonts remain loaded)
		return () => {
			// Note: We don't remove the style element on unmount
			// to avoid re-downloading fonts when component remounts
		}
	}, [])
}

export default useInterFont
