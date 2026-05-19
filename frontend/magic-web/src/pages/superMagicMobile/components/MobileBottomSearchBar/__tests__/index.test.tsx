import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MobileBottomSearchBar from "../index"

describe("MobileBottomSearchBar", () => {
	it("renders the controlled input with stable test ids", () => {
		render(
			<MobileBottomSearchBar
				value="workspace"
				placeholder="Search workspace"
				clearAriaLabel="Cancel search"
				onValueChange={vi.fn()}
				testIdPrefix="mobile-bottom-search"
			/>,
		)

		expect(screen.getByTestId("mobile-bottom-search-root")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-bottom-search-field")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-bottom-search-input")).toHaveValue("workspace")
		expect(screen.getByTestId("mobile-bottom-search-clear")).toBeInTheDocument()
	})

	it("shows the clear button on focus in focus-or-value mode", () => {
		render(
			<MobileBottomSearchBar
				value=""
				placeholder="Search workspace"
				clearAriaLabel="Cancel search"
				onValueChange={vi.fn()}
				testIdPrefix="focus-search"
				clearButtonVisibility="focus-or-value"
			/>,
		)

		expect(screen.queryByTestId("focus-search-clear")).not.toBeInTheDocument()

		fireEvent.focus(screen.getByTestId("focus-search-input"))

		expect(screen.getByTestId("focus-search-clear")).toBeInTheDocument()
	})

	it("keeps the clear button hidden on focus in value-only mode", () => {
		render(
			<MobileBottomSearchBar
				value=""
				placeholder="Search project"
				clearAriaLabel="Cancel search"
				onValueChange={vi.fn()}
				testIdPrefix="value-search"
				clearButtonVisibility="value-only"
			/>,
		)

		fireEvent.focus(screen.getByTestId("value-search-input"))

		expect(screen.queryByTestId("value-search-clear")).not.toBeInTheDocument()
	})

	it("clears the controlled value through the shared clear action", () => {
		const handleValueChange = vi.fn()

		render(
			<MobileBottomSearchBar
				value="keyword"
				placeholder="Search recycle bin"
				clearAriaLabel="Cancel search"
				onValueChange={handleValueChange}
				testIdPrefix="clear-search"
			/>,
		)

		fireEvent.mouseDown(screen.getByTestId("clear-search-clear"))

		expect(handleValueChange).toHaveBeenCalledWith("")
	})

	it("始终使用固定 pb-3，由 GlobalSafeArea spacer 统一处理底部安全区", () => {
		render(
			<MobileBottomSearchBar
				value=""
				placeholder="Search workspace"
				clearAriaLabel="Cancel search"
				onValueChange={vi.fn()}
				testIdPrefix="safe-area-search"
			/>,
		)

		expect(screen.getByTestId("safe-area-search-root").className).toContain("pb-3")
		expect(screen.getByTestId("safe-area-search-root").className).not.toContain(
			"safe-area-inset-bottom",
		)
	})

	it("className prop 可叠加在根节点", () => {
		render(
			<MobileBottomSearchBar
				value=""
				placeholder="Search workspace"
				clearAriaLabel="Cancel search"
				onValueChange={vi.fn()}
				testIdPrefix="plain-search"
				className="mt-2"
			/>,
		)

		expect(screen.getByTestId("plain-search-root").className).toContain("pb-3")
		expect(screen.getByTestId("plain-search-root").className).toContain("mt-2")
	})
})
