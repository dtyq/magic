import {
	createElement,
	forwardRef,
	useImperativeHandle,
	type ComponentProps,
	type ReactElement,
} from "react"
import { act, fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SuperMagicMessageItem } from "../type"
import { buildVirtualMessageProjection } from "../virtual-message-items"
import { VirtualMessageList } from "../components/VirtualMessageList"

const ROW_HEIGHT = 100

const virtualState = vi.hoisted(() => ({
	toolStatus: "completed",
	canonicalNode: undefined as Record<string, unknown> | undefined,
	lastProps: undefined as Record<string, any> | undefined,
	scrollOffset: 0,
	startMargin: 0,
	scrollSize: 2000,
	viewportSize: 400,
	resizeCallbacks: [] as ResizeObserverCallback[],
	stickySyncCalls: 0,
	animationFrameCallbacks: [] as Array<FrameRequestCallback>,
	scrollToIndexCalls: [] as Array<[number, Record<string, unknown> | undefined]>,
	/** virtua's global origin shift; row offsets are served as `cached - originShift`. */
	originShift: 0,
	/** Every render's pinned indices against the rows actually available to resolve them. */
	keepMountedRenders: [] as Array<{ keepMounted?: Array<number>; rowCount: number }>,
}))

// The fixed-grid suite controls the measured origin; the layout hook is tested separately.
vi.mock("../hooks/useVirtualListStartMargin", () => ({
	useVirtualListStartMargin: () => virtualState.startMargin,
}))

/**
 * virtua drives layout from a measurement cache; the mock replaces that cache with a fixed grid
 * so index math (sticky handoff, push-out) can be asserted without a real layout engine.
 */
vi.mock("virtua", () => ({
	Virtualizer: forwardRef((props: Record<string, any>, ref) => {
		virtualState.lastProps = props
		virtualState.keepMountedRenders.push({
			keepMounted: props.keepMounted,
			rowCount: ((props.children as Array<unknown>) || []).length,
		})
		useImperativeHandle(ref, () => ({
			get scrollOffset() {
				return virtualState.scrollOffset
			},
			get scrollSize() {
				return virtualState.scrollSize
			},
			get viewportSize() {
				return virtualState.viewportSize
			},
			findItemIndex: (offset: number) => {
				virtualState.stickySyncCalls++
				return Math.max(0, Math.floor((offset - (props.startMargin || 0)) / ROW_HEIGHT))
			},
			getItemOffset: (index: number) => index * ROW_HEIGHT - virtualState.originShift,
			getItemSize: () => ROW_HEIGHT,
			scrollTo: vi.fn(),
			scrollToIndex: (index: number, opts?: Record<string, unknown>) => {
				virtualState.scrollToIndexCalls.push([index, opts])
			},
		}))

		const Item = props.item || "div"
		const children = (props.children as Array<ReactElement>) || []
		return createElement(
			"div",
			{ "data-testid": "mock-virtualizer" },
			children.map((child, index) =>
				createElement(
					Item,
					{
						key: child.key ?? index,
						index,
						style: { position: "absolute", top: index * ROW_HEIGHT },
					},
					child,
				),
			),
		)
	}),
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		getMessageNode: () => ({ status: virtualState.toolStatus }),
		getTopicMessageNode: () => virtualState.canonicalNode,
		getMessageRevision: () => 1,
	},
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

class ControlledResizeObserver {
	callback: ResizeObserverCallback

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
	}

	// Rows observe their own content to hold a height floor across a remount. Only the canvas
	// observer is registered here, so the suite keeps driving layout growth through one callback.
	observe = vi.fn((target: Element) => {
		if ((target as HTMLElement).dataset?.testid !== "virtual-message-canvas") return
		virtualState.resizeCallbacks.push(this.callback)
	})

	disconnect = vi.fn(() => {
		const index = virtualState.resizeCallbacks.indexOf(this.callback)
		if (index !== -1) virtualState.resizeCallbacks.splice(index, 1)
	})
}

function message(id: string, role: "user" | "assistant" | "tool"): SuperMagicMessageItem {
	return {
		super_message_id: id,
		app_message_id: id,
		role,
		content: `${role} message`,
	} as unknown as SuperMagicMessageItem
}

/**
 * The pin is released once the turn stops running past the fold, so a list that asserts pinning
 * has to be taller than the 400px mock viewport by more than the park travel.
 */
function assistantTail(count: number, from: number) {
	return Array.from({ length: count }, (_, offset) =>
		message(`assistant-${from + offset}`, "assistant"),
	)
}

function createViewport(scrollHeight?: number) {
	const viewport = document.createElement("div")
	if (scrollHeight !== undefined) {
		Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: scrollHeight })
	}
	return viewport
}

