import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ControlHandles } from "../ControlHandles"

const sharedProps = {
	isMoving: false,
	onMoveHandleMouseDown: vi.fn(),
	onDuplicate: vi.fn(),
	onDelete: vi.fn(),
	onResizeHandleMouseDown: vi.fn(),
	rotation: 0,
	onRotateHandleMouseDown: vi.fn(),
	transformedRect: { top: 0, left: 0, width: 120, height: 80 },
	containerElement: null,
}

describe("ControlHandles", () => {
	it("uses machined knobs and mid-edge resize ticks", () => {
		render(
			<ControlHandles
				{...sharedProps}
				resizeHandles={[
					{
						id: "right",
						cursor: "e-resize",
						directionX: 1,
						directionY: 0,
						style: { top: "50%", right: 0 },
					},
					{
						id: "bottom",
						cursor: "s-resize",
						directionX: 0,
						directionY: 1,
						style: { left: "50%", bottom: 0 },
					},
					{
						id: "bottom-right",
						cursor: "se-resize",
						directionX: 1,
						directionY: 1,
						style: { right: 0, bottom: 0 },
					},
				]}
			/>,
		)

		const move = screen.getByTestId("on-move-handle-mouse-down")
		const rotate = screen.getByTestId("on-rotate-handle-mouse-down")
		const [right, bottom, corner] = screen.getAllByTestId("on-resize-handle-mouse-down")

		expect(move.className).toContain("h-5")
		expect(rotate.className).toContain("h-5")
		expect(move.className).toContain("bg-primary")
		expect(move.className).toContain("border-background")
		expect(move.className).not.toContain("shadow-md")
		expect(move.querySelector("svg")?.getAttribute("stroke-width")).toBe("2")

		expect(right.querySelector("[data-resize-tick='right']")).toBeTruthy()
		expect(bottom.querySelector("[data-resize-tick='bottom']")).toBeTruthy()
		expect(corner.querySelector("[data-resize-tick]")).toBeNull()
		expect(right.querySelector("svg")).toBeNull()
		expect(bottom.querySelector("svg")).toBeNull()
		for (const handle of [right, bottom, corner]) {
			expect(handle.className).toContain("group/resize")
			expect(handle.className).not.toContain("bg-background")
			expect(handle.className).not.toContain("border-2")
		}
	})

	it("renders gap ticks only when frames are provided", () => {
		const { rerender } = render(
			<ControlHandles
				{...sharedProps}
				resizeHandles={[]}
				gapHandles={[]}
				onGapHandlePointerDown={vi.fn()}
			/>,
		)
		expect(screen.queryByTestId("on-gap-handle-pointer-down")).not.toBeInTheDocument()
		rerender(
			<ControlHandles
				{...sharedProps}
				resizeHandles={[]}
				gapHandles={[
					{
						id: "column:40:40",
						axis: "column",
						left: 40,
						top: 10,
						width: 8,
						height: 60,
						cursor: "col-resize",
					},
					{
						id: "column:40:140",
						axis: "column",
						left: 40,
						top: 110,
						width: 8,
						height: 60,
						cursor: "col-resize",
					},
				]}
				onGapHandlePointerDown={vi.fn()}
			/>,
		)
		const handles = screen.getAllByTestId("on-gap-handle-pointer-down")
		expect(handles).toHaveLength(2)
		expect(handles[0]).toHaveAttribute("data-axis", "column")
		expect(handles[0].className).not.toContain("group-hover/selection")
		expect(handles[0].className).toContain("opacity-30")
		expect(handles[0].className).toContain("hover:opacity-100")
		expect(handles[0].className).not.toContain("opacity-0")
	})

	it("shows a gap value readout on the tick", () => {
		render(
			<ControlHandles
				{...sharedProps}
				resizeHandles={[]}
				gapHandles={[
					{
						id: "column:0:1",
						axis: "column",
						left: 40,
						top: 10,
						width: 8,
						height: 60,
						cursor: "col-resize",
						valueLabel: "24px",
					},
				]}
				onGapHandlePointerDown={vi.fn()}
			/>,
		)
		const readout = screen.getByTestId("gap-value-readout")
		expect(readout).toHaveTextContent("24px")
		expect(readout.className).toContain("opacity-0")
		expect(readout.className).toContain("group-hover/gap:opacity-100")
		expect(readout.className).toContain("group-data-[dragging=true]/gap:opacity-100")
	})
})
