/**
 * Element Selector
 * Handles element selection and highlighting
 */

import type { EditorBridge } from "../core/EditorBridge"
import { getElementSelector, isInjectedElement } from "../utils/dom"
import { isSourceNode } from "../utils/sourceNodes"
import { normalizeColor, normalizeTextAlign } from "../utils/css"
import { getEditableTextContent } from "../utils/textContent"

const TEXT_EDITING_STYLE_ID = "magic-editor-text-editing-style"

function isPxLineHeight(value: string): boolean {
	return /^-?(?:\d+\.?\d*|\.\d+)px$/i.test(value.trim())
}

/** Prefer the specified line-height over used pixels from getComputedStyle. */
function readAuthoredLineHeight(element: HTMLElement): string {
	const inline = element.style.getPropertyValue("line-height").trim()
	if (inline) return inline

	const typed = readTypedLineHeight(element)
	if (typed) return typed

	let authored = ""
	const visitRules = (rules: CSSRuleList) => {
		for (const rule of Array.from(rules)) {
			if (rule.type === CSSRule.MEDIA_RULE) {
				if (!isMatchingMediaRule(element, rule as CSSMediaRule)) continue
				try {
					visitRules((rule as CSSGroupingRule).cssRules)
				} catch {
					// Ignore unreadable grouped rules.
				}
				continue
			}
			if (rule.type === CSSRule.SUPPORTS_RULE) {
				if (!isMatchingSupportsRule(rule as CSSSupportsRule)) continue
				try {
					visitRules((rule as CSSGroupingRule).cssRules)
				} catch {
					// Ignore unreadable grouped rules.
				}
				continue
			}
			if (!(rule instanceof CSSStyleRule)) continue
			try {
				if (!element.matches(rule.selectorText)) continue
			} catch {
				continue
			}
			const value = rule.style.getPropertyValue("line-height").trim()
			if (value) authored = value
		}
	}

	for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
		if (sheet.disabled || !isMatchingStyleSheetMedia(element, sheet)) continue
		try {
			visitRules(sheet.cssRules)
		} catch {
			// Cross-origin stylesheets cannot be read.
		}
	}
	return authored
}

function readTypedLineHeight(element: HTMLElement): string {
	if (typeof element.computedStyleMap !== "function") return ""

	try {
		const mapped = element.computedStyleMap().get("line-height")
		if (!mapped) return ""
		if (typeof CSSKeywordValue !== "undefined" && mapped instanceof CSSKeywordValue) {
			return mapped.value
		}
		if (typeof CSSUnitValue !== "undefined" && mapped instanceof CSSUnitValue) {
			if (mapped.unit === "number") return String(mapped.value)
			if (mapped.unit === "percent") return `${mapped.value}%`
			return `${mapped.value}${mapped.unit}`
		}
		return mapped.toString()
	} catch {
		return ""
	}
}

function isMatchingMediaRule(element: HTMLElement, rule: CSSMediaRule): boolean {
	return matchesMediaQuery(element, rule.media?.mediaText ?? "")
}

function isMatchingSupportsRule(rule: CSSSupportsRule): boolean {
	if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true
	try {
		return CSS.supports(rule.conditionText)
	} catch {
		return true
	}
}

function isMatchingStyleSheetMedia(element: HTMLElement, sheet: CSSStyleSheet): boolean {
	return matchesMediaQuery(element, sheet.media?.mediaText ?? "")
}

function matchesMediaQuery(element: HTMLElement, mediaText: string): boolean {
	const query = mediaText.trim()
	if (!query || query === "all") return true
	const view = element.ownerDocument.defaultView
	if (!view?.matchMedia) return true
	try {
		return view.matchMedia(query).matches
	} catch {
		return true
	}
}

interface ElementInfo {
	selector: string
	tagName: string
	isImageElement?: boolean
	intrinsicWidth?: number
	intrinsicHeight?: number
	intrinsicAspectRatio?: number
	computedStyles: Record<string, string>
	rect: {
		top: number
		left: number
		width: number
		height: number
	}
	rotation?: number
	isTextElement?: boolean
	/** Whether the element itself contains non-whitespace text nodes. */
	hasDirectTextContent?: boolean
	textContent?: string
	inlineStyles?: Record<string, string>
	attributes?: {
		href?: string
		dataMagicHref?: string
		target?: string
		rel?: string
		download?: string
		title?: string
		ariaLabel?: string
	}
}