function renderList(
	items: Array<SuperMagicMessageItem>,
	options: Partial<ComponentProps<typeof VirtualMessageList>> & { startMargin?: number } = {},
) {
	const { startMargin = 0, ...props } = options
	virtualState.startMargin = startMargin
	const projection = buildVirtualMessageProjection(items)
	const viewport = createViewport()
	return render(
		<VirtualMessageList
			items={projection.items}
			userIndices={projection.userIndices}
			stickyTopOffset={40}
			getScrollElement={() => viewport}
			renderNode={({ item }) => <span>{item.key}</span>}
			{...props}
		/>,
	)
}

function flushAnimationFrame() {
	const callbacks = virtualState.animationFrameCallbacks.splice(0)
	act(() => {
		callbacks.forEach((callback) => callback(performance.now()))
	})
}

/**
 * jsdom never lays anything out, so the canvas box the component dedupes on has to be supplied
 * through the observer entry the same way a browser would report it.
 */
function resizeCanvas(box: { width?: number; height: number }) {
	const entries = [
		{ contentRect: { width: box.width ?? 600, height: box.height } },
	] as unknown as Array<ResizeObserverEntry>
	act(() => {
		virtualState.resizeCallbacks.forEach((callback) => callback(entries, {} as ResizeObserver))
	})
}

function scrollTo(offset: number) {
	virtualState.scrollOffset = offset
	act(() => {
		virtualState.lastProps?.onScroll?.(offset)
	})
	// Existing sticky assertions model a completed paint after each user scroll. The scheduler
	// tests below intentionally call the callback directly so they can inspect the pending frame.
	flushAnimationFrame()
}

function pinnedViewportTop(canvas: HTMLElement) {
	return Number.parseFloat(canvas.style.getPropertyValue("--message-group-sticky-top"))
}

