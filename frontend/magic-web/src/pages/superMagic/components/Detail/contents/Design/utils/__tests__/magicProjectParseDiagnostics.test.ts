import { describe, expect, it } from "vitest"
import {
	parseMagicProjectJsContent,
	parseMagicProjectJsContentSafely,
	parseMagicProjectJsContentWithDiagnostics,
} from "../utils"

describe("parseMagicProjectJsContentWithDiagnostics", () => {
	it("reports valid-empty only when canvas.elements is explicitly an empty array", () => {
		const result = parseMagicProjectJsContentWithDiagnostics(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "empty",
				canvas: { elements: [] },
			};
		`)

		expect(result.canvasStatus).toBe("valid-empty")
		expect(result.sourceVersion).toBe("1.0.0")
		expect(result.data?.canvas?.elements).toEqual([])
	})

	it("reports valid-non-empty when canvas.elements has items", () => {
		const result = parseMagicProjectJsContentWithDiagnostics(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "non-empty",
				canvas: { elements: [{ id: "rect-1", type: "rectangle" }] },
			};
		`)

		expect(result.canvasStatus).toBe("valid-non-empty")
		expect(result.data?.canvas?.elements).toEqual([expect.objectContaining({ id: "rect-1" })])
	})

	it("does not turn a missing canvas into an empty canvas", () => {
		const result = parseMagicProjectJsContentWithDiagnostics(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "missing",
			};
		`)

		expect(result.canvasStatus).toBe("missing")
		expect(result.data).toBeNull()
	})

	it("returns null for unsafe remote content", () => {
		const result = parseMagicProjectJsContentSafely(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "missing",
			};
		`)

		expect(result).toBeNull()
	})

	it("keeps legacy empty-canvas fallback for ordinary parsing", () => {
		const result = parseMagicProjectJsContent(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "missing",
			};
		`)

		expect(result?.canvas?.elements).toEqual([])
	})

	it("does not turn an invalid canvas object into an empty canvas", () => {
		const result = parseMagicProjectJsContentWithDiagnostics(`
			window.magicProjectConfig = {
				version: "1.0.0",
				type: "design",
				name: "invalid",
				canvas: {},
			};
		`)

		expect(result.canvasStatus).toBe("invalid")
		expect(result.data).toBeNull()
	})

	it("reports compressed canvas decoding failures separately", () => {
		const result = parseMagicProjectJsContentWithDiagnostics(`
			window.magicProjectConfig = {
				version: "2.0.0",
				type: "design",
				name: "broken",
				canvas: "MAGICPROJECTDESIGNDATA://not-valid-base64",
			};
		`)

		expect(result.canvasStatus).toBe("decompress-failed")
		expect(result.data).toBeNull()
	})
})
