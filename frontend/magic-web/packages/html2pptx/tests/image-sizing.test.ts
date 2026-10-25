// @vitest-environment jsdom

import JSZip from "jszip"
import PptxGenJS from "pptxgenjs"
import { afterEach, describe, expect, it } from "vitest"
import type { SlideConfig } from "../src/api/options"
import { drawImage } from "../src/drawer/drawImage"
import type { ElementNode } from "../src/ir/dom"
import type { PPTImageNode, PPTNodeBase } from "../src/ir/node"
import { createMediaSourceDescriptor } from "../src/media/source-descriptor"
import { parseImage } from "../src/parsers/parseImage"
import {
	asStreamingPptxPresentation,
	concatPptxChunks,
	createCollectingPptxDestination,
} from "./streaming-test-utils"

const config: SlideConfig = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 20,
	slideHeight: 11.25,
}

const transparentPng =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

afterEach(() => {
	document.body.innerHTML = ""
})

describe("image sizing", () => {
	it("keeps an IMG element's intrinsic dimensions for object-fit sizing", () => {
		document.body.innerHTML = `<img src="${transparentPng}">`
		const image = document.body.firstElementChild as HTMLImageElement
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1600 })
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 900 })

		const parsed = parseImage(
			createImageElementNode(image, "cover"),
			createBaseNode(20, 11.25),
			config,
			window,
		)

		expect(parsed).toMatchObject({
			sizing: "cover",
			intrinsicSize: { width: 1600, height: 900 },
		})
	})

	it("uses the intrinsic aspect ratio when generating a cover crop", async () => {
		const pptx = new PptxGenJS()
		const slide = pptx.addSlide()
		const node: PPTImageNode = {
			type: "image",
			x: 0,
			y: 0,
			w: 16,
			h: 9,
			zOrder: 1,
			source: createMediaSourceDescriptor(transparentPng, { key: "sizing-image" }),
			sizing: "cover",
			intrinsicSize: { width: 4, height: 3 },
		}

		drawImage(slide, node)

		const { destination, chunks } = createCollectingPptxDestination()
		await asStreamingPptxPresentation(pptx).writeTo({ destination })
		const zip = await JSZip.loadAsync(concatPptxChunks(chunks))
		const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string")
		if (!slideXml) throw new Error("slide1.xml is required")

		expect(slideXml).toContain('<a:srcRect l="0" r="0" t="12500" b="12500"/>')
		expect(slideXml).toContain('<a:ext cx="14630400" cy="8229600"/>')
	})

	it("maps top object-position to a bottom-only crop", async () => {
		const pptx = new PptxGenJS()
		const slide = pptx.addSlide()
		document.body.innerHTML = `<img src="${transparentPng}">`
		const image = document.body.firstElementChild as HTMLImageElement
		Object.defineProperty(image, "naturalWidth", { configurable: true, value: 400 })
		Object.defineProperty(image, "naturalHeight", { configurable: true, value: 800 })
		const parsed = parseImage(
			createImageElementNode(image, "cover", "top"),
			createBaseNode(20, 11.25),
			config,
			window,
		)
		expect(parsed?.objectPosition).toEqual({ x: 0.5, y: 0 })

		if (!parsed) throw new Error("parsed image is required")
		parsed.w = 4
		parsed.h = 2
		drawImage(slide, parsed)
		const { destination, chunks } = createCollectingPptxDestination()
		await asStreamingPptxPresentation(pptx).writeTo({ destination })
		const zip = await JSZip.loadAsync(concatPptxChunks(chunks))
		const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string")
		expect(slideXml).toContain('<a:srcRect l="0" r="0" t="0" b="75000"/>')
	})
})

function createBaseNode(w: number, h: number): PPTNodeBase {
	return { type: "", x: 0, y: 0, w, h, zOrder: 1 }
}

function createImageElementNode(
	image: HTMLImageElement,
	objectFit: string,
	objectPosition = "50% 50%",
): ElementNode {
	return {
		id: "test-image",
		tagName: "IMG",
		element: image,
		rect: { x: 0, y: 0, w: 1920, h: 1080 },
		layout: { offsetWidth: 1920, offsetHeight: 1080 },
		style: {
			opacity: "1",
			borderRadius: "0px",
			overflow: "visible",
			transform: "none",
			translate: "none",
			rotate: "none",
			scale: "none",
			objectFit,
			objectPosition,
		} as ElementNode["style"],
		textContent: null,
		children: [],
		parent: null,
		depth: 1,
		zIndex: 0,
		domOrder: 1,
	}
}
