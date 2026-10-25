import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NumericDragInput } from "../NumericDragInput"
import { resetNumericDragHintState } from "../numericDragHint"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

function ControlledNumericInput({
	initialValue,
	onChange = vi.fn(),
	...props
}: {
	initialValue: string
	onChange?: (value: string) => void
	onCommit?: (value: string) => void
	step?: number
	min?: number
	max?: number
	precision?: number
	dragSensitivity?: number
	formatDisplayValue?: (value: string | number) => string
	formatEditValue?: (value: string | number) => string
	scrubStartValue?: number | null
	className?: string
	hideStepper?: boolean
	onPointerDown?: React.PointerEventHandler<HTMLInputElement>
}) {
	const [value, setValue] = useState(initialValue)

	return (
		<NumericDragInput
			aria-label="numeric value"
			value={value}
			onChange={(nextValue) => {
				setValue(nextValue)
				onChange(nextValue)
			}}
			{...props}
		/>
	)
}

function firePointerEvent(
	target: EventTarget,
	type: "pointerdown" | "pointermove" | "pointerup",
	clientY: number,
): MouseEvent {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: 0,
		cancelable: true,
		clientY,
	})
	act(() => target.dispatchEvent(event))
	return event
}

describe("NumericDragInput", () => {
	afterEach(() => {
		resetNumericDragHintState()
	})

	it("formats the display value outside editing", () => {
		render(
			<ControlledNumericInput
				initialValue="normal"
				formatDisplayValue={(value) => (value === "normal" ? "Default" : String(value))}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		expect(input).toHaveValue("Default")
		fireEvent.focus(input)
		expect(input).toHaveValue("normal")
		fireEvent.change(input, { target: { value: "1.5" } })
		expect(input).toHaveValue("1.5")
		fireEvent.blur(input)
		expect(input).toHaveValue("1.5")
	})

	it("uses the edit formatter while focused", () => {
		render(
			<ControlledNumericInput
				initialValue="normal"
				formatDisplayValue={(value) => (value === "normal" ? "Default" : String(value))}
				formatEditValue={(value) => (value === "normal" ? "" : String(value))}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		expect(input).toHaveValue("Default")
		fireEvent.focus(input)
		expect(input).toHaveValue("")
		fireEvent.change(input, { target: { value: "1.2" } })
		expect(input).toHaveValue("1.2")
		fireEvent.blur(input)
		expect(input).toHaveValue("1.2")
	})

	it("adjusts the value by vertical drag", () => {
		const onPointerDown = vi.fn()
		const onCommit = vi.fn()
		render(
			<ControlledNumericInput
				initialValue="10"
				step={2}
				dragSensitivity={4}
				onPointerDown={onPointerDown}
				onCommit={onCommit}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		firePointerEvent(input, "pointerdown", 100)
		expect(onPointerDown).toHaveBeenCalled()
		expect(onPointerDown.mock.calls[0][0].button).toBe(0)
		expect(input).toHaveAttribute("data-dragging", "true")
		const moveEvent = firePointerEvent(window, "pointermove", 92)

		expect(input).toHaveValue("14")
		expect(onCommit).not.toHaveBeenCalled()
		expect(moveEvent.defaultPrevented).toBe(true)
		firePointerEvent(window, "pointermove", 84)
		expect(input).toHaveValue("18")
		expect(onCommit).not.toHaveBeenCalled()

		firePointerEvent(window, "pointerup", 84)
		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onCommit).toHaveBeenCalledWith("18")
		expect(input).not.toHaveAttribute("data-dragging", "true")
	})

	it("decreases the value when dragging down and respects min/max", () => {
		render(
			<ControlledNumericInput
				initialValue="10"
				step={2}
				dragSensitivity={4}
				min={6}
				max={12}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		firePointerEvent(input, "pointerdown", 100)
		firePointerEvent(window, "pointermove", 120)
		expect(input).toHaveValue("6")

		firePointerEvent(window, "pointerup", 120)
		firePointerEvent(input, "pointerdown", 100)
		firePointerEvent(window, "pointermove", 60)
		expect(input).toHaveValue("12")
	})

	it("does not adjust by mouse wheel", () => {
		render(<ControlledNumericInput initialValue="10" step={2} />)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		fireEvent.wheel(input, { deltaY: -80 })
		expect(input).toHaveValue("10")
		fireEvent.wheel(input, { deltaY: 80 })
		expect(input).toHaveValue("10")
	})

	it("starts a drag from the provided used-pixel value", () => {
		const onCommit = vi.fn()
		render(
			<ControlledNumericInput
				initialValue="100%"
				scrubStartValue={508}
				dragSensitivity={4}
				onCommit={onCommit}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		firePointerEvent(input, "pointerdown", 100)
		firePointerEvent(window, "pointermove", 96)
		firePointerEvent(window, "pointerup", 96)

		expect(input).toHaveValue("509")
		expect(onCommit).toHaveBeenCalledWith("509")
	})

	it("adjusts with ArrowUp and ArrowDown and formats precision", () => {
		render(
			<ControlledNumericInput initialValue="0.5" step={0.1} precision={2} min={0} max={1} />,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		fireEvent.keyDown(input, { key: "ArrowUp" })
		expect(input).toHaveValue("0.60")
		fireEvent.keyDown(input, { key: "ArrowDown" })
		expect(input).toHaveValue("0.50")
	})

	it("keeps direct text editing and ignores drag or wheel for an invalid value", () => {
		const onChange = vi.fn()
		render(<ControlledNumericInput initialValue="" onChange={onChange} />)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		firePointerEvent(input, "pointerdown", 100)
		firePointerEvent(window, "pointermove", 80)
		firePointerEvent(window, "pointerup", 80)
		fireEvent.wheel(input, { deltaY: -80 })

		expect(onChange).not.toHaveBeenCalled()

		fireEvent.change(input, { target: { value: "24" } })
		expect(input).toHaveValue("24")
		expect(onChange).toHaveBeenCalledWith("24")
	})

	it("hides the drag cursor until the value is numeric", () => {
		render(
			<ControlledNumericInput
				initialValue="normal"
				formatDisplayValue={(value) => (value === "normal" ? "Default" : String(value))}
			/>,
		)
		const input = screen.getByRole("textbox", { name: "numeric value" })

		expect(input).not.toHaveAttribute("data-can-drag", "true")
		expect(input.className).not.toContain("cursor-ns-resize")

		fireEvent.change(input, { target: { value: "1.5" } })

		expect(input).toHaveAttribute("data-can-drag", "true")
		expect(input.className).toContain("cursor-ns-resize")
	})

	it("increments and decrements with the stepper buttons", () => {
		const onCommit = vi.fn()
		render(
			<ControlledNumericInput
				initialValue="10"
				step={2}
				min={6}
				max={14}
				onCommit={onCommit}
			/>,
		)

		fireEvent.click(screen.getByTestId("numeric-drag-increment-button"))
		expect(screen.getByRole("textbox", { name: "numeric value" })).toHaveValue("12")
		expect(onCommit).toHaveBeenCalledWith("12")

		fireEvent.click(screen.getByTestId("numeric-drag-decrement-button"))
		expect(screen.getByRole("textbox", { name: "numeric value" })).toHaveValue("10")
		expect(onCommit).toHaveBeenCalledWith("10")
	})

	it("disables the stepper that would exceed min or max", () => {
		render(<ControlledNumericInput initialValue="12" step={2} min={6} max={12} />)

		expect(screen.getByTestId("numeric-drag-increment-button")).toBeDisabled()
		expect(screen.getByTestId("numeric-drag-decrement-button")).not.toBeDisabled()
	})

	it("reveals the stepper on hover and while dragging", () => {
		render(<ControlledNumericInput initialValue="10" />)

		const stepper = screen.getByTestId("numeric-drag-stepper")
		expect(stepper.className).toContain("opacity-0")
		expect(stepper.className).toContain("group-hover/numeric:opacity-100")
		expect(stepper.className).toContain("group-focus-within/numeric:opacity-100")

		const input = screen.getByRole("textbox", { name: "numeric value" })
		firePointerEvent(input, "pointerdown", 100)
		expect(screen.getByTestId("numeric-drag-stepper").className.split(" ")).toContain(
			"opacity-100",
		)
	})

	it("keeps the field border and rounds the overlay stepper", () => {
		render(
			<ControlledNumericInput
				initialValue="4"
				className="h-6 w-14 rounded-md px-1 text-right text-xs"
			/>,
		)

		const field = screen.getByTestId("numeric-drag-input")
		const input = screen.getByRole("textbox", { name: "numeric value" })
		const stepper = screen.getByTestId("numeric-drag-stepper")
		expect(field.contains(stepper)).toBe(true)
		expect(stepper.className).toContain("absolute")
		expect(stepper.className).toContain("rounded-r-md")
		expect(input.className).toContain("rounded-md")
		expect(input.className).not.toContain("rounded-r-none")
		expect(input.className).not.toContain("border-r-0")
		expect(input.className).toContain("pr-4")
	})

	it("hides the stepper when hideStepper is set", () => {
		render(<ControlledNumericInput initialValue="26" hideStepper />)

		expect(screen.queryByTestId("numeric-drag-stepper")).not.toBeInTheDocument()
		expect(screen.getByTestId("numeric-drag-input").className).toContain("contents")
	})

	it("hides the stepper on compact box-model fields", () => {
		render(
			<ControlledNumericInput
				initialValue="8"
				className="h-5 w-8 px-0.5 text-center text-[11px]"
			/>,
		)

		expect(screen.queryByTestId("numeric-drag-stepper")).not.toBeInTheDocument()
	})

	it("hides the stepper when the value cannot be adjusted", () => {
		render(<ControlledNumericInput initialValue="" />)

		expect(screen.queryByTestId("numeric-drag-stepper")).not.toBeInTheDocument()
	})

	it("shows the drag hint once on the first stepper hover", () => {
		const { unmount } = render(<ControlledNumericInput initialValue="10" />)

		expect(screen.queryByTestId("numeric-drag-hint")).not.toBeInTheDocument()
		fireEvent.mouseEnter(screen.getByTestId("numeric-drag-stepper"))
		expect(screen.getByTestId("numeric-drag-hint")).toHaveTextContent(
			"stylePanel.numericDragHint",
		)
		unmount()

		render(<ControlledNumericInput initialValue="8" />)
		fireEvent.mouseEnter(screen.getByTestId("numeric-drag-stepper"))
		expect(screen.queryByTestId("numeric-drag-hint")).not.toBeInTheDocument()
	})

	it("shows the drag hint on only one input at a time", () => {
		render(
			<>
				<ControlledNumericInput initialValue="10" />
				<ControlledNumericInput initialValue="20" />
			</>,
		)
		const steppers = screen.getAllByTestId("numeric-drag-stepper")

		fireEvent.mouseEnter(steppers[0])
		expect(screen.getAllByTestId("numeric-drag-hint")).toHaveLength(1)

		fireEvent.mouseEnter(steppers[1])
		expect(screen.getAllByTestId("numeric-drag-hint")).toHaveLength(1)
	})
})
