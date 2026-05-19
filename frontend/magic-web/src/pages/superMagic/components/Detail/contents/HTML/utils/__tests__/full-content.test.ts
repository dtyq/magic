import { describe, expect, it, vi } from "vitest"

vi.mock("../nested-iframe-content", () => ({
	getNestedIframeInterceptorScript: () => "",
}))

describe("getFullContent", () => {
	it("injects hidden scrollbar styles without disabling vertical scrolling", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent(
			"<!DOCTYPE html><html><body><div>Preview</div></body></html>",
			"",
			{
				hideVerticalScroll: true,
			},
		)

		expect(result).toContain("overflow-y: auto !important;")
		expect(result).toContain("scrollbar-width: none;")
	})

	it("does not inject vertical overflow hidden styles by default", async () => {
		const { getFullContent } = await import("../full-content")
		const result = getFullContent("<!DOCTYPE html><html><body><div>Preview</div></body></html>")

		expect(result).not.toContain("overflow-y: auto !important;")
	})
})
