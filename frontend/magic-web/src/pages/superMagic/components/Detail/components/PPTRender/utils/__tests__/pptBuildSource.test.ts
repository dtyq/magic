import { describe, expect, it } from "vitest"
import { stripPPTBuildMetadata } from "../pptBuildSource"

describe("stripPPTBuildMetadata", () => {
	it("removes step and effect attributes only", () => {
		const html = `<div class="a" data-ppt-step="1">x</div><p data-ppt-step="2" data-ppt-effect="appear" data-ppt-after="500" id="b">y</p><i data-ppt-step>z</i>`
		expect(stripPPTBuildMetadata(html)).toBe(`<div class="a">x</div><p id="b">y</p><i>z</i>`)
	})

	it("leaves unrelated markup untouched", () => {
		const html = `<div data-other="1" data-ppt-stepper="x">x</div>`
		expect(stripPPTBuildMetadata(html)).toBe(html)
	})
})
