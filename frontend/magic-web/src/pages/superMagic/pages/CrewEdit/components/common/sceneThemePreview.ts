import type { CSSProperties } from "react"

function normalizeHexColor(color?: string | null) {
	const value = color?.trim()
	if (!value) return null

	const match = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
	if (!match) return null

	const hex = match[1]
	if (hex.length === 3) {
		return `#${hex
			.split("")
			.map((char) => `${char}${char}`)
			.join("")}`
	}

	return `#${hex}`
}

function hexToRgb(hexColor: string) {
	const hex = hexColor.slice(1)
	return {
		r: Number.parseInt(hex.slice(0, 2), 16),
		g: Number.parseInt(hex.slice(2, 4), 16),
		b: Number.parseInt(hex.slice(4, 6), 16),
	}
}

export function getSceneThemePreviewStyle(themeColor?: string | null): CSSProperties | undefined {
	const color = normalizeHexColor(themeColor)
	if (!color) return undefined

	const { r, g, b } = hexToRgb(color)
	return {
		backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
		borderColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
		color,
	}
}
