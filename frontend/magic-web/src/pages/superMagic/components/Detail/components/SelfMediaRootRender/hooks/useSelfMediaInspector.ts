/**
 * useSelfMediaInspector
 *
 * Multi-iframe element inspector hook for self-media platforms.
 * Drives Chrome-DevTools-style element inspection across one or more
 * CardFrame iframes. On element selection, appends the element info
 * to the current message editor (without replacing existing content).
 *
 * For IsolatedHTMLRenderer iframes (which already have the runtime),
 * no script injection is needed — just pass the iframe elements.
 * For CardFrame iframes, the handler script is dynamically injected.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { InspectedElementInfo } from "@/components/business/ElementInspector/types"
import { INSPECTOR_MSG } from "@/components/business/ElementInspector/types"
import { buildAgentPromptContent } from "@/components/business/ElementInspector"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { injectInspectorHandler } from "../utils/inspectorHandlerScript"

export interface UseSelfMediaInspectorOptions {
	/**
	 * Returns the list of iframe elements that should be inspectable
	 * in the current view. Called when inspector starts.
	 */
	getIframeElements: () => HTMLIFrameElement[]
	/**
	 * If true, skips injecting the handler script (e.g., for IsolatedHTMLRenderer
	 * iframes that already have the runtime).
	 */
	skipInjection?: boolean
	/**
	 * Resolves file info for the iframe that was selected, used to generate
	 * an @file mention in the appended prompt content.
	 */
	getFileInfoForIframe?: (
		iframe: HTMLIFrameElement,
	) => { fileId: string; fileName: string; filePath: string } | undefined
}

export interface UseSelfMediaInspectorReturn {
	/** Whether inspector mode is currently active */
	active: boolean
	/** Start inspector mode (user must click button to trigger this) */
	start: () => void
	/** Stop inspector mode */
	stop: () => void
	/** Element currently under the cursor */
	hoveredElement: InspectedElementInfo | null
	/** Element that was clicked / selected */
	selectedElement: InspectedElementInfo | null
	/** Ref to the iframe that last reported a hover/select event */
	activeIframeRef: React.RefObject<HTMLIFrameElement | null>
}

const POINTER_EVENTS_ATTR = "data-inspector-pe-override"

/**
 * Walk up from an iframe element and temporarily override any
 * `pointer-events: none` on ancestor elements so the iframe can
 * receive mouse events. Returns a cleanup function that restores
 * original styles.
 */
function ensurePointerEvents(iframe: HTMLIFrameElement): () => void {
	const overridden: HTMLElement[] = []
	let el: HTMLElement | null = iframe
	while (el) {
		const computed = getComputedStyle(el).pointerEvents
		if (computed === "none") {
			el.style.pointerEvents = "auto"
			el.setAttribute(POINTER_EVENTS_ATTR, "")
			overridden.push(el)
		}
		el = el.parentElement
	}
	return () => {
		for (const node of overridden) {
			node.style.pointerEvents = ""
			node.removeAttribute(POINTER_EVENTS_ATTR)
		}
	}
}

