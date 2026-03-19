import type { ElementRect } from "../types"

/**
 * Size category for selection box
 * Used to determine which control handles to display
 */
export type SizeCategory = "small" | "medium" | "large"

/**
 * Size thresholds in pixels
 * These values determine when to hide/show certain controls
 */
const SIZE_THRESHOLDS = {
	SMALL: 60, // Below this: hide copy/delete handles
	MEDIUM: 120, // Below this: reduce number of resize handles
} as const

/**
 * Determine size category based on rect dimensions
 * Used to adaptively show/hide control handles
 */
export function getWidthSizeCategory(rect: ElementRect): SizeCategory {
	const size = rect.width

	if (size < SIZE_THRESHOLDS.SMALL) {
		return "small"
	}

	if (size < SIZE_THRESHOLDS.MEDIUM) {
		return "medium"
	}

	return "large"
}

/**
 * Check if copy/delete handles should be shown
 * Hidden when box is too small to avoid crowding
 */
export function shouldShowActionHandles(rect: ElementRect): boolean {
	return getWidthSizeCategory(rect) !== "small"
}
