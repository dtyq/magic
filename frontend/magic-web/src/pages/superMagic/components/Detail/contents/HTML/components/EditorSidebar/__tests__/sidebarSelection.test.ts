import { describe, expect, it } from "vitest"
import { shouldCollapseStylesOnBlur } from "../sidebarSelection"

describe("shouldCollapseStylesOnBlur", () => {
	it("collapses only when a selected element is cleared", () => {
		expect(shouldCollapseStylesOnBlur("h1.title", undefined)).toBe(true)
		expect(shouldCollapseStylesOnBlur("h1.title", "")).toBe(true)
	})

	it("keeps the section when selection starts, stays, or switches", () => {
		expect(shouldCollapseStylesOnBlur(undefined, undefined)).toBe(false)
		expect(shouldCollapseStylesOnBlur(undefined, "p.copy")).toBe(false)
		expect(shouldCollapseStylesOnBlur("p.copy", "p.copy")).toBe(false)
		expect(shouldCollapseStylesOnBlur("p.copy", "h1.title")).toBe(false)
	})
})
