import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ResizableDivider from "."

describe("ResizableDivider", () => {
	it("centers the visible divider and keeps it above adjacent panels", () => {
		render(<ResizableDivider position="left" offsetLeft={422} onResizeStart={vi.fn()} />)

		const handle = screen.getByTestId("handle-mouse-down")

		expect(handle).toHaveClass("z-20", "before:left-1/2", "before:-translate-x-1/2")
		expect(handle).toHaveStyle({ right: "422px", left: "auto" })
	})

	it("clears the drag overlay when the pointer ends or is cancelled", () => {
		render(<ResizableDivider onResizeStart={vi.fn()} />)
		const handle = screen.getByTestId("handle-mouse-down")

		fireEvent(handle, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 640 }))
		expect(screen.getByTestId("handle-overlay-mouse-move")).toBeInTheDocument()

		fireEvent.pointerUp(document)
		expect(screen.queryByTestId("handle-overlay-mouse-move")).not.toBeInTheDocument()

		fireEvent(handle, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 640 }))
		expect(screen.getByTestId("handle-overlay-mouse-move")).toBeInTheDocument()

		fireEvent.pointerCancel(document)
		expect(screen.queryByTestId("handle-overlay-mouse-move")).not.toBeInTheDocument()
	})
})
