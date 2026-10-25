import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFloatingComponent } from "../useFloatingComponent"

const mocks = vi.hoisted(() => ({
	handleWheel: vi.fn(),
	stage: {
		batchDraw: vi.fn(),
		draggable: () => true,
		position: vi.fn(),
		setPointersPositions: vi.fn(),
		x: () => 0,
		y: () => 0,
	},
}))

vi.mock("../../../providers/FloatingUIProvider", () => ({
	useFloatingUI: () => ({
		activateFloatingComponent: vi.fn(),
		deactivateFloatingComponent: vi.fn(),
		handleWheel: mocks.handleWheel,
		registerFloatingComponent: vi.fn(),
		registerFloatingRelatedElement: vi.fn(() => vi.fn()),
		unregisterFloatingComponent: vi.fn(),
	}),
}))

vi.mock("../../../providers/CanvasProvider", () => ({
	useCanvas: () => ({
		canvas: {
			eventEmitter: { emit: vi.fn() },
			stage: mocks.stage,
		},
	}),
}))

function FloatingSurfaceHarness() {
	const { containerRef } = useFloatingComponent({
		id: "rename-panel",
		interactive: true,
		enableWheelForwarding: true,
		enablePointerPanForwarding: true,
	})

	return (
		<div ref={containerRef} data-testid="floating-surface">
			<div data-floating-scroll-trap="dynamic" data-testid="scroll-trap">
				<div
					data-slot="scroll-area-viewport"
					data-testid="scroll-viewport"
					style={{ overflowX: "hidden", overflowY: "auto" }}
				>
					<div data-testid="scroll-content" />
				</div>
				<div data-slot="scroll-area-scrollbar">
					<div data-testid="scrollbar-thumb" />
				</div>
			</div>
		</div>
	)
}

function setScrollMetrics(
	element: HTMLElement,
	{ height, overflows }: { height: number; overflows: boolean },
) {
	Object.defineProperties(element, {
		clientHeight: { configurable: true, value: height },
		clientWidth: { configurable: true, value: 200 },
		scrollHeight: { configurable: true, value: overflows ? height + 100 : height },
		scrollWidth: { configurable: true, value: 200 },
	})
}

function createPointerDownEvent(): PointerEvent {
	const event = new MouseEvent("pointerdown", {
		bubbles: true,
		button: 0,
		cancelable: true,
		clientX: 10,
		clientY: 10,
	}) as PointerEvent
	Object.defineProperty(event, "pointerId", { value: 1 })
	return event
}

describe("useFloatingComponent dynamic scroll trap", () => {
	beforeEach(() => {
		mocks.handleWheel.mockClear()
		mocks.stage.batchDraw.mockClear()
		mocks.stage.position.mockClear()
		mocks.stage.setPointersPositions.mockClear()
	})

	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("keeps wheel input local while the scroll area has a visible scrollbar", () => {
		render(<FloatingSurfaceHarness />)
		const viewport = screen.getByTestId("scroll-viewport")
		const target = screen.getByTestId("scroll-content")
		setScrollMetrics(viewport, { height: 100, overflows: true })

		const event = createEvent.wheel(target, { bubbles: true, cancelable: true, deltaY: 40 })
		fireEvent(target, event)

		expect(event.defaultPrevented).toBe(false)
		expect(mocks.handleWheel).not.toHaveBeenCalled()
	})

	it("keeps zoom gestures local while the scroll area has a visible scrollbar", () => {
		render(<FloatingSurfaceHarness />)
		const viewport = screen.getByTestId("scroll-viewport")
		const target = screen.getByTestId("scroll-content")
		setScrollMetrics(viewport, { height: 100, overflows: true })

		const event = createEvent.wheel(target, {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			deltaY: 40,
		})
		fireEvent(target, event)

		expect(event.defaultPrevented).toBe(true)
		expect(mocks.handleWheel).not.toHaveBeenCalled()
	})

	it("passes wheel and zoom input through when the scroll area does not overflow", () => {
		render(<FloatingSurfaceHarness />)
		const viewport = screen.getByTestId("scroll-viewport")
		const target = screen.getByTestId("scroll-content")
		setScrollMetrics(viewport, { height: 100, overflows: false })

		const wheelEvent = createEvent.wheel(target, {
			bubbles: true,
			cancelable: true,
			deltaY: 40,
		})
		fireEvent(target, wheelEvent)
		const zoomEvent = createEvent.wheel(target, {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			deltaY: 40,
		})
		fireEvent(target, zoomEvent)

		expect(mocks.handleWheel).toHaveBeenNthCalledWith(1, wheelEvent)
		expect(mocks.handleWheel).toHaveBeenNthCalledWith(2, zoomEvent)
	})

	it("does not steal scrollbar pointer interaction while the scroll area overflows", () => {
		render(<FloatingSurfaceHarness />)
		const viewport = screen.getByTestId("scroll-viewport")
		const target = screen.getByTestId("scrollbar-thumb")
		setScrollMetrics(viewport, { height: 100, overflows: true })

		const event = createPointerDownEvent()
		fireEvent(target, event)

		expect(event.defaultPrevented).toBe(false)
		expect(mocks.stage.position).not.toHaveBeenCalled()
	})

	it("preserves canvas pan pass-through when the scroll area fits its content", () => {
		render(<FloatingSurfaceHarness />)
		const viewport = screen.getByTestId("scroll-viewport")
		const target = screen.getByTestId("scroll-content")
		setScrollMetrics(viewport, { height: 100, overflows: false })

		const event = createPointerDownEvent()
		fireEvent(target, event)

		expect(event.defaultPrevented).toBe(true)
	})
})
