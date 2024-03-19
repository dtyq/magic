import { useRef, useCallback } from "react"

/**
 * Scroll synchronization hook
 * Synchronizes scrolling across multiple scroll containers based on scroll percentage
 */
export function useScrollSync() {
	// Store refs to all scroll containers
	const scrollersRef = useRef<Map<string, HTMLElement>>(new Map())
	// Flag to prevent circular scroll event triggering
	const isSyncingRef = useRef(false)
	// Store pending animation frame ID
	const rafIdRef = useRef<number | null>(null)

	/**
	 * Register a scroll container
	 */
	const registerScroller = useCallback((id: string, element: HTMLElement | null) => {
		if (element) {
			scrollersRef.current.set(id, element)
		} else {
			scrollersRef.current.delete(id)
		}
	}, [])

	/**
	 * Handle scroll event from source container
	 * Sync other containers to the same scroll percentage
	 */
	const handleScroll = useCallback((sourceId: string) => {
		// If already syncing, skip to avoid circular triggering
		if (isSyncingRef.current) {
			return
		}

		// Cancel pending animation frame
		if (rafIdRef.current !== null) {
			cancelAnimationFrame(rafIdRef.current)
		}

		// Use requestAnimationFrame for performance optimization
		rafIdRef.current = requestAnimationFrame(() => {
			const sourceElement = scrollersRef.current.get(sourceId)
			if (!sourceElement) {
				return
			}

			const { scrollTop, scrollHeight, clientHeight } = sourceElement

			// Calculate scroll percentage
			const maxScroll = scrollHeight - clientHeight
			if (maxScroll <= 0) {
				return
			}

			const scrollPercentage = scrollTop / maxScroll

			// Set syncing flag to prevent circular triggering
			isSyncingRef.current = true

			// Sync all other scroll containers
			scrollersRef.current.forEach((element, id) => {
				if (id !== sourceId) {
					const targetMaxScroll = element.scrollHeight - element.clientHeight
					if (targetMaxScroll > 0) {
						element.scrollTop = scrollPercentage * targetMaxScroll
					}
				}
			})

			// Reset syncing flag after a short delay
			// Use setTimeout to ensure all scroll events have been processed
			setTimeout(() => {
				isSyncingRef.current = false
			}, 50)
		})
	}, [])

	return {
		registerScroller,
		handleScroll,
	}
}
