import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@/infrastructure/editors/tiptap/core"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { Markdown } from "@/infrastructure/editors/tiptap/markdown"
import {
	SafeHtmlDiv,
	SafeHtmlSpan,
	SafeHtmlTextBlockStyles,
} from "../components/EditorBody/extensions/safe-html-style"
import { SafeVideo } from "../components/EditorBody/extensions/safe-video"

describe("Markdown raw HTML rendering", () => {
	let editor: Editor | null = null

	afterEach(() => {
		editor?.destroy()
		editor = null
	})

	it("parses both styled div blocks as HTML content rather than code", () => {
		const markdown = `<div style="border: 2px solid blue; padding: 20px; background-color: lightgray; margin: 10px 0;">
    <h3>样式化的DIV元素</h3>
    <p>这是一个具有自定义样式的div元素，带有 <span style="background: yellow;">高亮 span</span>。</p>

</div>

![DingTalk Logo](https://static-legacy.dingtalk.com/media/example.jpg)

<div style="text-align: center; background-color: #f0f8ff; padding: 15px; border-radius: 10px; margin-top: 20px;">
    <p><strong>这是另一个带有样式的div</strong>，居中对齐并有淡蓝色背景。</p>
    
</div>`

		editor = new Editor({
			extensions: [
				StarterKit,
				Markdown.configure({ html: true, breaks: true }),
				SafeHtmlDiv,
				SafeHtmlSpan,
				SafeHtmlTextBlockStyles,
			],
			content: markdown,
		})

		const html = editor.getHTML()
		expect(html).not.toContain("<pre")
		expect(html).not.toContain("&lt;div")
		expect(html).toContain('style="border: 2px solid blue')
		expect(html).toContain('style="text-align: center')
		expect(html).toContain("样式化的DIV元素")
		expect(html).toContain('style="background: yellow')
		expect(html).toContain("这是另一个带有样式的div")
	})

	it("does not preserve unsafe layout styles in the editor schema", () => {
		editor = new Editor({
			extensions: [
				StarterKit,
				Markdown.configure({ html: true }),
				SafeHtmlDiv,
				SafeHtmlSpan,
				SafeHtmlTextBlockStyles,
			],
			content: '<div style="position:fixed;inset:0"><p>overlay</p></div>',
		})

		const html = editor.getHTML()
		expect(html).toContain("overlay")
		expect(html).not.toContain("position")
		expect(html).not.toContain("inset")
	})

	it("retains safe styles on text, list, and quote HTML blocks", () => {
		editor = new Editor({
			extensions: [
				StarterKit,
				Markdown.configure({ html: true }),
				SafeHtmlDiv,
				SafeHtmlSpan,
				SafeHtmlTextBlockStyles,
			],
			content: `<h2 style="background-color:#fff3cd; color:#8a6d3b; border:2px solid #f0ad4e; padding:8px 12px; border-radius:6px;">标题</h2>
<p style="background-color:#f3e8ff; color:#6f42c1; border:1px solid #c084fc; padding:10px 12px; border-radius:8px;">段落</p>
<ul style="background-color:#f1f3f5; color:#343a40; border:1px solid #adb5bd; padding:12px 16px; border-radius:8px;"><li style="color:#1971c2;">列表</li></ul>
<blockquote style="background-color:#fff9db; color:#8f5b00; border-left:5px solid #f59f00; padding:12px 16px; margin:0; border-radius:6px;">引用</blockquote>`,
		})

		const html = editor.getHTML()
		expect(html).toContain("background-color")
		expect(html).toContain("标题")
		expect(html).toContain("列表")
		expect(html).toContain("引用")
		expect(html).not.toContain("<pre")
	})

	it("renders a safe HTTPS video with bounded presentation styles", () => {
		editor = new Editor({
			extensions: [StarterKit, Markdown.configure({ html: true }), SafeVideo],
			content:
				'<video src="https://cdn.example.com/video.mp4" controls style="display:block; max-width:420px; max-height:360px;"></video>',
		})

		const html = editor.getHTML()
		expect(html).toContain("<video")
		expect(html).toContain('src="https://cdn.example.com/video.mp4"')
		expect(html).toContain('preload="metadata"')
		expect(html).toContain("controls")
		expect(html).not.toContain("autoplay")
	})

	it("revalidates video attributes when the node comes from JSON", () => {
		editor = new Editor({
			extensions: [StarterKit, Markdown.configure({ html: true }), SafeVideo],
			content: {
				type: "doc",
				content: [
					{
						type: "safeVideo",
						attrs: {
							src: "javascript:alert(1)",
							style: "position:fixed;inset:0!important",
						},
					},
				],
			},
		})

		const html = editor.getHTML()
		expect(html).toContain("<video")
		expect(html).not.toContain("javascript:")
		expect(html).not.toContain("position")
		expect(html).not.toContain("inset")
	})

	it("revalidates HTML style nodes and marks when the document comes from JSON", () => {
		editor = new Editor({
			extensions: [
				StarterKit,
				Markdown.configure({ html: true }),
				SafeHtmlDiv,
				SafeHtmlSpan,
				SafeHtmlTextBlockStyles,
			],
			content: {
				type: "doc",
				content: [
					{
						type: "safeHtmlDiv",
						attrs: { style: "position:fixed;inset:0;z-index:2147483647" },
						content: [{ type: "paragraph", content: [{ type: "text", text: "div" }] }],
					},
					{
						type: "paragraph",
						attrs: { style: "position:fixed;inset:0;z-index:2147483647" },
						content: [
							{
								type: "text",
								text: "span",
								marks: [
									{
										type: "safeHtmlSpan",
										attrs: { style: "position:fixed;inset:0!important" },
									},
								],
							},
						],
					},
				],
			},
		})

		const html = editor.getHTML()
		expect(html).toContain("div")
		expect(html).toContain("span")
		expect(html).not.toContain("position")
		expect(html).not.toContain("inset")
		expect(html).not.toContain("z-index")
	})
})
