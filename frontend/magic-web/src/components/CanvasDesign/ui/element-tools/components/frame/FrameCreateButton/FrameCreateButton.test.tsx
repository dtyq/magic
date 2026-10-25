import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import FrameCreateButton from "./index"

const mocks = vi.hoisted(() => ({
	tool: {
		visibility: "visible" as "visible" | "hidden" | "disabled",
		execute: vi.fn(),
	},
}))

vi.mock("../../../model/ElementToolResolutionContext", () => ({
	useElementToolResolution: () => mocks.tool,
}))

describe("FrameCreateButton", () => {
	beforeEach(() => {
		mocks.tool.visibility = "visible"
		mocks.tool.execute.mockClear()
	})

	it("forwards a click to the resolved tool command", () => {
		render(<FrameCreateButton />)

		fireEvent.click(screen.getByText("创建画框"))

		expect(mocks.tool.execute).toHaveBeenCalledTimes(1)
	})

	it("does not execute a hidden tool", () => {
		mocks.tool.visibility = "hidden"
		render(<FrameCreateButton />)

		const button = screen.getByText("创建画框").parentElement
		if (!button) throw new Error("expected frame create button")
		expect(button.className).toContain("disabled")
		fireEvent.click(button)

		expect(mocks.tool.execute).not.toHaveBeenCalled()
		mocks.tool.visibility = "visible"
	})
})
