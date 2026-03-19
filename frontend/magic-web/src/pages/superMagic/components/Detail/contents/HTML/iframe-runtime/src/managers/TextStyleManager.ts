/**
 * Text Style Manager
 * Handles text selection and applying styles to selected text portions
 */

import type { CommandHistory } from "../core/CommandHistory"
import type { EditorBridge } from "../core/EditorBridge"
import type { ElementSelector } from "../features/ElementSelector"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"

export class TextStyleManager {
	private commandHistory: CommandHistory
	private bridge: EditorBridge
	private elementSelector: ElementSelector | null = null
	private currentRange: Range | null = null
	private currentContainerSelector: string | null = null
	private selectionChangeHandler: (() => void) | null = null
	private applyingStyle: Promise<void> | null = null

	constructor(commandHistory: CommandHistory, bridge: EditorBridge) {
		this.commandHistory = commandHistory
		this.bridge = bridge
	}

	/**
	 * Set element selector for selecting created spans
	 */
	setElementSelector(elementSelector: ElementSelector): void {
		this.elementSelector = elementSelector
	}

	/**
	 * Start monitoring text selection changes
	 */
	startMonitoring(): void {
		if (this.selectionChangeHandler) {
			return // Already monitoring
		}

		this.selectionChangeHandler = () => {
			this.handleSelectionChange()
		}

		document.addEventListener("selectionchange", this.selectionChangeHandler)
		EditorLogger.debug("Text selection monitoring started")
	}

	/**
	 * Stop monitoring text selection changes
	 */
	stopMonitoring(): void {
		if (this.selectionChangeHandler) {
			document.removeEventListener("selectionchange", this.selectionChangeHandler)
			this.selectionChangeHandler = null
			EditorLogger.debug("Text selection monitoring stopped")
		}
	}

	/**
	 * Handle selection change event
	 */
	private handleSelectionChange(): void {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) {
			this.clearSelection()
			return
		}

		const range = selection.getRangeAt(0)
		const selectedText = range.toString().trim()

		// No text selected or collapsed selection (just cursor)
		if (!selectedText || range.collapsed) {
			this.clearSelection()
			return
		}

		// Store current range
		this.currentRange = range.cloneRange()

		// Get container element (the element being edited)
		const container = this.findEditableContainer(range.commonAncestorContainer)

		// If no contenteditable container found, the element needs to be made editable first
		// Don't modify DOM here as it will interrupt the selection
		if (!container) {
			this.clearSelection()
			return
		}

		// Generate selector for container
		this.currentContainerSelector = this.generateSelector(container)

		// Get bounding rect for toolbar positioning
		const rects = range.getClientRects()
		const boundingRect =
			rects.length > 0
				? {
						top: rects[0].top,
						left: rects[0].left,
						width: rects[0].width,
						height: rects[0].height,
					}
				: undefined

		// Notify parent window about text selection
		this.bridge.sendEvent("TEXT_SELECTION_CHANGED", {
			hasSelection: true,
			selectedText,
			boundingRect,
			containerSelector: this.currentContainerSelector,
		})

