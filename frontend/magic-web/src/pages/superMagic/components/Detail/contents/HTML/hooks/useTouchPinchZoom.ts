import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { bindTouchPinch, type PinchPhase, type PinchPoint } from "../utils/touch-pinch"
import { createPinchZoomController, type PinchAnchor } from "../utils/pinch-zoom-controller"

interface TouchPinchZoomConfig {
	containerRef: RefObject<HTMLDivElement>
	iframeRef: RefObject<HTMLIFrameElement>
	enabled: boolean
	iframeReady: boolean
	scale: number
	onPinchActiveChange?: (active: boolean) => void
	onScaleChange: (scale: number, anchor: PinchAnchor) => void
}

export function useTouchPinchZoom(config: TouchPinchZoomConfig): boolean {
	const [isPinching, setIsPinching] = useState(false)
	const getScale = useMemoizedFn(() => config.scale)
	const changeScale = useMemoizedFn(config.onScaleChange)
	const setActive = useMemoizedFn((active: boolean) => {
		config.onPinchActiveChange?.(active)
		setIsPinching(active)
	})
	const { containerRef, iframeRef, enabled, iframeReady } = config

	useEffect(() => {
		const container = containerRef.current
		const iframe = iframeRef.current
		if (!container || !iframe) return
		const controller = createPinchZoomController({
			iframe,
			getScale,
			onScaleChange: changeScale,
			onActiveChange: setActive,
		})
		const handleGesture = (
			source: "host" | "iframe",
			phase: PinchPhase,
			points: PinchPoint[],
		) => {
			if (enabled) controller.handleGesture(source, phase, points)
		}

		let origin: string | undefined
		try {
			if (iframe.src) {
				const url = new URL(iframe.src, window.location.href)
				if (url.protocol === "https:" || url.protocol === "http:") origin = url.origin
			}
		} catch {
			// Frames without a concrete origin rely on direct same-origin listeners.
		}
		const sendState = (value: boolean) => {
			try {
				if (origin)
					iframe.contentWindow?.postMessage(
						{ type: "magic-preview-pinch-state", enabled: value },
						origin,
					)
			} catch {
				// A removed/navigating frame may no longer have a live browsing context.
			}
		}

		const handleMessage = (event: MessageEvent) => {
			if (event.source !== iframe.contentWindow || !origin || event.origin !== origin) return
			if (event.data?.type === "magic-preview-pinch-ready") {
				sendState(enabled)
				return
			}
			if (event.data?.type !== "magic-preview-pinch") return
			const { phase, points } = event.data
			if (phase === "end" || phase === "cancel") {
				handleGesture("iframe", phase, [])
				return
			}
			if (phase !== "start" && phase !== "move") return
			if (!Array.isArray(points) || points.length !== 2 || points[0]?.id === points[1]?.id)
				return
			if (
				!points.every(
					(point) =>
						point &&
						Number.isFinite(point.id) &&
						Number.isFinite(point.x) &&
						Number.isFinite(point.y) &&
						((point.screenX === undefined && point.screenY === undefined) ||
							(Number.isFinite(point.screenX) && Number.isFinite(point.screenY))),
				)
			)
				return
			handleGesture("iframe", phase, points)
		}
		window.addEventListener("message", handleMessage)
		sendState(enabled)
		const unbind = enabled
			? bindTouchPinch(container, (phase, points) => handleGesture("host", phase, points))
			: undefined
		let unbindIframe: (() => void) | undefined
		if (enabled && iframeReady) {
			try {
				// Reading the document explicitly verifies access before installing listeners.
				if (iframe.contentWindow?.document) {
					unbindIframe = bindTouchPinch(iframe.contentWindow, (phase, points) =>
						handleGesture("iframe", phase, points),
					)
				}
			} catch {
				// The compiled iframe installer handles cross-origin documents.
			}
		}
		return () => {
			window.removeEventListener("message", handleMessage)
			sendState(false)
			unbind?.()
			unbindIframe?.()
			controller.destroy()
		}
	}, [containerRef, iframeRef, enabled, iframeReady, getScale, changeScale, setActive])
	return enabled && isPinching
}
