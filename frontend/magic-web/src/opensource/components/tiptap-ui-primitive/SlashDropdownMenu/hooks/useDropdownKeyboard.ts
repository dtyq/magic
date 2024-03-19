import { useState, useCallback } from "react"
import type { SuggestionKeyDownProps } from "@tiptap/suggestion"
import type { SuggestionItem } from "../types"

/**
 * Hook for handling dropdown keyboard navigation
 */
export function useDropdownKeyboard(
	filteredItems: SuggestionItem[],
	onSelect?: (item: SuggestionItem) => void,
	onExit?: () => void,
) {
	const [selectedIndex, setSelectedIndex] = useState(0)

	// Handle item selection
	const handleSelectItem = useCallback(
		(item: SuggestionItem) => {
			onSelect?.(item)
		},
		[onSelect],
	)

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(props: SuggestionKeyDownProps): boolean => {
			const { event } = props

			// Don't handle if no items
			if (filteredItems.length === 0) {
				return false
			}

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault()
					setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0))
					return true

				case "ArrowUp":
					event.preventDefault()
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1))
					return true

				case "Enter":
					event.preventDefault()
					if (filteredItems[selectedIndex]) {
						handleSelectItem(filteredItems[selectedIndex])
					}
					return true

				case "Escape":
					event.preventDefault()
					onExit?.()
					return true

				case "Tab":
					// Allow tab to close menu and continue
					onExit?.()
					return false

				default:
					return false
			}
		},
		[filteredItems, selectedIndex, handleSelectItem, onExit],
	)

	// Reset selected index when items change
	const resetSelection = useCallback(() => {
		setSelectedIndex(0)
	}, [])

	return {
		selectedIndex,
		setSelectedIndex,
		handleSelectItem,
		handleKeyDown,
		resetSelection,
	}
}
