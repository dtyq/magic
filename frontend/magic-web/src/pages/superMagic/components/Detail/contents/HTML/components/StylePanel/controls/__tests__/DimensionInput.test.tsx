import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DimensionInput } from "../DimensionInput"

vi.mock("@/components/shadcn-ui/input", () => ({
	/** Use a plain input so the test can focus on px-only behavior. */
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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

vi.mock("@/components/shadcn-ui/select", () => ({
	/** Keep the select minimal so tests can focus on unit preservation behavior. */
	Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SelectItem: ({
		children,
		value,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		value: string
		"data-testid"?: string
	}) => (
		<div data-testid={dataTestId} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({
		children,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		"data-testid"?: string
	}) => <button data-testid={dataTestId}>{children}</button>,
	SelectValue: () => <span />,
}))

describe("DimensionInput", () => {
	beforeEach(() => {
		vi.useFakeTimers()
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

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "240" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("240px")
	})

	it("should keep the parsed unit when editing a non-px value", () => {
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

		expect(screen.getByTestId("dimension-input-unit-trigger")).toBeInTheDocument()

		fireEvent.change(screen.getByTestId("dimension-input-input"), {
			target: { value: "60" },
		})
		vi.advanceTimersByTime(300)

		expect(handleChange).toHaveBeenCalledWith("60%")
	})
})
