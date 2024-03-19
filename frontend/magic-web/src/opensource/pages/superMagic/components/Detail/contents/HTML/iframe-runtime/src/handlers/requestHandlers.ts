/**
 * Request Handlers
 * Handles all request-type messages from parent window
 */

import type { EditorBridge } from "../core/EditorBridge"
import type { CommandHistory } from "../core/CommandHistory"
import type { StyleManager } from "../managers/StyleManager"
import type { TextStyleManager } from "../managers/TextStyleManager"
import type { ElementSelector } from "../features/ElementSelector"
import { ContentCleaner } from "../utils/ContentCleaner"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"

interface RequestHandlersConfig {
	bridge: EditorBridge
	commandHistory: CommandHistory
	styleManager: StyleManager
	textStyleManager: TextStyleManager
	elementSelector: ElementSelector
	onEditModeChange: (isEditMode: boolean) => void
	onSelectionModeChange: (isSelectionMode: boolean) => void
}

export function registerRequestHandlers(config: RequestHandlersConfig): void {
	const {
		bridge,
		commandHistory,
		styleManager,
		textStyleManager,
		elementSelector,
		onEditModeChange,
		onSelectionModeChange,
	} = config

	// Get content
	bridge.onRequest("GET_CONTENT", async () => {
		const html = document.documentElement.outerHTML
		const cleanHtml = ContentCleaner.cleanDocument(html)
		const hasChanges = commandHistory.getUndoStackSize() > 0

		EditorLogger.info("Get content", { hasChanges })
		return {
			html,
			cleanHtml,
			hasChanges,
		}
	})

	// Get clean content
	bridge.onRequest("GET_CLEAN_CONTENT", async () => {
		const html = document.documentElement.outerHTML
		const cleanHtml = ContentCleaner.cleanDocument(html)

		EditorLogger.info("Get clean content")
		return { cleanHtml }
	})

	// Get history state
	bridge.onRequest("GET_HISTORY_STATE", async () => {
		const state = commandHistory.getState()
		EditorLogger.debug("Get history state", state)
		return state
	})

	// Undo
	bridge.onRequest("UNDO", async () => {
		const result = await styleManager.undo()
		EditorLogger.info("Undo operation", { success: result })
		return { success: result }
	})

	// Redo
	bridge.onRequest("REDO", async () => {
		const result = await styleManager.redo()
		EditorLogger.info("Redo operation", { success: result })
		return { success: result }
	})

	// Clear history
	bridge.onRequest("CLEAR_HISTORY", async () => {
		commandHistory.clear()
		EditorLogger.info("Clear history")
		return { success: true }
	})

	// Enter edit mode
	bridge.onRequest("ENTER_EDIT_MODE", async () => {
		onEditModeChange(true)
		EditorLogger.info("Enter edit mode")
		return { success: true }
	})

	// Exit edit mode
	bridge.onRequest("EXIT_EDIT_MODE", async () => {
		onEditModeChange(false)
		EditorLogger.info("Exit edit mode")
		return { success: true }
	})

	// Validate content
	bridge.onRequest("VALIDATE_CONTENT", async () => {
		const html = document.documentElement.outerHTML
		const result = ContentCleaner.validateHtmlContent(html)
		EditorLogger.info("Validate content", result)
		return result
	})

	// Enable text editing
	bridge.onRequest("ENABLE_TEXT_EDITING", async (payload: unknown) => {
		const { selector } = payload as { selector: string }
		styleManager.enableTextEditing(selector)
		EditorLogger.info("Enable text editing", { selector })
		return { success: true }
	})

	// Disable text editing
	bridge.onRequest("DISABLE_TEXT_EDITING", async (payload: unknown) => {
		const { selector } = payload as { selector: string }
		styleManager.disableTextEditing(selector)
		EditorLogger.info("Disable text editing", { selector })
		return { success: true }
	})

	// Get text content
	bridge.onRequest("GET_TEXT_CONTENT", async (payload: unknown) => {
		const { selector } = payload as { selector: string }
		const result = styleManager.getTextContent(selector)
		EditorLogger.info("Get text content", { selector, result })
		return { content: result.textContent, hasText: result.hasText }
	})

	// Refresh selected element (re-select to get updated rect/styles)
	bridge.onRequest("REFRESH_SELECTED_ELEMENT", async (payload: unknown) => {
		const { selector } = payload as { selector: string }

		const element = findElement(selector)
		if (element instanceof HTMLElement) {
			// Check if element is already selected
			const isAlreadySelected = elementSelector.isSelected(element)

			if (isAlreadySelected) {
				// Element is already selected, just refresh the selection info
				// This avoids unnecessary clearSelection() which causes toolbar to be disabled
				elementSelector.refreshSelection()
				EditorLogger.info("Refresh selected element (already selected)", { selector })
			} else {
				// Element not selected, select it normally
				elementSelector.selectElement(element)
				EditorLogger.info("Refresh selected element (new selection)", { selector })
			}
			return { success: true }
		}
		return { success: false }
	})

	// Refresh selected elements (multi-select)
	bridge.onRequest("REFRESH_SELECTED_ELEMENTS", async (payload: unknown) => {
		const { selectors = [] } = (payload as { selectors?: string[] }) || {}

		elementSelector.refreshSelection()
		EditorLogger.info("Refresh selected elements", { selectorsCount: selectors.length })
		return { success: true }
	})

	// Enter selection mode
	bridge.onRequest("ENTER_SELECTION_MODE", async () => {
		elementSelector.enable()
		onSelectionModeChange(true)
		EditorLogger.info("Enter selection mode")
		return { success: true }
	})

	// Exit selection mode
	bridge.onRequest("EXIT_SELECTION_MODE", async () => {
		elementSelector.disable()
		onSelectionModeChange(false)
		EditorLogger.info("Exit selection mode")
		return { success: true }
	})

	// Clear selection (deselect element but keep selection mode active)
	bridge.onRequest("CLEAR_SELECTION", async () => {
		elementSelector.clearSelection()
		EditorLogger.info("Clear selection")
		return { success: true }
	})

	// Get text selection
	bridge.onRequest("GET_TEXT_SELECTION", async () => {
		const selection = textStyleManager.getTextSelection()
		EditorLogger.debug("Get text selection", selection)
		return selection
	})

	// Get computed styles for current text selection
	bridge.onRequest("GET_TEXT_SELECTION_STYLES", async () => {
		const styles = textStyleManager.getSelectionComputedStyles()
		EditorLogger.debug("Get text selection styles", styles)
		return { styles }
	})

	// Apply text style (to selected text portion)
	bridge.onRequest("APPLY_TEXT_STYLE", async (payload: unknown) => {
		const { selector, styles } = payload as {
			selector: string
			styles: {
				fontWeight?: string
				fontStyle?: string
				textDecoration?: string
				color?: string
				backgroundColor?: string
				fontSize?: string
			}
		}
		await textStyleManager.applyTextStyle(selector, styles)
		EditorLogger.info("Apply text style", { selector, styles })
		return { success: true }
	})

	// Get logs
	bridge.onRequest("GET_LOGS", async () => {
		const logs = EditorLogger.getLogs()
		EditorLogger.debug("Get logs", { count: logs.length })
		return { logs }
	})

	// Clear logs
	bridge.onRequest("CLEAR_LOGS", async () => {
		EditorLogger.clearLogs()
		EditorLogger.info("Logs cleared")
		return { success: true }
	})
}
