import { act, cleanup, renderHook } from "@testing-library/react"
import type { MutableRefObject } from "react"
import type { MessageListScrollAdapter } from "../../message-list-scroll-adapter"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useVirtualMessageScroll } from "../useVirtualMessageScroll"

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		Message_Scroll_To_Bottom: "Message_Scroll_To_Bottom",
		Message_Register_Programmatic_Scroll: "Message_Register_Programmatic_Scroll",
		Message_Suppress_Auto_Scroll: "Message_Suppress_Auto_Scroll",
	},
}))

function createViewport({
	scrollTop: initialScrollTop,
	clientHeight,
	scrollHeight = clientHeight,
}: {
	scrollTop: number
	clientHeight: number
	scrollHeight?: number
}) {
	const viewport = document.createElement("div")
	viewport.appendChild(document.createElement("div"))
	let scrollTop = initialScrollTop
	Object.defineProperties(viewport, {
		clientHeight: { configurable: true, value: clientHeight },
		scrollHeight: { configurable: true, writable: true, value: scrollHeight },
		scrollTop: {
			configurable: true,
			get: () => scrollTop,
			set: (value: number) => {
				scrollTop = Math.max(0, value)
			},
		},
	})
	return viewport
}

/** Stands in for virtua's `VirtualizerHandle`: index addressing over a fixed 100px row grid. */
function createVirtualizer(viewport: HTMLDivElement, itemCount: number, isMounted = () => true) {
	return {
		get itemCount() {
			// The list publishes its adapter one commit before the virtualizer behind it mounts,
			// and nothing is addressable until then.
			return isMounted() ? itemCount : 0
		},
		get scrollOffset() {
			return viewport.scrollTop
		},
		get scrollSize() {
			return viewport.scrollHeight
		},
		get viewportSize() {
			return viewport.clientHeight
		},
		findItemIndex: vi.fn((offset: number) => Math.max(0, Math.floor(offset / 100))),
		getItemOffset: vi.fn((index: number) => index * 100),
		getItemSize: vi.fn(() => 100),
		scrollTo: vi.fn(),
		scrollToIndex: vi.fn(),
	} as unknown as MessageListScrollAdapter
}

function setScrollHeight(viewport: HTMLDivElement, value: number) {
	Object.defineProperty(viewport, "scrollHeight", { configurable: true, value })
}

function items(count: number) {
	return Array.from({ length: count }, (_, index) => ({ key: `message-${index}` }))
}

