import { describe, expect, it } from "vitest"
import { resolveExportHtmlToPdfOptions } from "../src/shared/page"

describe("pdf-export options", () => {
	it("resolves defaults", () => {
		const options = resolveExportHtmlToPdfOptions({
			pages: ["<main>Hello</main>"],
		})
		expect(options.pages).toEqual(["<main>Hello</main>"])
		expect(options.pagination).toBe("slice")
		expect(options.fileName).toBe("export.pdf")
		expect(options.viewport).toEqual({ width: 1440, height: 900 })
		expect(options.paper).toEqual({ widthMm: 210, heightMm: 297 })
		expect(options.pixelRatio).toBe(2)
		expect(options.imageType).toBe("jpeg")
		expect(options.output).toBe("download")
	})

	it("normalizes pdf file names", () => {
		const options = resolveExportHtmlToPdfOptions({
			pages: ["<main>Hello</main>"],
			fileName: "report",
		})
		expect(options.fileName).toBe("report.pdf")
	})

	it("resolves none pagination and custom page settings", () => {
		const options = resolveExportHtmlToPdfOptions({
			pages: ["<main>One</main>", "<main>Two</main>"],
			pagination: "none",
			viewport: { width: 1024, height: 768 },
			paper: { widthMm: 100, heightMm: 200 },
		})

		expect(options.pagination).toBe("none")
		expect(options.pages).toHaveLength(2)
		expect(options.viewport).toEqual({ width: 1024, height: 768 })
		expect(options.paper).toEqual({ widthMm: 100, heightMm: 200 })
	})

	it("rejects empty html page input", () => {
		expect(() => resolveExportHtmlToPdfOptions({ pages: [] })).toThrow(
			"exportHtmlToPdf requires at least one non-empty HTML page",
		)
	})
})