export function useSelfMediaInspector({
	getIframeElements,
	skipInjection = false,
	getFileInfoForIframe,
}: UseSelfMediaInspectorOptions): UseSelfMediaInspectorReturn {
	const { t } = useTranslation("super")
	const [active, setActive] = useState(false)
	const [hoveredElement, setHoveredElement] = useState<InspectedElementInfo | null>(null)
	const [selectedElement, setSelectedElement] = useState<InspectedElementInfo | null>(null)
	const activeRef = useRef(false)
	const activeIframeRef = useRef<HTMLIFrameElement | null>(null)
	const cleanupFnsRef = useRef<Array<(() => void) | null>>([])
	const iframeSnapshotRef = useRef<HTMLIFrameElement[]>([])
	const getFileInfoRef = useRef(getFileInfoForIframe)
	getFileInfoRef.current = getFileInfoForIframe

	const start = useCallback(() => {
		const iframes = getIframeElements()
		if (iframes.length === 0) return

		iframeSnapshotRef.current = iframes
		setActive(true)
		activeRef.current = true
		setHoveredElement(null)
		setSelectedElement(null)
		// Pre-set to first iframe so the overlay can compute rects immediately
		activeIframeRef.current = iframes[0]

		// Inject handler and send START to each iframe
		const cleanups: Array<(() => void) | null> = []
		for (const iframe of iframes) {
			// Ensure pointer events can reach the iframe (override pointer-events: none)
			const pointerEventsCleanup = ensurePointerEvents(iframe)

			if (!skipInjection) {
				const injectCleanup = injectInspectorHandler(iframe)
				cleanups.push(() => {
					injectCleanup?.()
					pointerEventsCleanup()
				})
			} else {
				// For iframes that already have the runtime, just send START
				iframe.contentWindow?.postMessage(
					{ type: INSPECTOR_MSG.START, timestamp: Date.now() },
					"*",
				)
				cleanups.push(() => {
					iframe.contentWindow?.postMessage(
						{ type: INSPECTOR_MSG.STOP, timestamp: Date.now() },
						"*",
					)
					pointerEventsCleanup()
				})
			}
		}
		cleanupFnsRef.current = cleanups
	}, [getIframeElements, skipInjection])

	const stop = useCallback(() => {
		setActive(false)
		activeRef.current = false
		setHoveredElement(null)

		// Cleanup all injected handlers / send STOP
		for (const cleanup of cleanupFnsRef.current) {
			cleanup?.()
		}
		cleanupFnsRef.current = []
		iframeSnapshotRef.current = []
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

	// Click outside tracked iframes to dismiss inspector
	useEffect(() => {
		if (!active) return
		const handlePointerDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement | null
			if (!target) return
			// If clicked inside one of the tracked iframes' element, let the iframe handle it
			const clickedInsideIframe = iframeSnapshotRef.current.some(
				(iframe) => iframe === target || iframe.contains(target),
			)
			if (!clickedInsideIframe) {
				stop()
			}
		}
		// Use capture phase so we stop before the button's click handler fires
		document.addEventListener("pointerdown", handlePointerDown, true)
		return () => document.removeEventListener("pointerdown", handlePointerDown, true)
	}, [active, stop])

	// Listen for messages from any tracked iframe
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			if (!activeRef.current) return
			if (!event.data?.type) return

			// Check if message comes from one of our tracked iframes
			const sourceIframe = iframeSnapshotRef.current.find(
				(iframe) => iframe.contentWindow === event.source,
			)
			if (!sourceIframe) return

			switch (event.data.type) {
				case INSPECTOR_MSG.HOVER: {
					const info = event.data.elementInfo as InspectedElementInfo | undefined
					if (info) {
						activeIframeRef.current = sourceIframe
						setHoveredElement(info)
					}
					break
				}
				case INSPECTOR_MSG.SELECT: {
					const info = event.data.elementInfo as InspectedElementInfo | undefined
					if (info) {
						activeIframeRef.current = sourceIframe
						setSelectedElement(info)
						// Auto-stop inspector after selection
						setActive(false)
						activeRef.current = false
						setHoveredElement(null)
						// Cleanup all injected handlers
						for (const cleanup of cleanupFnsRef.current) {
							cleanup?.()
						}
						cleanupFnsRef.current = []
						iframeSnapshotRef.current = []
					}
					break
				}
				case INSPECTOR_MSG.HOVER_END: {
					setHoveredElement(null)
					break
				}
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	// On selection: build prompt content and append to current editor
	useEffect(() => {
		if (!selectedElement) return

		const iframe = activeIframeRef.current
		const fileInfo = iframe ? getFileInfoRef.current?.(iframe) : undefined
		const content = buildAgentPromptContent(
			selectedElement,
			t("stylePanel.inspector.agentPromptTitle"),
			fileInfo,
			undefined,
			undefined,
			t,
		)
		setSelectedElement(null)

		// Append to current editor without replacing existing content
		pubsub.publish(PubSubEvents.Append_Content_To_Editor, content)
	}, [selectedElement, t])

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (activeRef.current) {
				for (const cleanup of cleanupFnsRef.current) {
					cleanup?.()
				}
			}
		}
	}, [])

	return {
		active,
		start,
		stop,
		hoveredElement,
		selectedElement,
		activeIframeRef,
	}
}
