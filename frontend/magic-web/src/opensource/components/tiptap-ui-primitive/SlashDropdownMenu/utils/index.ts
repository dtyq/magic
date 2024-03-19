import type { SuggestionItem } from "../types"

/**
 * Type for render items in the menu list
 */
export interface RenderItem {
	type: "group" | "item"
	data: string | SuggestionItem
	key: string
}

/**
 * Group items by their group property for rendering
 * This function creates render items that include both group headers and menu items
 */
export function groupItemsForRender(items: SuggestionItem[], showGroups: boolean): RenderItem[] {
	if (!showGroups) {
		return items.map((item, index) => ({
			type: "item" as const,
			data: item,
			key: `item-${item.id}-${index}`,
		}))
	}

	const grouped: Record<string, SuggestionItem[]> = {}

	// Group items
	items.forEach((item) => {
		const group = item.group || "Other"
		if (!grouped[group]) {
			grouped[group] = []
		}
		grouped[group].push(item)
	})

	// Sort groups and create render array
	const renderItems: RenderItem[] = []
	const sortedGroups = Object.keys(grouped).sort()

	sortedGroups.forEach((groupName, groupIndex) => {
		// Add group header
		renderItems.push({
			type: "group",
			data: groupName,
			key: `group-${groupName}`,
		})

		// Add group items
		grouped[groupName].forEach((item, itemIndex) => {
			renderItems.push({
				type: "item",
				data: item,
				key: `item-${item.id}-${groupIndex}-${itemIndex}`,
			})
		})
	})

	return renderItems
}

/**
 * Calculate actual item indices excluding group headers
 * Returns a mapping from render item index to actual item index
 */
export function calculateItemIndices(renderItems: RenderItem[]): Record<number, number> {
	const itemIndices: Record<number, number> = {}
	let currentItemIndex = 0

	renderItems.forEach((renderItem, index) => {
		if (renderItem.type === "item") {
			itemIndices[index] = currentItemIndex
			currentItemIndex++
		}
	})

	return itemIndices
}

/**
 * Calculate position for dropdown based on decoration node
 */
export function calculateDropdownPosition(decorationNode: Element | null): {
	top: number
	left: number
} {
	if (!decorationNode) {
		return { top: 0, left: 0 }
	}

	const rect = decorationNode.getBoundingClientRect()
	const viewportHeight = window.innerHeight
	const viewportWidth = window.innerWidth
	const dropdownHeight = 300 // Estimated height
	const dropdownWidth = 280 // Estimated width

	let top = rect.bottom + 4
	let left = rect.left

	// If dropdown would go below viewport, position it above
	if (top + dropdownHeight > viewportHeight - 20) {
		top = rect.top - dropdownHeight - 4
	}

	// Ensure dropdown doesn't go off-screen horizontally
	if (left + dropdownWidth > viewportWidth - 20) {
		left = viewportWidth - dropdownWidth - 20
	}

	// Ensure minimum margins
	top = Math.max(10, top)
	left = Math.max(10, left)

	return { top, left }
}

/**
 * Check if an element is visible within its container
 */
export function isElementInViewport(
	element: Element,
	container: Element,
): { isVisible: boolean; position: "above" | "below" | "inside" } {
	const containerRect = container.getBoundingClientRect()
	const elementRect = element.getBoundingClientRect()

	const isAbove = elementRect.bottom < containerRect.top
	const isBelow = elementRect.top > containerRect.bottom
	const isInside = !isAbove && !isBelow

	return {
		isVisible: isInside,
		position: isAbove ? "above" : isBelow ? "below" : "inside",
	}
}

/**
 * Scroll element into view smoothly within container
 */
export function scrollElementIntoView(
	element: Element,
	container: Element,
	behavior: ScrollBehavior = "smooth",
): void {
	const { isVisible, position } = isElementInViewport(element, container)

	if (!isVisible) {
		element.scrollIntoView({
			block: "nearest",
			behavior,
		})
	}
}
