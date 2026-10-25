import { useCallback, useEffect, useState } from "react"

const activitySubscribers = new Set<() => void>()
let pageVisible = true
let visibilityListenerAttached = false

function getPageVisibility() {
	return pageVisible
}

function handlePageVisibilityChange() {
	pageVisible = document.visibilityState !== "hidden"
	activitySubscribers.forEach((subscriber) => subscriber())
}

function subscribePageVisibility(onStoreChange: () => void) {
	activitySubscribers.add(onStoreChange)
	if (!visibilityListenerAttached && typeof document !== "undefined") {
		pageVisible = document.visibilityState !== "hidden"
		document.addEventListener("visibilitychange", handlePageVisibilityChange)
		visibilityListenerAttached = true
	}

	return () => {
		activitySubscribers.delete(onStoreChange)
		if (activitySubscribers.size === 0 && visibilityListenerAttached) {
			document.removeEventListener("visibilitychange", handlePageVisibilityChange)
			visibilityListenerAttached = false
		}
	}
}

interface UseHtmlCodeBlockPreviewActivityOptions {
	enabled: boolean
}

/**
 * Pauses expensive streaming commits when the card is outside the viewport or the
 * document is backgrounded. The callback ref observes the existing root element,
 * so no wrapper is added that could affect width measurement.
 */
export function useHtmlCodeBlockPreviewActivity(options: UseHtmlCodeBlockPreviewActivityOptions) {
	const { enabled } = options
	const [activityElement, setActivityElement] = useState<HTMLDivElement | null>(null)
	const [isElementNearViewport, setIsElementNearViewport] = useState(true)
	const [isPageVisible, setIsPageVisible] = useState(getPageVisibility)

	useEffect(() => subscribePageVisibility(() => setIsPageVisible(getPageVisibility())), [])

	useEffect(() => {
		if (!enabled || !activityElement || typeof IntersectionObserver === "undefined") {
			setIsElementNearViewport(true)
			return
		}

		const observer = new IntersectionObserver(
			([entry]) => setIsElementNearViewport(entry?.isIntersecting === true),
			{ root: null, rootMargin: "240px 0px", threshold: 0 },
		)
		observer.observe(activityElement)
		return () => observer.disconnect()
	}, [activityElement, enabled])

	const setPreviewActivityElement = useCallback((element: HTMLDivElement | null) => {
		setActivityElement(element)
	}, [])

	return {
		setPreviewActivityElement,
		isPreviewActive: enabled && isElementNearViewport && isPageVisible,
	}
}
