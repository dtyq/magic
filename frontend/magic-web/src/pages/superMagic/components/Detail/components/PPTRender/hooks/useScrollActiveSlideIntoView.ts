import { useEffect } from "react"
import type { PPTStore } from "../stores"

interface UseScrollActiveSlideIntoViewOptions {
	store: PPTStore
	/**
	 * Delay before checking and scrolling (in milliseconds)
	 * 检查和滚动前的延迟（毫秒）
	 * @default 100
	 */
	delay?: number
	/**
	 * Enable/disable the auto-scroll behavior
	 * 启用/禁用自动滚动行为
	 * @default true
	 */
	enabled?: boolean
}

/**
 * Hook to automatically scroll the active slide into view when activeIndex changes
 * 当 activeIndex 变化时自动将激活的幻灯片滚动到可视区域
 *
 * Features:
 * - Only scrolls if the slide is not visible in the sidebar
 * - Uses smooth scrolling for better UX
 * - Minimal scroll distance (block: "nearest")
 * - Cleans up timeout on unmount
 *
 * @param options Configuration options
 */
export function useScrollActiveSlideIntoView({
	store,
	delay = 100,
	enabled = true,
}: UseScrollActiveSlideIntoViewOptions): void {
	useEffect(() => {
		if (!enabled) return

		// Wait a bit to ensure DOM is ready
		const timer = setTimeout(() => {
			// Find the active slide element in the sidebar using data attribute
			const activeSlideElement = document.querySelector(
				`[data-slide-index="${store.activeIndex}"]`,
			) as HTMLElement

			if (!activeSlideElement) {
				return
			}

			// Find the scroll container (ScrollArea viewport)
			const scrollContainer = activeSlideElement.closest(
				'[data-slot="scroll-area-viewport"]',
			) as HTMLElement

			if (!scrollContainer) {
				return
			}

			// Check if element is in view
			const elementRect = activeSlideElement.getBoundingClientRect()
			const containerRect = scrollContainer.getBoundingClientRect()

			// Check if slide is not fully visible
			// Add small margin to avoid edge cases
			const margin = 10
			const isNotInView =
				elementRect.top < containerRect.top + margin ||
				elementRect.bottom > containerRect.bottom - margin

			if (isNotInView) {
				// Scroll element into view with smooth animation
				activeSlideElement.scrollIntoView({
					behavior: "smooth",
					block: "nearest", // Minimal scroll distance
					inline: "nearest",
				})
			}
		}, delay)

		return () => clearTimeout(timer)
	}, [store.activeIndex, delay, enabled])
}
