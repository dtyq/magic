import { describe, expect, it } from "vitest"
import {
	createPptxSlideConfig,
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

	it("extracts dimensions from a slide container CSS rule", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(`
				<style>
					html, body, .slide-container { width: 1080px; height: 1920px; }
				</style>
				<div class="slide-container"></div>
			`),
		).toEqual({ width: 1080, height: 1920 })
	})

	it("extracts dimensions from the HTML sandbox canvas", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(
				'<main class="ft-canvas" style="width: 1080px; height: 1080px"></main>',
			),
		).toEqual({ width: 1080, height: 1080 })
	})

	it("extracts fixed canvas dimensions declared on the html and body shell", () => {
		expect(
			extractSlideContainerDimensionsFromHtml(`
				<!DOCTYPE html>
				<html>
					<head>
						<style>
							html, body { width: 1080px; height: 1080px; margin: 0; }
						</style>
					</head>
					<body><main class="ft-canvas"></main></body>
				</html>
			`),
		).toEqual({ width: 1080, height: 1080 })
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

describe("createPptxSlideConfig", () => {
	it("uses the slide canvas dimensions for the PPTX layout", () => {
		expect(createPptxSlideConfig({ width: 1080, height: 1920 })).toEqual({
			htmlWidth: 1080,
			htmlHeight: 1920,
			slideWidth: 11.25,
			slideHeight: 20,
		})
	})
})
