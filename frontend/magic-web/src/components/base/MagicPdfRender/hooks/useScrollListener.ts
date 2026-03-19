import { useEffect, useRef, useCallback } from "react"

interface UseScrollListenerProps {
	viewerRef: React.RefObject<HTMLDivElement>
	numPages: number
	pageNumber: number
	setPageNumber: (page: number) => void
	disabled?: boolean
	isScaling?: boolean // 是否正在缩放
	isStabilizing?: boolean // 是否在稳定期（缩放完成后的稳定期）
}

export function useScrollListener({
	viewerRef,
	numPages,
	pageNumber,
	setPageNumber,
	disabled = false,
	isScaling = false,
	isStabilizing = false,
}: UseScrollListenerProps) {
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
	const lastScrollTimeRef = useRef<number>(0)
	const isCalculatingRef = useRef<boolean>(false)
	const lastCalculatedPageRef = useRef<number>(pageNumber)
	const lastScrollPositionRef = useRef<number>(0)

	// Debounced scroll handler to avoid excessive calculations
	const debouncedHandleScroll = useCallback(() => {
		// Clear existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		// Set new timer with adaptive delay based on scroll state
		const delay = isStabilizing ? 300 : isScaling ? 500 : 100 // Reduced from 150 to 100 for faster response

		debounceTimerRef.current = setTimeout(() => {
			const viewer = viewerRef.current
			if (
				!viewer ||
				numPages === 0 ||
				disabled ||
				isScaling ||
				isStabilizing ||
				isCalculatingRef.current
			) {
				return
			}

			isCalculatingRef.current = true

			try {
				const viewerRect = viewer.getBoundingClientRect()
				const viewerCenter = viewerRect.top + viewerRect.height / 2
				const currentScrollTop = viewer.scrollTop

				// Detect fast scrolling by comparing scroll position change
				const scrollDelta = Math.abs(currentScrollTop - lastScrollPositionRef.current)
				const isFastScrolling = scrollDelta > viewerRect.height * 2 // Scrolled more than 2 viewport heights
				lastScrollPositionRef.current = currentScrollTop

				// Find the page closest to the viewer center
				let closestPage = pageNumber // Start with current page as default
				let minDistance = Infinity

				// Prioritize current page - give it a slight advantage
				const currentPageElement = viewer.querySelector(
					`[data-page-number="${pageNumber}"]`,
				)
				if (currentPageElement) {
					const pageRect = currentPageElement.getBoundingClientRect()
					const pageCenter = pageRect.top + pageRect.height / 2
					const distance = Math.abs(pageCenter - viewerCenter)

					// Give current page a 20% advantage to prevent unnecessary jumping
					const adjustedDistance = distance * 0.8

					if (adjustedDistance < minDistance) {
						minDistance = adjustedDistance
						closestPage = pageNumber
					}
				}

				// Check a larger range around current page, but expand for fast scrolling
				const baseRange = Math.min(5, Math.ceil(numPages / 3))
				const checkRange = Math.max(baseRange, 8) // Ensure minimum range of 8 pages
				const startPage = Math.max(1, pageNumber - checkRange)
				const endPage = Math.min(numPages, pageNumber + checkRange)

				for (let i = startPage; i <= endPage; i++) {
					if (i === pageNumber) continue // Already checked above

					const pageElement = viewer.querySelector(`[data-page-number="${i}"]`)
					if (pageElement) {
						const pageRect = pageElement.getBoundingClientRect()
						const pageCenter = pageRect.top + pageRect.height / 2
						const distance = Math.abs(pageCenter - viewerCenter)

						if (distance < minDistance) {
							minDistance = distance
							closestPage = i
						}
					}
				}

				// If no better page found in range, do a full scan
				// Trigger full scan more aggressively for fast scrolling scenarios
				const timeSinceLastScan = Date.now() - lastScrollTimeRef.current
				const shouldFullScan =
					isFastScrolling || // Always full scan on fast scrolling
					(closestPage === pageNumber && timeSinceLastScan > 1000) || // No page change and enough time passed
					(minDistance > viewerRect.height * 0.8 && timeSinceLastScan > 500) // Current page is far from center

				if (shouldFullScan) {
					for (let i = 1; i <= numPages; i++) {
						if (i >= startPage && i <= endPage) continue // Skip already checked

						const pageElement = viewer.querySelector(`[data-page-number="${i}"]`)
						if (pageElement) {
							const pageRect = pageElement.getBoundingClientRect()
							const pageCenter = pageRect.top + pageRect.height / 2
							const distance = Math.abs(pageCenter - viewerCenter)

							if (distance < minDistance) {
								minDistance = distance
								closestPage = i
							}
						}
					}
					lastScrollTimeRef.current = Date.now()
				}

				// Only change page if there's a significant difference
				const shouldChangePage =
					closestPage !== pageNumber && minDistance < viewerRect.height * 0.6 // Only change if page is reasonably centered

				if (shouldChangePage) {
					setPageNumber(closestPage)
					lastCalculatedPageRef.current = closestPage
				}
			} catch (error) {
				console.warn("ScrollListener: Error during page calculation:", error)
			} finally {
				isCalculatingRef.current = false
			}
		}, delay)
	}, [viewerRef, numPages, pageNumber, setPageNumber, disabled, isScaling, isStabilizing])

	// Update last calculated page when pageNumber changes externally
	useEffect(() => {
		lastCalculatedPageRef.current = pageNumber
	}, [pageNumber])

	// Scroll listener to automatically update current page number
	useEffect(() => {
		const viewer = viewerRef.current
		if (!viewer || numPages === 0 || disabled) return

		const handleScroll = () => {
			// Skip if scaling, stabilizing or recently calculated
			if (isScaling || isStabilizing || isCalculatingRef.current) {
				return
			}

			debouncedHandleScroll()
		}

		// Use passive listener for better performance
		viewer.addEventListener("scroll", handleScroll, { passive: true })

		return () => {
			viewer.removeEventListener("scroll", handleScroll)
			// Clear any pending debounce timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [
		numPages,
		pageNumber,
		setPageNumber,
		viewerRef,
		disabled,
		isScaling,
		isStabilizing,
		debouncedHandleScroll,
	])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [])
}
