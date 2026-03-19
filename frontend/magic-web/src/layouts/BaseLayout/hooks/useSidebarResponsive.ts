import { useCallback, useEffect, useRef, type RefObject } from "react"
import { reaction } from "mobx"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/stores/layout"

function convertPercentToPx(sizePercent: number): number {
	return (sizePercent / 100) * window.innerWidth
}

function convertPxToPercent(sizePx: number): number {
	if (!window.innerWidth) return sidebarStore.MIN_WIDTH_PERCENT
	return (sizePx / window.innerWidth) * 100
}

interface UseSidebarResponsiveParams {
	sidebarPanelRef: RefObject<ImperativePanelHandle>
	initialWidth: number
}

function useSidebarResponsive({ sidebarPanelRef, initialWidth }: UseSidebarResponsiveParams) {
	const isDraggingRef = useRef(false)
	const dragEndTimerRef = useRef<number>()
	const expandedSidebarWidthPxRef = useRef(convertPercentToPx(initialWidth))
	const prevWindowWidthRef = useRef(window.innerWidth)

	const getExpandedSidebarSizePercent = useCallback(() => {
		const sizePercent = convertPxToPercent(expandedSidebarWidthPxRef.current)
		return Math.max(
			sidebarStore.MIN_WIDTH_PERCENT,
			Math.min(sidebarStore.MAX_WIDTH_PERCENT, sizePercent),
		)
	}, [])

	const syncSidebarByViewport = useCallback(
		(isShrinking: boolean) => {
			const minRequiredWidth =
				expandedSidebarWidthPxRef.current + sidebarStore.MIN_MAIN_CONTENT_WIDTH_PX
			if (window.innerWidth <= minRequiredWidth) {
				// Only auto-collapse when the window is shrinking, not when expanding
				if (isShrinking && !sidebarStore.collapsed) sidebarStore.setCollapsed(true)
				return
			}
			if (sidebarStore.collapsed || !sidebarPanelRef.current) return

			const nextSizePercent = getExpandedSidebarSizePercent()
			sidebarPanelRef.current.resize(nextSizePercent)
			sidebarStore.setWidth(nextSizePercent)
		},
		[getExpandedSidebarSizePercent, sidebarPanelRef],
	)

	useEffect(() => {
		function handleResize() {
			const currentWidth = window.innerWidth
			const isShrinking = currentWidth < prevWindowWidthRef.current
			prevWindowWidthRef.current = currentWidth
			syncSidebarByViewport(isShrinking)
		}

		// Initial check: treat as shrinking to apply collapse if viewport is already too narrow
		syncSidebarByViewport(true)
		window.addEventListener("resize", handleResize)
		// When user explicitly expands the sidebar, only resize the panel
		// to the correct size - never force re-collapse here (that would
		// prevent the user from opening the sidebar on narrow screens).
		const dispose = reaction(
			() => sidebarStore.collapsed,
			(collapsed) => {
				if (collapsed || !sidebarPanelRef.current) return
				const nextSizePercent = getExpandedSidebarSizePercent()
				sidebarPanelRef.current.resize(nextSizePercent)
				sidebarStore.setWidth(nextSizePercent)
			},
		)

		return () => {
			dispose()
			window.removeEventListener("resize", handleResize)
		}
	}, [syncSidebarByViewport])

	useEffect(() => {
		return () => {
			if (dragEndTimerRef.current) {
				window.clearTimeout(dragEndTimerRef.current)
			}
			if (isDraggingRef.current && sidebarPanelRef.current) {
				const finalSize = sidebarPanelRef.current.getSize()
				expandedSidebarWidthPxRef.current = convertPercentToPx(finalSize)
				sidebarStore.setWidth(finalSize)
			}
			sidebarStore.persistWidth()
		}
	}, [sidebarPanelRef])

	const handleSidebarResize = useCallback(() => {
		if (sidebarStore.collapsed) return

		if (!isDraggingRef.current) {
			isDraggingRef.current = true
		}

		if (dragEndTimerRef.current) {
			window.clearTimeout(dragEndTimerRef.current)
		}

		dragEndTimerRef.current = window.setTimeout(() => {
			if (sidebarPanelRef.current && isDraggingRef.current) {
				const finalSize = sidebarPanelRef.current.getSize()
				expandedSidebarWidthPxRef.current = convertPercentToPx(finalSize)
				sidebarStore.setWidth(finalSize)
				isDraggingRef.current = false
			}
		}, 100)
	}, [sidebarPanelRef])

	return {
		handleSidebarResize,
	}
}

export default useSidebarResponsive
