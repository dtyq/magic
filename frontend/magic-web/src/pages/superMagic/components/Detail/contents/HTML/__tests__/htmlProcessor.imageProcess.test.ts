import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { processHtmlContent } from "../htmlProcessor"
import { HTML_PREVIEW_IMAGE_PROCESS } from "../previewImageProcess"
import { filterInjectedTags } from "../utils"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/utils/packageAsset", () => ({
	getPackageAssetUrl: () => "",
}))

describe("processHtmlContent image processing", () => {
	beforeEach(() => {
		vi.mocked(getTemporaryDownloadUrl).mockReset()
	})

	it("preserves escaped code examples and quoted attributes through resource processing", async () => {
		const result = await processHtmlContent({
			content: `<!doctype html><html><head></head><body>
				<p>&lt;LoginForm</p><p>&lt;Button</p><p>/&gt; &amp; &#169;</p>
				<div title="&quot;quoted&quot; &lt;value&gt; &amp; more"></div>
			</body></html>`,
			attachments: [
				{
					file_id: "slide-file",
					file_name: "slide.html",
					relative_file_path: "deck/slide.html",
				},
			],
			fileId: "slide-file",
			html_relative_path: "deck/",
		})
		const doc = new DOMParser().parseFromString(result.processedContent, "text/html")
		expect(Array.from(doc.querySelectorAll("p"), (p) => p.textContent)).toEqual([
			"<LoginForm",
			"<Button",
			"/> & ©",
		])
		expect(doc.querySelector("div")?.getAttribute("title")).toBe('"quoted" <value> & more')
		expect(Array.from(doc.querySelectorAll("*"), (el) => el.tagName)).not.toContain(
			"LOGINFORM<",
		)
	})

	it("retains raw script/style and nested SVG namespaces while removing only the root namespace", async () => {
		const script = 'window.example = "<Button> &lt;"; if (1 < 2 && 3 > 2) window.ready = true;'
		const css = '.parent > .child::before { content: "< & >"; }'
		const result = await processHtmlContent({
			content: `<!doctype html><!-- document comment --><html xmlns="http://www.w3.org/1999/xhtml"><head>
				<script>${script}</script><style>${css}</style></head><body>
				<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>
					<div xmlns="http://www.w3.org/1999/xhtml">&lt;Button &amp; text</div>
				</foreignObject></svg></body></html>`,
			attachments: [
				{
					file_id: "slide-file",
					file_name: "slide.html",
					relative_file_path: "deck/slide.html",
				},
			],
			fileId: "slide-file",
		})
		const doc = new DOMParser().parseFromString(result.processedContent, "text/html")
		expect(doc.querySelector("script:not([data-injected])")?.textContent).toBe(script)
		expect(doc.querySelector("style")?.textContent).toBe(css)
		expect(doc.doctype?.name).toBe("html")
		expect(result.processedContent).toContain("<!-- document comment -->")
		expect(doc.documentElement.hasAttribute("xmlns")).toBe(false)
		const svg = doc.querySelector("svg")
		expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg")
		expect(svg?.querySelector("div")?.getAttribute("xmlns")).toBe(
			"http://www.w3.org/1999/xhtml",
		)
		expect(svg?.querySelector("div")?.textContent).toBe("<Button & text")
	})

	it("preserves entity literals in inline cart and advisor scripts", async () => {
		const cartScript = `function escapeHtml(value) {
			return String(value).replace(/[&<>'"]/g, (character) => ({
				'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
			})[character]);
		}`
		const advisorScript = `function escapeAdvisorHtml(value) {
			return String(value).replace(/[&<>'"]/g, (character) => ({
				'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
			})[character]);
		}`
		const result = await processHtmlContent({
			content: `<!doctype html><html><head><script>${cartScript}</script></head>
				<body><script>${advisorScript}</script></body></html>`,
			attachments: [
				{ file_id: "html-file", file_name: "tool.html", relative_file_path: "tool.html" },
			],
			fileId: "html-file",
		})
		const scripts = Array.from(
			new DOMParser()
				.parseFromString(result.processedContent, "text/html")
				.querySelectorAll("script:not([data-injected])"),
			(script) => script.textContent,
		)
		expect(scripts).toEqual([cartScript, advisorScript])
	})

	it.each([
		"img",
		"inline-style",
		"inline-double-quote",
		"inline-unquoted",
		"stylesheet",
		"style-block",
	])("resolves ampersands in %s resource paths without corrupting text", async (usage) => {
		const path = "a&b.png"
		const url = "https://cdn.example.com/image.png?token=one&version=two"
		const sources: Record<string, string> = {
			img: '<img src="a&amp;b.png">',
			"inline-style": `<div style="background: url('a&amp;b.png')"></div>`,
			"inline-double-quote": '<div style="background: url(&quot;a&amp;b.png&quot;)"></div>',
			"inline-unquoted": '<div style="background: url(a&amp;b.png)"></div>',
			stylesheet: '<link rel="stylesheet" href="theme&amp;dark.css">',
			"style-block": `<style>.hero { background: url('a&b.png'); }</style>`,
		}
		const attachments = [
			{
				file_id: "html-file",
				file_name: "slide.html",
				relative_file_path: "deck/slide.html",
			},
			{ file_id: "image-file", file_name: path, relative_file_path: `deck/${path}` },
			{
				file_id: "css-file",
				file_name: "theme&dark.css",
				relative_file_path: "deck/theme&dark.css",
			},
		]
		const fileApi: FileApi = {
			identityKey: "test:entities",
			getTemporaryDownloadUrl: vi.fn().mockResolvedValue([{ file_id: "image-file", url }]),
			getFileContentById: vi.fn().mockResolvedValue(`.hero { background: url('a&b.png'); }`),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		}
		const result = await processHtmlContent({
			content: `<html><head></head><body>${sources[usage]}<p>&lt;Button &amp; text</p></body></html>`,
			attachments,
			attachmentList: attachments,
			fileId: "html-file",
			html_relative_path: "deck/",
			fileApi,
			preloadedUrlMapping: new Map([
				["image-file", url],
				["css-file", "https://cdn.example.com/theme.css"],
			]),
		})
		const doc = new DOMParser().parseFromString(result.processedContent, "text/html")
		expect(doc.querySelector("p")?.textContent).toBe("<Button & text")
		if (usage === "img") {
			expect(doc.querySelector("img")?.getAttribute("src")).toBe(url)
			expect(doc.querySelector("img")?.getAttribute("data-original-path")).toBe(path)
		} else if (usage.startsWith("inline-")) {
			expect(doc.querySelector("div")?.getAttribute("style")).toContain(url)
		} else {
			expect(doc.querySelector("style")?.textContent).toContain(url)
		}
		const saved = new DOMParser().parseFromString(
			filterInjectedTags(result.processedContent, result.filePathMapping),
			"text/html",
		)
		if (usage === "img") expect(saved.querySelector("img")?.getAttribute("src")).toBe(path)
		if (usage.startsWith("inline-"))
			expect(saved.querySelector("div")?.getAttribute("style")).toContain(path)
		if (usage === "stylesheet")
			expect(saved.querySelector("link")?.getAttribute("href")).toBe("theme&dark.css")
	})

	it("only replaces standalone window reload calls", async () => {
		const result = await processHtmlContent({
			content: `
				<script>
					window.reload()
					window.location.reload(true)
					previewwindow.reload()
					mywindow.reload(false)
					obj.window.reload()
				</script>
			`,
			attachments: [],
		})

		expect(result.processedContent).toContain("window.Magic.reload()")
		expect(result.processedContent).toContain("previewwindow.reload()")
		expect(result.processedContent).toContain("mywindow.reload(false)")
		expect(result.processedContent).toContain("obj.window.reload()")
		expect(result.processedContent).not.toContain("preview/*__ORIGINAL_RELOAD__:")
		expect(result.processedContent).not.toContain("my/*__ORIGINAL_RELOAD__:")
		expect(result.processedContent).not.toContain("obj./*__ORIGINAL_RELOAD__:")
	})

	it("replaces preloaded image URLs with the WebP variant without reprocessing scripts", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "image-file",
				url: "https://oss.example.com/hero.webp",
			},
		] as never)

		const attachments = [
			{
				file_id: "image-file",
				file_name: "hero.png",
				relative_file_path: "deck/hero.png",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
			{
				file_id: "script-file",
				file_name: "app.js",
				relative_file_path: "deck/app.js",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
		]

		const result = await processHtmlContent({
			content: '<img src="hero.png"><script src="app.js"></script>',
			attachments,
			attachmentList: attachments,
			html_relative_path: "deck/",
			preloadedUrlMapping: new Map([
				["image-file", "https://oss.example.com/hero.png"],
				["script-file", "https://oss.example.com/app.js"],
			]),
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["image-file"],
			options: { xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS },
		})
		expect(result.processedContent).toContain("https://oss.example.com/hero.webp")
		expect(result.processedContent).toContain("https://oss.example.com/app.js")
	})

	it("uses the bound file API when processing preloaded images", async () => {
		const fileApi: FileApi = {
			identityKey: "share:test",
			getTemporaryDownloadUrl: vi.fn().mockResolvedValue([
				{
					file_id: "image-file",
					url: "https://share.example.com/hero.webp",
				},
			]),
			getFileContentById: vi.fn(),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		}
		const attachments = [
			{
				file_id: "image-file",
				file_name: "hero.png",
				relative_file_path: "deck/hero.png",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
		]

		const result = await processHtmlContent({
			content: '<img src="hero.png">',
			attachments,
			attachmentList: attachments,
			html_relative_path: "deck/",
			preloadedUrlMapping: new Map([["image-file", "https://oss.example.com/hero.png"]]),
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			fileApi,
		})

		expect(fileApi.getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["image-file"],
			options: { xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS },
			access: undefined,
		})
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
		expect(result.processedContent).toContain("https://share.example.com/hero.webp")
	})

	it("inlines external CSS and resolves URLs relative to the CSS directory", async () => {
		const fileApi: FileApi = {
			identityKey: "share:test",
			getTemporaryDownloadUrl: vi.fn().mockResolvedValue([
				{
					file_id: "background-file",
					url: "https://share.example.com/background.webp",
				},
			]),
			getFileContentById: vi
				.fn()
				.mockResolvedValue(
					`.hero { background-image: url("images/background-clinic-teal.webp"); }`,
				),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		}
		const attachments = [
			{
				file_id: "html-file",
				file_name: "slide.html",
				relative_file_path: "deck/slide.html",
			},
			{
				file_id: "css-file",
				file_name: "theme.css",
				relative_file_path: "deck/theme.css",
			},
			{
				file_id: "background-file",
				file_name: "background-clinic-teal.webp",
				relative_file_path: "deck/images/background-clinic-teal.webp",
			},
		]

		const result = await processHtmlContent({
			content:
				'<link rel="stylesheet" href="theme.css"><img src="images/background-clinic-teal.webp"><main class="hero">content</main>',
			attachments,
			attachmentList: attachments,
			fileId: "html-file",
			html_relative_path: "deck/",
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			preloadedUrlMapping: new Map([["css-file", "https://share.example.com/theme.css"]]),
			fileApi,
		})

		expect(fileApi.getFileContentById).toHaveBeenCalledWith("css-file", {
			responseType: "text",
			access: undefined,
		})
		expect(result.processedContent).toContain("https://share.example.com/background.webp")
		expect(result.processedContent).toContain('data-original-href="theme.css"')
		expect(result.processedContent).not.toMatch(/\shref=["']theme\.css/)
		expect(result.processedContent).not.toContain('url("images/background-clinic-teal.webp")')
		expect(result.processedContent).not.toContain("url('images/background-clinic-teal.webp')")

		const contentForSave = filterInjectedTags(result.processedContent, result.filePathMapping)
		expect(contentForSave).toMatch(/\shref=["']theme\.css/)
		expect(contentForSave).not.toContain("https://share.example.com/background.webp")
	})

	it("inlines imported CSS and resolves its URLs relative to the imported file", async () => {
		const fileApi: FileApi = {
			identityKey: "share:test",
			getTemporaryDownloadUrl: vi.fn().mockResolvedValue([
				{
					file_id: "background-file",
					url: "https://share.example.com/imported-background.webp",
				},
			]),
			getFileContentById: vi.fn().mockImplementation(async (fileId: string) => {
				if (fileId === "css-file") return '@import "styles/hero.css";'
				if (fileId === "imported-css-file")
					return '.hero { background-image: url("../images/imported-background.webp"); }'
				return null
			}),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		}
		const attachments = [
			{
				file_id: "html-file",
				file_name: "slide.html",
				relative_file_path: "deck/slide.html",
			},
			{
				file_id: "css-file",
				file_name: "theme.css",
				relative_file_path: "deck/theme.css",
			},
			{
				file_id: "imported-css-file",
				file_name: "hero.css",
				relative_file_path: "deck/styles/hero.css",
			},
			{
				file_id: "background-file",
				file_name: "imported-background.webp",
				relative_file_path: "deck/images/imported-background.webp",
			},
		]

		const result = await processHtmlContent({
			content: '<link rel="stylesheet" href="theme.css"><main class="hero">content</main>',
			attachments,
			attachmentList: attachments,
			fileId: "html-file",
			html_relative_path: "deck/",
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			preloadedUrlMapping: new Map([["css-file", "https://share.example.com/theme.css"]]),
			fileApi,
		})

		expect(fileApi.getFileContentById).toHaveBeenCalledWith("imported-css-file", {
			responseType: "text",
			access: undefined,
		})
		expect(result.processedContent).toContain(
			"https://share.example.com/imported-background.webp",
		)
		expect(result.processedContent).not.toContain('@import "styles/hero.css"')
	})

	it("replaces inline background URLs when the filename contains parentheses", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "background-file",
				url: "https://oss.example.com/background.webp",
			},
		] as never)

		const attachments = [
			{
				file_id: "background-file",
				file_name: "hero (2).jpg",
				relative_file_path: "deck/images/hero (2).jpg",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
		]

		const result = await processHtmlContent({
			content: `<p style="background-image: url('./images/hero (2).jpg')">text</p>`,
			attachments,
			attachmentList: attachments,
			html_relative_path: "deck/",
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["background-file"],
			options: { xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS },
		})
		expect(result.processedContent).toContain("https://oss.example.com/background.webp")
		expect(result.processedContent).not.toContain("url('./images/hero (2).jpg')")
	})

	it("keeps GIF URLs original when WebP processing is enabled", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "animation-file",
				url: "https://oss.example.com/animation.gif",
			},
		] as never)

		const attachments = [
			{
				file_id: "animation-file",
				file_name: "animation.gif",
				relative_file_path: "deck/animation.gif",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
		]

		const result = await processHtmlContent({
			content: '<img src="animation.gif">',
			attachments,
			attachmentList: attachments,
			html_relative_path: "deck/",
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["animation-file"],
		})
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalledWith({
			file_ids: ["animation-file"],
			options: { xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS },
		})
		expect(result.processedContent).toContain("https://oss.example.com/animation.gif")
	})

	it("preserves the slide bridge position with an inert placeholder", async () => {
		const attachments = [
			{
				file_id: "placeholder-file",
				file_name: "placeholder.txt",
				relative_file_path: "deck/placeholder.txt",
				updated_at: "2026-07-15T00:00:00.000Z",
			},
		]
		const content = `<!DOCTYPE html>
<html>
<head></head>
<body>
<main>Placeholder content</main>
<script src="slide-bridge.js"></script>
</body>
</html>`

		const result = await processHtmlContent({
			content,
			attachments,
			attachmentList: attachments,
			html_relative_path: "deck/",
		})

		expect(result.processedContent).toContain('data-has-slide-bridge="true"')
		expect(result.processedContent).toContain("\n<!--magic-slide-bridge-placeholder-->\n")
		expect(result.processedContent).not.toContain('<script src="slide-bridge.js"></script>')
	})

	it("does not apply image processing to font resources referenced from CSS", async () => {
		vi.mocked(getTemporaryDownloadUrl)
			.mockResolvedValueOnce([
				{
					file_id: "background-image-file",
					url: "https://oss.example.com/background.webp",
				},
			] as never)
			.mockResolvedValueOnce([
				{
					file_id: "font-file",
					url: "https://oss.example.com/demo.woff2",
				},
			] as never)

		const attachments = [
			{
				file_id: "background-image-file",
				file_name: "background.webp",
				relative_file_path: "page/assets/background.webp",
				updated_at: "2026-07-29T00:00:00.000Z",
			},
			{
				file_id: "font-file",
				file_name: "demo.woff2",
				relative_file_path: "page/assets/demo.woff2",
				updated_at: "2026-07-29T00:00:00.000Z",
			},
		]

		await processHtmlContent({
			content: `
				<style>
					@font-face { font-family: Demo; src: url("assets/demo.woff2"); }
					.hero { background-image: url("assets/background.webp"); }
				</style>
			`,
			attachments,
			attachmentList: attachments,
			html_relative_path: "page/",
			xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
		})

		expect(getTemporaryDownloadUrl).toHaveBeenNthCalledWith(1, {
			file_ids: ["background-image-file"],
			options: { xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS },
		})
		expect(getTemporaryDownloadUrl).toHaveBeenNthCalledWith(2, {
			file_ids: ["font-file"],
		})
	})

	it("keeps cached image URLs isolated by processing parameters and original files", async () => {
		vi.mocked(getTemporaryDownloadUrl)
			.mockResolvedValueOnce([
				{
					file_id: "variant-image-file",
					url: "https://oss.example.com/hero-400.webp",
					expires_at: "2099-07-28 12:00:00",
				},
			] as never)
			.mockResolvedValueOnce([
				{
					file_id: "variant-image-file",
					url: "https://oss.example.com/hero-2160.webp",
					expires_at: "2099-07-28 12:00:00",
				},
			] as never)
			.mockResolvedValueOnce([
				{
					file_id: "variant-image-file",
					url: "https://oss.example.com/hero-original.png",
					expires_at: "2099-07-28 12:00:00",
				},
			] as never)

		const attachments = [
			{
				file_id: "variant-image-file",
				file_name: "hero.png",
				relative_file_path: "post/assets/hero.png",
				updated_at: "2026-07-28T00:00:00.000Z",
			},
		]
		const thumbnailOptions = {
			resize: { w: 400, m: "lfit" as const },
			quality: 80,
			format: "webp" as const,
		}
		const contentOptions = {
			resize: { w: 2160, m: "lfit" as const },
			quality: 90,
			format: "webp" as const,
		}

		const thumbnailResult = await processHtmlContent({
			content: '<img src="assets/hero.png">',
			attachments,
			attachmentList: attachments,
			html_relative_path: "post/",
			xMagicImageProcess: thumbnailOptions,
		})
		const contentResult = await processHtmlContent({
			content: '<img src="assets/hero.png">',
			attachments,
			attachmentList: attachments,
			html_relative_path: "post/",
			xMagicImageProcess: contentOptions,
		})
		const originalResult = await processHtmlContent({
			content: '<img src="assets/hero.png">',
			attachments,
			attachmentList: attachments,
			html_relative_path: "post/",
		})

		expect(getTemporaryDownloadUrl).toHaveBeenNthCalledWith(1, {
			file_ids: ["variant-image-file"],
			options: { xMagicImageProcess: thumbnailOptions },
		})
		expect(getTemporaryDownloadUrl).toHaveBeenNthCalledWith(2, {
			file_ids: ["variant-image-file"],
			options: { xMagicImageProcess: contentOptions },
		})
		expect(getTemporaryDownloadUrl).toHaveBeenNthCalledWith(3, {
			file_ids: ["variant-image-file"],
		})
		expect(thumbnailResult.processedContent).toContain("https://oss.example.com/hero-400.webp")
		expect(contentResult.processedContent).toContain("https://oss.example.com/hero-2160.webp")
		expect(originalResult.processedContent).toContain(
			"https://oss.example.com/hero-original.png",
		)
	})
})
