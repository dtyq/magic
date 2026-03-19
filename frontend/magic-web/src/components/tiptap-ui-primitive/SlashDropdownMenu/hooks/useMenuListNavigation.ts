import { useRef, useEffect, useCallback } from "react"
import { scrollElementIntoView } from "../utils"

/**
 * Hook for handling menu list keyboard navigation and scrolling
 */
export function useMenuListNavigation(selectedIndex: number) {
	const listRef = useRef<HTMLDivElement>(null)
	const selectedItemRef = useRef<HTMLDivElement>(null)

	// Handle keyboard navigation scrolling
	useEffect(() => {
		if (selectedItemRef.current && listRef.current) {
			scrollElementIntoView(selectedItemRef.current, listRef.current)
		}
	}, [selectedIndex])

	// Get ref for selected item
	const getItemRef = useCallback(
		(isSelected: boolean) => (isSelected ? selectedItemRef : null),
		[],
	)

	return {
		listRef,
		selectedItemRef,
		getItemRef,
	}
}
