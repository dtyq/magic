import { describe, expect, it } from "vitest"
import { replaceHtmlResourceUrls } from "../htmlResourceReplacement"

function replaceResource({
	htmlContent,
	path,
	url,
	tag = "img",
	attr = "src",
}: {
	htmlContent: string
	path: string
	url: string
	tag?: string
	attr?: string
}) {
	return replaceHtmlResourceUrls({
		fileIds: ["file-1"],
		preloadedUrlMapping: new Map([["file-1", url]]),
		imageFileIds: new Set(),
		fileUpdatedAtMap: new Map(),
		htmlContent,
		urlMap: new Map([
			[
				"file-1",
				{
					path,
					tag,
					attr,
				},
			],
		]),
		filePathMap: new Map(),
		allFiles: [],
		relativeFolderPath: "",
	})
}

describe("replaceHtmlResourceUrls", () => {
	it.each([false, true])(
		"distinguishes literal entities in filenames (reverse=%s)",
		async (reverse) => {
			const resources = [
				{ id: "plain", path: "a&b.png", url: "https://cdn.example.com/plain.png" },
				{ id: "literal", path: "a&amp;b.png", url: "https://cdn.example.com/literal.png" },
			]
			if (reverse) resources.reverse()
			const result = await replaceHtmlResourceUrls({
				fileIds: resources.map((item) => item.id),
				preloadedUrlMapping: new Map(resources.map((item) => [item.id, item.url])),
				imageFileIds: new Set(),
				fileUpdatedAtMap: new Map(),
				htmlContent:
					'<img id="plain" src="a&amp;b.png"><img id="literal" src="a&amp;amp;b.png">',
				urlMap: new Map(
					resources.map((item) => [
						item.id,
						{ path: item.path, tag: "img", attr: "src" },
					]),
				),
				filePathMap: new Map(),
				allFiles: [],
				relativeFolderPath: "",
			})
			const doc = new DOMParser().parseFromString(result.content, "text/html")
			expect(doc.querySelector("#plain")?.getAttribute("src")).toBe(
				"https://cdn.example.com/plain.png",
			)
			expect(doc.querySelector("#literal")?.getAttribute("src")).toBe(
				"https://cdn.example.com/literal.png",
			)
			expect(doc.querySelector("#plain")?.getAttribute("data-original-path")).toBe("a&b.png")
			expect(doc.querySelector("#literal")?.getAttribute("data-original-path")).toBe(
				"a&amp;b.png",
			)
		},
	)

	it.each([false, true])(
		"inlines only the matching stylesheet path (reverse=%s)",
		async (reverse) => {
			const resources = [
				{
					fileId: "plain",
					htmlPath: "a&b.css",
					content: ".plain { color: red; }",
					references: [],
				},
				{
					fileId: "literal",
					htmlPath: "a&amp;b.css",
					content: ".literal { color: blue; }",
					references: [],
				},
			]
			if (reverse) resources.reverse()
			const result = await replaceHtmlResourceUrls({
				fileIds: [],
				imageFileIds: new Set(),
				fileUpdatedAtMap: new Map(),
				htmlContent:
					'<link id="plain" rel="stylesheet" href="a&amp;b.css"><link id="literal" rel="stylesheet" href="a&amp;amp;b.css">',
				urlMap: new Map(),
				filePathMap: new Map(),
				allFiles: [],
				relativeFolderPath: "",
				externalCssResources: resources,
			})
			const doc = new DOMParser().parseFromString(result.content, "text/html")
			expect(doc.querySelector("#plain")?.nextElementSibling?.textContent).toBe(
				".plain { color: red; }",
			)
			expect(doc.querySelector("#literal")?.nextElementSibling?.textContent).toBe(
				".literal { color: blue; }",
			)
			expect(doc.querySelectorAll("style")).toHaveLength(2)
		},
	)

	it("escapes replacement URLs and original paths before writing HTML attributes", async () => {
		const path = 'assets/report" onerror="alert(1)&.png'
		const url = 'https://cdn.example.com/image.png?x=" onerror="alert(2)&y=<tag>'

		const result = await replaceResource({
			htmlContent: `<img src='${path}'>`,
			path,
			url,
		})

		expect(result.content).toBe(
			'<img src="https://cdn.example.com/image.png?x=&quot; onerror=&quot;alert(2)&amp;y=&lt;tag&gt;" data-original-path="assets/report&quot; onerror=&quot;alert(1)&amp;.png">',
		)
		expect(result.content).not.toContain('data-original-path="assets/report" onerror=')

		const image = new DOMParser()
			.parseFromString(result.content, "text/html")
			.querySelector("img")
		expect(image?.getAttribute("src")).toBe(url)
		expect(image?.getAttribute("data-original-path")).toBe(path)
		expect(image?.hasAttribute("onerror")).toBe(false)
	})

	it("uses the common escaped attribute replacement for object data", async () => {
		const path = 'assets/document" onload="alert(1)&.pdf'
		const url = 'https://cdn.example.com/document.pdf?x=" onerror="alert(2)&y=<tag>'
		const result = await replaceResource({
			htmlContent: `<object data='${path}'></object>`,
			path,
			url,
			tag: "object",
			attr: "data",
		})

		expect(result.content).toBe(
			'<object data="https://cdn.example.com/document.pdf?x=&quot; onerror=&quot;alert(2)&amp;y=&lt;tag&gt;" data-original-path="assets/document&quot; onload=&quot;alert(1)&amp;.pdf"></object>',
		)

		const object = new DOMParser()
			.parseFromString(result.content, "text/html")
			.querySelector("object")
		expect(object?.getAttribute("data")).toBe(url)
		expect(object?.getAttribute("data-original-path")).toBe(path)
		expect(object?.hasAttribute("onerror")).toBe(false)
		expect(object?.hasAttribute("onload")).toBe(false)
	})
})
