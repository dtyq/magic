const DEFAULT_INSERTED_IMAGE_NODE_WIDTH = "100%"
const FALLBACK_INSERTED_IMAGE_WIDTH_PX = 240
const INDEFINITE_WIDTH_PATTERN = /^(auto|fit-content|max-content|min-content|initial)(\(.*\))?$/i
const CSS_GLOBAL_KEYWORDS = new Set(["inherit", "unset", "revert", "revert-layer"])
const CONTENT_SIZED_DISPLAYS = new Set([
	"inline",
	"inline-block",
	"inline-flex",
	"inline-grid",
	"table",
	"inline-table",
])
const STRETCHING_DISPLAYS = new Set(["block", "flex", "grid", "list-item", "flow-root"])

/**
 * Resolve insert width from the live parent box.
 * Percentage width is kept when the parent already has a definite size.
 * Content-sized parents use the current box so the image cannot expand
 * the container to the page width.
 */
export function resolveInsertedImageNodeWidth(parent: HTMLElement): string {
	if (shouldUsePercentageWidth(parent)) return DEFAULT_INSERTED_IMAGE_NODE_WIDTH

	const measuredWidth = measureContentBoxWidth(parent)
	if (measuredWidth <= 0) return `${FALLBACK_INSERTED_IMAGE_WIDTH_PX}px`
	return `${Math.round(measuredWidth)}px`
}

function shouldUsePercentageWidth(parent: HTMLElement): boolean {
	// Absolute lengths are used-definite. Percentages are not: they still
	// resolve against a containing block that may itself be shrink-to-fit.
	if (hasAbsoluteSpecifiedWidth(parent)) return true
	if (hasContentSizedAncestorBeforeDefiniteWidth(parent)) return false
	if (hasDefiniteSpecifiedWidth(parent)) return true
	if (isNormalFlowStretchingBox(parent)) return true
	return stretchesToContainingBlock(parent)
}

function isNormalFlowStretchingBox(element: HTMLElement): boolean {
	if (isContentSizedBox(element)) return false
	const style = getComputedStyle(element)
	if (!STRETCHING_DISPLAYS.has(style.display)) return false
	if (style.float && style.float !== "none") return false
	if (
		(style.position === "absolute" || style.position === "fixed") &&
		(isAutoOrEmpty(style.left) || isAutoOrEmpty(style.right))
	) {
		return false
	}
	return !hasDefiniteSpecifiedWidth(element)
}

function hasDefiniteSpecifiedWidth(element: HTMLElement): boolean {
	const specified = readSpecifiedWidth(element)
	if (!specified) return false

	const normalized = specified.trim().toLowerCase()
	if (!normalized) return false
	if (INDEFINITE_WIDTH_PATTERN.test(normalized)) return false
	if (CSS_GLOBAL_KEYWORDS.has(normalized)) return false

	return true
}

function hasAbsoluteSpecifiedWidth(element: HTMLElement): boolean {
	if (!hasDefiniteSpecifiedWidth(element)) return false
	return !readSpecifiedWidth(element).includes("%")
}

function readSpecifiedWidth(element: HTMLElement): string {
	const mappedWidth = readComputedStyleMapWidth(element)
	if (mappedWidth) return mappedWidth
	return element.style.width.trim()
}

function readComputedStyleMapWidth(element: HTMLElement): string {
	if (typeof element.computedStyleMap !== "function") return ""

	try {
		const mapped = element.computedStyleMap().get("width")
		if (!mapped) return ""
		if (typeof CSSKeywordValue !== "undefined" && mapped instanceof CSSKeywordValue) {
			return mapped.value
		}
		if (typeof CSSUnitValue !== "undefined" && mapped instanceof CSSUnitValue) {
			return `${mapped.value}${mapped.unit === "percent" ? "%" : mapped.unit}`
		}
		return mapped.toString()
	} catch {
		return ""
	}
}

function hasContentSizedAncestorBeforeDefiniteWidth(element: HTMLElement): boolean {
	let current: HTMLElement | null = element
	while (current && current !== document.documentElement) {
		if (hasAbsoluteSpecifiedWidth(current)) return false
		if (isContentSizedBox(current)) return true
		current = current.parentElement
	}
	return false
}

function isContentSizedBox(element: HTMLElement): boolean {
	if (element === document.body || element === document.documentElement) return false
	if (hasDefiniteSpecifiedWidth(element)) return false

	const specified = readSpecifiedWidth(element).trim().toLowerCase()
	if (
		specified.startsWith("fit-content") ||
		specified === "max-content" ||
		specified === "min-content"
	) {
		return true
	}

	const style = getComputedStyle(element)
	if (CONTENT_SIZED_DISPLAYS.has(style.display)) return true
	if (style.float && style.float !== "none") return true
	if (
		(style.position === "absolute" || style.position === "fixed") &&
		(isAutoOrEmpty(style.left) || isAutoOrEmpty(style.right))
	) {
		return true
	}

	return isContentSizedFlexItem(element, style)
}

function isAutoOrEmpty(value: string): boolean {
	return !value || value === "auto"
}

function isContentSizedFlexItem(element: HTMLElement, style: CSSStyleDeclaration): boolean {
	const parent = element.parentElement
	if (!parent) return false

	const parentStyle = getComputedStyle(parent)
	if (parentStyle.display !== "flex" && parentStyle.display !== "inline-flex") return false

	const direction = parentStyle.flexDirection || "row"
	const isRow = direction === "row" || direction === "row-reverse"
	if (isRow) return Number.parseFloat(style.flexGrow || "0") === 0

	const alignSelf = style.alignSelf === "auto" ? parentStyle.alignItems : style.alignSelf
	return alignSelf !== "stretch" && alignSelf !== "normal"
}

function stretchesToContainingBlock(element: HTMLElement): boolean {
	// Temporary inline width is restored in finally before paint can flush.
	const previousWidth = element.style.width
	const before = element.offsetWidth

	try {
		element.style.width = "100%"
		return before === element.offsetWidth
	} finally {
		element.style.width = previousWidth
	}
}

function measureContentBoxWidth(element: HTMLElement): number {
	const style = getComputedStyle(element)
	const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
	const paddingRight = Number.parseFloat(style.paddingRight) || 0
	const borderBoxWidth = element.clientWidth || element.getBoundingClientRect().width
	return Math.max(0, borderBoxWidth - paddingLeft - paddingRight)
}
