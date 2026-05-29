import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { interfaceStore } from "@/stores/interface"

import {
	applyMobileDocumentTheme,
	applyMobileGlobalSafeAreaForSidebar,
	ensureThemeColorMeta,
	getMobileDocumentBackgroundCss,
	getMobileGlobalSafeAreaStyle,
	getMobileDocumentThemeHex,
	MOBILE_DOCUMENT_THEME_HEX,
} from "../mobileDocumentTheme"

describe("mobileDocumentTheme", () => {
	beforeEach(() => {
		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""
	})

	afterEach(() => {
		document.head.innerHTML = ""
		document.documentElement.style.background = ""
		document.body.style.background = ""
		interfaceStore.resetGlobalSafeAreaStyle()
	})

	it("maps sidebar + scheme to prototype hex values", () => {
		expect(
			getMobileDocumentThemeHex({ isSidebarOpen: false, colorScheme: "light" }),
		).toBe(MOBILE_DOCUMENT_THEME_HEX.closed.light)
		expect(
			getMobileDocumentThemeHex({ isSidebarOpen: true, colorScheme: "light" }),
		).toBe(MOBILE_DOCUMENT_THEME_HEX.open.light)
		expect(
			getMobileDocumentThemeHex({ isSidebarOpen: false, colorScheme: "dark" }),
		).toBe(MOBILE_DOCUMENT_THEME_HEX.closed.dark)
		expect(
			getMobileDocumentThemeHex({ isSidebarOpen: true, colorScheme: "dark" }),
		).toBe(MOBILE_DOCUMENT_THEME_HEX.open.dark)
	})

	it("maps sidebar state to mobile background CSS variables", () => {
		expect(getMobileDocumentBackgroundCss(false)).toBe("rgb(var(--mobile-background-rgb))")
		expect(getMobileDocumentBackgroundCss(true)).toBe("rgb(var(--mobile-shell-track-rgb))")
	})

	it("creates theme-color meta when only media-qualified tags exist", () => {
		const mediaMeta = document.createElement("meta")
		mediaMeta.setAttribute("name", "theme-color")
		mediaMeta.setAttribute("content", "#fafafa")
		mediaMeta.setAttribute("media", "(prefers-color-scheme: light)")
		document.head.appendChild(mediaMeta)

		const meta = ensureThemeColorMeta()
		expect(meta.getAttribute("media")).toBeNull()
		expect(document.querySelectorAll('meta[name="theme-color"]').length).toBe(2)
	})

	it("applyMobileDocumentTheme writes meta content and document backgrounds", () => {
		applyMobileDocumentTheme({ isSidebarOpen: true, colorScheme: "light" })

		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
		expect(meta?.getAttribute("content")).toBe("#f5f5f5")
		expect(document.documentElement.style.background).toBe("rgb(var(--mobile-shell-track-rgb))")
		expect(document.body.style.background).toBe("rgb(var(--mobile-shell-track-rgb))")
	})

	it("maps sidebar state to GlobalSafeArea shell track background", () => {
		expect(getMobileGlobalSafeAreaStyle(false)).toEqual({ top: {}, bottom: {} })
		expect(getMobileGlobalSafeAreaStyle(true)).toEqual({
			top: { backgroundColor: "rgb(var(--mobile-shell-track-rgb))" },
			bottom: { backgroundColor: "rgb(var(--mobile-shell-track-rgb))" },
		})
	})

	it("applyMobileGlobalSafeAreaForSidebar writes interfaceStore top/bottom styles", () => {
		applyMobileGlobalSafeAreaForSidebar(true)

		expect(interfaceStore.globalSafeAreaStyle.top).toEqual({
			backgroundColor: "rgb(var(--mobile-shell-track-rgb))",
		})
		expect(interfaceStore.globalSafeAreaStyle.bottom).toEqual({
			backgroundColor: "rgb(var(--mobile-shell-track-rgb))",
		})
	})
})
