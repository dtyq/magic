import { useCallback, useEffect, useRef, useState } from "react"

interface UsePullToNavigateOptions {
	/** Callback function when navigation is triggered */
	onRefresh?: () => Promise<void> | void
	/** Callback function before navigation is triggered */
	onNavigateBefore?: () => void
	/** Callback function after navigation is triggered */
	onNavigateAfter?: () => void
	/** Callback function when pull starts */
	onStart?: () => void
	/** Callback function when pull ends */
	onEnd?: (success: boolean) => void
	/** Threshold distance to trigger navigation (in pixels) */
	threshold?: number
	/** Maximum pull distance (in pixels) */
	maxDistance?: number
	/** Whether pull to navigate is disabled */
	disabled?: boolean
	/** Resistance factor for pull distance calculation */
	resistance?: number
	/** Whether to respect scrollable children elements */
	respectScrollableChildren?: boolean
}

interface UsePullToNavigateReturn {
	/** Whether pull to navigate is active */
	isActive: boolean
	/** Current pull distance (0-100 percentage) */
	pullDistance: number
	/** Raw pull distance in pixels */
	rawPullDistance: number
	/** Whether currently navigating */
	isRefreshing: boolean
	/** Whether in exit animation state */
	isExiting: boolean
	/** Ref to attach to the scrollable container */
	containerRef: React.MutableRefObject<HTMLElement | null>
	/** Function to set the container element */
	setContainer: (element: HTMLElement | null) => void
	/** Manual trigger navigation */
	triggerRefresh: () => void
}

// Helper function to check if an element is scrollable
function isElementScrollable(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element)
	const overflowY = style.overflowY
	const hasVerticalScrollbar = element.scrollHeight > element.clientHeight

	return (
		hasVerticalScrollbar &&
		(overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")
	)
}

// Helper function to find the closest scrollable parent
function findScrollableParent(element: HTMLElement, container: HTMLElement): HTMLElement | null {
	let current = element

	while (current && current !== container && current !== document.body) {
		if (isElementScrollable(current)) {
			return current
		}
		current = current.parentElement as HTMLElement
	}

	return null
}

// Helper function to check if a scrollable element can scroll up
function canScrollUp(element: HTMLElement): boolean {
	return element.scrollTop > 0
}

// Helper function to check if touch target is within PinnedMessages or UserHeader area
function isInFixedArea(element: HTMLElement | null, container: HTMLElement): boolean {
	if (!element) return false

	let current: HTMLElement | null = element
	while (current && current !== container && current !== document.body) {
		const className = current.className
		const classList = Array.from(current.classList || [])

		// Check if element is in PinnedMessages or UserHeader area
		// Match class names that contain "pinnedMessage", "pinned-message", or "userHeader"
		const isPinnedMessage =
			(typeof className === "string" && className.includes("pinnedMessageList")) ||
			classList.some((cls) => cls.includes("pinnedMessageList"))

		const isUserHeader =
			(typeof className === "string" && className.includes("userHeader")) ||
			classList.some((cls) => cls.includes("userHeader"))

		if (isPinnedMessage || isUserHeader) {
			return true
		}
		current = current.parentElement
	}

	return false
}

