// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import type { SlideConfig } from "../src/api/options"
import type { ElementNode, ComputedStyleInfo } from "../src/ir/dom"
import type { PPTNodeBase } from "../src/ir/node"
import { parseImage } from "../src/parsers/parseImage"
import { extractCssImageUrls } from "../src/shared/css-image-url"
import { hasBackgroundImage } from "../src/shared/element-predicates"

const config: SlideConfig = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 20,
	slideHeight: 11.25,
}

describe("CSS image URL parsing", () => {
	it("preserves parentheses in quoted image filenames and URL components", () => {
		const relativeUrl = "./images/e4dd31d9-96f2-4090-8db7-5aae07c8f1ee (2).jpg"
		const url =
			"https://cdn.example.test/images/e4dd31d9-96f2-4090-8db7-5aae07c8f1ee%20(2).jpg?crop=(wide)#frame(1)"

		expect(extractCssImageUrls(`url('${relativeUrl}')`)).toEqual([relativeUrl])
		expect(extractCssImageUrls(`url('${url}')`)).toEqual([url])
		expect(extractCssImageUrls(`URL("${url}")`)).toEqual([url])
	})

	it.each([
		"./images/photo.jpg",
		"./images/photo.jpeg",
		"./images/photo.png",
		"./images/photo.gif",
		"./images/photo.svg",
		"./images/photo.webp",
		"./images/photo.avif",
		"./images/photo.bmp",
		"./images/photo.tiff",
		"https://cdn.example.test/asset?format=webp&token=(signed)",
		"//cdn.example.test/path/image-without-extension",
		"blob:https://example.test/2d74a8b4-78f4-40ae-a4fb-0ff3af9dd933",
	])("does not restrict URL parsing by image format or URL shape: %s", (url) => {
		expect(extractCssImageUrls(`url("${url}")`)).toEqual([url])
	})

	it("supports data URLs without interpreting their percent escapes", () => {
		const url = "data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%201%201%27%3E%3C/svg%3E"

		expect(extractCssImageUrls(`url("${url}")`)).toEqual([url])
	})

	it("decodes quoted and unquoted CSS escapes", () => {
		expect(extractCssImageUrls(String.raw`url(./images/photo\(2\).webp)`)).toEqual([
			"./images/photo(2).webp",
		])
		expect(extractCssImageUrls(String.raw`url("./images/photo\000029 .png")`)).toEqual([
			"./images/photo).png",
		])
	})

	it("extracts URL layers nested alongside gradients and image-set candidates", () => {
		const value = [
			"linear-gradient(90deg, rgba(0, 0, 0, 0.2), transparent)",
			'image-set(url("./images/photo.avif") type("image/avif") 1x, url(\'./images/photo.webp\') 2x)',
		].join(", ")

		expect(extractCssImageUrls(value)).toEqual(["./images/photo.avif", "./images/photo.webp"])
	})

	it.each(['url("./images/unclosed.png)', "url(./images/photo(2).png)", "url()"])(
		"rejects malformed or empty values without returning a partial URL: %s",
		(value) => {
			expect(extractCssImageUrls(value)).toEqual([])
		},
	)

	it("rejects unescaped whitespace in an unquoted URL", () => {
		expect(extractCssImageUrls("url(./images/photo name.png)")).toEqual([])
	})

	it("passes the complete background URL into the image source descriptor", () => {
		const src = "https://cdn.example.test/images/e4dd31d9-96f2-4090-8db7-5aae07c8f1ee%20(2).jpg"
		const node = createBackgroundNode(`url("${src}")`)

		const parsed = parseImage(node, createBaseNode(), config, window)

		expect(parsed?.source).toMatchObject({
			kind: "url",
			url: src,
			contentType: "image/jpeg",
			extn: "jpg",
		})
	})

	it("keeps malformed URLs out of the background-image pipeline", () => {
		const node = createBackgroundNode("url(./images/photo(2).png)")

		expect(hasBackgroundImage(node)).toBe(false)
		expect(parseImage(node, createBaseNode(), config, window)).toBeNull()
	})
})

function createBackgroundNode(backgroundImage: string): ElementNode {
	const element = document.createElement("div")
	return {
		id: "background-image-test",
		tagName: "DIV",
		element,
		rect: { x: 0, y: 0, w: 1920, h: 1080 },
		layout: { offsetWidth: 1920, offsetHeight: 1080 },
		style: {
			backgroundImage,
			backgroundSize: "cover",
			opacity: "1",
			borderRadius: "0px",
			overflow: "visible",
			transform: "none",
			translate: "none",
			rotate: "none",
			scale: "none",
		} as ComputedStyleInfo,
		textContent: null,
		children: [],
		parent: null,
		depth: 1,
		zIndex: 0,
		domOrder: 1,
	}
}

function createBaseNode(): PPTNodeBase {
	return { type: "", x: 0, y: 0, w: 20, h: 11.25, zOrder: 1 }
}
