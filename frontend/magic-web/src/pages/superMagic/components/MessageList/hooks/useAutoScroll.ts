import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { debounce, throttle } from "lodash-es"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

const MIN_TOP_DISTANCE = 400
const MIN_BOTTOM_DISTANCE = 50
const BACK_TO_LATEST_OFFSET = 100

interface UseAutoScrollOptions {
	containerRef: RefObject<HTMLDivElement | null>
	topicKey: string
	onPullMore?: () => void
}

interface UseAutoScrollReturn {
	showBackToLatest: boolean
	scrollToBottom: (behavior?: ScrollBehavior) => void
	notifyPullMoreStarted: () => void
}

/**
 * Manages auto-scroll-to-bottom for a scrollable message list.
 *
 * Uses a ResizeObserver on the content wrapper to follow new content,
 * a scroll-guard mechanism to protect programmatic scrolls from user-scroll
 * interference, and PubSub integration for external scroll requests.
 */
export function useAutoScroll({
	containerRef,
	topicKey,
	onPullMore,
}: UseAutoScrollOptions): UseAutoScrollReturn {
	const [showBackToLatest, setShowBackToLatest] = useState(false)

	const autoFollowRef = useRef(true)
	const guardTimerRef = useRef<number | null>(null)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)
	const prevTopicKeyRef = useRef(topicKey)
	const onPullMoreRef = useRef(onPullMore)
	onPullMoreRef.current = onPullMore

	const isResizeScrollingRef = useRef(false)
	const resizeScrollTimerRef = useRef<number>(0)
	const suppressUntilRef = useRef(0)

	const pullMoreSnapshotRef = useRef<{
		scrollTop: number
		scrollHeight: number
	} | null>(null)

	const clearGuard = useCallback(() => {
		if (guardTimerRef.current !== null) {
			window.clearTimeout(guardTimerRef.current)
			guardTimerRef.current = null
		}
	}, [])

	const startGuard = useCallback(
		(duration: number) => {
			clearGuard()
			guardTimerRef.current = window.setTimeout(() => {
				guardTimerRef.current = null
			}, duration)
		},
		[clearGuard],
	)

	const scrollToBottom = useCallback(
		(behavior: ScrollBehavior = "smooth") => {
			const el = containerRef.current
			if (!el) return
			autoFollowRef.current = true
			startGuard(behavior === "smooth" ? 1000 : 300)
			el.scrollTo({ top: el.scrollHeight, behavior })
		},
		[containerRef, startGuard],
	)

	const notifyPullMoreStarted = useCallback(() => {
		const el = containerRef.current
		if (!el) return
		pullMoreSnapshotRef.current = {
			scrollTop: el.scrollTop,
			scrollHeight: el.scrollHeight,
		}
	}, [containerRef])

	// Reset on topic change (render-phase, skips first render)
	if (prevTopicKeyRef.current !== topicKey) {
		prevTopicKeyRef.current = topicKey
		autoFollowRef.current = true
		pullMoreSnapshotRef.current = null
	}

	// Scroll to bottom + reset UI on topic change (including initial mount)
	useEffect(() => {
		setShowBackToLatest(false)
		clearGuard()
		const el = containerRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [topicKey, clearGuard, containerRef])

	// ResizeObserver: auto-scroll when content height changes
	useEffect(() => {
		const viewport = containerRef.current
		if (!viewport) return

		const contentWrapper = viewport.firstElementChild as HTMLElement | null
		if (!contentWrapper) return

		const observer = new ResizeObserver(() => {
			if (pullMoreSnapshotRef.current) {
				const { scrollTop, scrollHeight } = pullMoreSnapshotRef.current
				// 只有当内容高度增加时才执行 pullMore 恢复逻辑（拉取更多消息只会增加内容）。
				// 如果高度减少或不变，说明是其他操作（如引用展开/收起）触发的 resize，
				// 应丢弃过期的 snapshot，走正常逻辑。
				if (viewport.scrollHeight > scrollHeight) {
					pullMoreSnapshotRef.current = null
					viewport.scrollTop = scrollTop + (viewport.scrollHeight - scrollHeight)
					return
				}
				// snapshot 过期，丢弃
				pullMoreSnapshotRef.current = null
			}

			const now = Date.now()

			if (!autoFollowRef.current) return

			if (now < suppressUntilRef.current) {
				return
			}

			isResizeScrollingRef.current = true
			window.clearTimeout(resizeScrollTimerRef.current)
			viewport.scrollTop = viewport.scrollHeight
			resizeScrollTimerRef.current = window.setTimeout(() => {
				isResizeScrollingRef.current = false
			}, 100)
		})

		observer.observe(contentWrapper)
		resizeObserverRef.current = observer

		return () => {
			observer.disconnect()
			resizeObserverRef.current = null
		}
	}, [containerRef])

	// Scroll + wheel event handlers
	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const pullMessages = debounce(() => {
			if (el.scrollTop < MIN_TOP_DISTANCE) onPullMoreRef.current?.()
		}, 300)

		const handleScroll = throttle(
			() => {
				const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight

				setShowBackToLatest(
					el.scrollTop + el.clientHeight + BACK_TO_LATEST_OFFSET < el.scrollHeight,
				)

				if (guardTimerRef.current === null && !isResizeScrollingRef.current) {
					autoFollowRef.current = distanceToBottom < MIN_BOTTOM_DISTANCE
				}

				pullMessages()
			},
			16,
			{ leading: false, trailing: true },
		)

		const handleWheel = (event: WheelEvent) => {
			if (event.deltaY >= 0) return
			if (guardTimerRef.current === null && !isResizeScrollingRef.current) return
			clearGuard()
			if (isResizeScrollingRef.current) {
				window.clearTimeout(resizeScrollTimerRef.current)
				isResizeScrollingRef.current = false
			}
			autoFollowRef.current = false
		}

		el.addEventListener("scroll", handleScroll)
		el.addEventListener("wheel", handleWheel, { passive: true })

		return () => {
			el.removeEventListener("scroll", handleScroll)
			el.removeEventListener("wheel", handleWheel)
			pullMessages.cancel()
			handleScroll.cancel()
		}
	}, [containerRef, clearGuard])

	// PubSub subscriptions
	useEffect(() => {
		pubsub.subscribe(
			PubSubEvents.Message_Scroll_To_Bottom,
			(options?: { behavior?: ScrollBehavior; time?: number }) => {
				const el = containerRef.current
				if (!el) return
				autoFollowRef.current = true
				startGuard(options?.time || 1000)
				el.scrollTo({
					top: el.scrollHeight,
					behavior: options?.behavior || "smooth",
				})
			},
		)
		pubsub.subscribe(
			PubSubEvents.Message_Register_Programmatic_Scroll,
			(options?: { time?: number }) => {
				startGuard(options?.time || 480)
			},
		)

		const handleSuppressAutoScroll = () => {
			suppressUntilRef.current = Date.now() + 300
		}
		pubsub.subscribe(PubSubEvents.Message_Suppress_Auto_Scroll, handleSuppressAutoScroll)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Message_Scroll_To_Bottom)
			pubsub.unsubscribe(PubSubEvents.Message_Register_Programmatic_Scroll)
			pubsub.unsubscribe(
				PubSubEvents.Message_Suppress_Auto_Scroll,
				handleSuppressAutoScroll as any,
			)
		}
	}, [containerRef, startGuard])

	// Cleanup on unmount
	useEffect(
		() => () => {
			clearGuard()
			window.clearTimeout(resizeScrollTimerRef.current)
			resizeObserverRef.current?.disconnect()
		},
		[clearGuard],
	)

	return { showBackToLatest, scrollToBottom, notifyPullMoreStarted }
}