function usePullToNavigate({
	onRefresh,
	onNavigateBefore,
	onNavigateAfter,
	onStart,
	onEnd,
	threshold = 80,
	maxDistance = 120,
	disabled = false,
	resistance = 0.5,
	respectScrollableChildren = true,
}: UsePullToNavigateOptions = {}): UsePullToNavigateReturn {
	const [isActive, setIsActive] = useState(false)
	const [pullDistance, setPullDistance] = useState(0)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isExiting, setIsExiting] = useState(false)

	const containerRef = useRef<HTMLElement | null>(null)
	const startY = useRef(0)
	const currentY = useRef(0)
	const isPulling = useRef(false)
	const initialScrollTop = useRef(0)
	const touchTarget = useRef<HTMLElement | null>(null)
	const prevDisabledRef = useRef(disabled)

	// Calculate pull distance percentage
	const pullPercentage = Math.min((pullDistance / threshold) * 100, 100)

	// Reset pull state when disabled changes from false to true
	useEffect(() => {
		// If disabled changes from false to true, reset all pull state
		if (prevDisabledRef.current === false && disabled === true) {
			if (isPulling.current || isActive) {
				// Trigger onEnd callback if pull was active
				if (isPulling.current) {
					onEnd?.(false)
				}
				setIsActive(false)
				setPullDistance(0)
				isPulling.current = false
				startY.current = 0
				currentY.current = 0
				initialScrollTop.current = 0
				touchTarget.current = null
			}
		}
		prevDisabledRef.current = disabled
	}, [disabled, isActive, onEnd])

	const handleTouchStart = useCallback(
		(e: TouchEvent) => {
			const container = containerRef.current
			if (!container) {
				return
			}

			const touchElement = e.target as HTMLElement
			const touchInFixedArea = isInFixedArea(touchElement, container)

			// If disabled and not in fixed area, block touch start
			if (disabled && !touchInFixedArea) {
				return
			}

			if (isRefreshing) {
				return
			}

			// Record the touch target
			touchTarget.current = touchElement

			// Record initial scroll position
			initialScrollTop.current = container.scrollTop
			startY.current = e.touches[0].clientY
			currentY.current = startY.current
		},
		[disabled, isRefreshing],
	)

	const handleTouchMove = useCallback(
		(e: TouchEvent) => {
			if (isRefreshing || !startY.current) {
				return
			}

			const container = containerRef.current
			if (!container) {
				return
			}

			// Check if touch target is in fixed area
			const touchInFixedArea = touchTarget.current
				? isInFixedArea(touchTarget.current, container)
				: false

			// If disabled and not in fixed area, block touch move
			if (disabled && !touchInFixedArea) {
				return
			}

			currentY.current = e.touches[0].clientY
			const deltaY = currentY.current - startY.current

			// Only allow pull down when:
			// 1. We started at the top (initialScrollTop === 0) OR touch is in fixed area
			// 2. Current scroll is still at top (scrollTop <= 0) OR touch is in fixed area
			// 3. Moving downward (deltaY > 0)
			if (
				!touchInFixedArea &&
				(initialScrollTop.current > 0 || container.scrollTop > 0 || deltaY <= 0)
			) {
				if (isPulling.current) {
					setIsActive(false)
					setPullDistance(0)
					isPulling.current = false
				}
				return
			}

			// Check if we should respect scrollable children
			if (respectScrollableChildren && touchTarget.current) {
				// If touch target is in fixed area, allow pull to navigate without checking scrollable children
				if (touchInFixedArea) {
					// Allow pull to navigate, don't check scrollable children
				} else {
					// Check scrollable children as usual
					const scrollableParent = findScrollableParent(touchTarget.current, container)

					// If there's a scrollable parent that can still scroll up, don't interfere
					if (scrollableParent && canScrollUp(scrollableParent)) {
						if (isPulling.current) {
							setIsActive(false)
							setPullDistance(0)
							isPulling.current = false
						}
						return
					}
				}
			}

			// Start pulling when moved down enough
			if (deltaY > 5) {
				// Prevent default scroll behavior when pulling
				e.preventDefault()

				if (!isPulling.current) {
					isPulling.current = true
					setIsActive(true)
					// Trigger onStart callback when pull starts
					onStart?.()
				}

				// Apply resistance to the pull distance
				// Use a progressive resistance formula for better feel
				let resistedDistance
				if (deltaY <= maxDistance) {
					// Normal resistance within maxDistance
					resistedDistance = deltaY * resistance
				} else {
					// Progressive resistance beyond maxDistance
					const baseDistance = maxDistance * resistance
					const extraDistance = (deltaY - maxDistance) * resistance * 0.3
					resistedDistance = baseDistance + extraDistance
				}

				setPullDistance(resistedDistance)
			}
		},
		[disabled, isRefreshing, resistance, maxDistance, onStart, respectScrollableChildren],
	)

	const handleTouchEnd = useCallback(async () => {
		if (isRefreshing || !isPulling.current) {
			return
		}

		// Check if touch target is in fixed area
		const container = containerRef.current
		const touchInFixedArea =
			container && touchTarget.current ? isInFixedArea(touchTarget.current, container) : false

		// If disabled and not in fixed area, block touch end
		if (disabled && !touchInFixedArea) {
			return
		}

		const shouldRefresh = pullDistance >= threshold

		if (shouldRefresh && onRefresh) {
			// Start exit animation
			setIsExiting(true)
			setIsRefreshing(true)

			onNavigateBefore?.()

			// Wait for exit animation to complete
			await new Promise((resolve) => setTimeout(resolve, 300))

			try {
				await onRefresh()
			} catch (error) {
				console.error("Pull to navigate error:", error)
			} finally {
				setIsRefreshing(false)
				setIsExiting(false)
				onNavigateAfter?.()
			}
		}

		// Reset state with smooth transition
		setIsActive(false)
		setPullDistance(0)
		isPulling.current = false
		startY.current = 0
		currentY.current = 0
		initialScrollTop.current = 0
		touchTarget.current = null

		// Trigger onEnd callback when pull ends
		onEnd?.(shouldRefresh)
	}, [disabled, isRefreshing, pullDistance, threshold, onRefresh, onEnd])

	const triggerRefresh = useCallback(async () => {
		if (disabled || isRefreshing || !onRefresh) return

		setIsRefreshing(true)
		try {
			await onRefresh()
		} catch (error) {
			console.error("Manual refresh error:", error)
		} finally {
			setIsRefreshing(false)
		}
	}, [disabled, isRefreshing, onRefresh])

	const setContainer = useCallback((element: HTMLElement | null) => {
		containerRef.current = element
	}, [])

	useEffect(() => {
		const container = containerRef.current
		if (!container) {
			return
		}

		// Add touch event listeners
		const touchStartOptions = { passive: false, capture: false }
		const touchMoveOptions = { passive: false, capture: false }
		const touchEndOptions = { passive: true, capture: false }

		container.addEventListener("touchstart", handleTouchStart, touchStartOptions)
		container.addEventListener("touchmove", handleTouchMove, touchMoveOptions)
		container.addEventListener("touchend", handleTouchEnd, touchEndOptions)
		container.addEventListener("touchcancel", handleTouchEnd, touchEndOptions)

		return () => {
			container.removeEventListener("touchstart", handleTouchStart)
			container.removeEventListener("touchmove", handleTouchMove)
			container.removeEventListener("touchend", handleTouchEnd)
			container.removeEventListener("touchcancel", handleTouchEnd)
		}
	}, [handleTouchStart, handleTouchMove, handleTouchEnd])

	return {
		isActive,
		pullDistance: pullPercentage,
		rawPullDistance: pullDistance,
		isRefreshing,
		isExiting,
		containerRef,
		setContainer,
		triggerRefresh,
	}
}

export default usePullToNavigate
