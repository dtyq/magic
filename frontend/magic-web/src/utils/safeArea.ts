interface SafeAreaInsetValues {
	safeAreaInsetTop: string
	safeAreaInsetBottom: string
	safeAreaInsetLeft: string
	safeAreaInsetRight: string
}

const safeAreaVarMap = {
	safeAreaInsetTop: "--safe-area-inset-top",
	safeAreaInsetBottom: "--safe-area-inset-bottom",
	safeAreaInsetLeft: "--safe-area-inset-left",
	safeAreaInsetRight: "--safe-area-inset-right",
} as const

function getSafeAreaFallbackValue(direction: "top" | "bottom" | "left" | "right") {
	return `var(--safe-area-inset-${direction}, env(safe-area-inset-${direction}))`
}

function isPositiveSafeAreaValue(value?: string) {
	if (!value) return false

	const numericValue = Number.parseFloat(value)
	if (!Number.isFinite(numericValue)) return false

	return numericValue > 0
}

function getRootStyle() {
	if (typeof document === "undefined") return null
	if (!document.documentElement) return null

	return document.documentElement.style
}

export const safeAreaFallbackTokens: SafeAreaInsetValues = {
	safeAreaInsetTop: getSafeAreaFallbackValue("top"),
	safeAreaInsetBottom: getSafeAreaFallbackValue("bottom"),
	safeAreaInsetLeft: getSafeAreaFallbackValue("left"),
	safeAreaInsetRight: getSafeAreaFallbackValue("right"),
}

export function getNativeSafeAreaInsetValue(value: number, dpi: number) {
	if (!Number.isFinite(value) || !Number.isFinite(dpi) || dpi <= 0) return "0px"

	const normalizedValue = value / dpi
	if (normalizedValue <= 0) return "0px"

	return `${normalizedValue}px`
}

export function syncSafeAreaCssVars(values: Partial<SafeAreaInsetValues>) {
	const rootStyle = getRootStyle()
	if (!rootStyle) return

	Object.entries(safeAreaVarMap).forEach(([key, cssVarName]) => {
		const safeAreaKey = key as keyof SafeAreaInsetValues
		const value = values[safeAreaKey]

		if (!isPositiveSafeAreaValue(value)) {
			rootStyle.removeProperty(cssVarName)
			return
		}
		if (!value) return

		rootStyle.setProperty(cssVarName, value)
	})
}
