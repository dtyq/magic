import { afterEach, describe, expect, it } from "vitest"
import { ContentCleaner } from "../../utils/ContentCleaner"
import { PPTBuildPreview } from "../PPTBuildPreview"

const hidden = () =>
	[...document.querySelectorAll("[data-magic-ppt-build-hidden]")].map((element) => element.id)

afterEach(() => {
	document.head.innerHTML = ""
	document.body.innerHTML = ""
})

describe("PPTBuildPreview", () => {
	it("hides every step after the previewed one and restores on clear", () => {
		document.body.innerHTML =
			'<p id="a" data-ppt-step="3">A</p><p id="b" data-ppt-step="7">B</p><p id="plain">P</p>'
		const preview = new PPTBuildPreview()
		preview.show(0)
		expect(hidden().sort()).toEqual(["a", "b"])
		preview.show(1)
		expect(hidden()).toEqual(["b"])
		preview.show(2)
		expect(hidden()).toEqual([])
		preview.show(0)
		preview.clear()
		expect(hidden()).toEqual([])
		expect(document.querySelector("style[data-magic-ppt-build-preview]")).toBeNull()
	})

	it("leaves nothing in saved HTML", () => {
		document.body.innerHTML = '<p id="a" data-ppt-step="1">A</p>'
		new PPTBuildPreview().show(0)
		const cleaned = ContentCleaner.cleanDocument(document.documentElement.outerHTML)
		expect(cleaned).toContain('data-ppt-step="1"')
		expect(cleaned).not.toContain("data-magic-ppt-build-hidden")
		expect(cleaned).not.toContain("data-magic-ppt-build-preview")
	})
})
