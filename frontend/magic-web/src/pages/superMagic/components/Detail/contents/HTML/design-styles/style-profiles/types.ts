export type StyleScene =
	"dashboard" | "editorial" | "commerce" | "landing" | "portfolio" | "terminal"

export type StyleLayout = "sidebar" | "split" | "centered" | "magazine" | "grid" | "stacked"

export type StyleTheme = "light" | "dark" | "mixed"

export type StyleFeature =
	| "oversized-type"
	| "serif-type"
	| "mono-type"
	| "hairline-grid"
	| "dense-data"
	| "soft-gradient"
	| "color-blocks"
	| "photo-led"
	| "rounded-cards"
	| "sharp-corners"
	| "generous-space"
	| "compact-controls"
	| "layered-panels"
	| "bold-borders"
	| "muted-surfaces"
	| "accent-line"
	| "editorial-columns"
	| "glow"

export interface LocalizedStyleText {
	zh: string
	en: string
}

export interface StyleProfile {
	code: string
	name: LocalizedStyleText
	description: LocalizedStyleText
	scene: StyleScene
	layout: StyleLayout
	theme: StyleTheme
	features: StyleFeature[]
	sourceSection: string
	fontFamily?: string
}
