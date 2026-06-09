export interface CanonicalContentDimensions {
	width: number
	height: number
}

export const DEFAULT_PPT_CONTENT_DIMENSIONS: CanonicalContentDimensions = {
	width: 1920,
	height: 1080,
}

function parsePositiveDimension(value: string | null | undefined): number | null {
	if (!value) return null
	const parsed = Number.parseFloat(value)
	if (!Number.isFinite(parsed) || parsed <= 0) return null
	return Math.ceil(parsed)
}

function parsePositivePixelDimension(value: string | null | undefined): number | null {
	if (!value) return null
	if (!/^\d+(\.\d+)?px$/i.test(value.trim())) return null
	return parsePositiveDimension(value)
}

function getAttributeDimensions(slideContainer: Element): CanonicalContentDimensions | null {
	const width = parsePositiveDimension(slideContainer.getAttribute("data-width"))
	const height = parsePositiveDimension(slideContainer.getAttribute("data-height"))

	if (!width || !height) return null

	return { width, height }
}

function getInlineStyleDimensions(slideContainer: Element): CanonicalContentDimensions | null {
	if (!(slideContainer instanceof HTMLElement)) return null

	const width = parsePositivePixelDimension(slideContainer.style.width)
	const height = parsePositivePixelDimension(slideContainer.style.height)

	if (!width || !height) return null

	return { width, height }
}

export function extractSlideContainerDimensionsFromHtml(
	html: string | null | undefined,
): CanonicalContentDimensions | null {
	if (!html?.trim()) return null
	if (typeof DOMParser === "undefined") return null

	try {
		const doc = new DOMParser().parseFromString(html, "text/html")
		const slideContainer = doc.querySelector(".slide-container")

		if (!slideContainer) return null

		return getAttributeDimensions(slideContainer) ?? getInlineStyleDimensions(slideContainer)
	} catch {
		return null
	}
}

export function resolvePptScaleContentDimensions(
	content: string | null | undefined,
	rawSourceCode?: string | null,
): CanonicalContentDimensions {
	return (
		extractSlideContainerDimensionsFromHtml(content) ??
		extractSlideContainerDimensionsFromHtml(rawSourceCode) ??
		DEFAULT_PPT_CONTENT_DIMENSIONS
	)
}
