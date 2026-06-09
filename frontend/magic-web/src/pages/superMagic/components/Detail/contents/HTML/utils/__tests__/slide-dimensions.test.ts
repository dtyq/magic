import { describe, expect, it } from "vitest"
import {
	DEFAULT_PPT_CONTENT_DIMENSIONS,
	extractSlideContainerDimensionsFromHtml,
	resolvePptScaleContentDimensions,
} from "../slide-dimensions"

describe("extractSlideContainerDimensionsFromHtml", () => {
	it("extracts canonical PPT dimensions from slide-container data attributes", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(`
				<div class="slide-container" data-width="1920" data-height="1080"></div>
			`),
		).toEqual({ width: 1920, height: 1080 })
	})

	it("falls back to inline pixel dimensions when data attributes are missing", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(`
				<div class="slide-container" style="width: 1280px; height: 720px"></div>
			`),
		).toEqual({ width: 1280, height: 720 })
	})

	it("returns null when no canonical slide dimensions are available", () => {
		expect(extractSlideContainerDimensionsFromHtml("<div>plain html</div>")).toBeNull()
	})

	it("does not treat percentage styles as canonical pixel dimensions", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(`
				<div class="slide-container" style="width: 100%; height: 100%"></div>
			`),
		).toBeNull()
	})
})

describe("resolvePptScaleContentDimensions", () => {
	it("prefers processed content dimensions over raw source dimensions", () => {
		expect(
			resolvePptScaleContentDimensions(
				`<div class="slide-container" data-width="1600" data-height="900"></div>`,
				`<div class="slide-container" data-width="1920" data-height="1080"></div>`,
			),
		).toEqual({ width: 1600, height: 900 })
	})

	it("uses raw source dimensions when processed content has no canonical dimensions", () => {
		expect(
			resolvePptScaleContentDimensions(
				"<div>processed</div>",
				`<div class="slide-container" data-width="1366" data-height="768"></div>`,
			),
		).toEqual({ width: 1366, height: 768 })
	})

	it("falls back to the default PPT dimensions", () => {
		expect(resolvePptScaleContentDimensions("<div>plain html</div>")).toEqual(
			DEFAULT_PPT_CONTENT_DIMENSIONS,
		)
	})
})
