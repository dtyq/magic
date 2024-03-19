/**
 * Style Manager
 * Handles style modification commands and history management
 */

import type { CommandHistory } from "../core/CommandHistory"
import type { ElementSelector } from "../features/ElementSelector"
import type { TextStyleManager } from "./TextStyleManager"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"
import { camelToKebab } from "../utils/css"

/**
 * Special element state data for Canvas, Video, Audio elements
 */
type CanvasElementData = {
	type: "canvas"
	dataURL: string
	width: number
	height: number
}

type VideoElementData = {
	type: "video"
	currentTime: number
	paused: boolean
}

type AudioElementData = {
	type: "audio"
	currentTime: number
	paused: boolean
}

type ContainerWithCanvasData = {
	type: "container-with-canvas"
	canvasStates: Array<{
		selector: string
		data: CanvasElementData
	}>
}

type SpecialElementData =
	| CanvasElementData
	| VideoElementData
	| AudioElementData
	| ContainerWithCanvasData

export class StyleManager {
	private commandHistory: CommandHistory
	private elementSelector: ElementSelector | null = null
	private textStyleManager: TextStyleManager | null = null
	private isDuplicating = false
	private isDeleting = false

	constructor(commandHistory: CommandHistory) {
		this.commandHistory = commandHistory
	}

	/**
	 * Helper method: Set styles to currently selected elements
	 * Automatically handles single or multiple elements
	 */
	async setStylesToSelected(styles: Record<string, string>): Promise<void> {
		if (!this.elementSelector) {
			EditorLogger.warn("ElementSelector not set, cannot apply styles to selected elements")
			return
		}

		const selectors = this.elementSelector.getSelectedSelectors()
		if (selectors.length === 0) {
			EditorLogger.warn("No elements selected")
			return
		}

		if (selectors.length === 1) {
			await this.setBatchStyles(selectors[0], styles)
		} else {
			await this.setBatchStylesMultiple(selectors, styles)
		}
	}

	/**
	 * Helper method: Set background color to currently selected elements
	 */
	async setBackgroundColorToSelected(color: string): Promise<void> {
		if (!this.elementSelector) {
			EditorLogger.warn("ElementSelector not set")
			return
		}

		const selectors = this.elementSelector.getSelectedSelectors()

		if (selectors.length === 0) {
			EditorLogger.warn("No elements selected")
			return
		}

		if (selectors.length === 1) {
			await this.setBackgroundColor(selectors[0], color)
		} else {
			await this.setBackgroundColorMultiple(selectors, color)
		}
	}

	/**
	 * Helper method: Set text color to currently selected elements
	 */
	async setTextColorToSelected(color: string): Promise<void> {
		if (!this.elementSelector) {
			EditorLogger.warn("ElementSelector not set")
			return
		}

		const selectors = this.elementSelector.getSelectedSelectors()
		if (selectors.length === 0) {
			EditorLogger.warn("No elements selected")
			return
		}

		if (selectors.length === 1) {
			await this.setTextColor(selectors[0], color)
		} else {
			await this.setTextColorMultiple(selectors, color)
		}
	}

	/**
	 * Set element selector reference for refreshing selection after undo/redo
	 */
	setElementSelector(elementSelector: ElementSelector): void {
		this.elementSelector = elementSelector
	}

	/**
	 * Set text style manager reference for handling text selection state
	 */
	setTextStyleManager(textStyleManager: TextStyleManager): void {
		this.textStyleManager = textStyleManager
	}

	/**
	 * Set background color (single element)
	 */
	async setBackgroundColor(selector: string, color: string): Promise<void> {
		const element = findElement(selector)
		const previousValue = element.style.backgroundColor

		// Apply style
		element.style.backgroundColor = color

		// Record command
		this.commandHistory.push({
			commandType: "SET_BACKGROUND_COLOR",
			payload: { selector, color },
			previousState: { selector, backgroundColor: previousValue },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Set background color to ${color}`,
			},
		})

		// Refresh selection to update bounding box after style changes
		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Set background color for multiple elements
	 */
	async setBackgroundColorMultiple(selectors: string[], color: string): Promise<void> {
		if (selectors.length === 0) return

		// If only one element, use single element method
		if (selectors.length === 1) {
			await this.setBackgroundColor(selectors[0], color)
			return
		}

		const previousStates: Array<{ selector: string; backgroundColor: string }> = []

		// Apply to all elements
		for (const selector of selectors) {
			try {
				const element = findElement(selector)
				const previousValue = element.style.backgroundColor

				previousStates.push({ selector, backgroundColor: previousValue })
				element.style.backgroundColor = color
			} catch (error) {
				EditorLogger.error(`Failed to set background color for element: ${selector}`, error)
			}
		}

		// Record as single command
		this.commandHistory.push({
			commandType: "SET_BACKGROUND_COLOR_MULTIPLE",
			payload: { selectors, color },
			previousState: { elements: previousStates },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Set background color for ${selectors.length} elements`,
			},
		})

