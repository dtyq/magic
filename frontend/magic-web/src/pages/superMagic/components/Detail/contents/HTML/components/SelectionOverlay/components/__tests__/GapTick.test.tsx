import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GapTick } from "../GapTick"

describe("GapTick", () => {
	it("renders a short vertical tick for the column axis", () => {
		render(<GapTick axis="column" />)
		const tick = document.querySelector("[data-gap-tick='column']")
		expect(tick).toBeTruthy()
		expect(tick?.querySelector("svg")).toBeNull()
		expect(tick?.className).toContain("h-3")
		expect(tick?.className).toContain("bg-[#808080]")
		expect(tick?.className).not.toContain("h-full")
	})

	it("renders a short horizontal tick for the row axis", () => {
		render(<GapTick axis="row" />)
		const tick = document.querySelector("[data-gap-tick='row']")
		expect(tick).toBeTruthy()
		expect(tick?.className).toContain("w-3")
		expect(tick?.className).toContain("bg-[#808080]")
		expect(tick?.className).not.toContain("w-full")
	})
})
