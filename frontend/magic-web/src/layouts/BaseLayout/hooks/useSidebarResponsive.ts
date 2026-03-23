import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { reaction } from "mobx"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/stores/layout"

function convertPercentToPx(sizePercent: number): number {
	return (sizePercent / 100) * window.innerWidth
}

function convertPxToPercent(sizePx: number): number {
	return convertPxToPercentByViewWidth(sizePx, window.innerWidth)
}

function convertPxToPercentByViewWidth(sizePx: number, viewWidth: number): number {
	if (!viewWidth) return sidebarStore.MIN_WIDTH_PERCENT
	return (sizePx / viewWidth) * 100
}

function getNarrowViewportMinSidebarWidthPx(viewWidth: number): number {
	const narrowMax = 1000
	const narrowMin = 768
	const minWidthAtNarrowMax = 220
	const minWidthAtNarrowMin = 196

	// Keep continuity at 1000px to avoid flicker/jump.
	// Above 1000px we still enforce a 220px floor and let percentage
	// naturally decrease as viewport grows.
	if (viewWidth >= narrowMax) return minWidthAtNarrowMax
	if (viewWidth <= narrowMin) return minWidthAtNarrowMin

	const ratio = (viewWidth - narrowMin) / (narrowMax - narrowMin)
	return minWidthAtNarrowMin + ratio * (minWidthAtNarrowMax - minWidthAtNarrowMin)
}

function getMinSidebarSizePercent(viewWidth: number): number {
	const narrowViewportMinSidebarPercent = convertPxToPercentByViewWidth(
		getNarrowViewportMinSidebarWidthPx(viewWidth),
		viewWidth,
	)
	return Math.max(sidebarStore.MIN_WIDTH_PERCENT, narrowViewportMinSidebarPercent)
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
	const [minSidebarSizePercent, setMinSidebarSizePercent] = useState(() =>
		getMinSidebarSizePercent(window.innerWidth),
	)

	const getExpandedSidebarSizePercent = useCallback((viewWidth: number) => {
		const minMainPx = sidebarStore.getMinMainContentWidthPx(viewWidth)
		const maxSidebarPercent = Math.max(
			sidebarStore.MIN_WIDTH_PERCENT,
			100 - (minMainPx / viewWidth) * 100,
		)
		const minSidebarPercent = getMinSidebarSizePercent(viewWidth)
		const desiredPercent = convertPxToPercent(expandedSidebarWidthPxRef.current)
		return Math.max(
			minSidebarPercent,
			Math.min(maxSidebarPercent, sidebarStore.MAX_WIDTH_PERCENT, desiredPercent),
		)
	}, [])

	const syncSidebarByViewport = useCallback(
		(isShrinking: boolean) => {
			const viewWidth = window.innerWidth
			const autoCollapseThreshold = sidebarStore.getAutoCollapseThresholdPx(
				viewWidth,
				expandedSidebarWidthPxRef.current,
			)
			if (viewWidth <= autoCollapseThreshold) {
				// Only auto-collapse when the window is shrinking, not when expanding
				if (isShrinking && !sidebarStore.collapsed) sidebarStore.setCollapsed(true)
				return
			}
			if (sidebarStore.collapsed || !sidebarPanelRef.current) return

			const nextSizePercent = getExpandedSidebarSizePercent(viewWidth)
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
			setMinSidebarSizePercent(getMinSidebarSizePercent(currentWidth))
			syncSidebarByViewport(isShrinking)
		}

		// Initial load: keep persisted expanded/collapsed; shrink-triggered collapse runs in handleResize.
		syncSidebarByViewport(false)
		window.addEventListener("resize", handleResize)
		// When user explicitly expands the sidebar, only resize the panel
		// to the correct size - never force re-collapse here (that would
		// prevent the user from opening the sidebar on narrow screens).
		const dispose = reaction(
			() => sidebarStore.collapsed,
			(collapsed) => {
				if (collapsed || !sidebarPanelRef.current) return
				const nextSizePercent = getExpandedSidebarSizePercent(window.innerWidth)
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
		minSidebarSizePercent,
	}
}

export default useSidebarResponsive
