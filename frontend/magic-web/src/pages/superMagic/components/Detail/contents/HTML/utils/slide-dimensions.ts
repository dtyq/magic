export interface CanonicalContentDimensions {
	width: number
	height: number
}

export const DEFAULT_PPT_CONTENT_DIMENSIONS: CanonicalContentDimensions = {
	width: 1920,
	height: 1080,
}

const PPTX_DPI = 96

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

function getAttributeDimensions(canvas: Element): CanonicalContentDimensions | null {
	const width = parsePositiveDimension(canvas.getAttribute("data-width"))
	const height = parsePositiveDimension(canvas.getAttribute("data-height"))

	if (!width || !height) return null

	return { width, height }
}

function getInlineStyleDimensions(canvas: Element): CanonicalContentDimensions | null {
	if (!(canvas instanceof HTMLElement)) return null

	const width = parsePositivePixelDimension(canvas.style.width)
	const height = parsePositivePixelDimension(canvas.style.height)

	if (!width || !height) return null

	return { width, height }
}

function getDeclarationDimensions(declarations: string): CanonicalContentDimensions | null {
	const width = parsePositivePixelDimension(
		declarations.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i)?.[1],
	)
	const height = parsePositivePixelDimension(
		declarations.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i)?.[1],
	)

	if (!width || !height) return null

	return { width, height }
}

function getStyleRuleDimensions(doc: Document): CanonicalContentDimensions | null {
	const rules = Array.from(doc.querySelectorAll("style"))
	for (const style of rules) {
		const matches = style.textContent?.matchAll(/([^{}]+)\{([^{}]*)\}/g)
		if (!matches) continue

		for (const match of matches) {
			const selectors = match[1]
			const declarations = match[2]
			if (!selectors.includes(".slide-container") && !selectors.includes(".ft-canvas")) {
				continue
			}

			const dimensions = getDeclarationDimensions(declarations)
			if (dimensions) return dimensions
		}
	}

	return null
}

function getRootStyleRuleDimensions(doc: Document): CanonicalContentDimensions | null {
	const rules = Array.from(doc.querySelectorAll("style"))

	for (const style of rules) {
		const matches = style.textContent?.matchAll(/([^{}]+)\{([^{}]*)\}/g)
		if (!matches) continue

		for (const match of matches) {
			const selectors = match[1].split(",").map((selector) => selector.trim().toLowerCase())
			if (!selectors.includes("html") || !selectors.includes("body")) continue

			const dimensions = getDeclarationDimensions(match[2])
			if (dimensions) return dimensions
		}
	}

	return null
}

export function extractSlideContainerDimensionsFromHtml(
	html: string | null | undefined,
): CanonicalContentDimensions | null {
	if (!html?.trim()) return null
	if (typeof DOMParser === "undefined") return null

	try {
		const doc = new DOMParser().parseFromString(html, "text/html")
		const canvas = doc.querySelector(".slide-container, main.ft-canvas")

		if (!canvas) return null

		return (
			getAttributeDimensions(canvas) ??
			getInlineStyleDimensions(canvas) ??
			getStyleRuleDimensions(doc) ??
			getRootStyleRuleDimensions(doc)
		)
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

/**
 * 一个 PPTX 文件只能使用一套页面尺寸，因此以首张导出页的画布比例作为整份文件的布局。
 */
export function createPptxSlideConfig(dimensions: CanonicalContentDimensions) {
	return {
		htmlWidth: dimensions.width,
		htmlHeight: dimensions.height,
		slideWidth: dimensions.width / PPTX_DPI,
		slideHeight: dimensions.height / PPTX_DPI,
	}
}
