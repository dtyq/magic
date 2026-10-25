import type { ReactNode } from "react"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { APP_MODAL_Z_INDEX, HTML_EDITOR_Z_INDEX } from "../../../contents/HTML/constants/z-index"
import { OverlayZIndexProvider, useCurrentOverlayZIndex } from "@/utils/overlayZIndex"
import { cn } from "@/utils/cn"

const HOST_BASE_CLASS_NAME = "fixed overflow-hidden bg-background"

const PPT_VIEWPORT_SELECTOR =
	'[data-presenter-console="true"], [data-mobile-fullscreen="landscape"]'

interface StablePreviewPortalSurfaceProps {
	anchor: HTMLElement | null
	borderRadius?: string
	children: ReactNode
	enabled: boolean
	isFullscreen: boolean
	isPpt?: boolean
	/**
	 * CSS color of a 1px frame drawn by the surface itself, as the host's own border. The surface
	 * floats above its anchor, so an outline on the anchor's container sits underneath the
	 * preview. As a border it is painted by the host below everything inside it: content stays
	 * within it, while tooltips and menus that escape the host (fixed-positioned) pass over it.
	 * Omitted in viewport mode.
	 */
	outlineColor?: string
	/** Extra host classes, e.g. scoped overrides for the hosted preview's own UI. */
	className?: string
	/**
	 * Host UI floated over the preview (e.g. the AI canvas project card and playback panel). It
	 * has to live in this surface: anything in the panel underneath is covered by the floating
	 * layer. Each overlay child positions itself inside the surface.
	 */
	overlay?: ReactNode
	visible: boolean
}

function isAnchorTreeVisible(anchor: HTMLElement): boolean {
	if (anchor.closest("[hidden]")) return false
	if (window.getComputedStyle(anchor).visibility !== "visible") return false

	let current: HTMLElement | null = anchor
	while (current) {
		const inlineOpacity = current.style.opacity
		if (
			current.style.display === "none" ||
			(inlineOpacity !== "" && Number(inlineOpacity) === 0)
		)
			return false
		current = current.parentElement
	}

	return true
}

/**
 * Keeps preview content in one body Portal for its whole cached lifetime.
 * Only the host geometry changes, so fullscreen does not recreate iframe-backed renderers.
 */
