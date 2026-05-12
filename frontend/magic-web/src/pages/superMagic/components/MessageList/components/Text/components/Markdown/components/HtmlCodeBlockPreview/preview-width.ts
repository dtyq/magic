import {
	HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH,
	HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES,
} from "./constants"

const HTML_PREVIEW_CANVAS_STYLE_WIDTH_PATTERN = /(?:min-|max-)?width\s*:\s*(\d{3,4})px\b/gi
const HTML_PREVIEW_CANVAS_ATTRIBUTE_WIDTH_PATTERN = /\bwidth\s*=\s*["']?(\d{3,4})["']?/gi
const HTML_PREVIEW_WIDTH_HINT_PATTERN = /width/i

function collectMatchedWidths(
	code: string,
	pattern: RegExp,
	options: { minimumWidth?: number } = {},
): number[] {
	const { minimumWidth = 1 } = options

	return Array.from(code.matchAll(pattern))
		.map((match) => Number(match[1]))
		.filter((width) => Number.isFinite(width) && width >= minimumWidth)
}

export function resolveHtmlPreviewCanvasWidth(code: string): number {
	if (!HTML_PREVIEW_WIDTH_HINT_PATTERN.test(code)) {
		return HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH
	}

	const matchedWidths = [
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_STYLE_WIDTH_PATTERN, {
			minimumWidth: HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH,
		}),
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_ATTRIBUTE_WIDTH_PATTERN, {
			minimumWidth: HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH,
		}),
	]
	const widestMatchedWidth = Math.max(HTML_CODE_BLOCK_PREVIEW_CANVAS_WIDTH, ...matchedWidths)

	return (
		HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES.find(
			(candidateWidth) => widestMatchedWidth <= candidateWidth,
		) ??
		HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES[
			HTML_CODE_BLOCK_PREVIEW_WIDE_CANVAS_WIDTH_CANDIDATES.length - 1
		]
	)
}

export function resolveHtmlPreviewIntrinsicWidthHint(code: string): number | null {
	if (!HTML_PREVIEW_WIDTH_HINT_PATTERN.test(code)) {
		return null
	}

	const matchedWidths = [
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_STYLE_WIDTH_PATTERN),
		...collectMatchedWidths(code, HTML_PREVIEW_CANVAS_ATTRIBUTE_WIDTH_PATTERN),
	]

	if (matchedWidths.length === 0) return null
	return Math.max(...matchedWidths)
}
