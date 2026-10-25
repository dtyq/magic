import { act, fireEvent, render, screen } from "@testing-library/react"
import { forwardRef, type InputHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DimensionInput } from "../DimensionInput"
import { resetNumericDragHintState } from "../numericDragHint"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	/** Use a plain input so the test can focus on inline unit behavior. */
	Input: forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
		<input ref={ref} {...props} />
	)),
}))

vi.mock("@/components/shadcn-ui/label", () => ({
	/** Keep the label lightweight for jsdom tests. */
	Label: ({
		children,
		htmlFor,
		className,
	}: {
		children: React.ReactNode
		htmlFor?: string
		className?: string
	}) => (
		<label htmlFor={htmlFor} className={className}>
			{children}
		</label>
	),
}))

function firePointerEvent(
	target: EventTarget,
	type: "pointerdown" | "pointermove" | "pointerup",
	clientY: number,
) {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: 0,
		cancelable: true,
		clientY,
	})
	act(() => target.dispatchEvent(event))
}

describe("DimensionInput", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		resetNumericDragHintState()
		vi.useRealTimers()
	})

	it("hides the px unit and treats a bare number as pixels", () => {
		const handleChange = vi.fn()

		render(
			<DimensionInput
				label="Width"
				value="200px"
				onChange={handleChange}
				id="width"
				testIdPrefix="dimension-input"
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("200")
		expect(screen.queryByTestId("dimension-input-unit-trigger")).not.toBeInTheDocument()

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "240" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("240px")
		expect(screen.getByTestId("dimension-input-input")).toHaveValue("240")
	})

	it("shows a non-px unit inside the input and keeps it when typed", () => {
		const handleChange = vi.fn()

		render(
			<DimensionInput
				label="Width"
				value="50%"
				onChange={handleChange}
				id="width"
				testIdPrefix="dimension-input"
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("50%")
		expect(screen.queryByTestId("dimension-input-unit-trigger")).not.toBeInTheDocument()

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "100%" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("100%")
		expect(screen.getByTestId("dimension-input-input")).toHaveValue("100%")
	})

	it("keeps a typed percent after the parent reports the computed pixel size", () => {
		const { rerender } = render(
			<DimensionInput
				label="Width"
				value="100%"
				onChange={vi.fn()}
				id="width"
				testIdPrefix="dimension-input"
				pixelValue="508px"
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("100%")

		rerender(
			<DimensionInput
				label="Width"
				value="508px"
				onChange={vi.fn()}
				id="width"
				testIdPrefix="dimension-input"
				pixelValue="508px"
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("100%")
	})

	it("syncs to a later inline px write instead of keeping the typed percent", () => {
		const { rerender } = render(
			<DimensionInput
				label="Width"
				value="100%"
				onChange={vi.fn()}
				id="width"
				testIdPrefix="dimension-input"
				pixelValue="508px"
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("100%")

		rerender(
			<DimensionInput
				label="Width"
				value="400px"
				onChange={vi.fn()}
				id="width"
				testIdPrefix="dimension-input"
				pixelValue="400px"
				valueFromInline
			/>,
		)

		expect(screen.getByTestId("dimension-input-input")).toHaveValue("400")
	})

	it("converts a number-only edit to px even when the previous unit was not px", () => {
		const handleChange = vi.fn()

		render(
			<DimensionInput
				label="Width"
				value="50%"
				onChange={handleChange}
				id="width"
				testIdPrefix="dimension-input"
			/>,
		)

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "60" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("60px")
		expect(screen.getByTestId("dimension-input-input")).toHaveValue("60")
	})

	it("converts a dragged percent to used pixels before applying the increment", () => {
		const handleChange = vi.fn()

		render(
			<DimensionInput
				label="Width"
				value="100%"
				onChange={handleChange}
				id="width"
				testIdPrefix="dimension-input"
				pixelValue="508px"
			/>,
		)
		const input = screen.getByTestId("dimension-input-input")

		firePointerEvent(input, "pointerdown", 100)
		firePointerEvent(window, "pointermove", 96)
		firePointerEvent(window, "pointerup", 96)
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("509px")
		expect(input).toHaveValue("509")
	})

	it("should hide the unit selector and append px automatically when px-only mode is enabled", () => {
		const handleChange = vi.fn()

		render(
			<DimensionInput
				label="Width"
				value="200px"
				onChange={handleChange}
				id="width"
				testIdPrefix="dimension-input"
				fixedUnit="px"
			/>,
		)

		expect(screen.queryByTestId("dimension-input-unit-trigger")).not.toBeInTheDocument()
		expect(screen.getByTestId("dimension-input-input")).toHaveValue("200")

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "240" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("240px")
	})
})
