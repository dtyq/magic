import fontMedium from "@/assets/fonts/D-DIN-PRO-500-Medium.otf"
import fontRegular from "@/assets/fonts/D-DIN-PRO-400-Regular.otf"
import { useEffect } from "react"

// D-DIN-PRO font styles for lazy loading
const ddinProFontStyles = `
	@font-face {
		font-family: "D-DIN-PRO";
		src: url(${fontMedium});
		font-display: swap;
	}

	@font-face {
		font-family: "D-DIN-PRO-Regular";
		src: url(${fontRegular});
		font-display: swap;
	}
`

let isLoaded = false
let styleElement: HTMLStyleElement | null = null

/**
 * Hook to load D-DIN-PRO fonts on demand
 * Only loads once per application lifecycle
 */
function useDDinProFonts() {
	useEffect(() => {
		if (isLoaded) return

		// Create style element and inject font-face rules
		styleElement = document.createElement("style")
		styleElement.setAttribute("data-font", "ddin-pro")
		styleElement.textContent = ddinProFontStyles
		document.head.appendChild(styleElement)

		isLoaded = true

		// Cleanup function (optional, fonts remain loaded)
		return () => {
			// Note: We don't remove the style element on unmount
			// to avoid re-downloading fonts when component remounts
		}
	}, [])
}

export default useDDinProFonts
