/**
 * Selection Handlers
 * Handles element selection and style query operations
 */

import type { EditorBridge } from "../core/EditorBridge"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"
import { normalizeColor, normalizeTextAlign } from "../utils/css"

interface SelectionHandlersConfig {
	bridge: EditorBridge
}

export function registerSelectionHandlers(config: SelectionHandlersConfig): void {
	const { bridge } = config

	// Get computed styles
	bridge.onRequest("GET_COMPUTED_STYLES", async (payload: unknown) => {
		const { selector } = payload as { selector: string }
		const element = findElement(selector) as HTMLElement
		const computed = window.getComputedStyle(element)

		const styles: Record<string, string> = {}
		const importantProps = [
			// Text styles
			"color",
			"fontSize",
			"fontWeight",
			"fontFamily",
			"fontStyle",
			"lineHeight",
			"textAlign",
			"textDecoration",
			// Background
			"backgroundColor",
			"backgroundImage",
			// Layout
			"width",
			"height",
			"display",
			"position",
			// Spacing
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
			// Border
			"border",
			"borderWidth",
			"borderStyle",
			"borderColor",
			"borderRadius",
			// Flex layout
			"flexDirection",
			"justifyContent",
			"alignItems",
			"flexWrap",
			"gap",
			// Grid layout
			"gridTemplateColumns",
			"gridTemplateRows",
			"justifyItems",
			// Effects
			"opacity",
			"boxShadow",
			"textShadow",
			// Transform
			"transform",
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

		EditorLogger.info("Get computed styles", { selector, styles })
		return { styles }
	})
}
