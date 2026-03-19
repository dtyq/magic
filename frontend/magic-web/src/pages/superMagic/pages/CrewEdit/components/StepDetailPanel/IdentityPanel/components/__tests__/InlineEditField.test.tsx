import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { InlineEditField } from "../InlineEditField"

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))

describe("InlineEditField", () => {
	it("does not enter edit mode when disabled", () => {
		render(
			<InlineEditField
				value="Crew"
				placeholder="Enter name"
				textClassName="text-sm"
				onSave={vi.fn()}
				testId="inline-edit-field"
				disabled
			/>,
		)

		fireEvent.click(screen.getByTestId("inline-edit-field"))

		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.getByText("Crew")).toBeInTheDocument()
	})

	it("exits edit mode when field becomes disabled", () => {
		const { rerender } = render(
			<InlineEditField
				value="Crew"
				placeholder="Enter name"
				textClassName="text-sm"
				onSave={vi.fn()}
				testId="inline-edit-field"
			/>,
		)

		fireEvent.click(screen.getByTestId("inline-edit-field"))
		expect(screen.getByRole("textbox")).toBeInTheDocument()

		rerender(
			<InlineEditField
				value="Crew"
				placeholder="Enter name"
				textClassName="text-sm"
				onSave={vi.fn()}
				testId="inline-edit-field"
				disabled
			/>,
		)

		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.getByText("Crew")).toBeInTheDocument()
	})

	it("calls custom click handler instead of entering edit mode", () => {
		const handleClick = vi.fn()

		render(
			<InlineEditField
				value="Crew"
				placeholder="Enter name"
				textClassName="text-sm"
				onSave={vi.fn()}
				onClick={handleClick}
				testId="inline-edit-field"
			/>,
		)

		fireEvent.click(screen.getByTestId("inline-edit-field"))

		expect(handleClick).toHaveBeenCalledTimes(1)
		expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
		expect(screen.getByText("Crew")).toBeInTheDocument()
	})
})