export default function StablePreviewPortalSurface({
	anchor,
	borderRadius = "0px",
	children,
	enabled,
	isFullscreen,
	isPpt = false,
	outlineColor,
	className,
	overlay,
	visible,
}: StablePreviewPortalSurfaceProps) {
	const parentOverlayZIndex = useCurrentOverlayZIndex()
	const [fullscreenZIndex, setFullscreenZIndex] = useState(APP_MODAL_Z_INDEX)
	const hostRef = useRef<HTMLDivElement | null>(null)
	if (!hostRef.current && typeof document !== "undefined") {
		const host = document.createElement("div")
		host.className = HOST_BASE_CLASS_NAME
		host.dataset.filesViewerPreviewPortal = "true"
		if (isPpt) host.dataset.filesViewerPptPortal = "true"
		host.style.display = "none"
		host.style.pointerEvents = "none"
		host.style.visibility = "hidden"
		hostRef.current = host
	}
	const host = hostRef.current

	useLayoutEffect(() => {
		if (!host) return
		host.className = cn(HOST_BASE_CLASS_NAME, className)
	}, [className, host])
	const lifecycleRef = useRef({ generation: 0 })
	const layoutSignatureRef = useRef("")
	const pptViewportRef = useRef(false)

	// Delay removal so React StrictMode's effect replay cannot detach iframe-backed content.
	useLayoutEffect(() => {
		const lifecycle = lifecycleRef.current
		const generation = ++lifecycle.generation
		if (!host) return

		if (!enabled) {
			host.remove()
			return
		}

		if (host.parentNode !== document.body) document.body.appendChild(host)

		return () => {
			queueMicrotask(() => {
				if (lifecycle.generation === generation) host.remove()
			})
		}
	}, [enabled, host])

	const syncSurface = useCallback(() => {
		if (!host) return

		const rect = anchor?.getBoundingClientRect()
		const usesViewport = pptViewportRef.current
		const isVisible = Boolean(
			visible &&
			anchor &&
			isAnchorTreeVisible(anchor) &&
			rect &&
			rect.width > 0 &&
			rect.height > 0,
		)
		const layoutSignature =
			isVisible && rect
				? `${rect.top}|${rect.left}|${rect.width}|${rect.height}|${isFullscreen}|${borderRadius}|${outlineColor}|${isPpt}|${usesViewport}|${window.innerWidth}|${window.innerHeight}`
				: `hidden|${isFullscreen}|${borderRadius}|${outlineColor}|${isPpt}`
		if (layoutSignatureRef.current === layoutSignature) return
		layoutSignatureRef.current = layoutSignature

		host.style.pointerEvents = isVisible ? "auto" : "none"
		host.style.display = isVisible ? "block" : "none"
		host.style.visibility = isVisible ? "visible" : "hidden"
		host.style.borderRadius = usesViewport ? "0px" : borderRadius
		host.style.boxSizing = "border-box"
		host.style.border = !usesViewport && outlineColor ? `1px solid ${outlineColor}` : ""
		if (isPpt) host.dataset.filesViewerPptPortal = "true"
		else delete host.dataset.filesViewerPptPortal
		// The fullscreen viewer shell has the base fullscreen z-index and a white background.
		// Keep the iframe surface one layer above it so the shell cannot cover the preview.
		host.style.zIndex = isFullscreen
			? "calc(var(--z-index-detail-fullscreen) + 1)"
			: usesViewport
				? String(HTML_EDITOR_Z_INDEX.FULLSCREEN.CONTAINER)
				: "10"
		if (isFullscreen) {
			// Body-portaled editor controls need the same base as this surface,
			// otherwise their ordinary editor layer is hidden behind fullscreen.
			const fullscreenBase = Number.parseInt(
				window.getComputedStyle(host).getPropertyValue("--z-index-detail-fullscreen"),
				10,
			)
			setFullscreenZIndex(
				Number.isFinite(fullscreenBase) ? fullscreenBase + 1 : APP_MODAL_Z_INDEX,
			)
		}

		if (!isVisible || !rect) return

		host.style.top = usesViewport ? "0px" : `${rect.top}px`
		host.style.right = "auto"
		host.style.bottom = "auto"
		host.style.left = usesViewport ? "0px" : `${rect.left}px`
		host.style.width = `${usesViewport ? window.innerWidth : rect.width}px`
		host.style.height = `${usesViewport ? window.innerHeight : rect.height}px`
	}, [anchor, borderRadius, host, isFullscreen, isPpt, outlineColor, visible])

	useLayoutEffect(() => {
		if (!host || !enabled) return
		const syncPptViewport = () => {
			pptViewportRef.current = Boolean(host.querySelector(PPT_VIEWPORT_SELECTOR))
			syncSurface()
		}
		// A fixed child cannot escape this host's stacking context. Promote the same
		// host for PPT-owned fullscreen modes, retaining all iframe/editor instances.
		const observer = new MutationObserver((records) => {
			const relevant = records.some(
				(record) =>
					record.type === "attributes" ||
					[...record.addedNodes, ...record.removedNodes].some(
						(node) =>
							node instanceof Element &&
							(node.matches(PPT_VIEWPORT_SELECTOR) ||
								Boolean(node.querySelector(PPT_VIEWPORT_SELECTOR))),
					),
			)
			if (relevant) syncPptViewport()
		})
		observer.observe(host, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["data-presenter-console", "data-mobile-fullscreen"],
		})
		syncPptViewport()
		return () => observer.disconnect()
	}, [enabled, host, syncSurface])

	useLayoutEffect(() => {
		syncSurface()
		if (!anchor || !visible) return

		let animationFrame = 0
		const scheduleSync = () => {
			if (animationFrame) return
			animationFrame = window.requestAnimationFrame(() => {
				animationFrame = 0
				syncSurface()
			})
		}
		const handleDocumentScroll = (event: Event) => {
			if (host && event.target instanceof Node && host.contains(event.target)) return
			scheduleSync()
		}

		// ResizeObserver already runs before paint. Deferring again lets the body portal
		// overlap the resized conversation for one frame. Updating the separate host
		// does not resize the observed anchor, so it cannot feed back into this observer.
		const resizeObserver =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncSurface)
		resizeObserver?.observe(anchor)
		document.addEventListener("scroll", handleDocumentScroll, {
			capture: true,
			passive: true,
		})
		document.addEventListener("transitionend", scheduleSync, true)
		document.addEventListener("transitioncancel", scheduleSync, true)
		window.addEventListener("resize", scheduleSync, { passive: true })
		window.visualViewport?.addEventListener("resize", scheduleSync)
		window.visualViewport?.addEventListener("scroll", scheduleSync)

		return () => {
			resizeObserver?.disconnect()
			document.removeEventListener("scroll", handleDocumentScroll, true)
			document.removeEventListener("transitionend", scheduleSync, true)
			document.removeEventListener("transitioncancel", scheduleSync, true)
			window.removeEventListener("resize", scheduleSync)
			window.visualViewport?.removeEventListener("resize", scheduleSync)
			window.visualViewport?.removeEventListener("scroll", scheduleSync)
			if (animationFrame) window.cancelAnimationFrame(animationFrame)
		}
	}, [anchor, enabled, host, syncSurface, visible])

	return enabled && host
		? createPortal(
				<OverlayZIndexProvider
					value={
						isFullscreen
							? Math.max(fullscreenZIndex, parentOverlayZIndex ?? 0)
							: parentOverlayZIndex
					}
				>
					{children}
					{overlay ? (
						// Click-through wrapper; only the overlay's own content takes the pointer.
						<div className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto">
							{overlay}
						</div>
					) : null}
				</OverlayZIndexProvider>,
				host,
				"files-viewer-stable-preview",
			)
		: null
}
