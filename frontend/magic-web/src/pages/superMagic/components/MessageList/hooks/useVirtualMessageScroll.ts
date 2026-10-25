import { getPrependedVirtualItemCount } from "../virtual-message-items"
import {
	type MutableRefObject,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { debounce, throttle } from "lodash-es"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { MessageListScrollAdapter } from "../message-list-scroll-adapter"
import { MESSAGE_LIST_VIEWPORT_SELECTOR } from "../message-list-viewport"
import {
	beginExplicitScroll,
	beginFollowOutput,
	beginHistoryAnchor,
	beginUserScroll,
	canFollowOutput,
	finishCorrection,
	initialScrollOwnership,
	type ScrollOwnershipState,
} from "../scroll-ownership"
import { useMemoizedFn } from "ahooks"

const DEFAULT_MIN_TOP_DISTANCE = 400
const MIN_BOTTOM_DISTANCE = 50
const BACK_TO_LATEST_OFFSET = 100
const SHRINK_SUPPRESS_DURATION = 300
/** Screens left for the animation after an explicit jump has closed the rest instantly. */
const SMOOTH_TAIL_VIEWPORTS = 1

interface VirtualScrollItem {
	key: string
}

interface UseVirtualMessageScrollOptions {
	containerRef: RefObject<HTMLDivElement | null>
	virtualizerRef: MutableRefObject<MessageListScrollAdapter | null>
	projectionKey?: string
	projectionInteractionKey?: string
	items: ReadonlyArray<VirtualScrollItem>
	topicKey: string
	onPullMore?: () => void | Promise<unknown>
	/** Distance from the top at which a fresh upward gesture may load one history page. */
	minTopDistance?: number
	/** Whether measurement growth may follow the latest row; explicit jumps ignore this gate. */
	allowFollowOutput?: boolean
}

export interface UseVirtualMessageScrollReturn {
	prepareProjectionChange: (key?: string) => void
	showBackToLatest: boolean
	scrollToBottom: (behavior?: ScrollBehavior) => void
	notifyPullMoreStarted: () => void
	onVirtualizerChange: (instance: MessageListScrollAdapter, sync: boolean) => void
}

// 下方历史滚动契约适用于分页和流式输出；简洁模式切换另外保留可见行或底部，用户新手势会取消该位置恢复。
/**
 * Owns scroll *intent*; the virtualizer owns scroll *position*.
 *
 * Keeping the viewport stable across prepends and row measurement is `shift` + the virtualizer's
 * internal compensation, so this hook never restores an anchor by hand. It only issues the two
 * writes a chat list genuinely needs — an explicit jump to latest, and following streaming output
 * while the user is parked at the bottom — and gates both through the ownership state machine so
 * they can never fight a gesture that is still in progress.
 */
export function useVirtualMessageScroll({
	containerRef,
	virtualizerRef,
	items,
	projectionKey = "",
	projectionInteractionKey = "",
	topicKey,
	onPullMore,
	minTopDistance = DEFAULT_MIN_TOP_DISTANCE,
	allowFollowOutput = true,
}: UseVirtualMessageScrollOptions): UseVirtualMessageScrollReturn {
	const [showBackToLatest, setShowBackToLatest] = useState(false)
	const itemsRef = useRef(items)
	const pendingProjectionAnchor = useRef<{ key: string; offset: number } | "bottom" | null>(null)
	const previousProjectionKey = useRef(projectionKey)
	const previousInteractionKey = useRef(projectionInteractionKey)
	const captureProjectionAnchor = (key?: string) => {
		const viewport = containerRef.current
		const adapter = virtualizerRef.current
		if (!viewport || !adapter) return
		if (
			!key &&
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < MIN_BOTTOM_DISTANCE
		) {
			pendingProjectionAnchor.current = "bottom"
			return
		}
		const oldItems = itemsRef.current
		if (oldItems.length === 0) return
		const retainedKeys = new Set(items.map((item) => item.key))
		// 页脚有独立虚拟索引，阅读锚点只能指向消息或过程控制行。
		const visibleIndex = Math.min(
			adapter.findItemIndex(adapter.scrollOffset),
			oldItems.length - 1,
		)
		let index = key ? oldItems.findIndex((item) => item.key === key) : visibleIndex
		if (!key) {
			while (index < oldItems.length && !retainedKeys.has(oldItems[index].key)) index += 1
			if (index >= oldItems.length) {
				index = visibleIndex
				while (index >= 0 && !retainedKeys.has(oldItems[index].key)) index -= 1
			}
		}
		if (index >= 0 && oldItems[index])
			pendingProjectionAnchor.current = {
				key: oldItems[index].key,
				offset: adapter.getItemOffset(index) - adapter.scrollOffset,
			}
	}
	if (previousProjectionKey.current !== projectionKey) {
		const isHistoryPrepend =
			previousInteractionKey.current === projectionInteractionKey &&
			getPrependedVirtualItemCount(itemsRef.current, items) > 0
		if (!pendingProjectionAnchor.current && !isHistoryPrepend) captureProjectionAnchor()
		previousInteractionKey.current = projectionInteractionKey
		previousProjectionKey.current = projectionKey
	}
	itemsRef.current = items
	const onPullMoreRef = useRef(onPullMore)
	onPullMoreRef.current = onPullMore
	const allowFollowOutputRef = useRef(allowFollowOutput)
	allowFollowOutputRef.current = allowFollowOutput

	const ownershipRef = useRef<ScrollOwnershipState>(initialScrollOwnership())
	/**
	 * Sticky follow preference, deliberately distinct from "currently near the bottom": a fresh
	 * topic must land at the latest message even though its viewport starts at offset 0.
	 */
	const autoFollowRef = useRef(true)
	/** A jump to latest that was raised before the virtualizer could serve it. */
	const pendingScrollToLatestRef = useRef(false)
	const guardTimerRef = useRef<number | null>(null)
	const previousScrollTopRef = useRef(0)
	const isUserScrollInteractionRef = useRef(false)
	const userHistoryIntentRef = useRef(false)
	const lastScrollSizeRef = useRef(0)
	const historyLoadStateRef = useRef<"idle" | "requesting">("idle")
	const historyRequestIdRef = useRef(0)
	const prevTopicKeyRef = useRef(topicKey)
	const previousItemCountRef = useRef(items.length)

	const clearGuard = useCallback(() => {
		if (guardTimerRef.current === null) return
		window.clearTimeout(guardTimerRef.current)
		guardTimerRef.current = null
	}, [])

	/**
	 * A jump to latest is not self-correcting. virtua derives its target from the projected total
	 * size, which still counts unmeasured rows at their estimate, and its smooth path additionally
	 * refuses to move while any row in the current range is unmeasured — after 150ms of quiet it
	 * drops the request outright. Either way the list can settle short of the bottom, and the
	 * explicit guard suppresses follow-output for its whole duration, so nothing else notices.
	 * Close the remaining gap once the guard expires, using the instant write whose virtua path
	 * re-derives the target on every measurement update.
	 */
	const reconcileScrollToLatest = useCallback(() => {
		// An upward gesture during the guard revokes the jump exactly as it revokes follow.
		if (!autoFollowRef.current) return

		const viewport = containerRef.current
		const virtualizer = virtualizerRef.current
		const lastIndex = virtualizer ? virtualizer.itemCount - 1 : -1
		if (!viewport || !virtualizer || lastIndex < 0) return

		const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
		if (distanceToBottom <= MIN_BOTTOM_DISTANCE) return

		ownershipRef.current = beginExplicitScroll(ownershipRef.current)
		virtualizer.scrollToIndex(lastIndex, { align: "end" })
		ownershipRef.current = finishCorrection(ownershipRef.current, "explicit")
	}, [containerRef, virtualizerRef])

	const startGuard = useCallback(
		(duration: number, reconcileToLatest = false) => {
			clearGuard()
			guardTimerRef.current = window.setTimeout(() => {
				guardTimerRef.current = null
				pendingProjectionAnchor.current = null
				ownershipRef.current = finishCorrection(ownershipRef.current, "explicit")
				// Carried in the closure so `clearGuard` — which a fresh gesture calls — drops the
				// correction along with the guard it belonged to.
				if (reconcileToLatest) reconcileScrollToLatest()
			}, duration)
		},
		[clearGuard, reconcileScrollToLatest],
	)

	/**
	 * Both jumps that matter on arrival — mount and topic switch — run while the list has
	 * published its adapter but not yet the virtualizer behind it, because the scroll element
	 * only exists after that first render. Writing there is a no-op, and claiming `explicit`
	 * ownership for it is actively harmful: it suppresses the follow-output signal that fires
	 * the moment the virtualizer does mount, which is the only thing left able to carry the
	 * intent out. So park the intent instead and let that signal flush it.
	 */
	const requestScrollToLatest = useCallback(
		(smooth: boolean, guardDuration: number) => {
			autoFollowRef.current = true
			userHistoryIntentRef.current = false

			const virtualizer = virtualizerRef.current
			const lastIndex = virtualizer ? virtualizer.itemCount - 1 : -1
			if (!virtualizer || lastIndex < 0) {
				pendingScrollToLatestRef.current = true
				return
			}

			pendingScrollToLatestRef.current = false
			ownershipRef.current = beginExplicitScroll(ownershipRef.current)
			startGuard(guardDuration, true)

			const viewport = containerRef.current
			const distanceToBottom = viewport
				? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
				: 0

			/**
			 * Moving scrollTop during a smooth scroll would cancel it, so virtua answers a row
			 * that grows mid-animation by shifting the origin every row is positioned from
			 * instead, and hands the shift back at the end of a scroll it did not drive itself —
			 * which its own animation never is. Whatever the rows grew by therefore stays in the
			 * origin until the next gesture, lifting the whole list out the top of the viewport.
			 *
			 * Sending a message walks straight into it, because the new User row is measured for
			 * the first time while the animation runs. It is also the case with nothing to
			 * animate: following output keeps the list at the bottom, so the jump it asks for is
			 * already there. Spend the animation only where there is really distance to cover.
			 */
			const animate = smooth && distanceToBottom > MIN_BOTTOM_DISTANCE

			/**
			 * A history page arrives as rows virtua has never measured, and its smooth path stalls
			 * on exactly that: it waits for every row in the current range to be measured, then
			 * abandons the request. Cover the bulk of the distance instantly and leave only the
			 * last screen — rows the user has already scrolled through, so their sizes are
			 * cached — to the animation.
			 */
			if (animate && viewport && viewport.clientHeight > 0) {
				const tailStart =
					viewport.scrollHeight - viewport.clientHeight * (SMOOTH_TAIL_VIEWPORTS + 1)
				if (tailStart > viewport.scrollTop) virtualizer.scrollTo(tailStart)
			}

			virtualizer.scrollToIndex(lastIndex, { align: "end", smooth: animate })
		},
		[containerRef, startGuard, virtualizerRef],
	)

	const scrollToBottom = useCallback(
		(behavior: ScrollBehavior = "smooth") => {
			const smooth = behavior === "smooth"
			requestScrollToLatest(smooth, smooth ? 1000 : 300)
		},
		[requestScrollToLatest],
	)

	const prepareProjectionChange = useMemoizedFn((key?: string) => {
		captureProjectionAnchor(key)
		if (key) {
			autoFollowRef.current = false
			pendingScrollToLatestRef.current = false
		}
	})
	useLayoutEffect(() => {
		if (!pendingProjectionAnchor.current) return
		ownershipRef.current = beginExplicitScroll(ownershipRef.current)
		userHistoryIntentRef.current = false
		startGuard(SHRINK_SUPPRESS_DURATION)
	}, [projectionKey, startGuard])

	/**
	 * Retained for the eight `handlePullMoreMessage(topic, callback)` call sites. Anchor capture
	 * is gone — the virtualizer's `shift` compensation covers restoration — so this only records
	 * that a history page owns the next layout pass.
	 */

	const notifyPullMoreStarted = useCallback(() => {
		ownershipRef.current = beginHistoryAnchor(
			ownershipRef.current,
			ownershipRef.current.generation + 1,
		)
	}, [])

	const finishHistoryLoad = useCallback(() => {
		historyLoadStateRef.current = "idle"
		// A page request consumes exactly one gesture; scroll events emitted while it was in
		// flight must not authorize the next page.
		userHistoryIntentRef.current = false
		ownershipRef.current = finishCorrection(ownershipRef.current, "history-anchor")
	}, [])

	if (prevTopicKeyRef.current !== topicKey) {
		prevTopicKeyRef.current = topicKey
		pendingProjectionAnchor.current = null
		autoFollowRef.current = true
		previousScrollTopRef.current = 0
		userHistoryIntentRef.current = false
		isUserScrollInteractionRef.current = false
		lastScrollSizeRef.current = 0
		historyLoadStateRef.current = "idle"
		historyRequestIdRef.current += 1
		pendingScrollToLatestRef.current = false
		ownershipRef.current = initialScrollOwnership()
		previousItemCountRef.current = items.length
	}

	useEffect(() => {
		setShowBackToLatest(false)
		clearGuard()
		finishHistoryLoad()
		scrollToBottom("auto")
	}, [clearGuard, finishHistoryLoad, scrollToBottom, topicKey])

	useLayoutEffect(() => {
		const previousItemCount = previousItemCountRef.current
		previousItemCountRef.current = items.length
		if (items.length >= previousItemCount) return

		// Authoritative replace/replace_tail can legitimately remove rows. The browser clamps
		// scrollTop as the canvas shrinks; that layout correction is not an upward gesture and
		// must not start another history-page request or a follow write.
		userHistoryIntentRef.current = false
		ownershipRef.current = {
			...ownershipRef.current,
			generation: ownershipRef.current.generation + 1,
			userIntent: "none",
			suppressUntil: Date.now() + SHRINK_SUPPRESS_DURATION,
		}
		if (historyLoadStateRef.current === "idle") finishHistoryLoad()
	}, [finishHistoryLoad, items])

	useEffect(() => {
		const viewport = containerRef.current
		if (!viewport) return undefined
		previousScrollTopRef.current = viewport.scrollTop

		const settleHistoryRequest = (requestId: number) => {
			if (historyRequestIdRef.current !== requestId) return
			finishHistoryLoad()
		}

		const pullMessages = debounce(() => {
			if (
				!userHistoryIntentRef.current ||
				historyLoadStateRef.current !== "idle" ||
				guardTimerRef.current !== null
			) {
				return
			}

			if (viewport.scrollTop >= minTopDistance) {
				// Do not carry an upward intent past the threshold, otherwise a later
				// streaming/layout scroll could be mistaken for a new user gesture.
				userHistoryIntentRef.current = false
				return
			}

			userHistoryIntentRef.current = false
			historyLoadStateRef.current = "requesting"
			ownershipRef.current = beginHistoryAnchor(
				ownershipRef.current,
				ownershipRef.current.generation + 1,
			)
			const requestId = ++historyRequestIdRef.current
			let result: void | Promise<unknown>
			try {
				result = onPullMoreRef.current?.()
			} catch {
				settleHistoryRequest(requestId)
				return
			}
			void Promise.resolve(result).then(
				() => settleHistoryRequest(requestId),
				() => settleHistoryRequest(requestId),
			)
		}, 300)

		const handleScroll = throttle(
			() => {
				const scrollSize = viewport.scrollHeight
				const distanceToBottom = scrollSize - viewport.scrollTop - viewport.clientHeight
				const nearBottom = distanceToBottom < MIN_BOTTOM_DISTANCE
				const isProgrammatic = guardTimerRef.current !== null
				const movedUp = viewport.scrollTop < previousScrollTopRef.current
				const movedDown = viewport.scrollTop > previousScrollTopRef.current
				previousScrollTopRef.current = viewport.scrollTop

				if (
					!isProgrammatic &&
					isUserScrollInteractionRef.current &&
					(movedUp || movedDown)
				) {
					ownershipRef.current = beginUserScroll(
						ownershipRef.current,
						movedUp ? "backward" : "forward",
						nearBottom,
					)
					if (movedUp) {
						if (historyLoadStateRef.current === "idle") {
							userHistoryIntentRef.current = true
						}
					} else {
						userHistoryIntentRef.current = false
					}
				}

				setShowBackToLatest(
					viewport.scrollTop + viewport.clientHeight + BACK_TO_LATEST_OFFSET < scrollSize,
				)

				if (!isProgrammatic) {
					if (
						movedUp &&
						(isUserScrollInteractionRef.current || userHistoryIntentRef.current)
					) {
						autoFollowRef.current = false
					} else if (nearBottom && movedDown) {
						// Re-enable follow only after an explicit downward gesture reaches bottom.
						autoFollowRef.current = true
					}
				}

				if (
					!isProgrammatic &&
					historyLoadStateRef.current === "idle" &&
					userHistoryIntentRef.current
				) {
					pullMessages()
				}
			},
			16,
			{ leading: false, trailing: true },
		)

		/**
		 * A gesture inside a nested scroller (code block preview, share shell) belongs to that
		 * element. The main viewport no longer carries `data-slot="scroll-area-viewport"`, so a
		 * non-nested target simply resolves to null or to the viewport itself.
		 */
		const isNestedScrollGesture = (target: EventTarget | null) => {
			const nested =
				target instanceof Element ? target.closest(MESSAGE_LIST_VIEWPORT_SELECTOR) : null
			return Boolean(nested) && nested !== viewport
		}

		const handleWheel = (event: WheelEvent) => {
			pendingProjectionAnchor.current = null
			if (isNestedScrollGesture(event.target)) return

			if (historyLoadStateRef.current !== "idle") {
				if (event.deltaY >= 0) userHistoryIntentRef.current = false
				return
			}
			if (event.deltaY >= 0) {
				userHistoryIntentRef.current = false
				return
			}
			userHistoryIntentRef.current = true
			// User intent must win immediately, even while the viewport is still within the
			// bottom tolerance. Otherwise a resize in the same gesture can pull it back down.
			autoFollowRef.current = false
			ownershipRef.current = beginUserScroll(ownershipRef.current, "backward", false)
			clearGuard()
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (isNestedScrollGesture(event.target)) return
			pendingProjectionAnchor.current = null
			isUserScrollInteractionRef.current = true
		}
		const handlePointerEnd = () => {
			isUserScrollInteractionRef.current = false
		}

		viewport.addEventListener("scroll", handleScroll)
		viewport.addEventListener("wheel", handleWheel, { passive: true })
		viewport.addEventListener("pointerdown", handlePointerDown, { passive: true })
		window.addEventListener("pointerup", handlePointerEnd, { passive: true })
		window.addEventListener("pointercancel", handlePointerEnd, { passive: true })

		return () => {
			viewport.removeEventListener("scroll", handleScroll)
			viewport.removeEventListener("wheel", handleWheel)
			viewport.removeEventListener("pointerdown", handlePointerDown)
			window.removeEventListener("pointerup", handlePointerEnd)
			window.removeEventListener("pointercancel", handlePointerEnd)
			pullMessages.cancel()
			handleScroll.cancel()
		}
	}, [clearGuard, containerRef, finishHistoryLoad, minTopDistance])

	const onVirtualizerChange = useMemoizedFn((instance: MessageListScrollAdapter) => {
		const anchor = pendingProjectionAnchor.current
		if (anchor) {
			if (anchor === "bottom")
				instance.scrollToIndex(instance.itemCount - 1, { align: "end" })
			else {
				const index = itemsRef.current.findIndex((item) => item.key === anchor.key)
				if (index >= 0) {
					const offset = instance.getItemOffset(index) - anchor.offset
					if (Math.abs(instance.scrollOffset - offset) > 1) instance.scrollTo(offset)
				} else pendingProjectionAnchor.current = null
			}
			return
		}
		const scrollSize = instance.scrollSize
		const previousScrollSize = lastScrollSizeRef.current
		lastScrollSizeRef.current = scrollSize

		const lastIndex = instance.itemCount - 1
		if (lastIndex < 0) return

		// The virtualizer has just become writable, so a parked jump can finally land. It does
		// not have to wait for the size to grow the way follow-output does, but an upward
		// gesture in the meantime revokes it exactly as it revokes follow.
		if (pendingScrollToLatestRef.current) {
			pendingScrollToLatestRef.current = false
			if (!autoFollowRef.current) return
			ownershipRef.current = beginExplicitScroll(ownershipRef.current)
			instance.scrollToIndex(lastIndex, { align: "end" })
			ownershipRef.current = finishCorrection(ownershipRef.current, "explicit")
			return
		}

		if (
			!allowFollowOutputRef.current ||
			!canFollowOutput(ownershipRef.current, {
				totalSizeIncreased: scrollSize > previousScrollSize,
				nearBottom: autoFollowRef.current,
			})
		) {
			return
		}

		ownershipRef.current = beginFollowOutput(ownershipRef.current)
		instance.scrollToIndex(lastIndex, { align: "end" })
		ownershipRef.current = finishCorrection(ownershipRef.current, "follow-output")
	})

	useEffect(() => {
		pubsub.subscribe(
			PubSubEvents.Message_Scroll_To_Bottom,
			(options?: { behavior?: ScrollBehavior; time?: number }) =>
				requestScrollToLatest(options?.behavior !== "auto", options?.time || 1000),
		)
		pubsub.subscribe(
			PubSubEvents.Message_Register_Programmatic_Scroll,
			(options?: { time?: number }) => startGuard(options?.time || 480),
		)
		const handleSuppressAutoScroll = () => {
			ownershipRef.current = {
				...ownershipRef.current,
				suppressUntil: Date.now() + SHRINK_SUPPRESS_DURATION,
			}
		}
		pubsub.subscribe(PubSubEvents.Message_Suppress_Auto_Scroll, handleSuppressAutoScroll)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Message_Scroll_To_Bottom)
			pubsub.unsubscribe(PubSubEvents.Message_Register_Programmatic_Scroll)
			pubsub.unsubscribe(PubSubEvents.Message_Suppress_Auto_Scroll, handleSuppressAutoScroll)
		}
	}, [requestScrollToLatest, startGuard])

	useEffect(() => () => clearGuard(), [clearGuard])

	return {
		prepareProjectionChange,
		showBackToLatest,
		scrollToBottom,
		notifyPullMoreStarted,
		onVirtualizerChange,
	}
}