export class ElementSelector {
	private selectedElements: Set<HTMLElement> = new Set()
	private hoveredElement: HTMLElement | null = null
	private enabled = false
	private bridge: EditorBridge
	private updateTimer: number | null = null
	private scrollCleanup: (() => void) | null = null
	private onTextEditingRequest?: (selector: string) => void
	private injectedTextEditingStyle: HTMLStyleElement | null = null

	constructor(bridge: EditorBridge) {
		this.bridge = bridge
		this.injectStyles()
		this.bindEvents()
		this.bindScrollListener()
	}

	/**
	 * Set callback for text editing requests
	 */
	setTextEditingCallback(callback: (selector: string) => void): void {
		this.onTextEditingRequest = callback
	}

	/**
	 * Check if element is selected
	 */
	isSelected(element: HTMLElement): boolean {
		return this.selectedElements.has(element)
	}

	/**
	 * Add element to selection
	 */
	addToSelection(element: HTMLElement): void {
		this.selectedElements.add(element)
		this.notifySelectionChanged()
	}

	/**
	 * Remove element from selection
	 */
	removeFromSelection(element: HTMLElement): void {
		// Remove editor-owned DOM state without changing author inline styles.
		if (element.getAttribute("data-text-editing") === "true") {
			element.contentEditable = "false"
			element.removeAttribute("data-text-editing")
		}
		this.selectedElements.delete(element)
		this.notifySelectionChanged()
	}

	/**
	 * Get all selected elements info
	 */
	getSelectedElementsInfo(): ElementInfo[] {
		const infos: ElementInfo[] = []
		this.selectedElements.forEach((element) => {
			const selector = getElementSelector(element)
			const styles = this.getElementStyles(element)
			const inlineStyles = this.getInlineStyles(element)
			const { rect, rotation } = this.getElementRectWithRotation(element)
			const isText = this.isTextElement(element)
			const hasDirectTextContent = this.hasDirectTextContent(element)
			const textContent = getEditableTextContent(element).trim()
			const imageMetadata = this.getImageMetadata(element)
			const attributes = this.getCommonAttributes(element)

			infos.push({
				selector,
				tagName: element.tagName.toLowerCase(),
				...imageMetadata,
				computedStyles: styles,
				inlineStyles,
				rect,
				rotation,
				isTextElement: isText,
				hasDirectTextContent,
				textContent: isText ? textContent : undefined,
				attributes,
			})
		})
		return infos
	}

	/**
	 * Get selectors of all selected elements
	 */
	getSelectedSelectors(): string[] {
		const selectors: string[] = []
		this.selectedElements.forEach((element) => {
			selectors.push(getElementSelector(element))
		})
		return selectors
	}

	/**
	 * Get count of selected elements
	 */
	getSelectedCount(): number {
		return this.selectedElements.size
	}

	/**
	 * Refresh current selection info and notify parent
	 */
	refreshSelection(): void {
		this.notifySelectionChanged()
	}

	/**
	 * Inject editor-only text editing rules without touching author inline styles.
	 */
	private injectStyles(): void {
		if (document.getElementById(TEXT_EDITING_STYLE_ID)) return

		const style = document.createElement("style")
		style.id = TEXT_EDITING_STYLE_ID
		style.setAttribute("data-injected", "true")
		style.textContent = `
[data-text-editing="true"] {
	-webkit-user-select: text !important;
	user-select: text !important;
	outline: none !important;
}
`
		document.head.appendChild(style)
		this.injectedTextEditingStyle = style
	}

