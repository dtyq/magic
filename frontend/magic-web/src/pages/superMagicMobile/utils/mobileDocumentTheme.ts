import type { CSSProperties } from "react"

import { interfaceStore } from "@/stores/interface"

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
 * html/body use the same hex as theme-color so iOS Safari can sample a literal color
 * (CSS variables in inline styles are unreliable for status-bar / chrome tinting).
 */
export function applyMobileDocumentTheme(options: MobileDocumentThemeOptions): void {
	const themeMeta = ensureThemeColorMeta()
	const hex = getMobileDocumentThemeHex(options)

	themeMeta.setAttribute("content", hex)
	document.documentElement.style.backgroundColor = hex
	document.body.style.backgroundColor = hex
}

interface MobileGlobalSafeAreaStyle {
	top: CSSProperties
	bottom: CSSProperties
}

/**
 * Resolve top/bottom GlobalSafeArea inline styles from sidebar state (shell track vs default token).
 */
export function getMobileGlobalSafeAreaStyle(isSidebarOpen: boolean): MobileGlobalSafeAreaStyle {
	if (!isSidebarOpen) {
		return { top: {}, bottom: {} }
	}

	const backgroundColor = getMobileDocumentBackgroundCss(true)
	return {
		top: { backgroundColor },
		bottom: { backgroundColor },
	}
}

/**
 * Sync GlobalSafeArea top/bottom fills with the mobile shell drawer background.
 */
export function applyMobileGlobalSafeAreaForSidebar(isSidebarOpen: boolean): void {
	const { top, bottom } = getMobileGlobalSafeAreaStyle(isSidebarOpen)
	interfaceStore.setGlobalSafeAreaStyle("top", top)
	interfaceStore.setGlobalSafeAreaStyle("bottom", bottom)
}
