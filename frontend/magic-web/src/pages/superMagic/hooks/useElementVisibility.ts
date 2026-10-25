import { useEffect, useState, type RefObject } from "react"

interface UseElementVisibilityOptions {
	enabled?: boolean
	initialVisible?: boolean
	root?: Element | null
	rootRef?: RefObject<Element | null>
	rootMargin?: string
	threshold?: number | number[]
	minimumIntersectionRatio?: number
	requireDocumentVisible?: boolean
}

type ElementVisibilityTarget<T extends HTMLElement> = RefObject<T | null> | T | null

function resolveElement<T extends HTMLElement>(target: ElementVisibilityTarget<T>) {
	if (!target) return null
	return "current" in target ? target.current : target
}

/** Returns whether the referenced element is currently visible in the viewport. */
export function useElementVisibility<T extends HTMLElement>(
	target: ElementVisibilityTarget<T>,
	options: UseElementVisibilityOptions = {},
) {
	const {
		enabled = true,
		initialVisible = false,
		root = null,
		rootRef,
		rootMargin = "0px",
		threshold = 0,
		minimumIntersectionRatio = 0,
		requireDocumentVisible = false,
	} = options
	const [visibility, setVisibility] = useState<{
		element: T | null
		isVisible: boolean
	}>({ element: null, isVisible: initialVisible })

	useEffect(() => {
		const element = resolveElement(target)
		if (!enabled) {
			setVisibility({ element, isVisible: initialVisible })
			return
		}

		if (!element) {
			setVisibility({ element: null, isVisible: initialVisible })
			return
		}
		const observerRoot = rootRef?.current ?? root
		if (rootRef && !observerRoot) return

		let isIntersecting = false
		const publishVisibility = () => {
			const isDocumentVisible =
				!requireDocumentVisible || document.visibilityState === "visible"
			setVisibility({ element, isVisible: isIntersecting && isDocumentVisible })
		}

		if (typeof IntersectionObserver === "undefined") {
			// Older WebViews cannot observe intersections. Treat a mounted target as intersecting,
			// while still respecting the page-visibility gate requested by analytics callers.
			isIntersecting = true
			publishVisibility()
			if (requireDocumentVisible)
				document.addEventListener("visibilitychange", publishVisibility)
			return () => document.removeEventListener("visibilitychange", publishVisibility)
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				const intersectionRatio =
					entry?.intersectionRatio ?? (entry?.isIntersecting ? 1 : 0)
				isIntersecting =
					Boolean(entry?.isIntersecting) && intersectionRatio >= minimumIntersectionRatio
				publishVisibility()
			},
			{ root: observerRoot, rootMargin, threshold },
		)
		observer.observe(element)
		if (requireDocumentVisible) document.addEventListener("visibilitychange", publishVisibility)

		return () => {
			observer.disconnect()
			document.removeEventListener("visibilitychange", publishVisibility)
		}
	}, [
		enabled,
		initialVisible,
		minimumIntersectionRatio,
		requireDocumentVisible,
		root,
		rootMargin,
		rootRef,
		target,
		threshold,
	])

	const element = resolveElement(target)
	// A callback ref may replace one portal/card with another before the observer callback runs.
	// Never leak the previous node's visible state into the newly rendered onboarding step.
	return visibility.element === element ? visibility.isVisible : initialVisible
}
