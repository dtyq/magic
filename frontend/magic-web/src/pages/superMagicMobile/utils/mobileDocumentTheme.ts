export type MobileDocumentColorScheme = "light" | "dark"

export interface MobileDocumentThemeOptions {
	isSidebarOpen: boolean
	colorScheme: MobileDocumentColorScheme
}

/** Hex literals for meta theme-color (browser API cannot use CSS variables). */
export const MOBILE_DOCUMENT_THEME_HEX = {
	closed: {
		light: "#fafafa",
		dark: "#0a0a0a",
	},
	/** Matches --mobile-shell-track-rgb (prototype --muted when sidebar is open). */
	open: {
		light: "#f5f5f5",
		dark: "#262626",
	},
} as const

const MOBILE_DOCUMENT_BACKGROUND_CSS = {
	closed: "rgb(var(--mobile-background-rgb))",
	open: "rgb(var(--mobile-shell-track-rgb))",
} as const

/**
 * Resolve status-bar hex from sidebar + color scheme (aligned with prototype HomeScreen).
 */
export function getMobileDocumentThemeHex({
	isSidebarOpen,
	colorScheme,
}: MobileDocumentThemeOptions): string {
	const palette = isSidebarOpen
		? MOBILE_DOCUMENT_THEME_HEX.open
		: MOBILE_DOCUMENT_THEME_HEX.closed
	return palette[colorScheme]
}

/**
 * Resolve html/body background CSS aligned with mobile panel (background) vs shell track (muted).
 */
export function getMobileDocumentBackgroundCss(isSidebarOpen: boolean): string {
	return isSidebarOpen
		? MOBILE_DOCUMENT_BACKGROUND_CSS.open
		: MOBILE_DOCUMENT_BACKGROUND_CSS.closed
}

/**
 * Ensure a theme-color meta exists for runtime updates (index.html may only have media-qualified tags).
 */
export function ensureThemeColorMeta(): HTMLMetaElement {
	const existing = document.querySelector<HTMLMetaElement>(
		'meta[name="theme-color"]:not([media])',
	)
	if (existing) return existing

	const meta = document.createElement("meta")
	meta.setAttribute("name", "theme-color")
	document.head.appendChild(meta)
	return meta
}

/**
 * Sync meta theme-color and html/body background for mobile chrome / viewport-fit gaps.
 */
export function applyMobileDocumentTheme(options: MobileDocumentThemeOptions): void {
	const themeMeta = ensureThemeColorMeta()
	const hex = getMobileDocumentThemeHex(options)
	const background = getMobileDocumentBackgroundCss(options.isSidebarOpen)

	themeMeta.setAttribute("content", hex)
	document.documentElement.style.background = background
	document.body.style.background = background
}
