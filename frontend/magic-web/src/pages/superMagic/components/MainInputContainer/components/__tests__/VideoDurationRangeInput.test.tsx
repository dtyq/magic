import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VideoDurationRangeInput } from "../VideoDurationRangeInput"

describe("VideoDurationRangeInput", () => {
	it("selects the minimum value when an empty slider is clicked", () => {
		const onValueChange = vi.fn()

		render(
			<VideoDurationRangeInput
				min={4}
				max={30}
				step={1}
				ariaLabel="时长"
				onValueChange={onValueChange}
				dataTestId="duration-range"
			/>,
		)

		fireEvent.pointerDown(screen.getByTestId("duration-range"), { button: 0 })

		expect(onValueChange).toHaveBeenCalledWith(4)
	})

	it("does not reinitialize an already selected value", () => {
		const onValueChange = vi.fn()

		render(
			<VideoDurationRangeInput
				value={8}
				min={4}
				max={30}
				step={1}
				ariaLabel="时长"
				onValueChange={onValueChange}
				dataTestId="duration-range"
			/>,
		)

		fireEvent.pointerDown(screen.getByTestId("duration-range"), { button: 0 })

		expect(onValueChange).not.toHaveBeenCalled()
	})

	it("supports keyboard selection of the minimum value from an empty state", () => {
		const onValueChange = vi.fn()

		render(
			<VideoDurationRangeInput
				min={4}
				max={30}
				step={1}
				ariaLabel="时长"
				onValueChange={onValueChange}
				dataTestId="duration-range"
			/>,
		)

		fireEvent.keyDown(screen.getByTestId("duration-range"), { key: "Home" })

		expect(onValueChange).toHaveBeenCalledWith(4)
	})
})
