import { useState, useEffect, useCallback, useRef } from "react"
import { useMemoizedFn } from "ahooks"

// Constants for layout calculation
const LAYOUT_CONSTANTS = {
	GAP: 4,
	MORE_BUTTON_MIN_WIDTH: 28,
	MAX_ROWS: 2,
	MAX_ITEM_WIDTH: 150,
} as const

interface UseMentionVisibilityOptions {
	itemCount: number
	containerRef: React.RefObject<HTMLDivElement>
}

interface MentionVisibilityResult {
	maxVisible: number
	calculateMaxVisible: () => void
}

/**
 * Custom hook for calculating mention item visibility in a flex-wrap layout
 * Determines how many items can fit in 2 rows before showing "more" button
 */
export function useMentionVisibility({
	itemCount,
	containerRef,
}: UseMentionVisibilityOptions): MentionVisibilityResult {
	const [maxVisible, setMaxVisible] = useState(0)
	const measurementCache = useRef<Map<number, number>>(new Map())

	/**
	 * Get cached width or measure element width
	 */
	const getElementWidth = useCallback((element: HTMLElement, index: number): number => {
		const cached = measurementCache.current.get(index)
		if (cached !== undefined) return cached

		const width = Math.min(element.offsetWidth, LAYOUT_CONSTANTS.MAX_ITEM_WIDTH)
		measurementCache.current.set(index, width)
		return width
	}, [])

	/**
	 * Calculate how many items fit in one row
	 */
	const calculateRowCapacity = useCallback(
		(
			containerWidth: number,
			startIndex: number,
			itemElements: NodeListOf<Element>,
			includeMoreButton: boolean = false,
		): number => {
			let currentRowWidth = 0
			let itemsInRow = 0
			const moreButtonWidth = includeMoreButton ? LAYOUT_CONSTANTS.MORE_BUTTON_MIN_WIDTH : 0

			for (let i = startIndex; i < itemElements.length; i++) {
				const element = itemElements[i] as HTMLElement
				const itemWidth = getElementWidth(element, i)
				const isFirstItem = itemsInRow === 0
				const widthWithGap = isFirstItem ? itemWidth : itemWidth + LAYOUT_CONSTANTS.GAP

				// Check if item + potential more button fits
				const totalWidth =
					currentRowWidth +
					widthWithGap +
					(includeMoreButton ? LAYOUT_CONSTANTS.GAP + moreButtonWidth : 0)

				if (totalWidth <= containerWidth) {
					currentRowWidth += widthWithGap
					itemsInRow++
				} else {
					break
				}
			}

			return itemsInRow
		},
		[getElementWidth],
	)

	/**
	 * Main calculation function - simplified and more readable
	 */
	const calculateMaxVisible = useMemoizedFn(() => {
		// Early returns for edge cases
		if (!containerRef.current || itemCount === 0) {
			setMaxVisible(0)
			return
		}

		const containerWidth = containerRef.current.offsetWidth
		const itemElements = containerRef.current.querySelectorAll("[data-mention-item='hidden']")

		if (itemElements.length === 0) {
			setMaxVisible(0)
			return
		}

		// Single item always visible
		if (itemElements.length === 1) {
			setMaxVisible(1)
			return
		}

		// Calculate first row capacity
		const firstRowCapacity = calculateRowCapacity(containerWidth, 0, itemElements)

		// If all items fit in first row
		if (firstRowCapacity >= itemElements.length) {
			setMaxVisible(itemElements.length)
			return
		}

		// Calculate second row capacity (need to consider more button)
		const secondRowStart = firstRowCapacity
		const remainingItems = itemElements.length - firstRowCapacity

		if (remainingItems <= 0) {
			setMaxVisible(firstRowCapacity)
			return
		}

		// Try to fit remaining items in second row with more button
		const secondRowCapacity = calculateRowCapacity(
			containerWidth,
			secondRowStart,
			itemElements,
			true, // Include more button width
		)

		// If we can fit some items in second row
		const totalVisible = firstRowCapacity + Math.max(0, secondRowCapacity)

		// Ensure we don't show more button for just one hidden item unless necessary
		if (itemElements.length - totalVisible === 1 && secondRowCapacity === 0) {
			// Try without more button constraint for the last item
			const secondRowWithoutMore = calculateRowCapacity(
				containerWidth,
				secondRowStart,
				itemElements,
				false,
			)

			if (secondRowWithoutMore > 0) {
				setMaxVisible(firstRowCapacity + secondRowWithoutMore)
				return
			}
		}

		setMaxVisible(Math.min(totalVisible, itemElements.length))
	})

	// Clear cache when item count changes
	useEffect(() => {
		measurementCache.current.clear()
	}, [itemCount])

	// Recalculate when container size or item count changes
	useEffect(() => {
		calculateMaxVisible()
	}, [calculateMaxVisible, itemCount])

	return {
		maxVisible,
		calculateMaxVisible,
	}
}
