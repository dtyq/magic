import type { DesignColorToken, DesignStyle } from "./catalog"

export interface DesignStyleVisuals {
	canvas: string
	surface: string
	surfaceRaised: string
	text: string
	mutedText: string
	primary: string
	secondary: string
	border: string
	success: string
	warning: string
	danger: string
	fontFamily: string
	bodyFontSize: string
	captionFontSize: string
	radius: string
	controlRadius: string
	shadow: string
}

const FALLBACKS = {
	canvas: "#f7f7f5",
	surface: "#ffffff",
	surfaceRaised: "#ffffff",
	text: "#171717",
	mutedText: "#6b7280",
	primary: "#171717",
	secondary: "#6b7280",
	border: "rgba(23, 23, 23, 0.14)",
	success: "#198754",
	warning: "#b7791f",
	danger: "#c53030",
	fontFamily: "system-ui, sans-serif",
	bodyFontSize: "16px",
	captionFontSize: "12px",
	radius: "12px",
	controlRadius: "8px",
	shadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
} as const

function cssValue(value: unknown, fallback: string) {
	return typeof value === "string" || typeof value === "number" ? String(value) : fallback
}

function findColor(colors: DesignColorToken[], patterns: RegExp[], fallback: string) {
	const token = colors
		.map((item) => ({
			item,
			patternIndex: patterns.findIndex((pattern) => pattern.test(item.name)),
		}))
		.filter(({ patternIndex }) => patternIndex >= 0)
		.sort((left, right) => {
			if (left.patternIndex !== right.patternIndex) {
				return left.patternIndex - right.patternIndex
			}
			return left.item.name.length - right.item.name.length
		})[0]?.item
	return cssValue(token?.value, fallback)
}

function findTypographyValue(
	style: DesignStyle,
	patterns: RegExp[],
	key: "fontFamily" | "fontSize",
) {
	const token = style.design.typography.find((item) =>
		patterns.some((pattern) => pattern.test(item.name)),
	)
	return token?.[key]
}

function firstTypographyValue(style: DesignStyle, key: "fontFamily" | "fontSize") {
	return style.design.typography.find((item) => item[key])?.[key]
}

function firstScaleValue(style: DesignStyle, rounded: boolean) {
	const values = rounded ? style.design.rounded : style.design.spacing

	return values.find((item) => item.value !== undefined)?.value
}

export function getStyleVisuals(style: DesignStyle): DesignStyleVisuals {
	const colors = style.design.colors
	const fontFamily = cssValue(
		findTypographyValue(style, [/body|body-md|body-lg|paragraph|text|ui/i], "fontFamily") ??
			firstTypographyValue(style, "fontFamily"),
		FALLBACKS.fontFamily,
	)
	const bodyFontSize = cssValue(
		findTypographyValue(style, [/body|body-md|body-lg|paragraph|text|ui/i], "fontSize") ??
			firstTypographyValue(style, "fontSize"),
		FALLBACKS.bodyFontSize,
	)
	const captionFontSize = cssValue(
		findTypographyValue(style, [/caption|label|small|micro/i], "fontSize"),
		FALLBACKS.captionFontSize,
	)
	const radius = cssValue(firstScaleValue(style, true), FALLBACKS.radius)

	return {
		canvas: findColor(colors, [/canvas|page|background|bg/i], FALLBACKS.canvas),
		surface: findColor(colors, [/surface|card|panel|white/i], FALLBACKS.surface),
		surfaceRaised: findColor(
			colors,
			[/elevated|raised|lifted|modal/i],
			FALLBACKS.surfaceRaised,
		),
		text: findColor(colors, [/foreground|text-base|text|ink|black/i], FALLBACKS.text),
		mutedText: findColor(colors, [/muted|secondary|subtle|gray|slate/i], FALLBACKS.mutedText),
		primary: findColor(colors, [/primary|brand|cta|action|accent/i], FALLBACKS.primary),
		secondary: findColor(colors, [/secondary|support|link|blue/i], FALLBACKS.secondary),
		border: findColor(colors, [/border|divider|outline|separator/i], FALLBACKS.border),
		success: findColor(colors, [/success|positive|green/i], FALLBACKS.success),
		warning: findColor(colors, [/warning|caution|orange|yellow/i], FALLBACKS.warning),
		danger: findColor(colors, [/error|danger|negative|red/i], FALLBACKS.danger),
		fontFamily,
		bodyFontSize,
		captionFontSize,
		radius,
		controlRadius: cssValue(firstScaleValue(style, true), FALLBACKS.controlRadius),
		shadow: FALLBACKS.shadow,
	}
}

export function tokenText(value: unknown, fallback = "—") {
	return value === undefined || value === null || value === "" ? fallback : String(value)
}

export function cssFontStack(value: unknown, fallback = FALLBACKS.fontFamily) {
	return cssValue(value, fallback)
}

export function cssNumber(value: unknown, fallback: number) {
	const parsed = Number.parseFloat(String(value))
	return Number.isFinite(parsed) ? parsed : fallback
}

export function previewFontSize(value: unknown, fallback = 20, min = 14, max = 54) {
	const raw = String(value ?? "")
		.trim()
		.toLowerCase()
	const parsed = Number.parseFloat(raw)
	if (!Number.isFinite(parsed)) return `${fallback}px`
	const pixels = raw.endsWith("rem") || raw.endsWith("em") ? parsed * 16 : parsed
	return `${Math.min(max, Math.max(min, pixels))}px`
}

export function fontWeightValue(value: unknown) {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

export function scaleWidth(value: unknown) {
	const numeric = Number.parseFloat(String(value))
	if (!Number.isFinite(numeric)) return "42%"
	return `${Math.min(100, Math.max(12, numeric * 2.5 + 18))}%`
}
