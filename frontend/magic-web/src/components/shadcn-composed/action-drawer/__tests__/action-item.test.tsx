import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ActionItem } from "../action-item"

/** Verifies enabled actions expose an interactive affordance and remain clickable. */
describe("ActionItem", () => {
	it("uses an interactive cursor for enabled actions", () => {
		const onClick = vi.fn()
		render(<ActionItem label="Mock action" onClick={onClick} />)

		const action = screen.getByRole("button", { name: "Mock action" })
		expect(action).toHaveClass("cursor-pointer")
		expect(action).not.toHaveClass("cursor-not-allowed")
		fireEvent.click(action)
		expect(onClick).toHaveBeenCalledOnce()
	})

	it("uses a disabled cursor and blocks disabled actions", () => {
		const onClick = vi.fn()
		render(<ActionItem label="Mock disabled action" disabled onClick={onClick} />)

		const action = screen.getByRole("button", { name: "Mock disabled action" })
		expect(action).toHaveClass("disabled:cursor-not-allowed")
		expect(action).toHaveClass("disabled:opacity-50")
		fireEvent.click(action)
		expect(onClick).not.toHaveBeenCalled()
	})
})