	private getElementStyles(element: HTMLElement): Record<string, string> {
		const computed = window.getComputedStyle(element)
		const styles: Record<string, string> = {}

		const importantProps = [
			"color",
			"fontSize",
			"fontWeight",
			"fontFamily",
			"fontStyle",
			"lineHeight",
			"textAlign",
			"textDecoration",
			"backgroundColor",
			"backgroundImage",
			"width",
			"height",
			"margin",
			"marginTop",
			"marginRight",
			"marginBottom",
			"marginLeft",
			"padding",
			"paddingTop",
			"paddingRight",
			"paddingBottom",
			"paddingLeft",
			"border",
			"borderWidth",
			"borderStyle",
			"borderColor",
			"borderRadius",
			"display",
			"position",
			"opacity",
			"boxShadow",
			"textShadow",
			"transform",
			"flexDirection",
			"justifyContent",
			"alignItems",
			"alignContent",
			"flexWrap",
			"flexGrow",
			"flexShrink",
			"flexBasis",
			"minWidth",
			"minHeight",
			"alignSelf",
			"gap",
			"rowGap",
			"columnGap",
			"gridTemplateColumns",
			"gridTemplateRows",
			"gridAutoFlow",
			"gridAutoColumns",
			"gridAutoRows",
			"gridColumn",
			"gridRow",
			"justifyItems",
			"justifySelf",
			"objectFit",
			"objectPosition",
		]

		importantProps.forEach((prop) => {
			const value = computed[prop as keyof CSSStyleDeclaration] as string

			// Normalize color values (convert rgb to hex)
			if (prop === "color" || prop === "backgroundColor" || prop === "borderColor") {
				styles[prop] = normalizeColor(value)
			}
			// Normalize textAlign (start/end to left/right)
			else if (prop === "textAlign") {
				styles[prop] = normalizeTextAlign(value)
			}
			// For border compound property, normalize embedded colors
			else if (prop === "border" && value.includes("rgb")) {
				// Replace rgb colors in border string with hex
				styles[prop] = value.replace(/rgb\([^)]+\)/g, (match) => normalizeColor(match))
			} else {
				styles[prop] = value
			}
		})
		if (styles.display === "flex" && styles.justifyContent === "normal") {
			styles.justifyContent = "flex-start"
		}

		const authoredLineHeight = readAuthoredLineHeight(element)
		if (authoredLineHeight && !isPxLineHeight(authoredLineHeight)) {
			styles.lineHeight = authoredLineHeight
		}

		const parent = element.parentElement
		if (parent) {
			const parentComputed = window.getComputedStyle(parent)
			styles.parentSelector = getElementSelector(parent)
			styles.parentDisplay = parentComputed.display
			styles.parentFlexDirection = parentComputed.flexDirection
			styles.parentJustifyContent =
				parentComputed.display === "flex" && parentComputed.justifyContent === "normal"
					? "flex-start"
					: parentComputed.justifyContent
			styles.parentAlignItems = parentComputed.alignItems
		}

		// Inline offsets first. Abs/fixed still need used computed values.
		const positionProps = ["top", "left", "right", "bottom"] as const
		const usesOffsetPosition = styles.position === "absolute" || styles.position === "fixed"
		positionProps.forEach((prop) => {
			const inlineValue = element.style.getPropertyValue(prop)
			if (inlineValue) {
				styles[prop] = inlineValue
				return
			}
			if (usesOffsetPosition) styles[prop] = computed[prop]
		})

		// Debug: Log position values
		if (element.style.top || element.style.left) {
			console.log("[ElementSelector] getElementStyles position values:", {
				selector: element.tagName,
				inlineTop: element.style.top,
				inlineLeft: element.style.left,
				stylesTop: styles.top,
				stylesLeft: styles.left,
				computedTop: computed.top,
				computedLeft: computed.left,
			})
		}

