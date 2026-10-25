import { useEffect, useRef, type RefObject } from "react"

export type PPTSwipeDirection = "prev" | "next"

interface UsePPTSwipeNavigationOptions {
	containerRef: RefObject<HTMLElement>
	/** The renderer iframe is a separate browsing context, so listen to it explicitly. */
	iframe?: HTMLIFrameElement | null
	enabled: boolean
	activationKey?: string | number | boolean
	onSwipe: (direction: PPTSwipeDirection) => void
}

const SWIPE_DISTANCE = 48

/**
 * Detect horizontal gestures without cancelling the browser's click/link handling.
 * A PPT slide is often rendered inside an iframe, therefore both the wrapper and
 * same-origin iframe document are wired when available.
 */
export function usePPTSwipeNavigation({
	containerRef,
	iframe,
	enabled,
	activationKey,
	onSwipe,
}: UsePPTSwipeNavigationOptions) {
	const startRef = useRef<{ x: number; y: number } | null>(null)

	useEffect(() => {
		if (!enabled) return

		const targets: EventTarget[] = []
		if (containerRef.current) targets.push(containerRef.current)
		if (iframe) {
			targets.push(iframe)
			try {
				if (iframe.contentDocument) targets.push(iframe.contentDocument)
			} catch {
				// Cross-origin previews report gestures through the preview-only message bridge.
			}
		}

		const handleMessage = (event: MessageEvent) => {
			if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return
			const origin = new URL(iframe.src || window.location.href, window.location.href).origin
			if (event.origin !== origin || event.data?.type !== "ppt-slide-swipe") return
			if (event.data.direction === "prev" || event.data.direction === "next")
				onSwipe(event.data.direction)
		}
		window.addEventListener("message", handleMessage)
		const handleTouchCancel = () => {
			startRef.current = null
		}
		const handleTouchStart = (event: Event) => {
			const touchEvent = event as TouchEvent
			if (touchEvent.touches.length !== 1) {
				startRef.current = null
				return
			}
			const touch = touchEvent.touches[0]
			startRef.current = { x: touch.clientX, y: touch.clientY }
		}
		const handleTouchEnd = (event: Event) => {
			const start = startRef.current
			startRef.current = null
			if (!start) return
			const touchEvent = event as TouchEvent
			const touch = touchEvent.changedTouches[0]
			if (!touch) return
			const deltaX = touch.clientX - start.x
			const deltaY = touch.clientY - start.y
			if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY)) return
			onSwipe(deltaX < 0 ? "next" : "prev")
		}

		for (const target of targets) {
			target.addEventListener("touchstart", handleTouchStart, { passive: true })
			target.addEventListener("touchend", handleTouchEnd, { passive: true })
			target.addEventListener("touchcancel", handleTouchCancel, { passive: true })
		}
		return () => {
			window.removeEventListener("message", handleMessage)
			startRef.current = null
			for (const target of targets) {
				target.removeEventListener("touchstart", handleTouchStart)
				target.removeEventListener("touchend", handleTouchEnd)
				target.removeEventListener("touchcancel", handleTouchCancel)
			}
		}
	}, [activationKey, containerRef, enabled, iframe, onSwipe])
}
