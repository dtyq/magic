import { useCallback, useLayoutEffect, useRef } from "react"
import type { MutableRefObject } from "react"
import type { HtmlCodeBlockPreviewStreamingScrollState } from "../types"

// 流式 HTML 代码块滚动控制所需的输入。
// 目标是：内容持续增长时自动贴底，但一旦用户手动查看历史内容，就停止强制滚动。
interface HtmlCodeBlockPreviewStreamingScrollHookOptions {
	isStreaming: boolean
	hasCompletedFence: boolean
	codeContent: string
	streamingScrollStateRef?: MutableRefObject<HtmlCodeBlockPreviewStreamingScrollState>
}

// 只要用户离底部超过这个阈值，就认为用户正在主动查看历史内容。
const HTML_CODE_BLOCK_PREVIEW_STREAMING_SCROLL_BOTTOM_THRESHOLD = 10

// 这个 hook 专门处理“流式代码输出时自动滚到底”的行为。
// 它不会自己渲染 UI，只负责维护滚动状态和在合适的时机触发贴底滚动。
export function useHtmlCodeBlockPreviewStreamingScroll(
	options: HtmlCodeBlockPreviewStreamingScrollHookOptions,
) {
	const { isStreaming, hasCompletedFence, codeContent, streamingScrollStateRef } = options
	const scrollAreaElementRef = useRef<HTMLDivElement | null>(null)
	const localStreamingScrollStateRef = useRef<HtmlCodeBlockPreviewStreamingScrollState>({
		hasUserInteracted: false,
	})
	const effectiveStreamingScrollStateRef = streamingScrollStateRef ?? localStreamingScrollStateRef
	const isProgrammaticScrollRef = useRef(false)
	const lastProgrammaticScrollTopRef = useRef<number | null>(null)
	const animationFrameRef = useRef<number | null>(null)

	const setScrollAreaElement = useCallback((scrollAreaElement: HTMLDivElement | null) => {
		scrollAreaElementRef.current = scrollAreaElement
	}, [])

	useLayoutEffect(() => {
		// 这里依赖的是 ScrollArea 的 viewport，而不是外层容器本身。
		const viewportElement = scrollAreaElementRef.current?.querySelector<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		)

		if (!viewportElement) return

		function markUserInteracted() {
			const distanceToBottom =
				viewportElement.scrollHeight -
				viewportElement.scrollTop -
				viewportElement.clientHeight

			if (
				isProgrammaticScrollRef.current &&
				viewportElement.scrollTop === lastProgrammaticScrollTopRef.current
			) {
				// 忽略我们自己触发的滚动，避免把“自动贴底”误判成用户手动操作。
				return
			}

			effectiveStreamingScrollStateRef.current.hasUserInteracted =
				distanceToBottom > HTML_CODE_BLOCK_PREVIEW_STREAMING_SCROLL_BOTTOM_THRESHOLD
		}

		viewportElement.addEventListener("wheel", markUserInteracted, { passive: true })
		viewportElement.addEventListener("touchstart", markUserInteracted, { passive: true })
		viewportElement.addEventListener("pointerdown", markUserInteracted, { passive: true })
		viewportElement.addEventListener("scroll", markUserInteracted, { passive: true })

		return () => {
			viewportElement.removeEventListener("wheel", markUserInteracted)
			viewportElement.removeEventListener("touchstart", markUserInteracted)
			viewportElement.removeEventListener("pointerdown", markUserInteracted)
			viewportElement.removeEventListener("scroll", markUserInteracted)
		}
	}, [effectiveStreamingScrollStateRef, isStreaming, hasCompletedFence, codeContent])

	const scheduleScrollToBottom = useCallback((viewportElement: HTMLElement) => {
		const targetScrollTop = viewportElement.scrollHeight
		// 标记本次滚动为程序触发，供 scroll 监听器过滤。
		isProgrammaticScrollRef.current = true
		lastProgrammaticScrollTopRef.current = targetScrollTop
		viewportElement.scrollTop = targetScrollTop

		if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current)

		animationFrameRef.current = window.requestAnimationFrame(() => {
			// 下一帧后认为这次程序滚动已经结束，恢复正常用户交互检测。
			isProgrammaticScrollRef.current = false
		})
	}, [])

	useLayoutEffect(() => {
		if (!isStreaming || hasCompletedFence) {
			// 一旦流式结束，就重置交互状态，避免影响下一次新的流式内容。
			effectiveStreamingScrollStateRef.current.hasUserInteracted = false
			lastProgrammaticScrollTopRef.current = null

			if (animationFrameRef.current) {
				window.cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}

			return
		}

		const viewportElement = scrollAreaElementRef.current?.querySelector<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		)

		// 用户已经主动滚离底部时，不再强制把视图拉回去。
		if (!viewportElement || effectiveStreamingScrollStateRef.current.hasUserInteracted) return

		scheduleScrollToBottom(viewportElement)
	}, [
		codeContent,
		effectiveStreamingScrollStateRef,
		hasCompletedFence,
		isStreaming,
		scheduleScrollToBottom,
	])

	useLayoutEffect(() => {
		return () => {
			if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current)
		}
	}, [])

	return {
		setScrollAreaElement,
	}
}
