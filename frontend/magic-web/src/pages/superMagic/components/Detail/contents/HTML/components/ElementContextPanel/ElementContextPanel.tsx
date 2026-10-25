import { createPortal } from "react-dom"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { StylePanel } from "../StylePanel"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import type { ElementRect } from "../SelectionOverlay/types"
import {
	getContextToolbarPosition,
	getContextViewport,
	getMeasuredToolbarSize,
} from "./contextPanelPosition"
import { HTML_EDITOR_Z_INDEX, TAILWIND_Z_INDEX_CLASSES } from "../../constants/z-index"
import { cn } from "@/utils/cn"
import {
	CONTEXT_TOOLBAR_PANEL_MAX_WIDTH,
	getContextToolbarPanelMaxWidth,
} from "../StylePanel/utils/contextToolbarPartition"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { OverlayZIndexProvider, useCurrentOverlayZIndex } from "@/utils/overlayZIndex"

interface Props {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	anchor: ElementRect | null
	selector?: string
	disabled?: boolean
	open?: boolean
	/** The canvas column bounds. The DOM tree is rendered outside this area. */
	boundaryRef?: React.RefObject<HTMLElement | null>
	onRevealMoreStyles?: () => void
}

const CONTEXT_TOOLBAR_MIN_HEIGHT = 48
const CONTEXT_TOOLBAR_CLOSE_DURATION = 240

function getVisibleViewport(boundaryRef?: React.RefObject<HTMLElement | null>): {
	left: number
	top: number
	right: number
	bottom: number
} {
	const viewport = getContextViewport(boundaryRef?.current?.getBoundingClientRect())
	return {
		left: viewport.left,
		top: viewport.top,
		right: viewport.left + viewport.width,
		bottom: viewport.top + viewport.height,
	}
}

function intersectsViewport(
	anchor: ElementRect | null,
	boundaryRef?: React.RefObject<HTMLElement | null>,
): boolean {
	if (!anchor || typeof window === "undefined") return false
	const viewport = getVisibleViewport(boundaryRef)
	return (
		anchor.left < viewport.right &&
		anchor.left + anchor.width > viewport.left &&
		anchor.top < viewport.bottom &&
		anchor.top + anchor.height > viewport.top
	)
}

