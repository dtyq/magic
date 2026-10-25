import { describe, it, expect, vi } from "vitest"
import {
	findFileByName,
	findFileByPath,
	extractFileName,
	parseImageSize,
	normalizeImagePath,
	escapeDangerousInvisibleHtmlTags,
	type AttachmentFile,
} from "../utils"

describe("Markdown Utils", () => {
	describe("escapeDangerousInvisibleHtmlTags", () => {
		it("escapes invisible or executable HTML tags", () => {
			expect(escapeDangerousInvisibleHtmlTags("before <script>alert(1)</script> after")).toBe(
				"before <code>&lt;script&gt;alert(1)&lt;/script&gt;</code> after",
			)
			expect(escapeDangerousInvisibleHtmlTags("<style>body { color: red }</style>")).toBe(
				"<pre><code>&lt;style&gt;body { color: red }&lt;/style&gt;</code></pre>",
			)
		})

		it("renders complete multiline HTML blocks as code", () => {
			const markdown = '<script>\n# heading\nconst html = "<div>example</div>"\n</script>'
			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(
				'<pre><code>&lt;script&gt;\n# heading\nconst html = "&lt;div&gt;example&lt;/div&gt;"\n&lt;/script&gt;</code></pre>',
			)
		})

		it("does not alter fenced code blocks", () => {
			const markdown = "```html\n<script>alert(1)</script>\n```"
			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(markdown)
		})

		it("leaves ordinary HTML untouched", () => {
			expect(escapeDangerousInvisibleHtmlTags("<div>visible</div>")).toBe(
				"<div>visible</div>",
			)
		})

		it("does not alter inline or indented code", () => {
			expect(escapeDangerousInvisibleHtmlTags("`<script>alert(1)</script>`")).toBe(
				"`<script>alert(1)</script>`",
			)
			expect(escapeDangerousInvisibleHtmlTags("    <script>alert(1)</script>")).toBe(
				"    <script>alert(1)</script>",
			)
		})

		it("uses markdown-it semantics for unmatched backticks and invalid fences", () => {
			expect(escapeDangerousInvisibleHtmlTags("unclosed `\n<script>x</script>")).toBe(
				"unclosed `\n<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>",
			)
			expect(escapeDangerousInvisibleHtmlTags("```bad```\n<script>x</script>")).toBe(
				"```bad```\n<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>",
			)
		})

		it("preserves blockquote and list prefixes around dangerous HTML blocks", () => {
			expect(escapeDangerousInvisibleHtmlTags("> <script>\n> # x\n> </script>")).toBe(
				"> <pre><code>&lt;script&gt;\n> # x\n> &lt;/script&gt;</code></pre>",
			)
			expect(escapeDangerousInvisibleHtmlTags("- <style>\n  # x\n  </style>")).toBe(
				"- <pre><code>&lt;style&gt;\n  # x\n  &lt;/style&gt;</code></pre>",
			)
		})

		it("renders raw HTML with executable attributes or protocols as code", () => {
			expect(escapeDangerousInvisibleHtmlTags('<div onclick="run()">text</div>')).toBe(
				'<pre><code>&lt;div onclick="run()"&gt;text&lt;/div&gt;</code></pre>',
			)
			expect(
				escapeDangerousInvisibleHtmlTags(
					'before <a href="javascript:alert(1)">click</a> after',
				),
			).toBe('before <code>&lt;a href="javascript:alert(1)"&gt;click&lt;/a&gt;</code> after')
		})

		it("preserves safe presentation styles and blocks overlay styles", () => {
			const markdown =
				'<div style="position:fixed;inset:0;z-index:2147483647;background:white">login</div>'
			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(
				'<pre><code>&lt;div style="position:fixed;inset:0;z-index:2147483647;background:white"&gt;login&lt;/div&gt;</code></pre>',
			)
			expect(escapeDangerousInvisibleHtmlTags('<span style="color:red">text</span>')).toBe(
				'<span style="color:red">text</span>',
			)
		})

		it("blocks oversized and negatively offset presentation values", () => {
			const markdown =
				'<div style="margin-top:-100vh!important;padding:100vh 100vw;background-color:white">login</div>'
			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(
				'<pre><code>&lt;div style="margin-top:-100vh!important;padding:100vh 100vw;background-color:white"&gt;login&lt;/div&gt;</code></pre>',
			)

			expect(
				escapeDangerousInvisibleHtmlTags(
					'<div style="margin-top:-20px;padding:9999px;font-size:9999px">login</div>',
				),
			).toContain("<pre><code>")
		})

		it("accepts safe shorthand styles consistently across browsers", () => {
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<div style="border: 2px solid blue; padding: 20px; background-color: lightgray; margin: 10px 0;">text</div>',
				),
			).toContain('<div style="border: 2px solid blue')
		})

		it("accepts safe style property families without allowing layout properties", () => {
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<div style="border-left-width: 2px; border-top-right-radius: 4px; padding-inline: 8px">text</div>',
				),
			).toContain("<pre><code>")
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<div style="border-left-width: 2px; border-top-right-radius: 4px; padding-left: 8px">text</div>',
				),
			).not.toContain("<pre><code>")
		})

		it("only allows color values in the background shorthand", () => {
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<span style="background: rgb(255 255 0 / 50%)">text</span>',
				),
			).toBe('<span style="background: rgb(255 255 0 / 50%)">text</span>')
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<span style="background: linear-gradient(red, blue)">text</span>',
				),
			).toBe(
				'<code>&lt;span style="background: linear-gradient(red, blue)"&gt;text&lt;/span&gt;</code>',
			)
		})

		it("preserves a safe styled span nested inside a styled div", () => {
			const markdown = `<div style="border: 1px solid #ccc; padding: 10px;">
  <h3>div 容器内的 H3 标题</h3>
  <p>div 容器内的段落文本，带 <span style="background: yellow;">高亮 span</span>。</p>
</div>`

			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(markdown)
		})

		it("preserves a styled multiline div across blank lines", () => {
			const markdown = `这是一个用于测试的Markdown文件，其中包含了设置了style属性的div元素。

<div style="border: 2px solid blue; padding: 20px; background-color: lightgray; margin: 10px 0;">
    <h3>样式化的DIV元素</h3>
    <p>这是一个具有自定义样式的div元素，展示了如何在Markdown中使用内联样式。</p>

</div>`

			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(markdown)
		})

		it("preserves multiple styled divs around a markdown image", () => {
			const markdown = `# 测试Markdown文件

这是一个用于测试的Markdown文件，其中包含了设置了style属性的div元素和一张图片。

<div style="border: 2px solid blue; padding: 20px; background-color: lightgray; margin: 10px 0;">
    <h3>样式化的DIV元素</h3>
    <p>这是一个具有自定义样式的div元素，展示了如何在Markdown中使用内联样式。</p>

</div>

以下是一张来自钉钉静态资源的图片：

![DingTalk Logo](https://static-legacy.dingtalk.com/media/example.jpg)

<div style="text-align: center; background-color: #f0f8ff; padding: 15px; border-radius: 10px; margin-top: 20px;">
    <p><strong>这是另一个带有样式的div</strong>，居中对齐并有淡蓝色背景。</p>

</div>`

			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(markdown)
		})

		it("preserves safe video HTML and blocks unsafe video attributes", () => {
			const safeVideo =
				'<video src="https://cdn.example.com/video.mp4" controls style="display:block; max-width:420px; max-height:360px;"></video>'
			expect(escapeDangerousInvisibleHtmlTags(safeVideo)).toBe(safeVideo)

			const autoplayVideo = '<video src="https://cdn.example.com/video.mp4" autoplay></video>'
			expect(escapeDangerousInvisibleHtmlTags(autoplayVideo)).toContain("<code>")
		})

		it("preserves safe min() sizing used by media HTML", () => {
			expect(
				escapeDangerousInvisibleHtmlTags(
					'<div style="margin:8px 0;"><img src="https://cdn.example.com/avatar.jpg" style="display:block; max-width:min(100%, 56px); max-height:56px;"></div>',
				),
			).not.toContain("<code>")
		})

		it.each([
			"java&#x73;cript:alert(1)",
			"jav&#97;script:alert(1)",
			"java&#10;script:alert(1)",
			"javascript&#58;alert(1)",
			"JaVaScRiPt:alert(1)",
			"vb&#x73;cript:msgbox(1)",
			"data&#58;text/html,<script>alert(1)</script>",
		])("decodes and blocks dangerous raw HTML URL %s", (href) => {
			const markdown = `before <a href="${href}">click</a> after`
			const escapedHref = href
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
			expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(
				`before <code>&lt;a href="${escapedHref}"&gt;click&lt;/a&gt;</code> after`,
			)
		})

		it("leaves safe raw HTML links untouched", () => {
			for (const href of [
				"https://example.com",
				"http://example.com",
				"/docs/page.md",
				"../page.md#section",
				"mailto:user@example.com",
			]) {
				const markdown = `<a href="${href}">example</a>`
				expect(escapeDangerousInvisibleHtmlTags(markdown)).toBe(markdown)
			}
		})

		it("renders SVG SMIL and MathML as code instead of allowing raw namespaces", () => {
			const svg =
				'<svg><a><animate attributeName="href" values="javascript:alert(1)" /></a><text>click</text></svg>'
			expect(escapeDangerousInvisibleHtmlTags(svg)).toBe(
				`<code>${svg
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")}</code>`,
			)
			expect(escapeDangerousInvisibleHtmlTags("<math><mi>x</mi></math>")).toBe(
				"<code>&lt;math&gt;&lt;mi&gt;x&lt;/mi&gt;&lt;/math&gt;</code>",
			)
		})

		it("falls back to one bounded code block for excessive repeated raw HTML", () => {
			const markdown = Array.from(
				{ length: 1100 },
				() => '<a href="javascript:alert(1)">x</a>',
			).join(" ")
			const result = escapeDangerousInvisibleHtmlTags(markdown)

			expect(result.startsWith("<pre><code>")).toBe(true)
			expect(result).not.toContain('<a href="javascript:alert(1)">')
		})

		it("checks raw HTML workload limits before DOM risk analysis", () => {
			const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString")
			try {
				const markdown = Array.from(
					{ length: 10000 },
					() => '<span style="color:red">x</span>',
				).join(" ")
				const result = escapeDangerousInvisibleHtmlTags(markdown)

				expect(markdown.length).toBeLessThan(4 * 1024 * 1024)
				expect(result.startsWith("<pre><code>")).toBe(true)
				expect(parseSpy).not.toHaveBeenCalled()
			} finally {
				parseSpy.mockRestore()
			}
		})

		it("caches repeated raw HTML risk decisions", () => {
			const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString")
			try {
				const markdown = Array.from(
					{ length: 100 },
					() => '<span style="color:red">x</span>',
				).join(" ")
				escapeDangerousInvisibleHtmlTags(markdown)

				expect(parseSpy).toHaveBeenCalledTimes(1)
			} finally {
				parseSpy.mockRestore()
			}
		})
	})
	describe("findFileByName", () => {
		it("should find file in flat array", () => {
			const files: AttachmentFile[] = [
				{ file_id: "1", file_name: "test.png" },
				{ file_id: "2", file_name: "image.jpg" },
			]

			const result = findFileByName(files, "test.png")
			expect(result).toEqual({ file_id: "1", file_name: "test.png" })
		})

		it("should find file in nested directories", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "folder",
					is_directory: true,
					children: [
						{ file_id: "2", file_name: "nested.png" },
						{ file_id: "3", file_name: "other.jpg" },
					],
				},
			]

			const result = findFileByName(files, "nested.png")
			expect(result).toEqual({ file_id: "2", file_name: "nested.png" })
		})

		it("should return null if file not found", () => {
			const files: AttachmentFile[] = [{ file_id: "1", file_name: "test.png" }]

			const result = findFileByName(files, "nonexistent.png")
			expect(result).toBeNull()
		})

		it("should handle empty array", () => {
			const result = findFileByName([], "test.png")
			expect(result).toBeNull()
		})
	})

	describe("findFileByPath", () => {
		it("should find file by relative path in flat array", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
				{
					file_id: "2",
					file_name: "image.jpg",
					relative_file_path: "/images/image.jpg",
				},
			]

			const result = findFileByPath(files, "/images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should find file with ./ prefix", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "./images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should find file in nested directories", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "folder1",
					file_name: "images",
					is_directory: true,
					relative_file_path: "/images",
					children: [
						{
							file_id: "2",
							file_name: "nested.png",
							relative_file_path: "/images/nested.png",
						},
						{
							file_id: "3",
							file_name: "other.jpg",
							relative_file_path: "/images/other.jpg",
						},
					],
				},
			]

			const result = findFileByPath(files, "./images/nested.png")
			expect(result).toEqual({
				file_id: "2",
				file_name: "nested.png",
				relative_file_path: "/images/nested.png",
			})
		})

		it("should return null if file not found", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "/images/nonexistent.png")
			expect(result).toBeNull()
		})

		it("should handle empty array", () => {
			const result = findFileByPath([], "/images/test.png")
			expect(result).toBeNull()
		})

		it("should normalize paths without leading slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should handle URL encoded paths with spaces", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test file.png",
					relative_file_path: "/images/test file.png",
				},
			]

			const result = findFileByPath(files, "./images/test%20file.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test file.png",
				relative_file_path: "/images/test file.png",
			})
		})

		it("should handle URL encoded paths with special characters", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "测试图片.png",
					relative_file_path: "/images/测试图片.png",
				},
			]

			// %E6%B5%8B%E8%AF%95 is URL encoded "测试"
			const result = findFileByPath(
				files,
				"./images/%E6%B5%8B%E8%AF%95%E5%9B%BE%E7%89%87.png",
			)
			expect(result).toEqual({
				file_id: "1",
				file_name: "测试图片.png",
				relative_file_path: "/images/测试图片.png",
			})
		})

		it("should handle paths with leading and trailing whitespace", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "  ./images/test.png  ")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should handle paths with trailing slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			// Should still match even if search path has trailing slash
			const result = findFileByPath(files, "./images/test.png/")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should match when attachment path has trailing slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png/",
				},
			]

			const result = findFileByPath(files, "./images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png/",
			})
		})

		it("should handle invalid URI sequences gracefully", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test%.png",
					relative_file_path: "/images/test%.png",
				},
			]

			// Invalid URI sequence should still work
			const result = findFileByPath(files, "./images/test%.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test%.png",
				relative_file_path: "/images/test%.png",
			})
		})
	})

	describe("extractFileName", () => {
		it("should extract file name from simple path", () => {
			expect(extractFileName("./images/file.png")).toBe("file.png")
		})

		it("should extract file name from path with size syntax", () => {
			expect(extractFileName("./images/file.png =300x200")).toBe("file.png")
		})

		it("should extract file name from nested path", () => {
			expect(extractFileName("../folder/subfolder/photo.jpg")).toBe("photo.jpg")
		})

		it("should handle file name without path", () => {
			expect(extractFileName("image.png")).toBe("image.png")
		})

		it("should handle file name with size syntax but no path", () => {
			expect(extractFileName("image.png =300x")).toBe("image.png")
		})
	})

	describe("parseImageSize", () => {
		it("should parse width and height", () => {
			expect(parseImageSize("./file.png =300x200")).toEqual({
				width: 300,
				height: 200,
			})
		})

		it("should parse width only", () => {
			expect(parseImageSize("./file.png =300x")).toEqual({
				width: 300,
				height: null,
			})
		})

		it("should return null for both when no size syntax", () => {
			expect(parseImageSize("./file.png")).toEqual({
				width: null,
				height: null,
			})
		})

		it("should handle size syntax in middle of URL", () => {
			expect(parseImageSize("./images/file.png =500x400 extra")).toEqual({
				width: 500,
				height: 400,
			})
		})
	})

	describe("normalizeImagePath", () => {
		it("should remove size syntax from path", () => {
			expect(normalizeImagePath("./images/file.png =300x200")).toBe("./images/file.png")
		})

		it("should handle path with width only", () => {
			expect(normalizeImagePath("./images/file.png =300x")).toBe("./images/file.png")
		})

		it("should return original path if no size syntax", () => {
			expect(normalizeImagePath("./images/file.png")).toBe("./images/file.png")
		})

		it("should handle multiple spaces", () => {
			expect(normalizeImagePath("./images/file.png  =300x200  extra")).toBe(
				"./images/file.png",
			)
		})
	})

	describe("Image path deduplication scenarios", () => {
		it("should demonstrate different sizes create different normalized paths when rawPath is used", () => {
			// This test demonstrates the fix for the TODO comment
			// When the same image appears with different sizes, they should be stored separately

			const path1 = "./images/file.png =300x200"
			const path2 = "./images/file.png =500x400"

			// Using rawPath as key (new behavior)
			const mapWithRawPath = {
				[path1]: { width: 300, height: 200 },
				[path2]: { width: 500, height: 400 },
			}

			// Both entries are preserved
			expect(mapWithRawPath[path1]).toEqual({ width: 300, height: 200 })
			expect(mapWithRawPath[path2]).toEqual({ width: 500, height: 400 })

			// Using normalized path as key (old behavior - would cause overwriting)
			const normalized1 = normalizeImagePath(path1)
			const normalized2 = normalizeImagePath(path2)

			expect(normalized1).toBe(normalized2) // Both normalize to same path
			expect(normalized1).toBe("./images/file.png")
		})
	})
})
