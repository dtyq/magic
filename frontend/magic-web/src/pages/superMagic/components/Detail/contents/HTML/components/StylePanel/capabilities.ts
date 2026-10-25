import type { SelectedElementInfo } from "./types"

const VOID_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
])

/**
 * Returns the controls that are meaningful for the selected element.
 * Capabilities are intentionally additive: a button can be both text and a flex item.
 */
export function getElementCapabilities(element: SelectedElementInfo | null) {
	if (!element) {
		return {
			isImage: false,
			isText: false,
			isVoid: false,
			isContainer: false,
			showTypography: false,
			showFontSize: false,
			showFontSizeAdjuster: false,
			showParagraph: false,
			showImage: false,
			showLayout: false,
			showFlexGrid: false,
			showBackground: false,
			showBorder: false,
			showShadow: false,
			showFlexItem: false,
			showGridItem: false,
			isLink: false,
		}
	}

	const tagName = element.tagName.toLowerCase()
	const display = element.computedStyles.display || "block"
	const isImage = element.isImageElement === true || tagName === "img"
	const isText = element.isTextElement === true && !isImage
	const isLink = tagName === "a"
	const isVoid = VOID_TAGS.has(tagName)
	const isContainer = !isVoid
	const hasDirectText = element.hasDirectTextContent === true
	const showTypography = isText && hasDirectText
	const showFontSize = showTypography
	const showFontSizeAdjuster = isContainer && !isImage
	const parentDisplay = element.computedStyles.parentDisplay

	return {
		isImage,
		isText,
		isVoid,
		isContainer,
		showTypography,
		showFontSize,
		showFontSizeAdjuster,
		showParagraph: showTypography,
		showImage: isImage,
		showLayout: true,
		showFlexGrid:
			isContainer &&
			(display === "flex" ||
				display === "grid" ||
				parentDisplay === "flex" ||
				parentDisplay === "grid"),
		showBackground: !isImage,
		showBorder: true,
		showShadow: true,
		showFlexItem: parentDisplay === "flex",
		showGridItem: parentDisplay === "grid",
		isLink,
	}
}
