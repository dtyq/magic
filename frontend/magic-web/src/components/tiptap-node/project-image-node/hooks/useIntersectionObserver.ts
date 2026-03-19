import * as React from "react"
import { INTERSECTION_OBSERVER_CONFIG } from "../constants"

interface UseIntersectionObserverOptions {
	threshold?: number
	rootMargin?: string
	viewportMargin?: number
}

/**
 * Custom hook for Intersection Observer with initial viewport check
 * Returns true when element enters viewport
 */
export function useIntersectionObserver(
	elementRef: React.RefObject<HTMLElement>,
	options: UseIntersectionObserverOptions = {},
): boolean {
	const {
		threshold = INTERSECTION_OBSERVER_CONFIG.THRESHOLD,
		rootMargin = INTERSECTION_OBSERVER_CONFIG.ROOT_MARGIN,
		viewportMargin = INTERSECTION_OBSERVER_CONFIG.VIEWPORT_MARGIN,
	} = options

	const [isIntersecting, setIsIntersecting] = React.useState(false)

	React.useEffect(() => {
		const element = elementRef.current
		if (!element) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsIntersecting(true)
				}
			},
			{ threshold, rootMargin },
		)

		observer.observe(element)

		// Check if element is already in viewport on mount
		const rect = element.getBoundingClientRect()
		const isInViewport =
			rect.top >= -viewportMargin &&
			rect.left >= -viewportMargin &&
			rect.bottom <=
				(window.innerHeight || document.documentElement.clientHeight) + viewportMargin &&
			rect.right <=
				(window.innerWidth || document.documentElement.clientWidth) + viewportMargin

		if (isInViewport) {
			setIsIntersecting(true)
		}

		return () => {
			observer.disconnect()
		}
	}, [elementRef, threshold, rootMargin, viewportMargin])

	return isIntersecting
}
