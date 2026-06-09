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
import type { InspectedElementInfo } from "./types"
import { INSPECTOR_MSG } from "./types"

interface UseElementInspectorOptions {
	/** Ref to the target iframe */
	iframeRef: React.RefObject<HTMLIFrameElement | null>
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
}

export function useElementInspector({
	iframeRef,
}: UseElementInspectorOptions): UseElementInspectorReturn {
	const [active, setActive] = useState(false)
	const [hoveredElement, setHoveredElement] = useState<InspectedElementInfo | null>(null)
	const [selectedElement, setSelectedElement] = useState<InspectedElementInfo | null>(null)
	const activeRef = useRef(false)

	const sendToIframe = useCallback(
		(type: string, payload?: Record<string, unknown>) => {
			iframeRef.current?.contentWindow?.postMessage(
				{ type, ...payload, timestamp: Date.now() },
				"*",
			)
		},
		[iframeRef],
	)

	const start = useCallback(() => {
		setActive(true)
		activeRef.current = true
		setHoveredElement(null)
		setSelectedElement(null)
		sendToIframe(INSPECTOR_MSG.START)
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
			if (!event.data?.type) return

			switch (event.data.type) {
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
	}, [iframeRef, sendToIframe])

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (activeRef.current) {
				iframeRef.current?.contentWindow?.postMessage(
					{ type: INSPECTOR_MSG.STOP, timestamp: Date.now() },
					"*",
				)
			}
		}
	}, [iframeRef])

	return {
		active,
		toggle,
		start,
		stop,
		hoveredElement,
		selectedElement,
		clearSelection,
	}
}
