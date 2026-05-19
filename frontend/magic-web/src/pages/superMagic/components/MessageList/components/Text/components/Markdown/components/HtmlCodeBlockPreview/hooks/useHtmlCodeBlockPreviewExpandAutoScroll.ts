import { useCallback, useEffect, useRef } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { HtmlCodeBlockPreviewMode } from "../types"

interface UseHtmlCodeBlockPreviewExpandAutoScrollOptions {
	isExpanded: boolean
	viewMode: HtmlCodeBlockPreviewMode
	getScrollTargetElement?: () => HTMLElement | null
}

const HTML_CODE_BLOCK_PREVIEW_EXPAND_SCROLL_PADDING = 16
const HTML_CODE_BLOCK_PREVIEW_EXPAND_SCROLL_SETTLE_DELAY = 220
const HTML_CODE_BLOCK_PREVIEW_RESIZE_SCROLL_SETTLE_DELAY = 96
const HTML_CODE_BLOCK_PREVIEW_INTERACTION_SCROLL_WINDOW = 480
const HTML_CODE_BLOCK_PREVIEW_PROGRAMMATIC_SCROLL_DURATION = 640

function findScrollableAncestor(element: HTMLElement | null) {
	let currentElement = element?.parentElement ?? null

	while (currentElement) {
		const computedStyle = window.getComputedStyle(currentElement)
		const overflowY = computedStyle.overflowY
		const isScrollable =
			(overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
			currentElement.scrollHeight > currentElement.clientHeight

		if (isScrollable) return currentElement
		currentElement = currentElement.parentElement
	}

	return null
}

export function useHtmlCodeBlockPreviewExpandAutoScroll(
	options: UseHtmlCodeBlockPreviewExpandAutoScrollOptions,
) {
	const { isExpanded, viewMode, getScrollTargetElement } = options
	const previewCardElementRef = useRef<HTMLDivElement | null>(null)
	const previousExpandedRef = useRef(isExpanded)
	const previousViewModeRef = useRef(viewMode)
	const animationFrameRef = useRef<number | null>(null)
	const settleTimerRef = useRef<number | null>(null)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)
	const interactionWindowTimerRef = useRef<number | null>(null)
	const isResizeAutoScrollArmedRef = useRef(false)

	const clearScheduledScroll = useCallback(() => {
		if (animationFrameRef.current !== null) {
			window.cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}

		if (settleTimerRef.current !== null) {
			window.clearTimeout(settleTimerRef.current)
			settleTimerRef.current = null
		}

		if (resizeObserverRef.current) {
			resizeObserverRef.current.disconnect()
			resizeObserverRef.current = null
		}

		if (interactionWindowTimerRef.current !== null) {
			window.clearTimeout(interactionWindowTimerRef.current)
			interactionWindowTimerRef.current = null
		}

		isResizeAutoScrollArmedRef.current = false
	}, [])

	const setPreviewCardElement = useCallback((element: HTMLDivElement | null) => {
		previewCardElementRef.current = element
	}, [])

	const armResizeAutoScroll = useCallback(
		(duration = HTML_CODE_BLOCK_PREVIEW_INTERACTION_SCROLL_WINDOW) => {
			if (interactionWindowTimerRef.current !== null) {
				window.clearTimeout(interactionWindowTimerRef.current)
			}

			isResizeAutoScrollArmedRef.current = true
			interactionWindowTimerRef.current = window.setTimeout(() => {
				isResizeAutoScrollArmedRef.current = false
				interactionWindowTimerRef.current = null
			}, duration)
		},
		[],
	)

	const scrollPreviewBottomIntoView = useCallback(() => {
		const previewCardElement = previewCardElementRef.current
		if (!previewCardElement) return
		const scrollTargetElement = getScrollTargetElement?.() ?? previewCardElement

		const viewportElement =
			previewCardElement.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ??
			findScrollableAncestor(previewCardElement)

		if (!viewportElement) return

		const previewCardRect = scrollTargetElement.getBoundingClientRect()
		const viewportRect = viewportElement.getBoundingClientRect()
		const bottomOverflow =
			previewCardRect.bottom -
			viewportRect.bottom +
			HTML_CODE_BLOCK_PREVIEW_EXPAND_SCROLL_PADDING

		if (bottomOverflow <= 0) return

		const targetTop = viewportElement.scrollTop + bottomOverflow
		pubsub.publish(PubSubEvents.Message_Register_Programmatic_Scroll, {
			time: HTML_CODE_BLOCK_PREVIEW_PROGRAMMATIC_SCROLL_DURATION,
		})

		if (typeof viewportElement.scrollTo === "function") {
			viewportElement.scrollTo({
				top: targetTop,
				behavior: "smooth",
			})
			return
		}

		viewportElement.scrollTop = targetTop
	}, [getScrollTargetElement])

	const scheduleScroll = useCallback(
		(delay = 0) => {
			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}

			if (settleTimerRef.current !== null) {
				window.clearTimeout(settleTimerRef.current)
				settleTimerRef.current = null
			}

			animationFrameRef.current = window.requestAnimationFrame(() => {
				animationFrameRef.current = null

				if (delay <= 0) {
					scrollPreviewBottomIntoView()
					return
				}

				settleTimerRef.current = window.setTimeout(() => {
					scrollPreviewBottomIntoView()
					settleTimerRef.current = null
				}, delay)
			})
		},
		[scrollPreviewBottomIntoView],
	)

	useEffect(() => {
		const wasExpanded = previousExpandedRef.current
		previousExpandedRef.current = isExpanded
		const previousViewMode = previousViewModeRef.current
		previousViewModeRef.current = viewMode

		if (!isExpanded) {
			clearScheduledScroll()
			return
		}

		if (!wasExpanded) {
			clearScheduledScroll()
			armResizeAutoScroll()
			scheduleScroll()
			scheduleScroll(HTML_CODE_BLOCK_PREVIEW_EXPAND_SCROLL_SETTLE_DELAY)
		} else if (previousViewMode !== viewMode && viewMode !== "code") {
			armResizeAutoScroll()
			scheduleScroll(HTML_CODE_BLOCK_PREVIEW_RESIZE_SCROLL_SETTLE_DELAY)
		}

		const previewCardElement = previewCardElementRef.current
		if (!previewCardElement || typeof ResizeObserver === "undefined") {
			return clearScheduledScroll
		}

		resizeObserverRef.current = new ResizeObserver(() => {
			if (!isResizeAutoScrollArmedRef.current) return
			scheduleScroll(HTML_CODE_BLOCK_PREVIEW_RESIZE_SCROLL_SETTLE_DELAY)
		})
		resizeObserverRef.current.observe(previewCardElement)

		return clearScheduledScroll
	}, [armResizeAutoScroll, clearScheduledScroll, isExpanded, scheduleScroll, viewMode])

	useEffect(() => clearScheduledScroll, [clearScheduledScroll])

	return {
		setPreviewCardElement,
	}
}