describe("VirtualMessageList", () => {
	beforeEach(() => {
		virtualState.toolStatus = "completed"
		virtualState.canonicalNode = undefined
		virtualState.lastProps = undefined
		virtualState.scrollOffset = 0
		virtualState.startMargin = 0
		virtualState.scrollSize = 2000
		virtualState.resizeCallbacks = []
		virtualState.stickySyncCalls = 0
		virtualState.animationFrameCallbacks = []
		virtualState.scrollToIndexCalls = []
		virtualState.keepMountedRenders = []
		virtualState.originShift = 0
		vi.stubGlobal("ResizeObserver", ControlledResizeObserver)
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			virtualState.animationFrameCallbacks.push(callback)
			return virtualState.animationFrameCallbacks.length
		})
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			virtualState.animationFrameCallbacks[id - 1] = () => undefined
		})
	})

	it("renders one flat row per message without group wrappers", () => {
		const { container } = renderList([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
			message("assistant-2", "assistant"),
			message("user-3", "user"),
			// A Tool row only survives projection when it has something for AttachmentSection.
			{
				...message("tool-4", "tool"),
				attachments: [{ filename: "result.html" }],
			} as unknown as SuperMagicMessageItem,
		])

		expect(virtualState.lastProps?.data).toBeUndefined()
		expect(virtualState.lastProps?.children).toHaveLength(5)
		expect(container.querySelectorAll('[data-testid="virtual-message-row"]')).toHaveLength(5)
		expect(container.querySelectorAll('[data-message-id="user-0"]')).toHaveLength(1)
		expect(container.querySelectorAll('[data-message-id="user-3"]')).toHaveLength(1)
		expect(container.querySelector('[data-virtual-message-spacing="true"]')).toHaveClass("h-2")
	})

	it("appends the footer as the last virtual row so one virtualizer measures everything", () => {
		const { container } = renderList([message("user-0", "user")], {
			footer: <div data-testid="message-list-footer">footer</div>,
		})

		const rows = virtualState.lastProps?.children as Array<ReactElement>
		expect(rows).toHaveLength(2)
		expect(rows[rows.length - 1].key).toContain("footer")
		expect(container.querySelector('[data-testid="message-list-footer"]')).not.toBeNull()
	})

	it("binds the caller's scroll element and start margin", () => {
		const viewport = createViewport()
		renderList([message("user-0", "user")], {
			getScrollElement: () => viewport,
			startMargin: 50,
		})

		expect(virtualState.lastProps?.scrollRef.current).toBe(viewport)
		expect(virtualState.lastProps?.startMargin).toBe(50)
	})

	it("does not mount the virtualizer before the caller's scroll element exists", () => {
		renderList([message("user-0", "user")], { getScrollElement: () => null })

		expect(virtualState.lastProps).toBeUndefined()
	})

	it("mounts once a caller's ref-based scroll element commits after this subtree", () => {
		// The share shell passes a plain ref filled by an ancestor, so it is still null while
		// this list renders. Reading it again on commit is what makes that path work at all.
		const lateViewport = { current: null as HTMLDivElement | null }
		const view = renderList([message("user-0", "user")], {
			getScrollElement: () => lateViewport.current,
		})
		expect(virtualState.lastProps).toBeUndefined()

		lateViewport.current = createViewport()
		view.rerender(
			<VirtualMessageList
				items={buildVirtualMessageProjection([message("user-0", "user")]).items}
				userIndices={[0]}
				stickyTopOffset={40}
				getScrollElement={() => lateViewport.current}
				renderNode={({ item }) => <span>{item.key}</span>}
			/>,
		)

		expect(virtualState.lastProps?.scrollRef.current).toBe(lateViewport.current)
	})

	it("enables shift only for a pure prepend, not for a middle insertion", () => {
		const initialMessages = [
			message("user-0", "user"),
			message("assistant-0", "assistant"),
			message("user-1", "user"),
		]
		const viewport = createViewport()
		const renderWith = (messages: Array<SuperMagicMessageItem>) => {
			const projection = buildVirtualMessageProjection(messages)
			return (
				<VirtualMessageList
					items={projection.items}
					userIndices={projection.userIndices}
					stickyTopOffset={40}
					getScrollElement={() => viewport}
					renderNode={({ item }) => <span>{item.key}</span>}
				/>
			)
		}

		const view = render(renderWith(initialMessages))
		expect(virtualState.lastProps?.shift).toBe(false)

		view.rerender(
			renderWith([
				message("history-user", "user"),
				message("history-assistant", "assistant"),
				...initialMessages,
			]),
		)
		expect(virtualState.lastProps?.shift).toBe(true)

		view.rerender(
			renderWith([
				message("history-user", "user"),
				message("history-assistant", "assistant"),
				message("user-0", "user"),
				message("assistant-0", "assistant"),
				message("middle-insert", "assistant"),
				message("user-1", "user"),
			]),
		)
		expect(virtualState.lastProps?.shift).toBe(false)
	})

	it("keeps the User row above the scroll position mounted and pinned", () => {
		// Rows: 0 user-0, 1 assistant-1, 2 assistant-2, 3 user-3, 4..9 assistant-4..9
		const { container } = renderList([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
			message("assistant-2", "assistant"),
			message("user-3", "user"),
			...assistantTail(6, 4),
		])

		scrollTo(2 * ROW_HEIGHT)
		expect(virtualState.lastProps?.keepMounted).toEqual([0])
		expect(
			container
				.querySelector('[data-virtual-item-sticky="true"]')
				?.querySelector("[data-message-id]"),
		).toHaveAttribute("data-message-id", "user-0")

		scrollTo(4 * ROW_HEIGHT)
		expect(virtualState.lastProps?.keepMounted).toEqual([3])
	})

	it("drops the pinned row from keepMounted once the list no longer reaches it", () => {
		// virtua clamps its own range but renders keepMounted verbatim, so a stale index resolves
		// to no child and throws. Replaying a shared topic restarts the list from empty.
		const viewport = createViewport()
		const renderWith = (messages: Array<SuperMagicMessageItem>) => {
			const projection = buildVirtualMessageProjection(messages)
			return (
				<VirtualMessageList
					items={projection.items}
					userIndices={projection.userIndices}
					stickyTopOffset={40}
					getScrollElement={() => viewport}
					renderNode={({ item }) => <span>{item.key}</span>}
				/>
			)
		}

		const view = render(
			renderWith([
				message("user-0", "user"),
				message("assistant-1", "assistant"),
				message("assistant-2", "assistant"),
				message("user-3", "user"),
				...assistantTail(6, 4),
			]),
		)

		scrollTo(4 * ROW_HEIGHT)
		expect(virtualState.lastProps?.keepMounted).toEqual([3])

		view.rerender(renderWith([message("user-0", "user")]))

		const outOfRange = virtualState.keepMountedRenders.filter(({ keepMounted, rowCount }) =>
			(keepMounted ?? []).some((index) => index >= rowCount),
		)
		expect(outOfRange).toEqual([])
	})

	it("pushes the pinned row out as the next User row reaches the park line", () => {
		const { container } = renderList([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
			message("user-2", "user"),
		])
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement

		// Desktop parks the pinned row 40px below the viewport top while nothing crowds it.
		expect(pinnedViewportTop(canvas)).toBe(40)

		// user-2 sits at offset 200; once it is within one row height of the park line the
		// pinned row must translate up in lockstep so the handoff has no overlap or gap.
		scrollTo(140)
		expect(pinnedViewportTop(canvas)).toBe(-40)
	})

	it("stops pinning while the virtualizer is positioning from a shifted origin", () => {
		// A row that grows during a smooth scroll is answered by shifting the origin every row is
		// positioned from, since moving scrollTop would cancel the animation — and the shift is
		// handed back only at the end of a scroll virtua did not drive itself. Left behind, it
		// displaces every row equally, which is survivable; holding one of them against a park
		// line the others do not share is not, since that one carries an opaque mask at z-20.
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
			startMargin: 50,
		})

		scrollTo(100)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).not.toBeNull()

		virtualState.originShift = 140
		scrollTo(100)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()
	})

	it("holds the pin with native sticky rather than a scroll-driven offset", () => {
		// The park line is expressed against the viewport, so the compositor has to resolve the
		// pin. Writing the row's offset from the scroll handler instead leaves it one frame
		// behind a scroll that has already been painted, which reads as the row shaking against
		// the viewport for as long as it is held — every turn, in a long conversation.
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
			startMargin: 50,
		})

		scrollTo(100)
		const pinned = container.querySelector<HTMLElement>('[data-virtual-item-sticky="true"]')
		expect(pinned?.style.position).toBe("sticky")
		expect(pinned?.style.top).toBe("var(--message-group-sticky-top, 0px)")
	})

	it("recomputes sticky ownership when User candidates are disabled and restored", () => {
		const items = [message("user-0", "user"), ...assistantTail(5, 1)]
		const projection = buildVirtualMessageProjection(items)
		const viewport = createViewport()
		virtualState.startMargin = 50
		const renderVirtualList = (userIndices: Array<number>) => (
			<VirtualMessageList
				items={projection.items}
				userIndices={userIndices}
				stickyTopOffset={40}
				getScrollElement={() => viewport}
				renderNode={({ item }) => <span>{item.key}</span>}
			/>
		)
		const { container, rerender } = render(renderVirtualList(projection.userIndices))

		scrollTo(100)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).not.toBeNull()
		const previousScrollOffset = virtualState.scrollOffset

		rerender(renderVirtualList([]))
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()
		expect(virtualState.scrollOffset).toBe(previousScrollOffset)

		rerender(renderVirtualList(projection.userIndices))
		flushAnimationFrame()
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).not.toBeNull()
		expect(virtualState.scrollOffset).toBe(previousScrollOffset)
	})

	it("leaves the first User row unpinned while it still sits in its natural slot", () => {
		// A list that opens with a User row is the shape of a conversation started from empty.
		// `findItemIndex` clamps the negative probe to row 0 and reports it as parked, but the
		// column's 50px top padding puts it 10px below the 40px park line — lifting it there
		// would paint its fade tail over the top of the reply instead of the other way round.
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
			startMargin: 50,
		})

		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()

		// At 10 the row's natural slot is the park line itself, so the pin would still be a
		// no-op; past that it is genuinely being held back.
		scrollTo(10)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()

		scrollTo(20)
		expect(
			container
				.querySelector('[data-virtual-item-sticky="true"]')
				?.querySelector("[data-message-id]"),
		).toHaveAttribute("data-message-id", "user-0")
	})

	it("leaves a shell with no start margin unpinned while its viewport cannot scroll", () => {
		// The share shell parks flush with the top and renders no column padding, so the first
		// User row's natural slot is the park line. Nothing has scrolled and nothing can, yet
		// pinning would still lift the row over the reply underneath it.
		const { container } = renderList(
			[message("user-0", "user"), message("assistant-1", "assistant")],
			{ stickyTopOffset: 0 },
		)

		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()
	})

	it("leaves two adjacent User rows unpinned because the push-out cancels the park", () => {
		// With no reply between them the follower reaches the park line exactly as the active
		// row would, so the pin has nothing to hold back.
		const { container } = renderList(
			[message("user-0", "user"), message("user-1", "user"), ...assistantTail(4, 2)],
			{ startMargin: 50 },
		)

		scrollTo(100)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()
	})

	it("never parks a readable pinned row above the park line", () => {
		// The shell's header owns everything above that line, so a row held there reads as the
		// message escaping the list. Only the push-out under the next User row may go above it,
		// and that row covers the outgoing one as it goes.
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
			startMargin: 50,
		})
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement

		for (const offset of [10, 60, 100, 160, 210, 500]) {
			scrollTo(offset)
			const pinned = container.querySelector('[data-virtual-item-sticky="true"]')
			if (!pinned) continue
			expect(pinnedViewportTop(canvas)).toBe(40)
		}
	})

	it("defaults to the viewport top and recomputes when the measured layout changes", () => {
		const items = [message("user-0", "user"), ...assistantTail(5, 1)]
		const view = renderList(items, { stickyTopOffset: undefined, startMargin: 10 })
		const canvas = view.container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement
		scrollTo(20)
		expect(pinnedViewportTop(canvas)).toBe(0)
		expect(view.container.querySelector('[data-virtual-item-sticky="true"]')).not.toBeNull()

		// Increasing content padding moves the natural row below the pin line at the same scroll offset.
		virtualState.startMargin = 30
		const projection = buildVirtualMessageProjection(items)
		const viewport = createViewport()
		view.rerender(
			<VirtualMessageList
				items={projection.items}
				userIndices={projection.userIndices}
				getScrollElement={() => viewport}
				renderNode={({ item }) => <span>{item.key}</span>}
			/>,
		)
		flushAnimationFrame()
		expect(virtualState.lastProps?.startMargin).toBe(30)
		expect(view.container.querySelector('[data-virtual-item-sticky="true"]')).toBeNull()
	})

	it("lets a shell without a header park the pinned turn flush with the viewport top", () => {
		// The workspace parks below its header line; the share shell has no header. Before
		// virtualization this was the caller's `top-*` class on the sticky row itself.
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
			stickyTopOffset: 0,
		})
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement

		scrollTo(100)
		expect(pinnedViewportTop(canvas)).toBe(0)
		expect(container.querySelector('[data-virtual-item-sticky="true"]')).not.toBeNull()
	})

	it("offsets the push-out by startMargin because item offsets exclude it", () => {
		// `getItemOffset` is measured from the virtualizer container while `scrollOffset` is
		// measured from the scroll element; startMargin is the gap between those two origins.
		const { container } = renderList(
			[
				message("user-0", "user"),
				message("assistant-1", "assistant"),
				message("user-2", "user"),
			],
			{ startMargin: 50 },
		)
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement

		// Same geometry as the no-margin case, but every threshold moves 50px later: the
		// no-margin list already pushes out at 140, this one is still parked.
		scrollTo(140)
		expect(pinnedViewportTop(canvas)).toBe(10)

		scrollTo(90)
		expect(pinnedViewportTop(canvas)).toBe(40)

		scrollTo(190)
		expect(pinnedViewportTop(canvas)).toBe(-40)
	})

	it("reports layout growth through the virtualizer change callback", () => {
		const onVirtualizerChange = vi.fn()
		renderList([message("user-0", "user"), message("assistant-1", "assistant")], {
			onVirtualizerChange,
		})

		expect(onVirtualizerChange).not.toHaveBeenCalled()
		resizeCanvas({ height: 200 })
		flushAnimationFrame()
		expect(onVirtualizerChange).toHaveBeenCalledTimes(1)
	})

	it("coalesces a growth burst into one virtualizer change per frame", () => {
		// The consumer answers this signal with a scroll request that virtua keeps re-deriving for
		// 150ms. Delivering it once per measurement frame would re-arm that request before it can
		// expire, and the scroll it performs is what produces the next measurement.
		const onVirtualizerChange = vi.fn()
		renderList([message("user-0", "user"), message("assistant-1", "assistant")], {
			onVirtualizerChange,
		})

		resizeCanvas({ height: 200 })
		resizeCanvas({ height: 320 })
		resizeCanvas({ height: 480 })
		expect(onVirtualizerChange).not.toHaveBeenCalled()

		flushAnimationFrame()
		expect(onVirtualizerChange).toHaveBeenCalledTimes(1)
	})

	it("does not report growth for an unchanged canvas box", () => {
		// `observe()` delivers an entry on subscription and a width-only reflow reports no new
		// projected size; neither is growth, and answering them re-enters the scroll writer.
		const onVirtualizerChange = vi.fn()
		renderList([message("user-0", "user"), message("assistant-1", "assistant")], {
			onVirtualizerChange,
		})

		resizeCanvas({ height: 200 })
		flushAnimationFrame()
		expect(onVirtualizerChange).toHaveBeenCalledTimes(1)

		resizeCanvas({ height: 200 })
		resizeCanvas({ height: 200 })
		flushAnimationFrame()
		expect(onVirtualizerChange).toHaveBeenCalledTimes(1)

		resizeCanvas({ width: 400, height: 200 })
		flushAnimationFrame()
		expect(onVirtualizerChange).toHaveBeenCalledTimes(1)
	})

	it("keeps one canvas observer across a streaming toggle", () => {
		// Re-subscribing would fire `observe()`'s entry again, which reads as growth that never
		// happened and fires a scroll write on every toggle of the streaming gate.
		const projection = buildVirtualMessageProjection([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
		])
		const viewport = createViewport()
		const props = {
			items: projection.items,
			userIndices: projection.userIndices,
			stickyTopOffset: 40,
			getScrollElement: () => viewport,
			renderNode: ({ item }: { item: (typeof projection.items)[number] }) => (
				<span>{item.key}</span>
			),
		}
		const { rerender } = render(<VirtualMessageList {...props} allowResizeStickySync={false} />)
		expect(virtualState.resizeCallbacks).toHaveLength(1)

		rerender(<VirtualMessageList {...props} allowResizeStickySync />)
		rerender(<VirtualMessageList {...props} allowResizeStickySync={false} />)

		expect(virtualState.resizeCallbacks).toHaveLength(1)
	})

	it("coalesces a ResizeObserver burst into one follow-up sticky sync", () => {
		renderList([message("user-0", "user"), ...assistantTail(5, 1)])

		virtualState.scrollOffset = 100
		act(() => {
			virtualState.lastProps?.onScroll?.(100)
		})
		const leadingSyncs = virtualState.stickySyncCalls

		act(() => {
			virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
			virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
			virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
		})

		// The first scroll sync is synchronous. Resize notifications arriving before the next
		// paint should schedule one, and only one, follow-up geometry read.
		expect(virtualState.stickySyncCalls).toBe(leadingSyncs)
		flushAnimationFrame()
		expect(virtualState.stickySyncCalls).toBe(leadingSyncs + 1)
	})

	it("coalesces interleaved scroll and resize requests in one frame", () => {
		const { container } = renderList([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
			message("user-2", "user"),
			...assistantTail(3, 3),
		])
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement

		virtualState.scrollOffset = 100
		act(() => {
			virtualState.lastProps?.onScroll?.(100)
		})
		const leadingSyncs = virtualState.stickySyncCalls
		act(() => {
			virtualState.scrollOffset = 140
			virtualState.lastProps?.onScroll?.(140)
			virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
			virtualState.lastProps?.onScroll?.(200)
		})

		expect(virtualState.stickySyncCalls).toBe(leadingSyncs)
		flushAnimationFrame()
		expect(virtualState.stickySyncCalls).toBe(leadingSyncs + 1)
		expect(pinnedViewportTop(canvas)).toBe(-40)
	})

	it("does not rewrite unchanged sticky geometry during a follow-up sync", () => {
		const { container } = renderList([message("user-0", "user"), ...assistantTail(5, 1)])
		const canvas = container.querySelector(
			'[data-testid="virtual-message-canvas"]',
		) as HTMLElement
		const setProperty = vi.spyOn(canvas.style, "setProperty")

		scrollTo(100)
		const rendersAfterLeadingSync = virtualState.keepMountedRenders.length
		act(() => {
			virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
		})
		flushAnimationFrame()

		expect(setProperty).not.toHaveBeenCalled()
		expect(virtualState.keepMountedRenders.length).toBe(rendersAfterLeadingSync)
	})

	it("debounces resize-driven sticky sync while initial measurements settle", () => {
		vi.useFakeTimers()
		try {
			renderList([message("user-0", "user"), ...assistantTail(5, 1)])
			// Drain the mount request so the following count only measures resize-driven work.
			flushAnimationFrame()
			const beforeResize = virtualState.stickySyncCalls
			const resize = virtualState.resizeCallbacks[0]

			act(() => {
				resize?.([], {} as ResizeObserver)
			})
			expect(virtualState.stickySyncCalls).toBe(beforeResize)

			act(() => {
				vi.advanceTimersByTime(100)
			})
			expect(virtualState.stickySyncCalls).toBe(beforeResize + 1)
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not run a settled resize debounce after its pending frame was consumed", () => {
		vi.useFakeTimers()
		try {
			// Fake timers replace the browser rAF shim, so restore the deterministic frame queue for
			// this test and keep the settle timeout independently controllable.
			vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
				virtualState.animationFrameCallbacks.push(callback)
				return virtualState.animationFrameCallbacks.length
			})
			vi.stubGlobal("cancelAnimationFrame", (id: number) => {
				virtualState.animationFrameCallbacks[id - 1] = () => undefined
			})
			renderList([message("user-0", "user"), ...assistantTail(5, 1)])
			// Drain the initial sequence sync, then create a known pending frame from a scroll.
			flushAnimationFrame()
			virtualState.scrollOffset = 100
			act(() => {
				virtualState.lastProps?.onScroll?.(100)
			})
			const resize = virtualState.resizeCallbacks[0]

			act(() => {
				// The mount sync has already queued a frame. A measurement callback joins that frame
				// and also arms the settle timer.
				resize?.([], {} as ResizeObserver)
			})
			flushAnimationFrame()
			const afterFrame = virtualState.stickySyncCalls

			act(() => {
				vi.advanceTimersByTime(100)
			})
			expect(virtualState.stickySyncCalls).toBe(afterFrame)
		} finally {
			vi.useRealTimers()
		}
	})

	it("coalesces cross-frame sticky requests while initial measurements settle", () => {
		vi.useFakeTimers()
		try {
			vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
				virtualState.animationFrameCallbacks.push(callback)
				return virtualState.animationFrameCallbacks.length
			})
			vi.stubGlobal("cancelAnimationFrame", (id: number) => {
				virtualState.animationFrameCallbacks[id - 1] = () => undefined
			})
			renderList([message("user-0", "user"), ...assistantTail(5, 1)])
			flushAnimationFrame()
			const beforeChurn = virtualState.stickySyncCalls
			act(() => {
				virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
			})

			for (const offset of [0, 0, 0, 0]) {
				virtualState.scrollOffset = offset
				act(() => {
					virtualState.lastProps?.onScroll?.(offset)
				})
				flushAnimationFrame()
			}

			// Virtua can emit scroll callbacks on successive measurement frames after a resize burst.
			// Those callbacks must not turn into one geometry read per frame.
			expect(virtualState.stickySyncCalls).toBe(beforeChurn)

			act(() => {
				vi.advanceTimersByTime(100)
			})
			expect(virtualState.stickySyncCalls).toBe(beforeChurn + 1)
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not let static lists recompute sticky state from measurement callbacks", () => {
		vi.useFakeTimers()
		try {
			renderList([message("user-0", "user"), ...assistantTail(5, 1)], {
				allowResizeStickySync: false,
			})
			flushAnimationFrame()
			const beforeResize = virtualState.stickySyncCalls

			act(() => {
				for (let index = 0; index < 20; index += 1) {
					virtualState.resizeCallbacks[0]?.([], {} as ResizeObserver)
				}
				vi.advanceTimersByTime(500)
			})

			expect(virtualState.stickySyncCalls).toBe(beforeResize)
		} finally {
			vi.useRealTimers()
		}
	})

	it("exposes the virtualizer handle through the scroll adapter", () => {
		const virtualizerRef = { current: null } as {
			current: import("../message-list-scroll-adapter").MessageListScrollAdapter | null
		}
		renderList([message("user-0", "user"), message("assistant-1", "assistant")], {
			virtualizerRef,
			footer: <div>footer</div>,
		})

		expect(virtualizerRef.current?.itemCount).toBe(3)
		expect(virtualizerRef.current?.getItemOffset(2)).toBe(200)
		virtualizerRef.current?.scrollToIndex(2, { align: "end" })
	})

	it("folds the space below the virtualizer into a scroll-to-last write", () => {
		// The caller's message column adds 8px of bottom padding below the virtualizer, inside the
		// same scroll element. Without folding it in, a bottom-aligned write on the last row lands
		// 8px above the scroll end — virtua's own `scrollSize` reports the projected size and
		// nothing else. The strip is read from the boxes between the canvas and the scroll
		// element, so the column has to actually be one of them here.
		const viewport = createViewport()
		const column = document.createElement("div")
		virtualState.startMargin = 50
		column.style.paddingBottom = "8px"
		viewport.appendChild(column)

		const projection = buildVirtualMessageProjection([
			message("user-0", "user"),
			message("assistant-1", "assistant"),
		])
		const virtualizerRef = { current: null } as {
			current: import("../message-list-scroll-adapter").MessageListScrollAdapter | null
		}
		render(
			<VirtualMessageList
				items={projection.items}
				userIndices={projection.userIndices}
				stickyTopOffset={40}
				virtualizerRef={virtualizerRef}
				getScrollElement={() => viewport}
				renderNode={({ item }) => <span>{item.key}</span>}
			/>,
			{ container: column },
		)

		virtualizerRef.current?.scrollToIndex(1, { align: "end" })
		expect(virtualState.scrollToIndexCalls).toEqual([[1, { align: "end", offset: 8 }]])

		// A bottom-aligned write on any earlier row still means "this row's bottom on the
		// viewport line", which the trailing strip has nothing to do with.
		virtualizerRef.current?.scrollToIndex(0, { align: "end" })
		expect(virtualState.scrollToIndexCalls[1]).toEqual([0, { align: "end" }])
	})

	it("filters a non-terminal empty Tool before it reaches the virtualizer", () => {
		virtualState.toolStatus = "running"
		const emptyTool = {
			...message("tool-0", "tool"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
		} as unknown as SuperMagicMessageItem
		const { container } = renderList([emptyTool])

		expect(container.querySelector('[data-message-id="tool-0"]')).toBeNull()
		expect(container.querySelector('[data-virtual-message-hidden="true"]')).toBeNull()
	})

	it("renders a Tool whose terminal state is carried by the nested tool result", () => {
		virtualState.toolStatus = ""
		virtualState.canonicalNode = {
			role: "tool",
			debug: {
				status: "running",
				tool: { name: "finish_task", status: "finished" },
			},
		}
		const finishTask = {
			...message("finish-task", "tool"),
			content: null,
			reasoning_content: null,
			tool_calls: null,
			attachments: [{ filename: "result.html" }],
		} as unknown as SuperMagicMessageItem
		const { container } = renderList([finishTask], {
			topicId: "chat-topic",
		})

		expect(container.querySelector('[data-message-id="finish-task"]')).not.toBeNull()
		expect(container.querySelector('[data-virtual-message-hidden="true"]')).toBeNull()
	})

	it("keeps the outer chat Topic ID when merging a historical canonical node", () => {
		virtualState.canonicalNode = {
			role: "assistant",
			topic_id: "inner-sandbox-topic",
			super_message_id: "assistant-0",
		}
		let renderedTopicId = ""
		renderList([message("assistant-0", "assistant")], {
			topicId: "chat-topic",
			renderNode: ({ item }) => {
				renderedTopicId = String(item.node?.topic_id || "")
				return <span>{item.key}</span>
			},
		})

		expect(renderedTopicId).toBe("chat-topic")
	})

	it("keeps other rows mounted when a render callback throws", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
		try {
			const { container } = renderList(
				[message("user-0", "user"), message("assistant-1", "assistant")],
				{
					renderNode: ({ item }) => {
						if (item.key === "assistant-1") throw new Error("render failed")
						return <span>{item.key}</span>
					},
				},
			)

			expect(container.querySelector('[data-message-id="user-0"]')).not.toBeNull()
			expect(container.querySelector('[data-testid="message-render-error"]')).not.toBeNull()
		} finally {
			consoleError.mockRestore()
		}
	})

	it.each([
		["null", null],
		["false", false],
	])("does not expose a message content wrapper when renderNode returns %s", (_, emptyNode) => {
		const { container } = renderList(
			[message("user-0", "user"), message("assistant-1", "assistant")],
			{
				renderNode: ({ item }) =>
					item.key === "assistant-1" ? emptyNode : <span>{item.key}</span>,
			},
		)

		expect(container.querySelector('[data-message-id="user-0"]')).not.toBeNull()
		expect(container.querySelector('[data-message-id="assistant-1"]')).toBeNull()
	})

	it("toggles export selection from the turnKey sidecar", () => {
		const onToggleSelect = vi.fn()
		const { container } = renderList(
			[message("user-0", "user"), message("assistant-1", "assistant")],
			{
				exportMode: true,
				selectedKeys: new Set(),
				onToggleSelect,
			},
		)

		fireEvent.click(
			container
				.querySelector('[data-message-id="assistant-1"]')
				?.closest('[data-testid="virtual-message-row"]') as HTMLElement,
		)
		expect(onToggleSelect).toHaveBeenCalledWith("turn-user-0")
	})
})
