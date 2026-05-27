import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"

const MOBILE_ANTD_POPUP_LAYER_ATTR = "data-mobile-antd-popup-layer"

export interface UseMobileAntdPopupLayerOptions {
	/** Whether the antd-mobile picker popup is open. */
	open: boolean
}

export interface UseMobileAntdPopupLayerResult {
	/** Overlay z-index from the global stack; pass to Picker popupStyle. */
	overlayZIndex: number
	/** Live portal root for nested popup/dialog portals. */
	portalContainer: HTMLElement | null
	/** Portal target so DatePicker popups render above nested MagicModal layers. */
	getContainer: () => HTMLElement
}

/** Creates a fixed full-screen portal root for antd-mobile popups at the acquired z-index. */
function createPopupPortalContainer(overlayZIndex: number) {
	const container = document.createElement("div")
	container.setAttribute(MOBILE_ANTD_POPUP_LAYER_ATTR, "true")
	container.style.position = "fixed"
	container.style.inset = "0"
	container.style.zIndex = String(overlayZIndex)
	container.style.pointerEvents = "none"
	document.body.appendChild(container)
	return container
}

/**
 * Manages overlay z-index and a portal container for antd-mobile DatePicker/Picker
 * when they are nested inside MagicModal (MagicPopup) on mobile.
 */
export function useMobileAntdPopupLayer({
	open,
}: UseMobileAntdPopupLayerOptions): UseMobileAntdPopupLayerResult {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
	const { overlayZIndex, releaseOverlayZIndex } = useOverlayZIndex({ open })

	useEffect(() => {
		if (!open) {
			releaseOverlayZIndex()
		}
	}, [open, releaseOverlayZIndex])

	// Create portal root before paint so antd-mobile getContainer is ready when Popup mounts.
	useLayoutEffect(() => {
		if (!open) {
			if (containerRef.current?.parentNode) {
				containerRef.current.parentNode.removeChild(containerRef.current)
			}
			containerRef.current = null
			setPortalContainer(null)
			return undefined
		}

		const container = createPopupPortalContainer(overlayZIndex)
		containerRef.current = container
		setPortalContainer(container)

		return () => {
			if (container.parentNode) {
				container.parentNode.removeChild(container)
			}
			if (containerRef.current === container) {
				containerRef.current = null
			}
			setPortalContainer((currentContainer) =>
				currentContainer === container ? null : currentContainer,
			)
		}
	}, [open])

	useLayoutEffect(() => {
		if (!open || !containerRef.current) return
		containerRef.current.style.zIndex = String(overlayZIndex)
	}, [open, overlayZIndex])

	const getContainer = useCallback(() => {
		return containerRef.current ?? document.body
	}, [])

	return {
		overlayZIndex,
		portalContainer,
		getContainer,
	}
}
