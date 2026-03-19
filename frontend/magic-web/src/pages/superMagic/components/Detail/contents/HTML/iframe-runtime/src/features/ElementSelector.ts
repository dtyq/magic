/**
 * Element Selector
 * Handles element selection and highlighting
 */

import type { EditorBridge } from "../core/EditorBridge"
import { getElementSelector, isInjectedElement } from "../utils/dom"
import { normalizeColor, normalizeTextAlign } from "../utils/css"

interface ElementInfo {
	selector: string
	tagName: string
	computedStyles: Record<string, string>
	rect: {
		top: number
		left: number
		width: number
		height: number
	}
	rotation?: number
	isTextElement?: boolean
	textContent?: string
}

export class ElementSelector {
	private selectedElements: Set<HTMLElement> = new Set()
	private hoveredElement: HTMLElement | null = null
	private enabled = false
	private bridge: EditorBridge
	private updateTimer: number | null = null
	private scrollCleanup: (() => void) | null = null
	private onTextEditingRequest?: (selector: string) => void

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
		// Clean up text editing attributes if removing
		if (element.getAttribute("data-text-editing") === "true") {
			element.contentEditable = "false"
			element.removeAttribute("data-text-editing")
			element.style.removeProperty("outline")
			element.style.removeProperty("outline-offset")
			this.restoreElementTextSelection(element)
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
			const { rect, rotation } = this.getElementRectWithRotation(element)
			const isText = this.isTextElement(element)
			const textContent = element.textContent?.trim() || ""

			infos.push({
				selector,
				tagName: element.tagName.toLowerCase(),
				computedStyles: styles,
				rect,
				rotation,
				isTextElement: isText,
				textContent: isText ? textContent : undefined,
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

	private injectStyles() {
		// No longer inject visual styles - bounding boxes will be rendered in parent window
		// Keep this method for potential future use or legacy compatibility
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
			"flexWrap",
			"gap",
			"gridTemplateColumns",
			"gridTemplateRows",
			"justifyItems",
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

		// For positioning properties (top, left, right, bottom), prefer inline styles
		// because they reflect the actual values we set, not the computed values
		const positionProps = ["top", "left", "right", "bottom"]
		positionProps.forEach((prop) => {
			const inlineValue = element.style.getPropertyValue(prop)
			if (inlineValue) {
				// Use inline style if it exists
				styles[prop] = inlineValue
			} else {
				// Fall back to computed style
				styles[prop] = computed[prop as keyof CSSStyleDeclaration] as string
			}
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

			// Count child elements
			const childElements = element.querySelectorAll("*").length

			// If has text but few child elements (< 3), consider it a text element
			if (hasSignificantText && childElements < 3) {
				return true
			}
		}

		return false
	}

	private enableElementTextSelection(element: HTMLElement): void {
		const previousUserSelect = element.style.userSelect
		const previousWebkitUserSelect = element.style.getPropertyValue("-webkit-user-select")

		if (previousUserSelect) {
			element.setAttribute("data-previous-user-select", previousUserSelect)
		}
		if (previousWebkitUserSelect) {
			element.setAttribute("data-previous-webkit-user-select", previousWebkitUserSelect)
		}

		element.style.userSelect = "text"
		element.style.setProperty("-webkit-user-select", "text")
	}

	private restoreElementTextSelection(element: HTMLElement): void {
		const previousUserSelect = element.getAttribute("data-previous-user-select")
		const previousWebkitUserSelect = element.getAttribute("data-previous-webkit-user-select")

		if (previousUserSelect !== null) {
			element.style.userSelect = previousUserSelect
			element.removeAttribute("data-previous-user-select")
		} else {
			element.style.removeProperty("user-select")
		}

		if (previousWebkitUserSelect !== null) {
			element.style.setProperty("-webkit-user-select", previousWebkitUserSelect)
			element.removeAttribute("data-previous-webkit-user-select")
		} else {
			element.style.removeProperty("-webkit-user-select")
		}
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

	/**
	 * Get element's original rect (unrotated) and rotation angle
	 */
	private getElementRectWithRotation(element: HTMLElement) {
		// Get original dimensions (not affected by transform)
		const width = element.offsetWidth
		const height = element.offsetHeight

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

	selectElement(element: HTMLElement, multiSelect = false) {
		if (!element || element === document.documentElement || element === document.body) {
			return
		}

		// Ignore injected elements
		if (isInjectedElement(element)) {
			return
		}

		// Check if element is already selected
		const isAlreadySelected = this.selectedElements.has(element)

		// In single select mode, check if we need to clear previous selections
		if (!multiSelect) {
			// If the same element is already selected and is in text editing mode,
			// don't clear selection to avoid interrupting text editing
			const isTextEditing = element.getAttribute("data-text-editing") === "true"

			if (isAlreadySelected && isTextEditing) {
				// Just refresh the selection info without clearing
				this.notifySelectionChanged()
				console.log(
					"[ElementSelector] Element already selected and editing, refreshing:",
					getElementSelector(element),
				)
				return
			}

			// Clear previous selections for different element or non-editing state
			this.clearSelection()
		}

		// Add element to selection
		this.selectedElements.add(element)

		// Auto-enable text editing for text elements (only in single select mode)
		const isText = this.isTextElement(element)
		if (!multiSelect && isText && !element.isContentEditable) {
			element.contentEditable = "true"
			element.setAttribute("data-text-editing", "true")
			this.enableElementTextSelection(element)
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

	deselectElement() {
		this.clearSelection()
	}

	/**
	 * Clear all selections
	 */
	clearSelection() {
		// Clean up text editing attributes for all selected elements
		this.selectedElements.forEach((element) => {
			if (element.getAttribute("data-text-editing") === "true") {
				element.contentEditable = "false"
				element.removeAttribute("data-text-editing")
				element.style.removeProperty("outline")
				element.style.removeProperty("outline-offset")
				this.restoreElementTextSelection(element)
			}
		})

		this.selectedElements.clear()

		// Notify parent window to clear selection highlight
		this.bridge.sendEvent("ELEMENTS_DESELECTED", {})
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
			const { rect, rotation } = this.getElementRectWithRotation(element)
			const isText = this.isTextElement(element)
			const textContent = element.textContent?.trim() || ""

			this.bridge.sendEvent("ELEMENT_SELECTED", {
				selector,
				tagName: element.tagName.toLowerCase(),
				computedStyles: styles,
				rect,
				rotation,
				isTextElement: isText,
				textContent: isText ? textContent : undefined,
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
			if (!target || target === document.body || target === document.documentElement) {
				return
			}

			// Ignore injected elements
			if (isInjectedElement(target)) return

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

		// Click
		document.addEventListener(
			"click",
			(e) => {
				if (!this.enabled) return

				const target = e.target as HTMLElement

				// Ignore injected elements
				if (isInjectedElement(target)) return

				// Check if there's a text selection - if so, don't trigger element selection
				// This prevents accidentally selecting other elements when releasing mouse after text selection
				const selection = window.getSelection()
				const hasTextSelection =
					selection && !selection.isCollapsed && selection.toString().trim().length > 0

				if (hasTextSelection) {
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
					} else {
						// First click or different element - select element (clear others)
						this.selectElement(selectableElement, false)
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
				e.preventDefault()
				this.deselectElement()
			}
		})
	}

	enable() {
		console.log("[ElementSelector] Enabling selection mode")
		this.enabled = true
	}

	disable() {
		console.log("[ElementSelector] Disabling selection mode")
		this.enabled = false
		this.deselectElement()

		// Clean up all elements that might still be in text editing mode
		const editingElements = document.querySelectorAll("[data-text-editing='true']")
		editingElements.forEach((element) => {
			if (element instanceof HTMLElement) {
				element.contentEditable = "false"
				element.removeAttribute("data-text-editing")
				element.removeAttribute("data-previous-content")
				element.style.removeProperty("outline")
				element.style.removeProperty("outline-offset")
				this.restoreElementTextSelection(element)
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

		// No longer need to remove styles (they're not injected anymore)
	}
}
