/**
 * useElementInspector
 *
 * Standalone hook that drives Chrome-DevTools-style element inspection
 * inside an iframe. Communicates via postMessage using INSPECTOR_MSG constants.
 *
 * Usage:
 *   const inspector = useElementInspector({ iframeRef })
 *   // inspector.active — whether inspect mode is on
 *   // inspector.toggle() — start / stop
 *   // inspector.hoveredElement — info about the element under cursor
 *   // inspector.selectedElement — info about the clicked element
 */

import { useState, useCallback, useEffect, useRef } from "react"
import type { InspectedElementInfo, InspectedElementRect, InspectorScrollOffset } from "./types"
import { INSPECTOR_MSG } from "./types"

interface UseElementInspectorOptions {
	/** Ref to the target iframe */
	iframeRef: React.RefObject<HTMLIFrameElement | null>
	/** Origin used for parent ↔ iframe inspector messages. */
	targetOrigin?: string
}

interface UseElementInspectorReturn {
	/** Whether inspector mode is currently active */
	active: boolean
	/** Toggle inspector mode on/off */
	toggle: () => void
	/** Start inspector mode */
	start: () => void
	/** Stop inspector mode */
	stop: () => void
	/** Element currently under the cursor */
	hoveredElement: InspectedElementInfo | null
	/** Element that was clicked / selected */
	selectedElement: InspectedElementInfo | null
	/** Clear the selected element */
	clearSelection: () => void
	/** Update the small set of element selectors whose viewport rects should follow scrolling. */
	setTrackedSelectors: (selectors: string[]) => void
	/** Latest viewport rectangles reported by the iframe for tracked targets. */
	trackedRects: Record<string, InspectedElementRect>
	/** Latest iframe document scroll offset reported by the runtime. */
	iframeScrollOffset: InspectorScrollOffset | null
	/** Scroll an iframe element into view through the runtime. */
	scrollToSelector: (selector: string) => void
	/** Scroll the iframe document to an absolute position through the runtime. */
	scrollToPosition: (offset: InspectorScrollOffset) => void
}

function areRectsEqual(a: InspectedElementRect | undefined, b: InspectedElementRect): boolean {
	return Boolean(
		a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height,
	)
}

