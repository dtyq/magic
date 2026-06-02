import { describe, expect, it } from "vitest"
import { parseMagicProjectJsContent } from "../magicProjectParser"

describe("parseMagicProjectJsContent", () => {
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
})
