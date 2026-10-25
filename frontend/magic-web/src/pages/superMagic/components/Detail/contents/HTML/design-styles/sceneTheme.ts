import type { CSSProperties } from "react"
import type { DesignStyle } from "./catalog"
import { getStyleVisuals } from "./designStyleVisuals"
import { getStyleProfile } from "./styleProfiles"

function luminance(color: string) {
	const hex = color.replace("#", "")
	if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return undefined
	const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
	const rgb = [0, 2, 4].map((offset) => {
		const value = parseInt(full.slice(offset, offset + 2), 16) / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

export function readableText(background: string) {
	return (luminance(background) ?? 1) > 0.179 ? "#171717" : "#ffffff"
}

/** Missing semantic tokens are resolved from the actual palette, with readable text. */
export function getSceneTheme(style: DesignStyle) {
	const profile = getStyleProfile(style.code)
	const base = getStyleVisuals(style)
	const palette = style.design.colors.filter((token) =>
		/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(String(token.value)),
	)
	const dark = profile?.theme === "dark"
	const named = (pattern: RegExp) => palette.find((token) => pattern.test(token.name))?.value
	const backgrounds = palette.filter((token) =>
		dark
			? (luminance(String(token.value)) ?? 1) < 0.08
			: (luminance(String(token.value)) ?? 0) > 0.8,
	)
	const background = String(
		named(/^(canvas|background|bg|cream|paper|color-bg|bg-primary)$/i) ??
			backgrounds[0]?.value ??
			(dark ? "#131519" : "#faf9f6"),
	)
	const surface = String(
		named(/^(surface|card|panel|background-secondary|bg-secondary)$/i) ??
			backgrounds[1]?.value ??
			background,
	)
	const primary = String(
		named(/^(primary|accent|brand|action|main)$/i) ??
			palette.find((token) => {
				const value = luminance(String(token.value)) ?? 0
				return value > 0.1 && value < 0.65
			})?.value ??
			base.primary,
	)
	const foreground = readableText(background)
	const features = profile?.features ?? []
	const radius = features.includes("sharp-corners")
		? "0px"
		: features.includes("rounded-cards")
			? "22px"
			: base.radius
	const fallbackFont = features.includes("mono-type")
		? '"IBM Plex Mono", monospace'
		: features.includes("serif-type")
			? '"Lora", serif'
			: base.fontFamily
	const font = profile?.fontFamily
		? `"${profile.fontFamily.replace(/"/g, '\\"')}", ${fallbackFont}`
		: fallbackFont
	const heading = style.design.typography.find((token) =>
		/heading|display|hero|h1/i.test(token.name),
	)
	const weight = Number(heading?.fontWeight)
	const layered = features.includes("layered-panels")
	const atmospheric = features.includes("glow") || features.includes("soft-gradient")
	const variables = {
		"--scene-bg": background,
		"--scene-surface": surface,
		"--scene-ink": foreground,
		"--scene-muted": `color-mix(in srgb, ${foreground} 62%, ${background})`,
		"--scene-primary": primary,
		"--scene-on-primary": readableText(primary),
		"--scene-line": `color-mix(in srgb, ${foreground} ${features.includes("bold-borders") ? 75 : 16}%, ${background})`,
		"--scene-radius": radius,
		"--scene-gap": features.includes("generous-space")
			? "40px"
			: features.includes("dense-data")
				? "16px"
				: "28px",
		"--scene-weight": Number.isFinite(weight) && weight >= 100 && weight <= 900 ? weight : 600,
		"--scene-title-size": features.includes("oversized-type")
			? "clamp(2.75rem, 7vw, 5.5rem)"
			: "clamp(2.25rem, 5vw, 4rem)",
		"--scene-shadow": layered
			? `0 18px 50px color-mix(in srgb, ${foreground} 16%, transparent)`
			: "none",
		fontFamily: `${font}, "PingFang SC", "Microsoft YaHei", sans-serif`,
		colorScheme: readableText(background) === "#ffffff" ? "dark" : "light",
		backgroundImage: atmospheric
			? `radial-gradient(circle at 82% 8%, color-mix(in srgb, ${primary} 34%, transparent), transparent 38%)`
			: undefined,
	} as CSSProperties
	return { variables, background, surface, primary, foreground, font, radius }
}