export function useElementInspector({
	iframeRef,
	targetOrigin,
}: UseElementInspectorOptions): UseElementInspectorReturn {
	const [active, setActive] = useState(false)
	const [hoveredElement, setHoveredElement] = useState<InspectedElementInfo | null>(null)
	const [selectedElement, setSelectedElement] = useState<InspectedElementInfo | null>(null)
	const [trackedRects, setTrackedRects] = useState<Record<string, InspectedElementRect>>({})
	const [iframeScrollOffset, setIframeScrollOffset] = useState<InspectorScrollOffset | null>(null)
	const activeRef = useRef(false)
	const trackedSelectorsRef = useRef<string[]>([])
	const inspectorTargetOrigin = targetOrigin ?? window.location.origin

	const postToIframe = useCallback(
		(message: Record<string, unknown>) => {
			try {
				iframeRef.current?.contentWindow?.postMessage(message, inspectorTargetOrigin)
			} catch {
				// The iframe may be disconnected or navigating across origins.
			}
		},
		[iframeRef, inspectorTargetOrigin],
	)

	const sendToIframe = useCallback(
		(type: string, payload?: Record<string, unknown>) => {
			postToIframe({ type, ...payload, timestamp: Date.now() })
		},
		[postToIframe],
	)

	const start = useCallback(() => {
		setActive(true)
		activeRef.current = true
		setHoveredElement(null)
		setSelectedElement(null)
		setIframeScrollOffset(null)
		sendToIframe(INSPECTOR_MSG.START)
		sendToIframe(INSPECTOR_MSG.TRACK, { selectors: trackedSelectorsRef.current })
	}, [sendToIframe])

	const stop = useCallback(() => {
		setActive(false)
		activeRef.current = false
		setHoveredElement(null)
		sendToIframe(INSPECTOR_MSG.STOP)
	}, [sendToIframe])

	const toggle = useCallback(() => {
		if (activeRef.current) {
			stop()
		} else {
			start()
		}
	}, [start, stop])

	const clearSelection = useCallback(() => {
		setSelectedElement(null)
	}, [])

	const scrollToSelector = useCallback(
		(selector: string) => {
			if (!selector.trim()) return
			sendToIframe(INSPECTOR_MSG.SCROLL_TO_SELECTOR, { selector })
		},
		[sendToIframe],
	)

	const scrollToPosition = useCallback(
		({ left, top }: InspectorScrollOffset) => {
			if (!Number.isFinite(left) || !Number.isFinite(top)) return
			sendToIframe(INSPECTOR_MSG.SCROLL_TO_POSITION, {
				left: Math.max(0, left),
				top: Math.max(0, top),
			})
		},
		[sendToIframe],
	)

	const setTrackedSelectors = useCallback(
		(selectors: string[]) => {
			const nextSelectors = Array.from(new Set(selectors.filter(Boolean)))
			const previousSelectors = trackedSelectorsRef.current
			const selectorsUnchanged =
				previousSelectors.length === nextSelectors.length &&
				previousSelectors.every((selector, index) => selector === nextSelectors[index])
			trackedSelectorsRef.current = nextSelectors
			if (selectorsUnchanged) return
			setTrackedRects((current) => {
				const allowed = new Set(nextSelectors)
				return Object.fromEntries(
					Object.entries(current).filter(([selector]) => allowed.has(selector)),
				)
			})
			postToIframe({
				type: INSPECTOR_MSG.TRACK,
				selectors: nextSelectors,
				timestamp: Date.now(),
			})
		},
		[postToIframe],
	)

	// A document reload replaces the injected inspector runtime, so replay the
	// current target set once the new iframe document is ready.
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return
		const handleLoad = () => {
			setHoveredElement(null)
			setSelectedElement(null)
			setTrackedRects({})
			setIframeScrollOffset(null)
			if (activeRef.current) {
				postToIframe({ type: INSPECTOR_MSG.START, timestamp: Date.now() })
			}
			postToIframe({
				type: INSPECTOR_MSG.TRACK,
				selectors: trackedSelectorsRef.current,
				timestamp: Date.now(),
			})
		}
		iframe.addEventListener("load", handleLoad)
		return () => iframe.removeEventListener("load", handleLoad)
	}, [iframeRef, postToIframe])

	// Press Esc to cancel inspector while it is active
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && activeRef.current) {
				stop()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [stop])

	// Click outside iframe to cancel inspector
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (!activeRef.current) return
			const iframe = iframeRef.current
			if (!iframe) return
			// Inspector interactions are rendered in the parent document. The
			// collection panel may be portaled outside the overlay, and screenshot
			// selection starts on the overlay before continuing with pointer capture;
			// neither interaction should stop inspection on its initial mousedown.
			if (
				e.target instanceof Element &&
				e.target.closest(
					"[data-element-inspector-overlay], [data-element-inspector-panel-portal], [data-element-inspector-capture-authorization]",
				)
			) {
				return
			}
			// If the click target is not the iframe element itself, it's "outside"
			if (e.target !== iframe && !iframe.contains(e.target as Node)) {
				stop()
			}
		}
		document.addEventListener("mousedown", handleClick, true)
		return () => document.removeEventListener("mousedown", handleClick, true)
	}, [iframeRef, stop])

	// Listen for messages from iframe
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			if (event.source !== iframeRef.current?.contentWindow) return
			if (inspectorTargetOrigin !== "*" && event.origin !== inspectorTargetOrigin) {
				setActive(false)
				activeRef.current = false
				setHoveredElement(null)
				setSelectedElement(null)
				setTrackedRects({})
				setIframeScrollOffset(null)
				trackedSelectorsRef.current = []
				return
			}
			if (!event.data?.type) return

			switch (event.data.type) {
				case INSPECTOR_MSG.SCROLL_CHANGED: {
					const left = Number(event.data.left)
					const top = Number(event.data.top)
					if (!Number.isFinite(left) || !Number.isFinite(top) || left < 0 || top < 0) {
						return
					}
					setIframeScrollOffset((current) =>
						current?.left === left && current.top === top ? current : { left, top },
					)
					break
				}
				case INSPECTOR_MSG.RECTS_CHANGED: {
					const rects = Array.isArray(event.data.rects) ? event.data.rects : []
					if (rects.length === 0) return
					setTrackedRects((current) => {
						let changed = false
						const next = { ...current }
						for (const item of rects) {
							if (!item?.selector || !item.rect) continue
							if (areRectsEqual(current[item.selector], item.rect)) continue
							next[item.selector] = item.rect
							changed = true
						}
						return changed ? next : current
					})
					setSelectedElement((current) => {
						if (!current) return current
						const update = rects.find((item) => item?.selector === current.selector)
						if (!update?.rect || areRectsEqual(current.rect, update.rect)) {
							return current
						}
						return { ...current, rect: update.rect }
					})
					break
				}
				case INSPECTOR_MSG.HOVER: {
					if (!activeRef.current) return
					const info = event.data.elementInfo as InspectedElementInfo | undefined
					if (info) setHoveredElement(info)
					break
				}
				case INSPECTOR_MSG.SELECT: {
					if (!activeRef.current) return
					const info = event.data.elementInfo as InspectedElementInfo | undefined
					if (info) {
						setSelectedElement(info)
						// Auto-stop inspector after selection
						setActive(false)
						activeRef.current = false
						setHoveredElement(null)
						sendToIframe(INSPECTOR_MSG.STOP)
					}
					break
				}
				case INSPECTOR_MSG.HOVER_END: {
					if (!activeRef.current) return
					setHoveredElement(null)
					break
				}
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [iframeRef, inspectorTargetOrigin, sendToIframe])

	// Clean up on unmount
	useEffect(() => {
		const iframe = iframeRef.current
		return () => {
			if (activeRef.current) {
				try {
					iframe?.contentWindow?.postMessage(
						{ type: INSPECTOR_MSG.STOP, timestamp: Date.now() },
						inspectorTargetOrigin,
					)
				} catch {
					// The iframe can be disconnected before the hook cleanup runs.
				}
			}
		}
	}, [iframeRef, inspectorTargetOrigin])

	return {
		active,
		toggle,
		start,
		stop,
		hoveredElement,
		selectedElement,
		clearSelection,
		setTrackedSelectors,
		trackedRects,
		iframeScrollOffset,
		scrollToSelector,
		scrollToPosition,
	}
}
