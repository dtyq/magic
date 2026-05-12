import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { exportMermaidSvgToPngBlob } from "../mermaidExport"

const { mockSnapdom, mockToBlob } = vi.hoisted(() => ({
	mockSnapdom: vi.fn(),
	mockToBlob: vi.fn(),
}))

vi.mock("@zumer/snapdom", () => ({
	snapdom: mockSnapdom,
}))

describe("mermaidExport", () => {
	let originalFonts: typeof document.fonts | undefined

	beforeEach(() => {
		mockToBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		mockSnapdom.mockResolvedValue({
			toBlob: mockToBlob,
		})

		originalFonts = document.fonts
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: {
				ready: Promise.resolve(),
			},
		})
	})

	afterEach(() => {
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: originalFonts,
		})
		vi.clearAllMocks()
	})

	it("should export Mermaid inline SVG through snapdom", async () => {
		const svg = `
			<svg id="mermaid_123" class="flowchart" viewBox="0 0 240 120">
				<foreignObject width="240" height="120">
					<div xmlns="http://www.w3.org/1999/xhtml">hello</div>
				</foreignObject>
			</svg>
		`

		const result = await exportMermaidSvgToPngBlob(svg)

		expect(result).toBeInstanceOf(Blob)
		expect(mockSnapdom).toHaveBeenCalledTimes(1)
		expect(mockToBlob).toHaveBeenCalledWith({ type: "png" })
	})

	it("should reject non-inline Mermaid sources", async () => {
		await expect(exportMermaidSvgToPngBlob("https://example.com/test.svg")).rejects.toThrow(
			"Mermaid SVG source must be inline markup or data URL",
		)
	})
})