		// Refresh selection to update bounding boxes after style changes
		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Set text color (single element)
	 */
	async setTextColor(selector: string, color: string): Promise<void> {
		const element = findElement(selector)
		const previousValue = element.style.color

		// Apply style
		element.style.color = color

		// Record command
		this.commandHistory.push({
			commandType: "SET_TEXT_COLOR",
			payload: { selector, color },
			previousState: { selector, color: previousValue },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Set text color to ${color}`,
			},
		})

		// Refresh selection to update bounding box after style changes
		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Set text color for multiple elements
	 */
	async setTextColorMultiple(selectors: string[], color: string): Promise<void> {
		if (selectors.length === 0) return

		// If only one element, use single element method
		if (selectors.length === 1) {
			await this.setTextColor(selectors[0], color)
			return
		}

		const previousStates: Array<{ selector: string; color: string }> = []

		// Apply to all elements
		for (const selector of selectors) {
			try {
				const element = findElement(selector)
				const previousValue = element.style.color

				previousStates.push({ selector, color: previousValue })
				element.style.color = color
			} catch (error) {
				EditorLogger.error(`Failed to set text color for element: ${selector}`, error)
			}
		}

		// Record as single command
		this.commandHistory.push({
			commandType: "SET_TEXT_COLOR_MULTIPLE",
			payload: { selectors, color },
			previousState: { elements: previousStates },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Set text color for ${selectors.length} elements`,
			},
		})
	}

	/**
	 * Set font size
	 */
	async setFontSize(
		selector: string,
		fontSize: number | string,
		unit: "px" | "em" | "rem" = "px",
	): Promise<void> {
		const element = findElement(selector)
		const size = typeof fontSize === "number" ? `${fontSize}${unit}` : fontSize
		const previousValue = element.style.fontSize

		// Apply style
		element.style.fontSize = size

		// Record command
		this.commandHistory.push({
			commandType: "SET_FONT_SIZE",
			payload: { selector, fontSize, unit },
			previousState: { selector, fontSize: previousValue },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Set font size to ${size}`,
			},
		})
	}

	/**
	 * Batch set styles (single element)
	 */
	async setBatchStyles(selector: string, styles: Record<string, string>): Promise<void> {
		const element = findElement(selector)
		const previousState: Record<string, string> = {}

		// Save previous values
		for (const property of Object.keys(styles)) {
			const kebabProperty = camelToKebab(property)
			previousState[property] = element.style.getPropertyValue(kebabProperty) || ""
		}

		// Apply styles
		for (const [property, value] of Object.entries(styles)) {
			const kebabProperty = camelToKebab(property)
			element.style.setProperty(kebabProperty, value)
		}

		// Record command (only if not in batch mode)
		if (!this.commandHistory.isInBatchMode()) {
			this.commandHistory.push({
				commandType: "BATCH_STYLES",
				payload: { selector, styles },
				previousState: { selector, ...previousState },
				timestamp: Date.now(),
				metadata: {
					canUndo: true,
					description: `Batch set ${Object.keys(styles).length} styles`,
				},
			})
		}

		// Refresh selection to update bounding box after style changes
		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Batch set styles for multiple elements
	 * Records as a single undoable operation
	 */
	async setBatchStylesMultiple(
		selectors: string[],
		styles: Record<string, string>,
	): Promise<void> {
		if (selectors.length === 0) return

		// If only one element, use single element method
		if (selectors.length === 1) {
			await this.setBatchStyles(selectors[0], styles)
			return
		}

		const previousStates: Array<{
			selector: string
			styles: Record<string, string>
		}> = []

		// Apply styles to all elements and save previous states
		for (const selector of selectors) {
			try {
				const element = findElement(selector)
				const previousState: Record<string, string> = {}

				// Save previous values
				for (const property of Object.keys(styles)) {
					const kebabProperty = camelToKebab(property)
					previousState[property] = element.style.getPropertyValue(kebabProperty) || ""
				}

				previousStates.push({ selector, styles: previousState })

				// Apply styles
				for (const [property, value] of Object.entries(styles)) {
					const kebabProperty = camelToKebab(property)
					element.style.setProperty(kebabProperty, value)
				}
			} catch (error) {
				EditorLogger.error(`Failed to apply styles to element: ${selector}`, error)
			}
		}

		// Record as single command for undo/redo
		this.commandHistory.push({
			commandType: "BATCH_STYLES_MULTIPLE",
			payload: { selectors, styles },
			previousState: { elements: previousStates },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Apply styles to ${selectors.length} elements`,
			},
		})

		// Refresh selection to update bounding boxes after style changes
		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Apply styles without recording to history (for temporary updates during drag)
	 */
	applyStylesTemporary(selector: string, styles: Record<string, string>): void {
		const element = findElement(selector) as HTMLElement

		// Apply styles without recording
		for (const [property, value] of Object.entries(styles)) {
			const kebabProperty = camelToKebab(property)
			element.style.setProperty(kebabProperty, value)
		}

		// Note: We intentionally do NOT call refreshSelection() here during temporary style updates
		// (e.g., during drag/rotate operations) to avoid performance issues from frequent
		// cross-iframe communication. The parent window should use optimistic updates instead.
		// refreshSelection() will be called when the operation completes (e.g., in stopRotate).

		// Debug: Log applied styles
		if (styles.top || styles.left) {
			EditorLogger.debug("Applied temporary styles", {
				selector,
				styles,
				actualInlineTop: element.style.top,
				actualInlineLeft: element.style.left,
			})
		}
	}

	/**
	 * Apply font size adjustment without recording history
	 * Used internally for redo operations
	 */
	private applyFontSizeAdjustment(
		selector: string,
		scaleFactor: number,
		minFontSize = 8,
	): Array<{ relativePath: string; fontSize: string }> {
		const rootElement = findElement(selector)

		// Collect all elements (root + descendants)
		const allElements = [rootElement, ...Array.from(rootElement.querySelectorAll("*"))]

		// Store previous font sizes for undo
		const previousFontSizes: Array<{
			element: HTMLElement
			relativePath: string
			fontSize: string
		}> = []

		// Apply font size adjustment to all elements
		allElements.forEach((el, index) => {
			if (!(el instanceof HTMLElement)) return

			const computedStyle = window.getComputedStyle(el)
			const currentFontSize = Number.parseFloat(computedStyle.fontSize)

			if (Number.isNaN(currentFontSize) || currentFontSize <= 0) return

			// Save previous font size for undo
			const previousFontSize = el.style.fontSize || ""
			// Generate relative path from root element
			const relativePath = index === 0 ? "" : this.getRelativePath(rootElement, el)

			previousFontSizes.push({
				element: el,
				relativePath,
				fontSize: previousFontSize,
			})

			// Calculate and apply new font size
			const newFontSize = Math.round(currentFontSize * scaleFactor)
			const finalFontSize = Math.max(minFontSize, newFontSize)
			el.style.fontSize = `${finalFontSize}px`
		})

		return previousFontSizes.map(({ relativePath, fontSize }) => ({
			relativePath,
			fontSize,
		}))
	}

	/**
	 * Adjust font size recursively for element and all its children
	 * Records as a single atomic operation for undo/redo
	 */
	async adjustFontSizeRecursive(
		selector: string,
		scaleFactor: number,
		minFontSize = 8,
	): Promise<void> {
		// Apply adjustment and get previous font sizes
		const previousFontSizes = this.applyFontSizeAdjustment(selector, scaleFactor, minFontSize)

		// Record command for undo/redo
		this.commandHistory.push({
			commandType: "ADJUST_FONT_SIZE_RECURSIVE",
			payload: { selector, scaleFactor, minFontSize },
			previousState: {
				selector,
				fontSizes: previousFontSizes,
			},
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Adjust font size for ${previousFontSizes.length} elements`,
			},
		})

		if (this.elementSelector) {
			this.elementSelector.refreshSelection()
		}
	}

	/**
	 * Get relative path from root element to target element
	 * This ensures we only affect elements within the selected scope
	 */
	private getRelativePath(rootElement: Element, targetElement: Element): string {
		const path: string[] = []
		let current: Element | null = targetElement

		// Build path from target up to (but not including) root
		while (current && current !== rootElement) {
			const parentEl: Element | null = current.parentElement
			if (!parentEl || parentEl === rootElement) {
				// Reached root's children level
				const currentTag = current.tagName
				const siblings = Array.from(rootElement.children).filter(
					(child) => child.tagName === currentTag,
				)
				const index = siblings.indexOf(current)
				const tag = current.tagName.toLowerCase()
				path.unshift(`> ${tag}:nth-of-type(${index + 1})`)
				break
			} else {
				// Still traversing up
				const currentTag = current.tagName
				const siblings = Array.from(parentEl.children).filter(
					(child) => child.tagName === currentTag,
				)
				const index = siblings.indexOf(current)
				const tag = current.tagName.toLowerCase()
				path.unshift(`> ${tag}:nth-of-type(${index + 1})`)
			}
			current = parentEl
		}

		return path.join(" ")
	}

	/**
	 * Begin batch operation (for drag operations)
	 * Saves initial state before starting drag
	 */
	beginBatchOperation(selector: string, styles: Record<string, string>): void {
		const element = findElement(selector)
		const previousState: Record<string, string> = {}

		// Save current values as initial state
		for (const property of Object.keys(styles)) {
			const kebabProperty = camelToKebab(property)
			previousState[property] = element.style.getPropertyValue(kebabProperty) || ""
		}

		// Begin batch mode with initial command
		this.commandHistory.beginBatch({
			commandType: "BATCH_STYLES",
			payload: { selector, styles },
			previousState: { selector, ...previousState },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Batch set ${Object.keys(styles).length} styles`,
			},
		})
	}

	/**
	 * End batch operation
	 * Records the entire operation as a single history entry
	 */
	endBatchOperation(selector: string, styles: Record<string, string>): void {
		// Create final command with current styles
		this.commandHistory.endBatch({
			commandType: "BATCH_STYLES",
			payload: { selector, styles },
			previousState: {}, // Will be replaced with initial state from beginBatch
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Batch set ${Object.keys(styles).length} styles`,
			},
		})
	}

	/**
	 * Cancel batch operation without recording
	 */
	cancelBatchOperation(): void {
		this.commandHistory.cancelBatch()
	}

	/**
	 * Set text content
	 */
	async setTextContent(selector: string, textContent: string): Promise<void> {
		const element = findElement(selector)
		const previousValue = element.textContent || ""

		// Apply text content
		element.textContent = textContent

		// Record command
		this.commandHistory.push({
			commandType: "SET_TEXT_CONTENT",
			payload: { selector, textContent },
			previousState: { selector, textContent: previousValue },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Set text content",
			},
		})
	}

	/**
	 * Get text content
	 */
	getTextContent(selector: string): { textContent: string; hasText: boolean } {
		const element = findElement(selector)
		const textContent = element.textContent || ""
		const hasText = textContent.trim().length > 0

		return { textContent, hasText }
	}

	/**
	 * Enable text selection while editing
	 */
	private enableTextSelectionForEditing(element: HTMLElement): void {
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

	private restoreTextSelectionAfterEditing(element: HTMLElement): void {
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
	 * Enable text editing (set contenteditable)
	 */
	enableTextEditing(selector: string): void {
		const element = findElement(selector) as HTMLElement

		// Clean up any existing editing state and event listeners
		// This ensures we always have a fresh start even if the element
		// still has the data-text-editing attribute from a previous session
		if (element.getAttribute("data-text-editing") === "true") {
			EditorLogger.warn("Text editing state exists, cleaning up first", { selector })
			// Force remove all attributes and reset state
			element.removeAttribute("contenteditable")
			element.removeAttribute("data-text-editing")
			element.removeAttribute("data-previous-content")
			element.style.outline = ""
		}

		EditorLogger.info("Enabling text editing", { selector })

		const previousContent = element.textContent || ""

		this.enableTextSelectionForEditing(element)
		element.setAttribute("contenteditable", "true")
		element.setAttribute("data-text-editing", "true")
		element.setAttribute("data-previous-content", previousContent)
		element.focus()

		element.style.outline = "none"

		// Handle input event (real-time content change)
		let updateTimer: number | null = null

		const handleInput = () => {
			// Debounce updates to avoid too frequent re-renders
			if (updateTimer) {
				window.cancelAnimationFrame(updateTimer)
			}

			updateTimer = window.requestAnimationFrame(() => {
				// Update selection overlay to reflect new dimensions
				// Use refreshSelection() instead of selectElement() to avoid re-triggering
				// the full selection flow which can interrupt text editing
				if (this.elementSelector) {
					const currentSelected = (this.elementSelector as any).selectedElement
					const isChildSpan =
						currentSelected &&
						currentSelected !== element &&
						currentSelected.tagName === "SPAN" &&
						element.contains(currentSelected)

					if (!isChildSpan) {
						// Just refresh the selection info, don't re-select
						// This updates the bounding box without interrupting focus
						this.elementSelector.refreshSelection()
						EditorLogger.debug("Refreshed selection overlay during text editing", {
							selector,
						})
					} else {
						EditorLogger.debug("Skipped refresh - preserving child span selection", {
							parentSelector: selector,
							spanTagName: currentSelected.tagName,
						})
					}
				}
			})
		}

		// Handle blur event (save on focus loss)
		const handleBlur = () => {
			const newContent = element.textContent || ""
			const oldContent = element.getAttribute("data-previous-content") || ""

			// Clean up timer
			if (updateTimer) {
				window.cancelAnimationFrame(updateTimer)
				updateTimer = null
			}

			// Only save if content changed
			if (newContent !== oldContent) {
				this.commandHistory.push({
					commandType: "UPDATE_TEXT_CONTENT",
					payload: { selector, content: newContent },
					previousState: { selector, textContent: oldContent },
					timestamp: Date.now(),
					metadata: {
						canUndo: true,
						description: "Update text content",
					},
				})
				EditorLogger.info("Text editing saved on blur", { selector, newContent })
			}

			// Clean up
			element.removeAttribute("contenteditable")
			element.removeAttribute("data-text-editing")
			element.removeAttribute("data-previous-content")
			this.restoreTextSelectionAfterEditing(element)
			element.style.outline = ""
			element.removeEventListener("blur", handleBlur)
			element.removeEventListener("input", handleInput)
			element.removeEventListener("keydown", handleKeyDown)
		}

		// Handle escape key
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault()
				element.blur()
			}
		}

		element.addEventListener("blur", handleBlur)
		element.addEventListener("input", handleInput)
		element.addEventListener("keydown", handleKeyDown)

		EditorLogger.info("Text editing enabled", { selector })
	}

	/**
	 * Disable text editing (remove contenteditable)
	 */
	disableTextEditing(selector: string): void {
		const element = findElement(selector) as HTMLElement

		// Check if editing is active
		if (element.getAttribute("data-text-editing") === "true") {
			// Trigger blur to save and cleanup event listeners
			element.blur()
		}

		// Force cleanup all editing attributes
		element.removeAttribute("contenteditable")
		element.removeAttribute("data-text-editing")
		element.removeAttribute("data-previous-content")

		// Remove visual feedback
		element.style.outline = ""
		element.style.outlineOffset = ""

		if (
			element.hasAttribute("data-previous-user-select") ||
			element.hasAttribute("data-previous-webkit-user-select")
		) {
			this.restoreTextSelectionAfterEditing(element)
		}

		EditorLogger.info("Text editing disabled", { selector })
	}

	/**
	 * Update text content
	 */
	async updateTextContent(selector: string, content: string): Promise<void> {
		const element = findElement(selector)
		const previousValue = element.textContent || ""

		// Apply text content
		element.textContent = content

		// Record command
		this.commandHistory.push({
			commandType: "UPDATE_TEXT_CONTENT",
			payload: { selector, content },
			previousState: { selector, textContent: previousValue },
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Update text content",
			},
		})
	}

	/**
	 * Set element position (relative)
	 */
	async setElementPosition(selector: string, top: number, left: number): Promise<void> {
		const element = findElement(selector) as HTMLElement
		const previousPosition = element.style.position || ""
		const previousTop = element.style.top || ""
		const previousLeft = element.style.left || ""

		// Apply position styles
		element.style.position = "relative"
		element.style.top = `${top}px`
		element.style.left = `${left}px`

		// Record command
		this.commandHistory.push({
			commandType: "SET_ELEMENT_POSITION",
			payload: { selector, top, left },
			previousState: {
				selector,
				position: previousPosition,
				top: previousTop,
				left: previousLeft,
			},
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: `Move element to (${left}, ${top})`,
			},
		})
	}

	/**
	 * Delete element
	 */
	async deleteElement(selector: string): Promise<void> {
		// Prevent duplicate operations
		if (this.isDeleting) {
			EditorLogger.warn("[StyleManager] Delete operation already in progress, ignoring", {
				selector,
			})
			return
		}

		try {
			this.isDeleting = true
			EditorLogger.info("[StyleManager] deleteElement called", { selector })

			const element = findElement(selector)
			const parent = element.parentElement
			if (!parent) {
				EditorLogger.error("[StyleManager] Cannot delete root element")
				throw new Error("Cannot delete root element")
			}

			EditorLogger.info("[StyleManager] Element found, preparing to delete", {
				tagName: element.tagName,
				hasParent: !!parent,
			})

			// Store element info for undo
			const previousHTML = element.outerHTML
			const nextSibling = element.nextSibling
			// Store information about the sibling structure for accurate restoration
			let nextSiblingSelector = null
			let siblingIndex = -1

			// Calculate element's index among its siblings for fallback
			if (parent) {
				const siblings = Array.from(parent.children)
				siblingIndex = siblings.indexOf(element)
			}

			// Only generate selector if nextSibling is an HTMLElement
			if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
				try {
					nextSiblingSelector = this.generateSelectorForElement(
						nextSibling as HTMLElement,
					)
				} catch (error) {
					EditorLogger.warn(
						"[StyleManager] Failed to generate selector for nextSibling",
						error,
					)
				}
			}

			const parentSelector = this.generateSelectorForElement(parent)

			// Handle special elements: save their runtime state
			const specialElementData = this.captureSpecialElementState(element)

			// Remove element
			element.remove()
			EditorLogger.info("[StyleManager] Element removed from DOM")

			// Clear selection
			if (this.elementSelector) {
				this.elementSelector.clearSelection()
				EditorLogger.info("[StyleManager] Selection cleared")
			}

			// Record command
			this.commandHistory.push({
				commandType: "DELETE_ELEMENT",
				payload: { selector },
				previousState: {
					selector,
					parentSelector: parentSelector,
					nextSiblingSelector,
					siblingIndex,
					html: previousHTML,
					specialElementData, // Save special element state
				},
				timestamp: Date.now(),
				metadata: {
					canUndo: true,
					description: "Delete element",
				},
			})
			EditorLogger.info("[StyleManager] Delete command recorded in history")
		} finally {
			// Reset flag after operation completes
			setTimeout(() => {
				this.isDeleting = false
			}, 300)
		}
	}

	/**
	 * Duplicate element and insert after current element as sibling
	 */
	async duplicateElement(selector: string): Promise<void> {
		// Prevent duplicate operations
		if (this.isDuplicating) {
			EditorLogger.warn("[StyleManager] Duplicate operation already in progress, ignoring", {
				selector,
			})
			return
		}

		try {
			this.isDuplicating = true
			EditorLogger.info("[StyleManager] duplicateElement called", { selector })

			const element = findElement(selector)
			const parent = element.parentElement
			if (!parent) {
				EditorLogger.error("[StyleManager] Cannot duplicate root element")
				throw new Error("Cannot duplicate root element")
			}

			EditorLogger.info("[StyleManager] Element found, preparing to duplicate", {
				tagName: element.tagName,
				hasParent: !!parent,
			})

			// Clone the element (deep clone to include all children)
			const clonedElement = element.cloneNode(true) as HTMLElement

			// Handle special elements: copy their runtime state
			const specialElementData = this.captureSpecialElementState(element)

			// Insert the cloned element after the original
			const nextSibling = element.nextSibling
			if (nextSibling) {
				parent.insertBefore(clonedElement, nextSibling)
			} else {
				parent.appendChild(clonedElement)
			}

			EditorLogger.info("[StyleManager] Element duplicated and inserted")

			// Restore special element state to the cloned element
			if (specialElementData) {
				await this.restoreSpecialElementState(clonedElement, specialElementData)
			}

			// Generate selector for the duplicated element
			const duplicatedSelector = this.generateSelectorForElement(clonedElement)

			// Store undo information
			const previousState = {
				selector,
				duplicatedSelector,
			}

			// Record command
			this.commandHistory.push({
				commandType: "DUPLICATE_ELEMENT",
				payload: { selector, duplicatedSelector },
				previousState,
				timestamp: Date.now(),
				metadata: {
					canUndo: true,
					description: "Duplicate element",
				},
			})

			EditorLogger.info("[StyleManager] Duplicate command recorded in history")

			// Select the newly duplicated element
			if (this.elementSelector && clonedElement instanceof HTMLElement) {
				setTimeout(() => {
					this.elementSelector?.selectElement(clonedElement)
					EditorLogger.info("[StyleManager] Duplicated element selected")
				}, 0)
			}
		} finally {
			// Reset flag after operation completes
			setTimeout(() => {
				this.isDuplicating = false
			}, 300)
		}
	}

	/**
	 * Capture special element state (Canvas, Video, etc.)
	 * Returns data that can be used to restore the element's runtime state
	 */
	private captureSpecialElementState(element: Element): SpecialElementData | null {
		try {
			// Handle Canvas elements
			if (element.tagName === "CANVAS") {
				const canvas = element as HTMLCanvasElement
				try {
					// Save canvas content as data URL
					const dataURL = canvas.toDataURL("image/png")
					EditorLogger.info("[StyleManager] Captured canvas state", {
						width: canvas.width,
						height: canvas.height,
					})
					return {
						type: "canvas",
						dataURL,
						width: canvas.width,
						height: canvas.height,
					}
				} catch (error) {
					// Canvas might be tainted (cross-origin), cannot capture
					EditorLogger.warn("[StyleManager] Cannot capture canvas state (tainted)", error)
					return null
				}
			}

			// Handle Video elements
			if (element.tagName === "VIDEO") {
				const video = element as HTMLVideoElement
				return {
					type: "video",
					currentTime: video.currentTime,
					paused: video.paused,
				}
			}

			// Handle Audio elements
			if (element.tagName === "AUDIO") {
				const audio = element as HTMLAudioElement
				return {
					type: "audio",
					currentTime: audio.currentTime,
					paused: audio.paused,
				}
			}

			// Check for canvas elements in descendants
			const canvases = element.querySelectorAll("canvas")
			if (canvases.length > 0) {
				const canvasStates: Array<{ selector: string; data: any }> = []
				canvases.forEach((canvas, index) => {
					try {
						const dataURL = (canvas as HTMLCanvasElement).toDataURL("image/png")
						canvasStates.push({
							selector: `canvas:nth-of-type(${index + 1})`,
							data: {
								type: "canvas",
								dataURL,
								width: (canvas as HTMLCanvasElement).width,
								height: (canvas as HTMLCanvasElement).height,
							},
						})
					} catch (error) {
						EditorLogger.warn(
							`[StyleManager] Cannot capture descendant canvas ${index}`,
							error,
						)
					}
				})

				if (canvasStates.length > 0) {
					return {
						type: "container-with-canvas",
						canvasStates,
					}
				}
			}
		} catch (error) {
			EditorLogger.warn("[StyleManager] Failed to capture special element state", error)
		}

		return null
	}

	/**
	 * Restore special element state (Canvas, Video, etc.)
	 */
	private async restoreSpecialElementState(
		element: Element,
		specialElementData: SpecialElementData | null,
	): Promise<void> {
		if (!specialElementData) return

		try {
			if (specialElementData.type === "canvas") {
				// Restore canvas content
				const canvas = element as HTMLCanvasElement
				const ctx = canvas.getContext("2d")
				if (!ctx) {
					EditorLogger.warn("[StyleManager] Cannot get canvas context")
					return
				}

				// Load image from data URL
				const img = new Image()
				await new Promise<void>((resolve, reject) => {
					img.onload = () => {
						// Ensure canvas has correct dimensions
						canvas.width = specialElementData.width
						canvas.height = specialElementData.height
						// Draw the saved image
						ctx.drawImage(img, 0, 0)
						EditorLogger.info("[StyleManager] Canvas content restored")
						resolve()
					}
					img.onerror = () => {
						EditorLogger.error("[StyleManager] Failed to load canvas image")
						reject(new Error("Failed to load canvas image"))
					}
					img.src = specialElementData.dataURL
				})
			} else if (specialElementData.type === "video") {
				// Restore video state
				const video = element as HTMLVideoElement
				video.currentTime = specialElementData.currentTime
				if (!specialElementData.paused) {
					// Don't auto-play, just note that it was playing
					EditorLogger.info("[StyleManager] Video was playing, keeping paused")
				}
			} else if (specialElementData.type === "audio") {
				// Restore audio state
				const audio = element as HTMLAudioElement
				audio.currentTime = specialElementData.currentTime
				if (!specialElementData.paused) {
					EditorLogger.info("[StyleManager] Audio was playing, keeping paused")
				}
			} else if (specialElementData.type === "container-with-canvas") {
				// Restore canvas elements in descendants
				const canvasStates = specialElementData.canvasStates as Array<{
					selector: string
					data: any
				}>
				for (const { selector, data } of canvasStates) {
					try {
						const canvas = element.querySelector(selector) as HTMLCanvasElement
						if (canvas) {
							await this.restoreSpecialElementState(canvas, data)
						}
					} catch (error) {
						EditorLogger.warn(
							`[StyleManager] Failed to restore descendant canvas: ${selector}`,
							error,
						)
					}
				}
			}
		} catch (error) {
			EditorLogger.error("[StyleManager] Failed to restore special element state", error)
		}
	}

	/**
	 * Generate a unique selector for an element
	 */
	private generateSelectorForElement(element: HTMLElement): string {
		// Validate element
		if (!element || !element.tagName) {
			throw new Error("Invalid element: element or tagName is undefined")
		}

		if (element.id) {
			return `#${this.escapeCSSSelector(element.id)}`
		}

		const path: string[] = []
		let current: HTMLElement | null = element

		while (current && current !== document.body) {
			if (!current.tagName) {
				EditorLogger.warn("[StyleManager] Element without tagName encountered")
				break
			}

			let selector = current.tagName.toLowerCase()

			if (current.className && typeof current.className === "string") {
				const classes = Array.from(current.classList)
					.filter((cls) => !cls.startsWith("data-"))
					.map((cls) => this.escapeCSSSelector(cls))
					.join(".")
				if (classes) {
					selector += `.${classes}`
				}
			}

			// Add nth-of-type if needed for uniqueness
			if (current.parentElement) {
				const siblings = Array.from(current.parentElement.children).filter(
					(el) => el.tagName === current!.tagName,
				)
				if (siblings.length > 1) {
					const index = siblings.indexOf(current) + 1
					selector += `:nth-of-type(${index})`
				}
			}

			path.unshift(selector)
			current = current.parentElement
		}

		if (path.length === 0) {
			throw new Error("Failed to generate selector: empty path")
		}

		return path.join(" > ")
	}

	/**
	 * Escape special characters in CSS selector
	 * Per CSS spec, these characters need to be escaped: !"#$%&'()*+,-./:;<=>?@[\]^`{|}~
	 */
	private escapeCSSSelector(str: string): string {
		// Escape special characters that need escaping in CSS selectors
		// Note: In character class, \ needs to be escaped as \\, [ as \[, ] as \]
		// The - is placed at the end to avoid being interpreted as a range operator
		return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~-])/g, "\\$1")
	}

	/**
	 * Undo last command
	 */
	async undo(): Promise<boolean> {
		const command = this.commandHistory.undo()
		if (!command) return false

		const previousState = command.previousState as any

		// Restore previous state
		this.restoreState(command)

		// Refresh multi-selection after undo when selector is not available
		if (Array.isArray(previousState?.elements) && this.elementSelector) {
			this.elementSelector.refreshSelection()
		}

		// For DELETE_ELEMENT, restoreState handles element selection
		// For other commands, refresh selected element if there's a selector
		if (command.commandType !== "DELETE_ELEMENT") {
			const previousState = command.previousState as any
			if (previousState?.selector && this.elementSelector) {
				try {
					const element = findElement(previousState.selector)
					if (element instanceof HTMLElement) {
						// Check if element is currently being edited
						const isTextEditing = element.getAttribute("data-text-editing") === "true"
						if (isTextEditing) {
							// Just refresh to update dimensions, don't re-select
							this.elementSelector.refreshSelection()
						} else {
							// Re-select the element to update the overlay
							this.elementSelector.selectElement(element)
						}
					}
				} catch (error) {
					EditorLogger.warn("Failed to refresh element after undo", error)
				}
			}
		}

		return true
	}

	/**
	 * Redo last command
	 */
	async redo(): Promise<boolean> {
		const command = this.commandHistory.redo()
		if (!command) return false

		// Reapply command
		await this.applyCommand(command)

		// For DELETE_ELEMENT, applyCommand handles clearing selection
		// For other commands, refresh selected element if there's a selector
		if (command.commandType !== "DELETE_ELEMENT") {
			const payload = command.payload as any
			if (payload?.selector && this.elementSelector) {
				try {
					const element = findElement(payload.selector)
					if (element instanceof HTMLElement) {
						// Check if element is currently being edited
						const isTextEditing = element.getAttribute("data-text-editing") === "true"
						if (isTextEditing) {
							// Just refresh to update dimensions, don't re-select
							this.elementSelector.refreshSelection()
						} else {
							// Re-select the element to update the overlay
							this.elementSelector.selectElement(element)
						}
					}
				} catch (error) {
					EditorLogger.warn("Failed to refresh element after redo", error)
				}
			}
		}

		return true
	}

	/**
	 * Restore previous state
	 */
	private restoreState(command: any): void {
		if (!command.previousState) return

		try {
			// Handle batch styles multiple restoration FIRST (before destructuring selector)
			if (command.commandType === "BATCH_STYLES_MULTIPLE") {
				const { elements } = command.previousState as {
					elements: Array<{ selector: string; styles: Record<string, string> }>
				}

				for (const { selector: elemSelector, styles: prevStyles } of elements) {
					try {
						const elem = findElement(elemSelector)
						// Restore previous style values
						for (const [property, value] of Object.entries(prevStyles)) {
							const kebabProperty = camelToKebab(property)
							if (value) {
								elem.style.setProperty(kebabProperty, value)
							} else {
								elem.style.removeProperty(kebabProperty)
							}
						}
					} catch (error) {
						EditorLogger.error(
							`Failed to restore styles for element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// Handle background color multiple restoration FIRST
			if (command.commandType === "SET_BACKGROUND_COLOR_MULTIPLE") {
				const { elements } = command.previousState as {
					elements: Array<{ selector: string; backgroundColor: string }>
				}

				for (const { selector: elemSelector, backgroundColor } of elements) {
					try {
						const elem = findElement(elemSelector)
						elem.style.backgroundColor = backgroundColor
					} catch (error) {
						EditorLogger.error(
							`Failed to restore background color for element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// Handle text color multiple restoration FIRST
			if (command.commandType === "SET_TEXT_COLOR_MULTIPLE") {
				const { elements } = command.previousState as {
					elements: Array<{ selector: string; color: string }>
				}

				for (const { selector: elemSelector, color } of elements) {
					try {
						const elem = findElement(elemSelector)
						elem.style.color = color
					} catch (error) {
						EditorLogger.error(
							`Failed to restore text color for element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// NOW safe to destructure selector for single-element operations
			const { selector, textContent, ...previousState } = command.previousState

			// Handle duplicate element restoration (undo)
			if (command.commandType === "DUPLICATE_ELEMENT") {
				const { duplicatedSelector } = command.previousState
				EditorLogger.info("[StyleManager] Undoing element duplication", {
					duplicatedSelector,
				})

				try {
					const duplicatedElement = findElement(duplicatedSelector)
					duplicatedElement.remove()
					EditorLogger.info("[StyleManager] Duplicated element removed")

					// Re-select the original element
					if (this.elementSelector && command.previousState.selector) {
						const originalElement = findElement(command.previousState.selector)
						if (originalElement instanceof HTMLElement) {
							setTimeout(() => {
								this.elementSelector?.selectElement(originalElement)
								EditorLogger.info("[StyleManager] Original element re-selected")
							}, 0)
						}
					}
				} catch (error) {
					EditorLogger.error("[StyleManager] Failed to undo element duplication", error)
				}
				return
			}

			// Handle delete element restoration
			if (command.commandType === "DELETE_ELEMENT") {
				const {
					parentSelector,
					nextSiblingSelector,
					siblingIndex,
					html,
					selector,
					specialElementData,
				} = command.previousState
				EditorLogger.info("[StyleManager] Restoring deleted element", {
					selector,
					hasNextSibling: !!nextSiblingSelector,
					siblingIndex,
					hasSpecialData: !!specialElementData,
				})

				const parent = findElement(parentSelector)
				const tempDiv = document.createElement("div")
				tempDiv.innerHTML = html
				const restoredElement = tempDiv.firstElementChild

				if (restoredElement) {
					// Use siblingIndex as the primary strategy since it's most reliable
					// (CSS selectors with :nth-of-type() become invalid after DOM changes)
					let restored = false

					// Strategy 1: Use siblingIndex (most reliable)
					if (!restored && typeof siblingIndex === "number" && siblingIndex >= 0) {
						try {
							const currentChildren = Array.from(parent.children)

							if (siblingIndex <= currentChildren.length) {
								// Insert at the original index
								if (siblingIndex < currentChildren.length) {
									parent.insertBefore(
										restoredElement,
										currentChildren[siblingIndex],
									)
								} else {
									// Append at the end if index equals length
									parent.appendChild(restoredElement)
								}
								restored = true
								EditorLogger.info(
									`[StyleManager] Element restored at index ${siblingIndex}`,
								)
							}
						} catch (error) {
							EditorLogger.warn("[StyleManager] Index-based restore failed")
						}
					}

					// Strategy 2: Fallback - try nextSiblingSelector (may fail due to :nth-of-type() changes)
					if (!restored && nextSiblingSelector) {
						try {
							const nextSibling = findElement(nextSiblingSelector)
							parent.insertBefore(restoredElement, nextSibling)
							restored = true
							EditorLogger.info("[StyleManager] Element restored before next sibling")
						} catch (error) {
							EditorLogger.warn("[StyleManager] Next sibling not found")
						}
					}

					// Strategy 3: Last resort - append to end
					if (!restored) {
						parent.appendChild(restoredElement)
						EditorLogger.info("[StyleManager] Element restored at end (fallback)")
					}

					// Restore special element state (Canvas, Video, etc.)
					if (specialElementData) {
						this.restoreSpecialElementState(restoredElement, specialElementData).catch(
							(error) => {
								EditorLogger.error(
									"[StyleManager] Failed to restore special element state",
									error,
								)
							},
						)
					}

					// Re-select the restored element
					if (this.elementSelector && restoredElement instanceof HTMLElement) {
						// Use a small delay to ensure DOM is updated and special state is restored
						setTimeout(() => {
							this.elementSelector?.selectElement(restoredElement as HTMLElement)
							EditorLogger.info("[StyleManager] Restored element selected")
						}, 0)
					}
				} else {
					EditorLogger.error("[StyleManager] Failed to parse restored element HTML")
				}
				return
			}

			// Handle recursive font size adjustment restoration
			if (command.commandType === "ADJUST_FONT_SIZE_RECURSIVE") {
				const { fontSizes } = command.previousState as {
					selector: string
					fontSizes: Array<{ relativePath: string; fontSize: string }>
				}

				if (fontSizes && selector) {
					// First, find the root element
					const rootElement = findElement(selector)

					fontSizes.forEach(({ relativePath, fontSize: prevFontSize }) => {
						try {
							let targetElement: Element | null = null

							if (relativePath === "") {
								// This is the root element itself
								targetElement = rootElement
							} else {
								// Query within the root element's scope
								// Add :scope prefix to support relative selectors starting with >
								const scopedSelector = relativePath.startsWith(">")
									? `:scope ${relativePath}`
									: relativePath
								targetElement = rootElement.querySelector(scopedSelector)
							}

							if (targetElement instanceof HTMLElement) {
								// If previous font size was empty, remove the inline style
								// Otherwise, set it to the previous value
								if (prevFontSize === "") {
									targetElement.style.removeProperty("font-size")
								} else {
									targetElement.style.fontSize = prevFontSize
								}
							}
						} catch (e) {
							// Element might not exist anymore, skip
							EditorLogger.warn(`Failed to restore font size for ${relativePath}`, e)
						}
					})
				}
				return
			}

			const element = findElement(selector)

			// Handle APPLY_TEXT_STYLE command
			if (command.commandType === "APPLY_TEXT_STYLE") {
				const previousState = command.previousState as any

				// Case 1: Style attribute restoration (when reusing existing span)
				if (previousState.styles !== undefined) {
					// Restore previous style values
					const previousStyles = previousState.styles as Record<string, string>
					const htmlElement = element as HTMLElement

					// Restore each style property directly (using camelCase property access)
					for (const [property, value] of Object.entries(previousStyles)) {
						if (value === "") {
							// Remove the property if it was empty before
							htmlElement.style[property as any] = ""
						} else {
							// Restore the previous value
							htmlElement.style[property as any] = value
						}
					}

					// Restore text selection
					if (this.textStyleManager && previousState.selectedText) {
						const restored = this.textStyleManager.restoreTextSelection(
							selector,
							previousState.selectedText,
						)
						if (!restored) {
							this.textStyleManager.clearTextSelection()
						}
					}

					return
				}

				// Case 2: innerHTML restoration (when creating new span)
				if (previousState.innerHTML !== undefined) {
					const previousHTML = previousState.innerHTML

					element.innerHTML = previousHTML

					// Try to restore text selection after innerHTML restoration
					if (this.textStyleManager) {
						const selectedText = previousState.selectedText
						if (
							selectedText &&
							typeof selectedText === "string" &&
							selectedText.length > 0
						) {
							// Try to restore the text selection
							const restored = this.textStyleManager.restoreTextSelection(
								selector,
								selectedText,
							)
							if (!restored) {
								this.textStyleManager.clearTextSelection()
							}
						} else {
							this.textStyleManager.clearTextSelection()
						}
					}

					return
				}
			}

			// Handle innerHTML restoration for other command types
			if (
				(command.previousState as any).innerHTML !== undefined &&
				command.commandType !== "APPLY_TEXT_STYLE"
			) {
				element.innerHTML = (command.previousState as any).innerHTML
				return
			}

			// Handle text content restoration
			if (textContent !== undefined) {
				element.textContent = textContent
				return
			}

			// Handle style restoration
			for (const [property, value] of Object.entries(previousState)) {
				const kebabProperty = camelToKebab(property)
				if (value) {
					element.style.setProperty(kebabProperty, value as string)
				} else {
					element.style.removeProperty(kebabProperty)
				}
			}
		} catch (error) {
			EditorLogger.error("Failed to restore state", error)
		}
	}

	/**
	 * Apply command
	 */
	private async applyCommand(command: any): Promise<void> {
		if (!command.payload) return

		try {
			// Handle batch styles multiple FIRST (before destructuring selector)
			if (command.commandType === "BATCH_STYLES_MULTIPLE") {
				const { selectors, styles } = command.payload as {
					selectors: string[]
					styles: Record<string, string>
				}

				for (const elemSelector of selectors) {
					try {
						const elem = findElement(elemSelector)
						// Apply styles
						for (const [property, value] of Object.entries(styles)) {
							const kebabProperty = camelToKebab(property)
							elem.style.setProperty(kebabProperty, value)
						}
					} catch (error) {
						EditorLogger.error(
							`Failed to apply styles to element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// Handle background color multiple FIRST
			if (command.commandType === "SET_BACKGROUND_COLOR_MULTIPLE") {
				const { selectors, color } = command.payload as {
					selectors: string[]
					color: string
				}

				for (const elemSelector of selectors) {
					try {
						const elem = findElement(elemSelector)
						elem.style.backgroundColor = color
					} catch (error) {
						EditorLogger.error(
							`Failed to set background color for element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// Handle text color multiple FIRST
			if (command.commandType === "SET_TEXT_COLOR_MULTIPLE") {
				const { selectors, color } = command.payload as {
					selectors: string[]
					color: string
				}

				for (const elemSelector of selectors) {
					try {
						const elem = findElement(elemSelector)
						elem.style.color = color
					} catch (error) {
						EditorLogger.error(
							`Failed to set text color for element: ${elemSelector}`,
							error,
						)
					}
				}
				return
			}

			// NOW safe to destructure selector for single-element operations
			const { selector, styles, color, fontSize, unit, content, textContent, top, left } =
				command.payload

			// Handle duplicate element (redo)
			if (command.commandType === "DUPLICATE_ELEMENT") {
				EditorLogger.info("[StyleManager] Redoing element duplication", { selector })
				const element = findElement(selector)
				const parent = element.parentElement
				if (!parent) {
					EditorLogger.error("[StyleManager] Cannot duplicate element without parent")
					return
				}

				// Clone the element
				const clonedElement = element.cloneNode(true) as HTMLElement

				// Capture and restore special element state
				const specialElementData = this.captureSpecialElementState(element)

				// Insert after original
				const nextSibling = element.nextSibling
				if (nextSibling) {
					parent.insertBefore(clonedElement, nextSibling)
				} else {
					parent.appendChild(clonedElement)
				}

				// Restore special element state
				if (specialElementData) {
					await this.restoreSpecialElementState(clonedElement, specialElementData)
				}

				EditorLogger.info("[StyleManager] Element duplicated during redo")

				// Select the newly duplicated element
				if (this.elementSelector && clonedElement instanceof HTMLElement) {
					setTimeout(() => {
						this.elementSelector?.selectElement(clonedElement)
						EditorLogger.info("[StyleManager] Duplicated element selected during redo")
					}, 0)
				}
				return
			}

			// Handle delete element
			if (command.commandType === "DELETE_ELEMENT") {
				EditorLogger.info("[StyleManager] Reapplying DELETE_ELEMENT command", { selector })
				const element = findElement(selector) as HTMLElement
				element.remove()
				EditorLogger.info("[StyleManager] Element removed during redo")

				// Clear selection
				if (this.elementSelector) {
					this.elementSelector.clearSelection()
					EditorLogger.info("[StyleManager] Selection cleared during redo")
				}
				return
			}

			const element = findElement(selector) as HTMLElement

			switch (command.commandType) {
				case "SET_BACKGROUND_COLOR":
					element.style.backgroundColor = color
					break
				case "SET_TEXT_COLOR":
					element.style.color = color
					break
				case "SET_FONT_SIZE":
					element.style.fontSize =
						typeof fontSize === "number" ? `${fontSize}${unit}` : fontSize
					break
				case "BATCH_STYLES":
					for (const [property, value] of Object.entries(styles)) {
						const kebabProperty = camelToKebab(property)
						element.style.setProperty(kebabProperty, value as string)
					}
					break
				case "ADJUST_FONT_SIZE_RECURSIVE": {
					// Reapply font size adjustment without recording history
					const { scaleFactor, minFontSize = 8 } = command.payload
					this.applyFontSizeAdjustment(selector, scaleFactor, minFontSize)
					break
				}
				case "SET_TEXT_CONTENT": {
					element.textContent = textContent
					break
				}
				case "UPDATE_TEXT_CONTENT": {
					element.textContent = content
					break
				}
				case "SET_ELEMENT_POSITION": {
					element.style.position = "relative"
					element.style.top = `${top}px`
					element.style.left = `${left}px`
					break
				}
				case "APPLY_TEXT_STYLE": {
					// Restore to the styled state (for redo)
					const payload = command.payload as any

					// Case 1: Style update (reusing existing span)
					if (payload.isStyleUpdate && payload.styles) {
						const styles = payload.styles as Record<string, string>
						const htmlElement = element as HTMLElement

						// Apply each style property directly (using camelCase property access)
						for (const [property, value] of Object.entries(styles)) {
							htmlElement.style[property as any] = value || ""
						}

						// Restore text selection
						if (this.textStyleManager && payload.selectedText) {
							const restored = this.textStyleManager.restoreTextSelection(
								selector,
								payload.selectedText,
							)
							if (!restored) {
								this.textStyleManager.clearTextSelection()
							}
						}
					}
					// Case 2: innerHTML restoration (creating new span)
					else if (payload.innerHTML !== undefined) {
						element.innerHTML = payload.innerHTML

						// Try to restore text selection after innerHTML restoration
						if (this.textStyleManager) {
							const selectedText = payload.selectedText
							if (
								selectedText &&
								typeof selectedText === "string" &&
								selectedText.length > 0
							) {
								const restored = this.textStyleManager.restoreTextSelection(
									selector,
									selectedText,
								)
								if (!restored) {
									this.textStyleManager.clearTextSelection()
								}
							} else {
								this.textStyleManager.clearTextSelection()
							}
						}
					}
					break
				}
			}
		} catch (error) {
			EditorLogger.error("Failed to apply command", error)
		}
	}
}