export function ElementContextPanel({
	editorRef,
	anchor,
	selector,
	disabled,
	open = true,
	boundaryRef,
	onRevealMoreStyles,
}: Props) {
	const panelRef = useRef<HTMLDivElement>(null)
	const toolbarContentRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState({
		left: 8,
		top: 8,
		width: 0,
		height: CONTEXT_TOOLBAR_MIN_HEIGHT,
		maxWidth: CONTEXT_TOOLBAR_PANEL_MAX_WIDTH,
	})
	const hasAnchor = Boolean(open && anchor && selector)
	const [isOpen, setIsOpen] = useState(false)
	const [shouldRender, setShouldRender] = useState(hasAnchor)
	const wasVisibleRef = useRef(false)
	const hasVisibleAnchor = intersectsViewport(anchor, boundaryRef)
	const shouldShowPanel = hasAnchor && hasVisibleAnchor

	const parentOverlayZIndex = useCurrentOverlayZIndex()
	const hasParentOverlay = parentOverlayZIndex != null
	const { overlayZIndex, releaseOverlayZIndex } = useOverlayZIndex({
		open: shouldRender,
		zIndexManaged: hasParentOverlay,
		zIndex: hasParentOverlay
			? parentOverlayZIndex + 10
			: HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.CONTEXT_PANEL,
	})
	// Fullscreen can change the parent layer while this toolbar stays mounted.
	// Release its old allocation before the hook registers the new layer.
	useEffect(() => releaseOverlayZIndex, [releaseOverlayZIndex])

	useEffect(() => {
		if (shouldRender) return
		releaseOverlayZIndex()
	}, [releaseOverlayZIndex, shouldRender])

	useEffect(() => {
		if (typeof window === "undefined") return
		if (!shouldShowPanel) {
			wasVisibleRef.current = false
			setIsOpen(false)
			const closeTimer = window.setTimeout(
				() => setShouldRender(false),
				CONTEXT_TOOLBAR_CLOSE_DURATION,
			)
			return () => window.clearTimeout(closeTimer)
		}
		setShouldRender(true)
		// Keep an already visible toolbar open while the selected element changes.
		// This updates its contents and position without replaying the entrance motion.
		if (wasVisibleRef.current) {
			setIsOpen(true)
			return
		}
		wasVisibleRef.current = true
		setIsOpen(false)
		// Let the closed state render for one frame before opening the panel. Without
		// this extra frame, child toolbar transitions can be skipped by the browser.
		let openFrame: number | null = null
		const frame = window.requestAnimationFrame(() => {
			openFrame = window.requestAnimationFrame(() => setIsOpen(true))
		})
		return () => {
			window.cancelAnimationFrame(frame)
			if (openFrame !== null) window.cancelAnimationFrame(openFrame)
		}
	}, [shouldShowPanel])
	useLayoutEffect(() => {
		if (!anchor || !selector || !panelRef.current) return
		let frame: number | null = null
		const updateNow = () => {
			frame = null
			// A flex canvas can be taller than the visible browser viewport. The
			// floating panel must use the clipped viewport, otherwise a lower
			// element incorrectly appears to have free space below it.
			const viewport = getContextViewport(boundaryRef?.current?.getBoundingClientRect())
			// Wrap against the window, not the canvas. The toolbar may overlap
			// the sidebar instead of collapsing into a sparse extra row.
			const availableWidth = Math.max(0, window.innerWidth - 16)
			const maxWidth = getContextToolbarPanelMaxWidth(availableWidth)
			const measured = getMeasuredToolbarSize(
				panelRef.current?.getBoundingClientRect(),
				maxWidth,
				CONTEXT_TOOLBAR_MIN_HEIGHT,
			)
			if (!measured) {
				setPosition((previous) =>
					previous.maxWidth === maxWidth ? previous : { ...previous, maxWidth },
				)
				return
			}
			const next = getContextToolbarPosition(anchor, measured, viewport, 8, {
				windowSize: { width: window.innerWidth, height: window.innerHeight },
			})
			const nextPosition = {
				left: next.left,
				top: next.top,
				width: measured.width,
				height: measured.height,
				maxWidth,
			}
			setPosition((previous) =>
				previous.left === nextPosition.left &&
				previous.top === nextPosition.top &&
				previous.width === nextPosition.width &&
				previous.height === nextPosition.height &&
				previous.maxWidth === nextPosition.maxWidth
					? previous
					: nextPosition,
			)
		}
		const update = () => {
			if (frame !== null) return
			frame = window.requestAnimationFrame(updateNow)
		}
		const updateFromScroll = (event: Event) => {
			// Scrolling the panel content must not feed back into panel positioning.
			// Only canvas/page scrolling changes the anchor's viewport coordinates.
			if (event.target instanceof Node && panelRef.current?.contains(event.target)) return
			update()
		}
		updateNow()
		window.addEventListener("resize", update)
		window.addEventListener("scroll", updateFromScroll, true)
		const resizeObserver =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		// Observe content, not the panel. Panel size is the layout result.
		if (boundaryRef?.current) resizeObserver?.observe(boundaryRef.current)
		if (toolbarContentRef.current) resizeObserver?.observe(toolbarContentRef.current)
		return () => {
			window.removeEventListener("resize", update)
			window.removeEventListener("scroll", updateFromScroll, true)
			resizeObserver?.disconnect()
			if (frame !== null) window.cancelAnimationFrame(frame)
		}
	}, [anchor, boundaryRef, selector, shouldRender])
	if (
		!shouldRender ||
		!shouldShowPanel ||
		!anchor ||
		!selector ||
		typeof document === "undefined"
	)
		return null
	return createPortal(
		<OverlayZIndexProvider value={overlayZIndex}>
			<div
				ref={panelRef}
				data-html-context-panel="true"
				data-testid="html-editor-context-panel"
				// overflow-x:auto would compute overflow-y to auto and show a
				// first-frame scrollbar while child motion still uses translate-y.
				className={cn(
					"group/context-toolbar pointer-events-none fixed box-border flex h-auto w-fit max-w-[calc(100vw_-_16px)] translate-y-2 scale-[0.99] items-start overflow-visible rounded-lg border border-border/60 bg-card/95 p-1.5 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.14)] blur-[2px] backdrop-blur transition-[transform,opacity,filter] [transition-duration:160ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-[open=true]:pointer-events-auto data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[open=true]:opacity-100 data-[open=true]:blur-0 motion-reduce:transition-none",
					!hasParentOverlay && TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.CONTEXT_PANEL,
				)}
				data-open={isOpen}
				style={{
					left: position.left,
					top: position.top,
					maxWidth: position.maxWidth,
					zIndex: overlayZIndex,
				}}
			>
				<div ref={toolbarContentRef} className="w-fit min-w-min max-w-full">
					<StylePanel
						editorRef={editorRef}
						variant="context"
						disabled={disabled}
						contextToolbarOpen={isOpen}
						selectionRect={anchor}
						boundaryRef={boundaryRef}
						availableWidth={position.maxWidth}
						onRevealMoreStyles={onRevealMoreStyles}
					/>
				</div>
			</div>
		</OverlayZIndexProvider>,
		document.body,
	)
}
