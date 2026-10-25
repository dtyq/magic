import { getPrimaryFontFamily, parseFontFamilyStack } from "./fontRendering"

export type GoogleFontLoadStatus = "loaded" | "skipped" | "failed"

const GOOGLE_FONT_FAMILIES = new Set([
	"Cormorant Garamond",
	"DM Mono",
	"DM Sans",
	"IBM Plex Mono",
	"IBM Plex Sans",
	"Inter",
	"JetBrains Mono",
	"Lora",
	"Open Sans",
	"Playfair Display",
	"Plus Jakarta Sans",
	"Poppins",
	"Space Mono",
	"Syne",
])

const pendingLoads = new Map<string, Promise<GoogleFontLoadStatus>>()

function normalizeFamily(value: string) {
	return value.trim().replace(/^['"]|['"]$/g, "")
}

export function getGoogleFontFamilies(value: unknown) {
	return parseFontFamilyStack(value)
		.map(normalizeFamily)
		.filter((family) => GOOGLE_FONT_FAMILIES.has(family))
}

export function buildGoogleFontsCssUrl(families: string[]) {
	const uniqueFamilies = Array.from(new Set(families)).filter((family) =>
		GOOGLE_FONT_FAMILIES.has(family),
	)
	if (uniqueFamilies.length === 0) return undefined

	const query = uniqueFamilies
		.map(
			(family) =>
				`family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@300;400;500;600;700`,
		)
		.join("&")
	return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

export function loadGoogleFonts(
	value: unknown,
	documentLike: Document | undefined = typeof document === "undefined" ? undefined : document,
): Promise<GoogleFontLoadStatus> {
	const families = getGoogleFontFamilies(value)
	const url = buildGoogleFontsCssUrl(families)
	if (!url || !documentLike?.head) return Promise.resolve("skipped")

	const primaryFamily = getPrimaryFontFamily(value) ?? families[0]
	const pendingLoad = pendingLoads.get(primaryFamily)
	if (pendingLoad) return pendingLoad
	const existingLink = Array.from(
		documentLike.head.querySelectorAll<HTMLLinkElement>("link[data-design-style-google-fonts]"),
	).find((link) => link.dataset.designStyleGoogleFonts === primaryFamily)
	if (existingLink) return Promise.resolve("loaded")

	const loadPromise = new Promise<GoogleFontLoadStatus>((resolve) => {
		const link = documentLike.createElement("link")
		link.rel = "stylesheet"
		link.href = url
		link.dataset.designStyleGoogleFonts = primaryFamily
		link.onload = () => resolve("loaded")
		link.onerror = () => resolve("failed")
		documentLike.head.appendChild(link)
	})
	pendingLoads.set(primaryFamily, loadPromise)
	return loadPromise.finally(() => pendingLoads.delete(primaryFamily))
}