		EditorLogger.debug("Text selection changed", {
			selectedText,
			containerSelector: this.currentContainerSelector,
		})
	}

	/**
	 * Clear current selection
	 */
	private clearSelection(): void {
		if (this.currentRange) {
			this.currentRange = null
			this.currentContainerSelector = null

			this.bridge.sendEvent("TEXT_SELECTION_CHANGED", {
				hasSelection: false,
				selectedText: "",
				boundingRect: undefined,
				containerSelector: undefined,
			})
		}
	}

	/**
	 * Find the editable container element
	 */
	private findEditableContainer(node: Node): HTMLElement | null {
		let current: Node | null = node

		while (current) {
			if (current instanceof HTMLElement) {
				// Check if this element is contenteditable
				if (current.isContentEditable) {
					return current
				}
			}
			current = current.parentNode
		}

		return null
	}

	/**
	 * Generate a unique selector for an element
	 */
	private generateSelector(element: HTMLElement): string {
		// Try to use data-editor-id first
		const editorId = element.getAttribute("data-editor-id")
		if (editorId) {
			return `[data-editor-id="${editorId}"]`
		}

		// Fallback to id
		if (element.id) {
			return `#${element.id}`
		}

		// Generate a path-based selector
		const path: string[] = []
		let current: HTMLElement | null = element

		while (current && current !== document.body) {
			let selector = current.tagName.toLowerCase()
			if (current.className) {
				selector += `.${current.className.split(" ").join(".")}`
			}
			path.unshift(selector)
			current = current.parentElement
		}

		return path.join(" > ")
	}

	/**
	 * Get current text selection info
	 */
	getTextSelection(): {
		hasSelection: boolean
		selectedText: string
		range?: {
			startOffset: number
			endOffset: number
			containerSelector: string
		}
	} {
		if (!this.currentRange || !this.currentContainerSelector) {
			return {
				hasSelection: false,
				selectedText: "",
			}
		}

		return {
			hasSelection: true,
			selectedText: this.currentRange.toString(),
			range: {
				startOffset: this.currentRange.startOffset,
				endOffset: this.currentRange.endOffset,
				containerSelector: this.currentContainerSelector,
			},
		}
	}

	/**
	 * Get computed styles for the current text selection
	 * Returns the styles of the first element in the selection range
	 * This is used for style panel to display current text styles
	 */
	getSelectionComputedStyles(): Record<string, string> {
		if (!this.currentRange) {
			return {}
		}

		try {
			// Get the first element in the selection
			let startNode = this.currentRange.startContainer

			// If it's a text node, get its parent element
			if (startNode.nodeType === Node.TEXT_NODE) {
				startNode = startNode.parentElement as Node
			}

			if (!(startNode instanceof HTMLElement)) {
				return {}
			}

			// Get computed styles
			const computedStyle = window.getComputedStyle(startNode)

			// Extract relevant text styling properties
			return {
				color: computedStyle.color,
				backgroundColor: computedStyle.backgroundColor,
				fontSize: computedStyle.fontSize,
				fontWeight: computedStyle.fontWeight,
				fontFamily: computedStyle.fontFamily,
				fontStyle: computedStyle.fontStyle,
				lineHeight: computedStyle.lineHeight,
				textAlign: computedStyle.textAlign,
				textDecoration: computedStyle.textDecoration,
			}
		} catch (error) {
			EditorLogger.error("Failed to get selection computed styles", error)
			return {}
		}
	}

	/**
	 * Apply style to selected text
	 * This will wrap the selected text in a <span> and apply styles to it
	 */
	async applyTextStyle(
		selector: string,
		styles: {
			fontWeight?: string
			fontStyle?: string
			textDecoration?: string
			color?: string
			backgroundColor?: string
			fontSize?: string
		},
	): Promise<void> {
		// Wait for any ongoing style application to complete
		// This prevents concurrent modifications that would corrupt the selection range
		if (this.applyingStyle) {
			await this.applyingStyle
		}

		// Create a promise to track this style application
		let resolveApplying: () => void
		this.applyingStyle = new Promise((resolve) => {
			resolveApplying = resolve
		})

		try {
			await this.applyTextStyleInternal(selector, styles)
		} finally {
			// Always release the lock
			resolveApplying!()
			this.applyingStyle = null
		}
	}

	/**
	 * Internal method to apply text style (without locking)
	 */
	private async applyTextStyleInternal(
		selector: string,
		styles: {
			fontWeight?: string
			fontStyle?: string
			textDecoration?: string
			color?: string
			backgroundColor?: string
			fontSize?: string
		},
	): Promise<void> {
		// Verify we have a selection
		if (!this.currentRange) {
			EditorLogger.warn("No text selection to apply style to")
			return
		}

		// Verify the selector matches current container
		if (selector !== this.currentContainerSelector) {
			EditorLogger.warn("Selector mismatch", {
				expected: this.currentContainerSelector,
				received: selector,
			})
			return
		}

		const container = findElement(selector)
		if (!container) {
			EditorLogger.error("Container element not found", { selector })
			return
		}

		try {
			// Save current selection state for undo
			const previousHTML = container.innerHTML

			// Check if the selection is entirely within a single span element
			// If so, we can reuse it instead of creating nested spans
			let targetSpan: HTMLSpanElement | null = null
			const previousStyles: Record<string, string> = {}
			let newSpanCreated = false
			const range = this.currentRange

			// Check if the common ancestor itself is a span
			let commonAncestor = range.commonAncestorContainer
			if (commonAncestor.nodeType === Node.TEXT_NODE) {
				commonAncestor = commonAncestor.parentElement as Node
			}

			// If the common ancestor is a span and the selection covers all its content
			if (commonAncestor instanceof HTMLSpanElement) {
				const spanTextContent = commonAncestor.textContent || ""
				const selectedText = range.toString()

				if (spanTextContent === selectedText) {
					// The selection covers the entire span - reuse it
					targetSpan = commonAncestor

					// Save previous style values for undo
					if (styles.fontWeight !== undefined) {
						previousStyles.fontWeight = targetSpan.style.fontWeight || ""
					}
					if (styles.fontStyle !== undefined) {
						previousStyles.fontStyle = targetSpan.style.fontStyle || ""
					}
					if (styles.textDecoration !== undefined) {
						previousStyles.textDecoration = targetSpan.style.textDecoration || ""
					}
					if (styles.color !== undefined) {
						previousStyles.color = targetSpan.style.color || ""
					}
					if (styles.backgroundColor !== undefined) {
						previousStyles.backgroundColor = targetSpan.style.backgroundColor || ""
					}
					if (styles.fontSize !== undefined) {
						previousStyles.fontSize = targetSpan.style.fontSize || ""
					}
				}
			}

			if (targetSpan) {
				// Reuse the existing span - just update its styles
				if (styles.fontWeight !== undefined) targetSpan.style.fontWeight = styles.fontWeight
				if (styles.fontStyle !== undefined) targetSpan.style.fontStyle = styles.fontStyle
				if (styles.textDecoration !== undefined)
					targetSpan.style.textDecoration = styles.textDecoration
				if (styles.color !== undefined) targetSpan.style.color = styles.color
				if (styles.backgroundColor !== undefined)
					targetSpan.style.backgroundColor = styles.backgroundColor
				if (styles.fontSize !== undefined) targetSpan.style.fontSize = styles.fontSize
			} else {
				// Create a new span element to wrap the selection
				const span = document.createElement("span")
				newSpanCreated = true

				// Apply styles to the span
				if (styles.fontWeight) span.style.fontWeight = styles.fontWeight
				if (styles.fontStyle) span.style.fontStyle = styles.fontStyle
				if (styles.textDecoration) span.style.textDecoration = styles.textDecoration
				if (styles.color) span.style.color = styles.color
				if (styles.backgroundColor) span.style.backgroundColor = styles.backgroundColor
				if (styles.fontSize) span.style.fontSize = styles.fontSize

				// Extract the selected content and wrap it in the span
				const fragment = range.extractContents()
				span.appendChild(fragment)

				// Insert the span at the selection point
				range.insertNode(span)

				// Update target span reference for re-selection
				targetSpan = span
			}

			// Get the new HTML after applying style (for redo)
			const newHTML = container.innerHTML

			// Re-select the modified text (instead of clearing selection)
			// This allows users to apply multiple styles continuously
			const selection = window.getSelection()
			if (selection && targetSpan) {
				const newRange = document.createRange()
				newRange.selectNodeContents(targetSpan)
				selection.removeAllRanges()
				selection.addRange(newRange)

				// Update current range to the new selection
				this.currentRange = newRange.cloneRange()

				// Notify parent window about the updated selection
				// This ensures the StylePanel displays the correct styles
				const selectedText = newRange.toString()
				const rects = newRange.getClientRects()
				const boundingRect =
					rects.length > 0
						? {
								top: rects[0].top,
								left: rects[0].left,
								width: rects[0].width,
								height: rects[0].height,
							}
						: undefined

				this.bridge.sendEvent("TEXT_SELECTION_CHANGED", {
					hasSelection: true,
					selectedText,
					boundingRect,
					containerSelector: selector,
				})

				EditorLogger.debug("Text selection updated after style application", {
					selectedText,
					containerSelector: selector,
				})
			}

			// Record command for undo/redo
			// Save the selected text to enable selection restoration after undo/redo
			const selectedText = this.currentRange.toString()

			// If we reused an existing span, save style changes instead of innerHTML
			if (Object.keys(previousStyles).length > 0) {
				this.commandHistory.push({
					commandType: "APPLY_TEXT_STYLE",
					payload: { selector, styles, selectedText, isStyleUpdate: true }, // Mark as style update
					previousState: { selector, styles: previousStyles, selectedText }, // Save previous styles
					timestamp: Date.now(),
					metadata: {
						canUndo: true,
						description: `Apply text style`,
					},
				})
			} else {
				// New span was created, save innerHTML
				this.commandHistory.push({
					commandType: "APPLY_TEXT_STYLE",
					payload: { selector, styles, innerHTML: newHTML, selectedText }, // Save new HTML for redo
					previousState: { selector, innerHTML: previousHTML, selectedText }, // Save old HTML for undo
					timestamp: Date.now(),
					metadata: {
						canUndo: true,
						description: `Apply text style`,
					},
				})
			}

			EditorLogger.info("Text style applied", { selector, styles })

			// If a new span was created, select it as the selectedElement
			// This allows users to see and modify the span's styles in the StylePanel

			if (newSpanCreated && targetSpan && this.elementSelector) {
				// Use a small delay to ensure the DOM has settled after text selection
				setTimeout(() => {
					if (targetSpan && this.elementSelector) {
						// Clear browser text selection first before selecting the element
						// This ensures we transition cleanly from text selection to element selection
						const selection = window.getSelection()
						if (selection) {
							selection.removeAllRanges()
						}

						// Clear our internal text selection state
						this.clearTextSelection()

						this.elementSelector.selectElement(targetSpan as HTMLElement)
						EditorLogger.debug("New span selected as selectedElement", {
							spanSelector: this.generateSpanSelector(targetSpan),
						})
					}
				}, 50)
			}
		} catch (error) {
			EditorLogger.error("Failed to apply text style", error)
			throw error
		}
	}

	/**
	 * Generate a selector for a span element
	 */
	private generateSpanSelector(span: HTMLSpanElement): string {
		let selector = "span"
		if (span.id) {
			selector = `#${span.id}`
		} else if (span.className) {
			selector = `span.${span.className.split(" ").join(".")}`
		}
		return selector
	}

	/**
	 * Clear current text selection state
	 * Called after undo/redo operations that restore innerHTML
	 */
	clearTextSelection(): void {
		this.currentRange = null
		this.currentContainerSelector = null

		// Clear browser selection
		const selection = window.getSelection()
		if (selection) {
			selection.removeAllRanges()
		}

		// Notify parent window
		this.bridge.sendEvent("TEXT_SELECTION_CHANGED", {
			hasSelection: false,
			selectedText: "",
			boundingRect: undefined,
			containerSelector: undefined,
		})

		EditorLogger.debug("Text selection cleared")
	}

	/**
	 * Try to restore text selection after innerHTML restoration
	 * Returns true if selection was restored successfully
	 */
	restoreTextSelection(containerSelector: string, selectedText: string): boolean {
		try {
			const container = findElement(containerSelector)
			if (!container) {
				EditorLogger.warn("Container not found for text selection restoration", {
					containerSelector,
				})
				return false
			}

			// Try to find and select the text
			const textContent = container.textContent || ""
			const textIndex = textContent.indexOf(selectedText)

			if (textIndex === -1) {
				EditorLogger.warn("Selected text not found in container", {
					selectedText,
					containerSelector,
				})
				return false
			}

			// Create a range to select the text
			const range = document.createRange()
			const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)

			let currentOffset = 0
			let startNode: Node | null = null
			let startOffset = 0
			let endNode: Node | null = null
			let endOffset = 0

			// Find the text nodes that contain the selected text
			while (walker.nextNode()) {
				const textNode = walker.currentNode
				const nodeLength = textNode.textContent?.length || 0

				if (
					!startNode &&
					currentOffset <= textIndex &&
					currentOffset + nodeLength > textIndex
				) {
					// Found start node
					startNode = textNode
					startOffset = textIndex - currentOffset
				}

				if (
					startNode &&
					currentOffset < textIndex + selectedText.length &&
					currentOffset + nodeLength >= textIndex + selectedText.length
				) {
					// Found end node
					endNode = textNode
					endOffset = textIndex + selectedText.length - currentOffset
					break
				}

				currentOffset += nodeLength
			}

			if (!startNode || !endNode) {
				EditorLogger.warn("Could not find text nodes for selection")
				return false
			}

			// Set the range
			range.setStart(startNode, startOffset)
			range.setEnd(endNode, endOffset)

			// Apply the selection
			const selection = window.getSelection()
			if (selection) {
				selection.removeAllRanges()
				selection.addRange(range)

				// Update internal state
				this.currentRange = range.cloneRange()
				this.currentContainerSelector = containerSelector

				EditorLogger.info("Text selection restored successfully", {
					selectedText,
					containerSelector,
				})
				return true
			}

			return false
		} catch (error) {
			EditorLogger.error("Failed to restore text selection", error)
			return false
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.stopMonitoring()
		this.currentRange = null
		this.currentContainerSelector = null
	}
}
