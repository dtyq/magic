import { createRef } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import HeadlessHorizontalScroll from "./index"

function makeScrollable(element: HTMLElement) {
	Object.defineProperties(element, {
		clientWidth: { configurable: true, value: 200 },
		scrollWidth: { configurable: true, value: 600 },
	})
}

function firePointerEvent(
	element: HTMLElement | Window,
	type: "pointerdown" | "pointermove" | "pointerup",
	init: MouseEventInit & { pointerId: number; pointerType?: string },
) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
	Object.defineProperties(event, {
		pointerId: { value: init.pointerId },
		pointerType: { value: init.pointerType ?? "" },
	})
	fireEvent(element, event)
	return event
}

describe("HeadlessHorizontalScroll", () => {
	it("keeps vertical overflow clipped by default", () => {
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)

		const scroller = screen.getByTestId("scroller")
		const root = scroller.parentElement

		expect(root).toHaveClass("overflow-hidden")
		expect(root).not.toHaveClass("overflow-visible")
	})

	// Verify the mobile filter-bar opt-in changes only the outer clipping behavior.
	it("allows vertical overflow when explicitly enabled", () => {
		render(
			<HeadlessHorizontalScroll
				allowVerticalOverflow
				scrollContainerProps={{ "data-testid": "scroller" }}
			>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)

		const scroller = screen.getByTestId("scroller")
		const root = scroller.parentElement

		expect(root).toHaveClass("overflow-visible")
		expect(root).not.toHaveClass("overflow-hidden")
	})

	it("scrolls horizontally while the pointer is held and dragged", () => {
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		makeScrollable(scroller)

		firePointerEvent(scroller, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(scroller, "pointermove", {
			pointerId: 1,
			buttons: 1,
			clientX: 70,
			clientY: 22,
		})

		expect(scroller.scrollLeft).toBe(50)
		expect(scroller).toHaveClass("cursor-grabbing")

		firePointerEvent(scroller, "pointerup", { pointerId: 1 })
		expect(scroller).not.toHaveClass("cursor-grabbing")
	})

	it("keeps the final position when the pointer returns quickly after release", () => {
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		makeScrollable(scroller)
		scroller.style.scrollBehavior = "smooth"

		firePointerEvent(scroller, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(scroller, "pointermove", {
			pointerId: 1,
			buttons: 1,
			clientX: 70,
			clientY: 22,
		})

		expect(scroller.scrollLeft).toBe(50)
		expect(scroller.style.scrollBehavior).toBe("auto")

		firePointerEvent(window, "pointerup", { pointerId: 1, clientX: 70, clientY: 22 })
		firePointerEvent(scroller, "pointermove", {
			pointerId: 1,
			buttons: 1,
			clientX: 120,
			clientY: 22,
		})

		expect(scroller.scrollLeft).toBe(50)
		expect(scroller.style.scrollBehavior).toBe("smooth")
	})

	it("releases an active pointer capture when the drag effect is rebuilt", () => {
		const firstScrollContainerRef = createRef<HTMLDivElement>()
		const secondScrollContainerRef = createRef<HTMLDivElement>()
		const { rerender } = render(
			<HeadlessHorizontalScroll
				scrollContainerRef={firstScrollContainerRef}
				scrollContainerProps={{ "data-testid": "scroller" }}
			>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		let capturedPointerId: number | null = null
		const setPointerCapture = vi.fn((pointerId: number) => {
			capturedPointerId = pointerId
		})
		const hasPointerCapture = vi.fn((pointerId: number) => capturedPointerId === pointerId)
		const releasePointerCapture = vi.fn((pointerId: number) => {
			if (capturedPointerId === pointerId) capturedPointerId = null
		})
		Object.defineProperties(scroller, {
			setPointerCapture: { configurable: true, value: setPointerCapture },
			hasPointerCapture: { configurable: true, value: hasPointerCapture },
			releasePointerCapture: { configurable: true, value: releasePointerCapture },
		})
		makeScrollable(scroller)
		scroller.style.scrollBehavior = "smooth"

		firePointerEvent(scroller, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(scroller, "pointermove", {
			pointerId: 1,
			buttons: 1,
			clientX: 70,
			clientY: 22,
		})

		expect(scroller).toHaveClass("cursor-grabbing")
		expect(scroller.style.scrollBehavior).toBe("auto")

		rerender(
			<HeadlessHorizontalScroll
				scrollContainerRef={secondScrollContainerRef}
				scrollContainerProps={{ "data-testid": "scroller" }}
			>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)

		expect(secondScrollContainerRef.current).toBe(scroller)
		expect(releasePointerCapture).toHaveBeenCalledWith(1)
		expect(scroller).not.toHaveClass("cursor-grabbing")
		expect(scroller.style.scrollBehavior).toBe("smooth")
	})

	it("keeps a click when the pointer does not become a horizontal drag", () => {
		const handleClick = vi.fn()
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<button type="button" onClick={handleClick}>
					Item
				</button>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		const item = screen.getByRole("button", { name: "Item" })
		const setPointerCapture = vi.fn()
		Object.defineProperty(scroller, "setPointerCapture", { value: setPointerCapture })
		makeScrollable(scroller)

		firePointerEvent(item, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(item, "pointerup", {
			pointerId: 1,
			clientX: 120,
			clientY: 20,
		})
		fireEvent.click(item)

		expect(setPointerCapture).not.toHaveBeenCalled()
		expect(handleClick).toHaveBeenCalledOnce()
	})

	it("suppresses the item click produced after dragging", () => {
		const handleClick = vi.fn()
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<button type="button" onClick={handleClick}>
					Item
				</button>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		const item = screen.getByRole("button", { name: "Item" })
		makeScrollable(scroller)

		firePointerEvent(item, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(item, "pointermove", {
			pointerId: 1,
			buttons: 1,
			clientX: 70,
			clientY: 22,
		})
		firePointerEvent(item, "pointerup", { pointerId: 1, clientX: 70, clientY: 22 })
		fireEvent.click(item)

		expect(handleClick).not.toHaveBeenCalled()
	})

	it("suppresses a fast drag click even when no pointer move is delivered", () => {
		const handleClick = vi.fn()
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<button type="button" onClick={handleClick}>
					Item
				</button>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		const item = screen.getByRole("button", { name: "Item" })
		makeScrollable(scroller)

		firePointerEvent(item, "pointerdown", {
			pointerId: 1,
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		firePointerEvent(window, "pointerup", {
			pointerId: 1,
			clientX: 70,
			clientY: 22,
		})
		fireEvent.click(item)

		expect(scroller.scrollLeft).toBe(50)
		expect(handleClick).not.toHaveBeenCalled()
	})

	it("leaves touch scrolling and item clicks to the browser", () => {
		const handleClick = vi.fn()
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<button type="button" onClick={handleClick}>
					Item
				</button>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		const item = screen.getByRole("button", { name: "Item" })
		makeScrollable(scroller)

		firePointerEvent(item, "pointerdown", {
			pointerId: 1,
			pointerType: "touch",
			button: 0,
			clientX: 120,
			clientY: 20,
		})
		const moveEvent = firePointerEvent(item, "pointermove", {
			pointerId: 1,
			pointerType: "touch",
			buttons: 1,
			clientX: 70,
			clientY: 22,
		})
		firePointerEvent(item, "pointerup", {
			pointerId: 1,
			pointerType: "touch",
			clientX: 70,
			clientY: 22,
		})
		fireEvent.click(item)

		expect(moveEvent.defaultPrevented).toBe(false)
		expect(scroller.scrollLeft).toBe(0)
		expect(scroller).not.toHaveClass("touch-pan-y")
		expect(scroller).not.toHaveClass("cursor-grabbing")
		expect(handleClick).toHaveBeenCalledOnce()
	})

	it("no longer maps vertical wheel movement to horizontal scrolling", () => {
		render(
			<HeadlessHorizontalScroll scrollContainerProps={{ "data-testid": "scroller" }}>
				<div>Content</div>
			</HeadlessHorizontalScroll>,
		)
		const scroller = screen.getByTestId("scroller")
		makeScrollable(scroller)

		fireEvent.wheel(scroller, { deltaY: 80 })

		expect(scroller.scrollLeft).toBe(0)
	})
})