		return styles
	}

	private getInlineStyles(element: HTMLElement): Record<string, string> {
		const styles: Record<string, string> = {}
		for (let index = 0; index < element.style.length; index += 1) {
			const property = element.style.item(index)
			if (!property) continue
			const value = element.style.getPropertyValue(property).trim()
			if (!value) continue
			const priority = element.style.getPropertyPriority(property)
			styles[property] = priority ? `${value} !${priority}` : value
		}
		return styles
	}

	private getCommonAttributes(element: HTMLElement): ElementInfo["attributes"] {
		const read = (name: string) => element.getAttribute(name) || undefined
		return {
			href: read("href"),
			dataMagicHref: read("data-magic-href"),
			target: read("target"),
			rel: read("rel"),
			download: read("download"),
			title: read("title"),
			ariaLabel: read("aria-label"),
		}
	}

	/**
	 * Collect intrinsic image metadata so parent-side image tools can share one ratio source.
	 */
	private getImageMetadata(element: HTMLElement): {
		isImageElement: boolean
		intrinsicWidth?: number
		intrinsicHeight?: number
		intrinsicAspectRatio?: number
	} {
		if (!(element instanceof HTMLImageElement))
			return {
				isImageElement: false,
			}

		const intrinsicWidth = element.naturalWidth || undefined
		const intrinsicHeight = element.naturalHeight || undefined
		const intrinsicAspectRatio =
			intrinsicWidth && intrinsicHeight ? intrinsicWidth / intrinsicHeight : undefined

		return {
			isImageElement: true,
			intrinsicWidth,
			intrinsicHeight,
			intrinsicAspectRatio,
		}
	}

	private isDocumentRoot(element: EventTarget | HTMLElement | null): boolean {
		return element === document.body || element === document.documentElement
	}

	/**
	 * Find the actual selectable element (handle special containers like ECharts)
	 * If element is inside a special container (e.g. ECharts), return the container
	 */
	private findSelectableElement(element: HTMLElement): HTMLElement {
		let current: HTMLElement | null = element

		// Traverse up the DOM tree to find special containers
		while (current && current !== document.body && current !== document.documentElement) {
			// Check for ECharts container (has _echarts_instance_ attribute)
			if (current.hasAttribute("_echarts_instance_")) {
				console.log(
					"[ElementSelector] Found ECharts container, selecting it instead:",
					current,
				)
				return current
			}

			// Check for chart container by class name
			if (
				current.classList.contains("chart") ||
				current.classList.contains("chart-container")
			) {
				console.log(
					"[ElementSelector] Found chart container by class, selecting it instead:",
					current,
				)
				return current
			}

			// Check for elements with data-chart attribute
			if (current.hasAttribute("data-chart") || current.hasAttribute("data-chart-type")) {
				console.log(
					"[ElementSelector] Found chart container by data attribute, selecting it instead:",
					current,
				)
				return current
			}

			// Check for Highcharts container
			if (current.hasAttribute("data-highcharts-chart")) {
				console.log(
					"[ElementSelector] Found Highcharts container, selecting it instead:",
					current,
				)
				return current
			}

			// Check for Chart.js canvas wrapper
			// BUT: only if parent doesn't have a chart indicator (to avoid returning inner divs)
			const canvasChild: HTMLCanvasElement | null = current.querySelector("canvas")
			if (
				canvasChild &&
				current.childElementCount === 1 &&
				canvasChild.parentElement === current
			) {
				// Before returning, check if a parent has chart indicators
				const parent = current.parentElement
				if (parent && parent !== document.body && parent !== document.documentElement) {
					const hasParentChartIndicator =
						parent.hasAttribute("_echarts_instance_") ||
						parent.hasAttribute("data-chart") ||
						parent.hasAttribute("data-chart-type") ||
						parent.hasAttribute("data-highcharts-chart") ||
						parent.classList.contains("chart") ||
						parent.classList.contains("chart-container")

					if (hasParentChartIndicator) {
						// Don't return yet, continue to find the actual chart container
						current = current.parentElement
						continue
					}
				}

				// If the element is a simple wrapper around a single canvas, treat it as a chart container
				console.log(
					"[ElementSelector] Found canvas wrapper, selecting it instead:",
					current,
				)
				return current
			}

			current = current.parentElement
		}

		// No special container found, return original element
		return element
	}

	/**
	 * Check if element is primarily a text element
	 */
	private isTextElement(element: HTMLElement): boolean {
		const tagName = element.tagName.toLowerCase()

		// Common text container tags
		const textTags = [
			"p",
			"span",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"a",
			"li",
			"td",
			"th",
			"label",
			"button",
			"blockquote",
			"pre",
			"code",
			"strong",
			"em",
			"b",
			"i",
			"small",
			"mark",
			"del",
			"ins",
			"sub",
			"sup",
		]

		// Check if it's a known text tag
		if (textTags.includes(tagName)) {
			return true
		}

		// For div elements, check if it primarily contains text
		if (tagName === "div") {
			const textContent = element.textContent?.trim() || ""
			const hasSignificantText = textContent.length > 0

			if (!hasSignificantText) {
				return false
			}

			const allElements = Array.from(element.querySelectorAll("*"))

			// Inline/decorative tags that shouldn't count against the "simple text container" limit
			const inlineTags = [
				"span",
				"br",
				"a",
				"strong",
				"b",
				"em",
				"i",
				"mark",
				"small",
				"del",
				"ins",
				"sub",
				"sup",
				"code",
				"font",
				"svg",
				"img",
			]

			// Filter out inline/decorative tags to count only complex/structural elements
			const complexElements = allElements.filter(
				(el) => !inlineTags.includes(el.tagName.toLowerCase()),
			)

			// If it has text and very few complex structural elements (< 3), consider it a text element
			if (complexElements.length < 3) {
				return true
			}
		}

		return false
	}

	/**
	 * Check only the element's own text nodes, excluding text rendered by descendants.
	 * This distinction is used by the host toolbar to avoid showing font-size controls
	 * for containers whose content is entirely provided by child elements.
	 */
	private hasDirectTextContent(element: HTMLElement): boolean {
		return Array.from(element.childNodes).some(
			(node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
		)
	}

	/**
	 * Extract rotation angle from transform matrix
	 */
	private extractRotation(element: HTMLElement): number {
		const styles = window.getComputedStyle(element)
		const transform = styles.transform || styles.webkitTransform

		if (!transform || transform === "none") {
			return 0
		}

		// Parse transform matrix
		if (transform.startsWith("matrix(")) {
			const values = transform
				.match(/matrix\(([^)]+)\)/)?.[1]
				.split(",")
				.map(parseFloat)
			if (values && values.length >= 6) {
				const a = values[0]
				const b = values[1]
				const angle = Math.atan2(b, a) * (180 / Math.PI)
				return angle
			}
		}

		return 0
	}

	private extractTransformScale(element: HTMLElement): { scaleX: number; scaleY: number } {
		const styles = window.getComputedStyle(element)
		const transform = styles.transform || styles.webkitTransform

		if (!transform || transform === "none") {
			return { scaleX: 1, scaleY: 1 }
		}

		if (transform.startsWith("matrix3d(")) {
			const values = transform
				.match(/matrix3d\(([^)]+)\)/)?.[1]
				.split(",")
				.map(parseFloat)

			if (values && values.length >= 16) {
				const scaleX = Math.hypot(values[0], values[1], values[2])
				const scaleY = Math.hypot(values[4], values[5], values[6])
				return {
					scaleX: scaleX || 1,
					scaleY: scaleY || 1,
				}
			}
		}

		if (transform.startsWith("matrix(")) {
			const values = transform
				.match(/matrix\(([^)]+)\)/)?.[1]
				.split(",")
				.map(parseFloat)

			if (values && values.length >= 6) {
				const [a, b, c, d] = values
				const scaleX = Math.hypot(a, b)
				const scaleY = Math.hypot(c, d)
				return {
					scaleX: scaleX || 1,
					scaleY: scaleY || 1,
				}
			}
		}

		return { scaleX: 1, scaleY: 1 }
	}

	/**
	 * Get element's original rect (unrotated) and rotation angle
	 */
	private getElementRectWithRotation(element: HTMLElement) {
		const { scaleX, scaleY } = this.extractTransformScale(element)
		const width = element.offsetWidth * scaleX
		const height = element.offsetHeight * scaleY

		// Get bounding rect (includes rotation)
		const boundingRect = element.getBoundingClientRect()

		// Calculate center point
		const centerX = boundingRect.left + boundingRect.width / 2
		const centerY = boundingRect.top + boundingRect.height / 2

		// Calculate top-left corner of unrotated rect
		const left = centerX - width / 2
		const top = centerY - height / 2

		// Get rotation angle
		const rotation = this.extractRotation(element)

		return {
			rect: {
				top,
				left,
				width,
				height,
			},
			rotation,
		}
	}

	private getAncestorInfos(element: HTMLElement) {
		const ancestors: Array<{
			selector: string
			tagName: string
			textContent?: string
			rect: { top: number; left: number; width: number; height: number }
		}> = []
		let current = element.parentElement
		while (current && !this.isDocumentRoot(current) && ancestors.length < 8) {
			if (!isInjectedElement(current)) {
				const { rect } = this.getElementRectWithRotation(current)
				const textContent = getEditableTextContent(current).trim()
				ancestors.push({
					selector: getElementSelector(current),
					tagName: current.tagName.toLowerCase(),
					textContent: textContent || undefined,
					rect,
				})
			}
			current = current.parentElement
		}
		return ancestors
	}

	private getInFlowChildRects(element: HTMLElement) {
		return Array.from(element.children)
			.filter((node): node is HTMLElement => node instanceof HTMLElement)
			.map((child) => {
				const style = window.getComputedStyle(child)
				const { rect } = this.getElementRectWithRotation(child)
				return {
					...rect,
					position: style.position,
					display: style.display,
				}
			})
	}

	/** Live container + child boxes after a temporary style write. */
	getLayoutSnapshot(element: HTMLElement) {
		const { rect } = this.getElementRectWithRotation(element)
		return {
			rect,
			childRects: this.getInFlowChildRects(element),
		}
	}

	selectElement(element: HTMLElement, multiSelect = false) {
		if (!element || this.isDocumentRoot(element)) {
			return
		}

		// Ignore injected elements
		if (isInjectedElement(element) || !isSourceNode(element)) {
			return
		}

		// Check if element is already selected
		const isAlreadySelected = this.selectedElements.has(element)

		// In single select mode, check if we need to clear previous selections
		if (!multiSelect) {
			// Refresh an existing selection in place. Clearing first emits a
			// deselection event and can race with the refreshed selection event.
			// This is especially visible after moving an image in the DOM tree.
			if (isAlreadySelected && this.selectedElements.size === 1) {
				this.notifySelectionChanged()
				console.log(
					"[ElementSelector] Element already selected, refreshing:",
					getElementSelector(element),
				)
				return
			}

			// Clear the previous selection without notifying the host. The new
			// selection is emitted immediately below, so sending an intermediate
			// deselection would make the canvas and inspector flash.
			this.clearSelectedElementsState()
		}

		// Add element to selection
		this.selectedElements.add(element)

		// Preserve the existing first-selection editing state while CSS provides visual feedback.
		const isText = this.isTextElement(element)
		if (!this.selectionOnly && !multiSelect && isText && !element.isContentEditable) {
			element.contentEditable = "true"
			element.setAttribute("data-text-editing", "true")
		}

		// Notify selection changed
		this.notifySelectionChanged()

		console.log(
			"[ElementSelector] Element selected:",
			getElementSelector(element),
			"multiSelect:",
			multiSelect,
			"total selected:",
			this.selectedElements.size,
		)
	}

	/**
	 * Show a hover highlight requested by the host UI without changing selection.
	 */
	hoverElement(element: HTMLElement): void {
		if (!element || this.isDocumentRoot(element)) return
		if (isInjectedElement(element) || !isSourceNode(element)) return

		this.hoveredElement = element
		if (this.isSelected(element)) return

		const rect = element.getBoundingClientRect()
		this.bridge.sendEvent("ELEMENT_HOVERED", {
			rect: {
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
			},
		})
	}

	/**
	 * Clear a host-requested hover highlight without changing selection.
	 */
	clearHoveredElement(): void {
		this.hoveredElement = null
		this.bridge.sendEvent("ELEMENT_HOVER_END", {})
	}

	deselectElement() {
		this.clearSelection()
	}

	/**
	 * Clear all selections
	 */
	clearSelection() {
		this.clearSelectedElementsState()

		// Notify parent window to clear selection highlight
		this.bridge.sendEvent("ELEMENTS_DESELECTED", {})
	}

	/** Clear selected elements and editor-owned state without emitting an event. */
	private clearSelectedElementsState() {
		// Remove editor-owned DOM state without changing author inline styles.
		this.selectedElements.forEach((element) => {
			if (element.getAttribute("data-text-editing") === "true") {
				element.contentEditable = "false"
				element.removeAttribute("data-text-editing")
			}
		})

		this.selectedElements.clear()
	}

	/**
	 * Notify parent window about selection change
	 */
	private notifySelectionChanged() {
		const count = this.selectedElements.size

		if (count === 0) {
			// No selection
			this.bridge.sendEvent("ELEMENTS_DESELECTED", {})
		} else if (count === 1) {
			// Single selection - send ELEMENT_SELECTED for backward compatibility
			const element = Array.from(this.selectedElements)[0]
			const selector = getElementSelector(element)
			const styles = this.getElementStyles(element)
			const inlineStyles = this.getInlineStyles(element)
			const { rect, rotation } = this.getElementRectWithRotation(element)
			const isText = this.isTextElement(element)
			const hasDirectTextContent = this.hasDirectTextContent(element)
			const textContent = getEditableTextContent(element).trim()
			const imageMetadata = this.getImageMetadata(element)
			const attributes = this.getCommonAttributes(element)

			this.bridge.sendEvent("ELEMENT_SELECTED", {
				selector,
				tagName: element.tagName.toLowerCase(),
				...imageMetadata,
				computedStyles: styles,
				inlineStyles,
				rect,
				childRects: this.getInFlowChildRects(element),
				ancestors: this.getAncestorInfos(element),
				rotation,
				isTextElement: isText,
				hasDirectTextContent,
				textContent: isText ? textContent : undefined,
				attributes,
			})
		} else {
			// Multiple selection - send ELEMENTS_SELECTED
			const elements = this.getSelectedElementsInfo()

			this.bridge.sendEvent("ELEMENTS_SELECTED", {
				elements,
			})
		}
	}

	private bindEvents() {
		// Mouse move
		document.addEventListener("mousemove", (e) => {
			if (!this.enabled) return

			const target = e.target as HTMLElement
			if (!target || this.isDocumentRoot(target)) {
				return
			}

			// Ignore injected elements
			if (isInjectedElement(target) || !isSourceNode(target)) return

			// Find the actual selectable element (might be a container like ECharts)
			const selectableElement = this.findSelectableElement(target)

			// Update hovered element
			if (this.hoveredElement !== selectableElement) {
				this.hoveredElement = selectableElement

				// Send hover event to parent window (only if not already selected)
				if (!this.isSelected(selectableElement)) {
					const rect = selectableElement.getBoundingClientRect()
					this.bridge.sendEvent("ELEMENT_HOVERED", {
						rect: {
							top: rect.top,
							left: rect.left,
							width: rect.width,
							height: rect.height,
						},
					})
				}
			}
		})

		// Mouse out
		document.addEventListener("mouseout", (e) => {
			if (!this.enabled) return

			const target = e.target as HTMLElement
			if (target && !this.isSelected(target)) {
				// Clear hover effect in parent window
				this.bridge.sendEvent("ELEMENT_HOVER_END", {})
			}
		})

		// Shift + click adds to the selection. Without this the browser also extends a text
		// range from the previous click, which then makes the click handler skip the element.
		document.addEventListener(
			"mousedown",
			(e) => {
				if (!this.enabled || !e.shiftKey) return
				const target = e.target as HTMLElement
				if (!target || target.isContentEditable || isInjectedElement(target)) return
				e.preventDefault()
				window.getSelection()?.removeAllRanges()
			},
			true,
		)

		// Click
		document.addEventListener(
			"click",
			(e) => {
				if (!this.enabled) return

				const target = e.target as HTMLElement

				// Ignore injected elements
				if (isInjectedElement(target)) return
				if (!isSourceNode(target)) {
					e.preventDefault()
					e.stopPropagation()
					this.clearSelection()
					this.bridge.sendEvent("DYNAMIC_ELEMENT_CLICKED", {})
					return
				}

				// Check if there's a text selection - if so, don't trigger element selection
				// This prevents accidentally selecting other elements when releasing mouse after text selection
				const selection = window.getSelection()
				const hasTextSelection =
					selection && !selection.isCollapsed && selection.toString().trim().length > 0

				if (hasTextSelection && !e.shiftKey) {
					// User is selecting text, don't trigger element selection
					console.log(
						"[ElementSelector] Text selection detected, skipping element selection",
					)
					return
				}

				e.preventDefault()
				e.stopPropagation()

				// Find the actual selectable element (might be a container like ECharts)
				const selectableElement = this.findSelectableElement(target)

				// Clicks on the page gutters hit html/body. Those are not
				// selectable, so treat them as a request to clear selection.
				if (this.isDocumentRoot(target) || this.isDocumentRoot(selectableElement)) {
					if (this.selectedElements.size > 0) {
						this.deselectElement()
					}
					return
				}

				if (e.shiftKey) {
					// Shift + Click: Multi-select mode
					if (this.isSelected(selectableElement)) {
						// Already selected - remove from selection
						this.removeFromSelection(selectableElement)
						console.log(
							"[ElementSelector] Removed from selection:",
							getElementSelector(selectableElement),
						)
					} else {
						// Not selected - add to selection
						this.selectElement(selectableElement, true)
						console.log(
							"[ElementSelector] Added to selection:",
							getElementSelector(selectableElement),
						)
					}
				} else {
					// Normal click: Single-select mode
					const wasAlreadySelected =
						this.selectedElements.size === 1 && this.isSelected(selectableElement)

					if (wasAlreadySelected) {
						// Second click on already selected element - enable text editing if it's a text element
						const isText = this.isTextElement(selectableElement)
						if (isText && this.onTextEditingRequest) {
							const selector = getElementSelector(selectableElement)
							// Call text editing callback
							this.onTextEditingRequest(selector)
							console.log(
								"[ElementSelector] Second click on selected text element, requesting text editing:",
								selector,
							)
						}
						// Selection info is refreshed above; the dedicated context-panel event
						// carries the explicit open intent.
					} else {
						// First click or different element - select element (clear others)
						this.selectElement(selectableElement)
					}
				}
			},
			true,
		)

		// Keyboard shortcuts
		document.addEventListener("keydown", (e) => {
			if (!this.enabled || this.selectedElements.size === 0) return

			// Escape - deselect all
			if (e.key === "Escape") {
				// The parent editor's keyboard bridge handles Escape first. When it
				// has already consumed the event for a local panel, keep the current
				// element selection intact.
				if (e.defaultPrevented) return
				e.preventDefault()
				this.deselectElement()
			}
		})
	}

	private selectionOnly = false

	setSelectionOnly(value: boolean) {
		if (value === this.selectionOnly) return
		// Clear any contenteditable state left by an earlier full editing session.
		this.disable()
		this.selectionOnly = value
	}

	enable() {
		console.log("[ElementSelector] Enabling selection mode")
		this.enabled = true
	}

	disable() {
		console.log("[ElementSelector] Disabling selection mode")
		this.enabled = false
		this.deselectElement()

		// Clean up editor-owned DOM state without changing author inline styles.
		const editingElements = document.querySelectorAll("[data-text-editing='true']")
		editingElements.forEach((element) => {
			if (element instanceof HTMLElement) {
				element.contentEditable = "false"
				element.removeAttribute("data-text-editing")
				element.removeAttribute("data-previous-content")
			}
		})

		// Notify parent to clear all highlights
		this.bridge.sendEvent("ELEMENT_HOVER_END", {})
	}

	/**
	 * Update selected elements position (for scroll/resize events)
	 */
	private updateSelectedElementPosition() {
		if (this.selectedElements.size === 0 || !this.enabled) return

		// Re-notify selection changed to update positions
		this.notifySelectionChanged()
	}

	/**
	 * Bind scroll listener to update element position on scroll
	 */
	private bindScrollListener() {
		const handleScroll = () => {
			if (!this.enabled || this.selectedElements.size === 0) return

			// Debounce updates using requestAnimationFrame
			if (this.updateTimer) {
				window.cancelAnimationFrame(this.updateTimer)
			}

			this.updateTimer = window.requestAnimationFrame(() => {
				this.updateSelectedElementPosition()
			})
		}

		// Listen to all scroll events (including nested scroll containers)
		window.addEventListener("scroll", handleScroll, true)
		window.addEventListener("resize", handleScroll)

		// Store cleanup for later
		this.scrollCleanup = () => {
			window.removeEventListener("scroll", handleScroll, true)
			window.removeEventListener("resize", handleScroll)
			if (this.updateTimer) {
				window.cancelAnimationFrame(this.updateTimer)
			}
		}
	}

	destroy() {
		this.disable()
		this.selectedElements.clear()
		this.hoveredElement = null

		// Cleanup scroll listeners
		if (this.scrollCleanup) {
			this.scrollCleanup()
			this.scrollCleanup = null
		}

		// Remove only the style node owned by this selector instance.
		this.injectedTextEditingStyle?.remove()
		this.injectedTextEditingStyle = null
	}
}
