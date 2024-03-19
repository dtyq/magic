/**
 * Command Handlers
 * Handles all command-type messages from parent window
 */

import type { EditorBridge } from "../core/EditorBridge"
import type { StyleManager } from "../managers/StyleManager"
import type { TextStyleManager } from "../managers/TextStyleManager"
import { EditorLogger } from "../utils/EditorLogger"

interface CommandHandlersConfig {
	bridge: EditorBridge
	styleManager: StyleManager
	textStyleManager: TextStyleManager
}

export function registerCommandHandlers(config: CommandHandlersConfig): void {
	const { bridge, styleManager, textStyleManager } = config

	// Set background color
	bridge.onCommand("SET_BACKGROUND_COLOR", async (payload: unknown) => {
		const { selector, color } = payload as { selector: string; color: string }
		await styleManager.setBackgroundColor(selector, color)
		EditorLogger.info("Set background color", { selector, color })
		return { success: true }
	})

	// Set text color
	bridge.onCommand("SET_TEXT_COLOR", async (payload: unknown) => {
		const { selector, color } = payload as { selector: string; color: string }
		await styleManager.setTextColor(selector, color)
		EditorLogger.info("Set text color", { selector, color })
		return { success: true }
	})

	// Set font size
	bridge.onCommand("SET_FONT_SIZE", async (payload: unknown) => {
		const {
			selector,
			fontSize,
			unit = "px",
		} = payload as {
			selector: string
			fontSize: number | string
			unit?: "px" | "em" | "rem"
		}
		await styleManager.setFontSize(selector, fontSize, unit)
		EditorLogger.info("Set font size", { selector, fontSize, unit })
		return { success: true }
	})

	// Batch set styles
	bridge.onCommand("BATCH_STYLES", async (payload: unknown) => {
		const { selector, styles } = payload as {
			selector: string
			styles: Record<string, string>
		}
		await styleManager.setBatchStyles(selector, styles)
		EditorLogger.info("Batch set styles", { selector, styles })
		return { success: true }
	})

	// Batch set styles for multiple elements
	bridge.onCommand("BATCH_STYLES_MULTIPLE", async (payload: unknown) => {
		const { selectors, styles } = payload as {
			selectors: string[]
			styles: Record<string, string>
		}
		await styleManager.setBatchStylesMultiple(selectors, styles)
		EditorLogger.info("Batch set styles (multiple)", { selectors, styles })
		return { success: true }
	})

	// Adjust font size recursively
	bridge.onCommand("ADJUST_FONT_SIZE_RECURSIVE", async (payload: unknown) => {
		const {
			selector,
			scaleFactor,
			minFontSize = 8,
		} = payload as {
			selector: string
			scaleFactor: number
			minFontSize?: number
		}
		await styleManager.adjustFontSizeRecursive(selector, scaleFactor, minFontSize)
		EditorLogger.info("Adjust font size recursively", {
			selector,
			scaleFactor,
			minFontSize,
		})
		return { success: true }
	})

	// Apply styles temporarily (without history)
	bridge.onCommand("APPLY_STYLES_TEMPORARY", async (payload: unknown) => {
		const { selector, styles } = payload as {
			selector: string
			styles: Record<string, string>
		}
		styleManager.applyStylesTemporary(selector, styles)
		EditorLogger.debug("Apply styles temporarily", { selector, styles })
		return { success: true }
	})

	// Begin batch operation
	bridge.onCommand("BEGIN_BATCH_OPERATION", async (payload: unknown) => {
		const { selector, styles } = payload as {
			selector: string
			styles: Record<string, string>
		}
		styleManager.beginBatchOperation(selector, styles)
		EditorLogger.info("Begin batch operation", { selector })
		return { success: true }
	})

	// End batch operation
	bridge.onCommand("END_BATCH_OPERATION", async (payload: unknown) => {
		const { selector, styles } = payload as {
			selector: string
			styles: Record<string, string>
		}
		styleManager.endBatchOperation(selector, styles)
		EditorLogger.info("End batch operation", { selector })
		return { success: true }
	})

	// Cancel batch operation
	bridge.onCommand("CANCEL_BATCH_OPERATION", async () => {
		styleManager.cancelBatchOperation()
		EditorLogger.info("Cancel batch operation")
		return { success: true }
	})

	// Set text content
	bridge.onCommand("SET_TEXT_CONTENT", async (payload: unknown) => {
		const { selector, textContent } = payload as {
			selector: string
			textContent: string
		}
		await styleManager.setTextContent(selector, textContent)
		EditorLogger.info("Set text content", { selector, textContent })
		return { success: true }
	})

	// Update text content
	bridge.onCommand("UPDATE_TEXT_CONTENT", async (payload: unknown) => {
		const { selector, content } = payload as {
			selector: string
			content: string
		}
		await styleManager.updateTextContent(selector, content)
		EditorLogger.info("Update text content", { selector, content })
		return { success: true }
	})

	// Set element position
	bridge.onCommand("SET_ELEMENT_POSITION", async (payload: unknown) => {
		const { selector, top, left } = payload as {
			selector: string
			top: number
			left: number
		}
		await styleManager.setElementPosition(selector, top, left)
		EditorLogger.info("Set element position", { selector, top, left })
		return { success: true }
	})

	// Delete element
	bridge.onCommand("DELETE_ELEMENT", async (payload: unknown) => {
		try {
			const { selector } = payload as { selector: string }
			EditorLogger.info("Delete element command received", { selector })
			await styleManager.deleteElement(selector)
			EditorLogger.info("Delete element completed", { selector })
			return { success: true }
		} catch (error) {
			EditorLogger.error("Delete element failed", error)
			throw error
		}
	})

	// Duplicate element
	bridge.onCommand("DUPLICATE_ELEMENT", async (payload: unknown) => {
		try {
			const { selector } = payload as { selector: string }
			EditorLogger.info("Duplicate element command received", { selector })
			await styleManager.duplicateElement(selector)
			EditorLogger.info("Duplicate element completed", { selector })
			return { success: true }
		} catch (error) {
			EditorLogger.error("Duplicate element failed", error)
			throw error
		}
	})

	// Apply text style (to selected text portion)
	bridge.onCommand("APPLY_TEXT_STYLE", async (payload: unknown) => {
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
}
