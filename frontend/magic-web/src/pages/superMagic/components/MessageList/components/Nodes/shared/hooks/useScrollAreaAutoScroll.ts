import { useCallback, useEffect, useRef } from "react"

const BOTTOM_THRESHOLD = 8

interface UseScrollAreaAutoScrollOptions {
	isStreaming: boolean
}

/**
 * Lightweight auto-scroll for inner ScrollArea containers during streaming.
 *
 * Returns a ref to pass as `viewportRef` on <ScrollArea>.
 * While streaming, new content auto-scrolls to the bottom.
 * If the user scrolls up, auto-follow pauses.
 * If the user scrolls back to the bottom, auto-follow resumes.
 */
export function useScrollAreaAutoScroll({ isStreaming }: UseScrollAreaAutoScrollOptions) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const autoFollowRef = useRef(true)
	const isResizeScrollingRef = useRef(false)
	const resizeTimerRef = useRef<number>(0)

	const isAtBottom = useCallback((el: HTMLElement) => {
		return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
	}, [])

	useEffect(() => {
		if (isStreaming) {
			autoFollowRef.current = true
		}
	}, [isStreaming])

	useEffect(() => {
		const viewport = viewportRef.current
		if (!viewport) return

		const contentWrapper = viewport.firstElementChild as HTMLElement | null
		if (!contentWrapper) return

		const observer = new ResizeObserver(() => {
			if (!autoFollowRef.current) return

			isResizeScrollingRef.current = true
			window.clearTimeout(resizeTimerRef.current)
			viewport.scrollTop = viewport.scrollHeight
			resizeTimerRef.current = window.setTimeout(() => {
				isResizeScrollingRef.current = false
			}, 80)
		})

		observer.observe(contentWrapper)

		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const el = viewportRef.current
		if (!el) return

		const handleScroll = () => {
			if (isResizeScrollingRef.current) return
			autoFollowRef.current = isAtBottom(el)
		}

		const handleWheel = (e: WheelEvent) => {
			if (e.deltaY < 0) {
				if (isResizeScrollingRef.current) {
					window.clearTimeout(resizeTimerRef.current)
					isResizeScrollingRef.current = false
				}
				autoFollowRef.current = false
			}
		}

		el.addEventListener("scroll", handleScroll, { passive: true })
		el.addEventListener("wheel", handleWheel, { passive: true })

		return () => {
			el.removeEventListener("scroll", handleScroll)
			el.removeEventListener("wheel", handleWheel)
		}
	}, [isAtBottom])

	useEffect(
		() => () => {
			window.clearTimeout(resizeTimerRef.current)
		},
		[],
	)

	return { viewportRef }
}
