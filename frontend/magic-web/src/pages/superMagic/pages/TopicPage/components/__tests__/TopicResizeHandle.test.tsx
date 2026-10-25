import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TopicResizeHandle from "../TopicResizeHandle"

describe("TopicResizeHandle", () => {
	it("keeps the divider narrow while exposing a wider pointer target", () => {
		render(<TopicResizeHandle onResizeStart={vi.fn()} />)

		const handle = screen.getByTestId("handle-mouse-down")
		const hitArea = screen.getByTestId("resize-handle-hit-area")

		expect(handle).toHaveClass("!w-2", "overflow-visible")
		expect(hitArea).toHaveClass("absolute", "w-4")
		const grip = screen.getByTestId("resize-grip")
		expect(grip).toHaveClass("rounded-md", "border", "bg-white", "px-0.5", "py-1")
		expect(grip.children).toHaveLength(3)
	})

	it("supports the shared grip on a gray divider with a left border", () => {
		render(
			<TopicResizeHandle
				className="border-l border-border !bg-sidebar"
				onResizeStart={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("handle-mouse-down")).toHaveClass(
			"border-l",
			"border-border",
			"!bg-sidebar",
		)
		expect(screen.getByTestId("resize-grip")).toHaveAttribute("data-orientation", "vertical")
	})

	it("starts resizing from the extended pointer target and clears the drag portal", () => {
		const onResizeStart = vi.fn()
		render(<TopicResizeHandle onResizeStart={onResizeStart} />)

		fireEvent(
			screen.getByTestId("resize-handle-hit-area"),
			new MouseEvent("pointerdown", { bubbles: true, clientX: 640 }),
		)

		expect(onResizeStart).toHaveBeenCalledTimes(1)
		expect(onResizeStart).toHaveBeenCalledWith(640)
		expect(screen.getByTestId("set-is-dragging")).toBeInTheDocument()

		fireEvent.pointerUp(document)
		expect(screen.queryByTestId("set-is-dragging")).not.toBeInTheDocument()
	})

	it("clears the drag portal when the pointer is cancelled", () => {
		render(<TopicResizeHandle onResizeStart={vi.fn()} />)

		fireEvent(
			screen.getByTestId("handle-mouse-down"),
			new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 480 }),
		)
		expect(screen.getByTestId("set-is-dragging")).toBeInTheDocument()

		fireEvent.pointerCancel(document)
		expect(screen.queryByTestId("set-is-dragging")).not.toBeInTheDocument()
	})

	it("does not start resizing while disabled", () => {
		const onResizeStart = vi.fn()
		render(<TopicResizeHandle disabled onResizeStart={onResizeStart} />)

		fireEvent.pointerDown(screen.getByTestId("resize-handle-hit-area"), { clientX: 320 })

		expect(onResizeStart).not.toHaveBeenCalled()
		expect(screen.queryByTestId("set-is-dragging")).not.toBeInTheDocument()
		expect(screen.getByTestId("handle-mouse-down")).toHaveClass(
			"pointer-events-none",
			"opacity-0",
		)
	})
})