describe("useVirtualMessageScroll", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it("loads one history page only after an explicit upward gesture", async () => {
		const viewport = createViewport({ scrollTop: 900, clientHeight: 300, scrollHeight: 1200 })
		const virtualizer = createVirtualizer(viewport, 12)
		const onPullMore = vi.fn()

		renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				onPullMore,
			}),
		)
		act(() => {
			vi.advanceTimersByTime(301)
		})

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.scrollTop = 100
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).toHaveBeenCalledTimes(1)
	})

	it("honors a custom top threshold and does not reuse an intent created outside it", async () => {
		const viewport = createViewport({ scrollTop: 900, clientHeight: 300, scrollHeight: 1200 })
		const virtualizer = createVirtualizer(viewport, 12)
		const onPullMore = vi.fn()

		renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				onPullMore,
				minTopDistance: 30,
			}),
		)
		act(() => {
			vi.advanceTimersByTime(301)
		})

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.scrollTop = 31
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})
		expect(onPullMore).not.toHaveBeenCalled()

		// A later layout scroll crossing the threshold must not consume the old gesture.
		act(() => {
			viewport.scrollTop = 20
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})
		expect(onPullMore).not.toHaveBeenCalled()

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.scrollTop = 10
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).toHaveBeenCalledTimes(1)
	})

	it("locks history pagination until the in-flight request settles", async () => {
		const viewport = createViewport({ scrollTop: 20, clientHeight: 300, scrollHeight: 900 })
		const virtualizer = createVirtualizer(viewport, 3)
		const virtualizerRef = {
			current: virtualizer,
		} as MutableRefObject<MessageListScrollAdapter | null>
		const containerRef = { current: viewport }
		const initialItems = [{ key: "a" }, { key: "b" }, { key: "c" }]
		let resolvePullMore: (() => void) | undefined
		const onPullMore = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePullMore = resolve
				}),
		)

		const { rerender } = renderHook(
			({ list }) =>
				useVirtualMessageScroll({
					containerRef,
					virtualizerRef,
					items: list,
					topicKey: "topic-1",
					onPullMore,
					minTopDistance: 30,
				}),
			{ initialProps: { list: initialItems } },
		)
		act(() => {
			vi.advanceTimersByTime(301)
			viewport.scrollTop = 20
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})
		expect(onPullMore).toHaveBeenCalledTimes(1)

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})
		expect(onPullMore).toHaveBeenCalledTimes(1)

		rerender({ list: [{ key: "x" }, { key: "y" }, ...initialItems] })
		await act(async () => {
			resolvePullMore?.()
			await vi.advanceTimersByTimeAsync(64)
		})

		act(() => {
			viewport.scrollTop = 20
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).toHaveBeenCalledTimes(2)
	})

	it("does not turn a prior downward wheel into history intent for later layout scrolls", async () => {
		const viewport = createViewport({ scrollTop: 900, clientHeight: 300, scrollHeight: 1200 })
		const virtualizer = createVirtualizer(viewport, 12)
		const onPullMore = vi.fn()

		renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				onPullMore,
			}),
		)
		act(() => {
			vi.advanceTimersByTime(301)
		})

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }))
			viewport.scrollTop = 100
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).not.toHaveBeenCalled()
	})

	it("ignores wheel gestures originating inside a nested scroll viewport", async () => {
		const viewport = createViewport({ scrollTop: 20, clientHeight: 300, scrollHeight: 1200 })
		const nestedViewport = document.createElement("div")
		nestedViewport.dataset.slot = "scroll-area-viewport"
		viewport.firstElementChild?.appendChild(nestedViewport)
		const virtualizer = createVirtualizer(viewport, 12)
		const onPullMore = vi.fn()

		renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				onPullMore,
				minTopDistance: 30,
			}),
		)

		act(() => {
			nestedViewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: -100 }))
			viewport.scrollTop = 10
			viewport.dispatchEvent(new Event("scroll"))
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).not.toHaveBeenCalled()
	})

	it("issues no scroll write of its own for a prepended history page", async () => {
		const viewport = createViewport({ scrollTop: 450, clientHeight: 300, scrollHeight: 900 })
		const virtualizer = createVirtualizer(viewport, 3)
		const virtualizerRef = {
			current: virtualizer,
		} as MutableRefObject<MessageListScrollAdapter | null>
		const containerRef = { current: viewport }
		const initialItems = [{ key: "a" }, { key: "b" }, { key: "c" }]

		const { result, rerender } = renderHook(
			({ list }) =>
				useVirtualMessageScroll({
					containerRef,
					virtualizerRef,
					items: list,
					topicKey: "topic-1",
				}),
			{ initialProps: { list: initialItems } },
		)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		act(() => result.current.notifyPullMoreStarted())
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		setScrollHeight(viewport, 1400)
		rerender({ list: [{ key: "x" }, { key: "y" }, ...initialItems] })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(64)
		})

		// `shift` owns viewport stability for prepends; the controller must stay silent.
		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})

	it("does not request history when authoritative reconciliation shrinks the list", async () => {
		const viewport = createViewport({ scrollTop: 900, clientHeight: 300, scrollHeight: 1200 })
		const virtualizer = createVirtualizer(viewport, 12)
		const onPullMore = vi.fn()
		const initialItems = items(12)
		const containerRef = { current: viewport }
		const virtualizerRef = {
			current: virtualizer,
		} as MutableRefObject<MessageListScrollAdapter | null>
		const { rerender } = renderHook(
			({ list }) =>
				useVirtualMessageScroll({
					containerRef,
					virtualizerRef,
					items: list,
					topicKey: "topic-1",
					onPullMore,
				}),
			{ initialProps: { list: initialItems } },
		)

		act(() => {
			vi.advanceTimersByTime(301)
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
			viewport.scrollTop = 100
			viewport.dispatchEvent(new Event("scroll"))
		})
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		// A visible-tab HTTP replace can remove local rows. The resulting scrollTop clamp is
		// a layout side effect, not a request to load older history.
		rerender({ list: initialItems.slice(0, 4) })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500)
		})

		expect(onPullMore).not.toHaveBeenCalled()
		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})

	it("jumps to the last row when the user explicitly returns to latest", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 1200 })
		const virtualizer = createVirtualizer(viewport, 8)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(8),
				topicKey: "topic-1",
			}),
		)

		vi.mocked(virtualizer.scrollToIndex).mockClear()
		act(() => result.current.scrollToBottom("auto"))

		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(7, { align: "end", smooth: false })
	})

	it("closes most of the distance instantly before animating the tail of a smooth jump", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 3000 })
		const virtualizer = createVirtualizer(viewport, 30)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(30),
				topicKey: "topic-1",
			}),
		)

		vi.mocked(virtualizer.scrollTo).mockClear()
		vi.mocked(virtualizer.scrollToIndex).mockClear()
		act(() => result.current.scrollToBottom("smooth"))

		// virtua's smooth path stalls on unmeasured rows in the range it starts from, which is
		// exactly the range a history page just filled. Only the last screen may be animated.
		expect(virtualizer.scrollTo).toHaveBeenCalledWith(2400)
		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(29, { align: "end", smooth: true })
	})

	it("refuses to animate a jump that has no distance to cover", () => {
		// Sending a message asks for a smooth jump while following output already holds the list
		// at the bottom. Animating anyway opens the window in which virtua answers a row that
		// grows by shifting the origin every row is positioned from — the new User row is
		// measured for the first time inside it — and it hands that shift back only at the end
		// of a scroll it did not drive itself, which its own animation never is.
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 300 })
		const virtualizer = createVirtualizer(viewport, 4)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(4),
				topicKey: "topic-1",
			}),
		)

		vi.mocked(virtualizer.scrollTo).mockClear()
		vi.mocked(virtualizer.scrollToIndex).mockClear()
		act(() => result.current.scrollToBottom("smooth"))

		expect(virtualizer.scrollTo).not.toHaveBeenCalled()
		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: "end", smooth: false })
	})

	it("corrects a jump that settled short of the bottom once the guard expires", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 3000 })
		const virtualizer = createVirtualizer(viewport, 30)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(30),
				topicKey: "topic-1",
			}),
		)

		act(() => result.current.scrollToBottom("auto"))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		// The virtualizer never moved the element, standing in for a request virtua dropped or a
		// target it derived from estimated row sizes.
		act(() => {
			vi.advanceTimersByTime(301)
		})

		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(29, { align: "end" })
	})

	it("issues no correction when the jump already reached the bottom", () => {
		const viewport = createViewport({ scrollTop: 700, clientHeight: 300, scrollHeight: 1000 })
		const virtualizer = createVirtualizer(viewport, 10)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(10),
				topicKey: "topic-1",
			}),
		)

		act(() => result.current.scrollToBottom("auto"))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		act(() => {
			vi.advanceTimersByTime(301)
		})

		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})

	it("drops the pending correction when an upward gesture takes over during the guard", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 3000 })
		const virtualizer = createVirtualizer(viewport, 30)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(30),
				topicKey: "topic-1",
			}),
		)

		act(() => result.current.scrollToBottom("auto"))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
		})
		act(() => {
			vi.advanceTimersByTime(301)
		})

		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})

	it("carries the arrival jump across the commit where the virtualizer is not yet addressable", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 1200 })
		let mounted = false
		const virtualizer = createVirtualizer(viewport, 12, () => mounted)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
			}),
		)

		// The jump raised on arrival had nothing to write to, so it must not have been spent.
		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()

		mounted = true
		act(() => result.current.onVirtualizerChange(virtualizer, false))

		// Note the absence of a size increase: the parked jump lands on the virtualizer becoming
		// addressable, which is the only signal it gets when the list arrives already complete.
		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(11, { align: "end" })
	})

	it("follows streaming growth while parked at the bottom", () => {
		const viewport = createViewport({ scrollTop: 700, clientHeight: 300, scrollHeight: 1000 })
		const virtualizer = createVirtualizer(viewport, 12)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
			}),
		)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		act(() => result.current.onVirtualizerChange(virtualizer, false))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		setScrollHeight(viewport, 1200)
		act(() => result.current.onVirtualizerChange(virtualizer, false))

		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(11, { align: "end" })
	})

	it("does not follow repeated static measurement growth when follow output is disabled", () => {
		const viewport = createViewport({ scrollTop: 700, clientHeight: 300, scrollHeight: 1000 })
		const virtualizer = createVirtualizer(viewport, 12)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				allowFollowOutput: false,
			}),
		)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		act(() => result.current.onVirtualizerChange(virtualizer, false))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		for (const scrollHeight of [1100, 1200, 1300]) {
			setScrollHeight(viewport, scrollHeight)
			act(() => result.current.onVirtualizerChange(virtualizer, false))
		}

		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})

	it("keeps explicit scroll-to-bottom available when follow output is disabled", () => {
		const viewport = createViewport({ scrollTop: 0, clientHeight: 300, scrollHeight: 1000 })
		const virtualizer = createVirtualizer(viewport, 12)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
				allowFollowOutput: false,
			}),
		)

		act(() => result.current.scrollToBottom("auto"))

		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(11, {
			align: "end",
			smooth: false,
		})
	})

	it("stops following as soon as an upward wheel starts near the bottom", () => {
		const viewport = createViewport({ scrollTop: 699, clientHeight: 300, scrollHeight: 1000 })
		const virtualizer = createVirtualizer(viewport, 12)

		const { result } = renderHook(() =>
			useVirtualMessageScroll({
				containerRef: { current: viewport },
				virtualizerRef: { current: virtualizer },
				items: items(12),
				topicKey: "topic-1",
			}),
		)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		act(() => result.current.onVirtualizerChange(virtualizer, false))
		vi.mocked(virtualizer.scrollToIndex).mockClear()

		act(() => {
			viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))
			viewport.scrollTop = 698
			viewport.dispatchEvent(new Event("scroll"))
			vi.advanceTimersByTime(20)
		})

		setScrollHeight(viewport, 1200)
		act(() => result.current.onVirtualizerChange(virtualizer, false))

		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled()
	})
})
