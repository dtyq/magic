import { afterEach, describe, expect, it } from "vitest"
import { parseMagicProjectJsContent } from "../magicProjectParser"

describe("parseMagicProjectJsContent", () => {
	afterEach(() => {
		delete (globalThis as Record<string, unknown>).__magicProjectParserExecuted
	})

	it("extracts slides from magic.project.js content", () => {
		const result = parseMagicProjectJsContent(`
			window.magicProjectConfig = {
				type: "slide",
				slides: ["./slides/fresh-1.html", "./slides/fresh-2.html"]
			};
			window.magicProjectConfigure(window.magicProjectConfig);
		`)

		expect(result?.slides).toEqual(["./slides/fresh-1.html", "./slides/fresh-2.html"])
		expect(result?.config.type).toBe("slide")
	})

	it("does not execute arbitrary JavaScript while parsing config", () => {
		const result = parseMagicProjectJsContent(`
			window.magicProjectConfig = {
				type: "slide",
				slides: ["./slides/safe.html"]
			};
			globalThis.__magicProjectParserExecuted = true;
		`)

		expect(result?.slides).toEqual(["./slides/safe.html"])
		expect((globalThis as Record<string, unknown>).__magicProjectParserExecuted).toBeUndefined()
	})

	it("rejects non-literal values instead of evaluating them", () => {
		const result = parseMagicProjectJsContent(`
			window.magicProjectConfig = {
				type: "slide",
				slides: getSlides()
			};
		`)

		expect(result).toBeNull()
	})

	it("ignores fake config assignments inside comments", () => {
		const result = parseMagicProjectJsContent(`
			// window.magicProjectConfig = { type: "slide", slides: ["./slides/comment.html"] };
			window.magicProjectConfig = {
				type: "slide",
				slides: ["./slides/real.html"]
			};
		`)

		expect(result?.slides).toEqual(["./slides/real.html"])
	})
})
