import { convertRgbaOpacity } from "@/pages/superMagic/components/IconViewComponent/index"
import { addAlphaToHex } from "@/utils/color"

export function getModeBgColor(color: string, opacity: number = 0.1) {
	if (!color) return color
	// Check if it's rgba/rgb format
	if (color.includes("rgba") || color.includes("rgb")) {
		return convertRgbaOpacity(color, opacity)
	}
	// Use addAlphaToHex for hex format
	return addAlphaToHex(color, opacity)
}

export function getModeBorderColor(color: string) {
	// Check if it's rgba/rgb format
	if (color.includes("rgba") || color.includes("rgb")) {
		return convertRgbaOpacity(color, 0.2)
	}
	// Use addAlphaToHex for hex format
	return addAlphaToHex(color, 0.2)
}
