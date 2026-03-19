import { describe, expect, it, afterEach } from "vitest"
import { Editor } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { Markdown } from "tiptap-markdown"
import { ProjectImageNode } from "../project-image-node-extension"
import { generateTempSrc, TEMP_PATH_PREFIX } from "../temp-path-utils"

describe("ProjectImageNode Markdown Integration", () => {
	let editor: Editor | null = null

	const createEditor = (content = "") => {
		editor = new Editor({
			extensions: [
				Document,
				Paragraph,
				Text,
				Markdown,
				ProjectImageNode.configure({
					urlResolver: (path) => path,
				}),
			],
			content,
		})
		return editor
	}

	afterEach(() => {
		if (editor) {
			editor.destroy()
			editor = null
		}
	})

	describe("Markdown to Editor (Parsing)", () => {
		it("should parse markdown image with width and height", () => {
			const markdown = '![test](./images/photo.jpg "=800x600")'
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(markdown, true, { emitUpdate: false })

			const json = editor.getJSON()
			const imageNode = json.content?.[0]

			expect(imageNode?.type).toBe("image")
			expect(imageNode?.attrs?.src).toBe("./images/photo.jpg")
			expect(imageNode?.attrs?.width).toBe(800)
			expect(imageNode?.attrs?.height).toBe(600)
		})

		it("should parse markdown image with width only", () => {
			const markdown = '![test](./images/photo.jpg "=500x")'
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(markdown, true, { emitUpdate: false })

			const json = editor.getJSON()
			const imageNode = json.content?.[0]

			expect(imageNode?.type).toBe("image")
			expect(imageNode?.attrs?.src).toBe("./images/photo.jpg")
			expect(imageNode?.attrs?.width).toBe(500)
			expect(imageNode?.attrs?.height).toBeNull()
		})

		it("should parse markdown image without dimensions", () => {
			const markdown = "![test](./images/photo.jpg)"
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(markdown, true, { emitUpdate: false })

			const json = editor.getJSON()
			const imageNode = json.content?.[0]

			expect(imageNode?.type).toBe("image")
			expect(imageNode?.attrs?.src).toBe("./images/photo.jpg")
			expect(imageNode?.attrs?.width).toBeNull()
			expect(imageNode?.attrs?.height).toBeNull()
		})

		it("should handle relative paths without ./ prefix", () => {
			const markdown = '![test](images/photo.jpg "=300x200")'
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(markdown, true, { emitUpdate: false })

			const json = editor.getJSON()
			const imageNode = json.content?.[0]

			expect(imageNode?.type).toBe("image")
			expect(imageNode?.attrs?.src).toBe("images/photo.jpg")
			expect(imageNode?.attrs?.width).toBe(300)
			expect(imageNode?.attrs?.height).toBe(200)
		})
	})

	describe("Editor to Markdown (Serialization)", () => {
		it("should serialize image node with width and height", () => {
			const editor = createEditor()

			editor.commands.setProjectImage({
				src: "./images/photo.jpg",
				alt: "test image",
				uploading: false,
			})

			// Manually set dimensions
			editor.commands.updateProjectImage("./images/photo.jpg", {
				width: 800,
				height: 600,
			})

			// @ts-expect-error - markdown storage extension
			const markdown = editor.storage.markdown.getMarkdown()

			// With dimensions, serializes as HTML img tag
			expect(markdown).toContain(
				'<img src="./images/photo.jpg" alt="test image" width="800" height="600" />',
			)
		})

		it("should serialize image node with width only", () => {
			const editor = createEditor()

			editor.commands.setProjectImage({
				src: "./images/photo.jpg",
				alt: "test image",
				uploading: false,
			})

			editor.commands.updateProjectImage("./images/photo.jpg", {
				width: 500,
			})

			// @ts-expect-error - markdown storage extension
			const markdown = editor.storage.markdown.getMarkdown()

			// With width only, serializes as HTML img tag
			expect(markdown).toContain(
				'<img src="./images/photo.jpg" alt="test image" width="500" />',
			)
		})

		it("should serialize image node without dimensions", () => {
			const editor = createEditor()

			editor.commands.setProjectImage({
				src: "./images/photo.jpg",
				alt: "test image",
				uploading: false,
			})

			// @ts-expect-error - markdown storage extension
			const markdown = editor.storage.markdown.getMarkdown()

			// Should not have dimension suffix
			expect(markdown).toContain("![test image](./images/photo.jpg)")
			expect(markdown).not.toContain("=")
		})

		it("should skip temporary/uploading images", () => {
			const editor = createEditor()
			const tempSrc = generateTempSrc("test.jpg")

			editor.commands.setProjectImage({
				src: tempSrc,
				alt: "uploading",
				uploading: true,
				uploadProgress: 50,
			})

			// @ts-expect-error - markdown storage extension
			const markdown = editor.storage.markdown.getMarkdown()

			// Should not contain the uploading image
			expect(markdown).not.toContain(TEMP_PATH_PREFIX)
		})

		it("should skip images with upload errors", () => {
			const editor = createEditor()

			editor.commands.setProjectImage({
				src: "./failed.jpg",
				alt: "failed",
			})

			editor.commands.updateProjectImageUploadStatus("./failed.jpg", {
				uploadError: "Upload failed",
			})

			// @ts-expect-error - markdown storage extension
			const markdown = editor.storage.markdown.getMarkdown()

			// Should not contain the failed image
			expect(markdown).not.toContain("failed.jpg")
		})
	})

	describe("Round-trip consistency", () => {
		it("should maintain image data through parse and serialize cycle", () => {
			const originalMarkdown = '![My Photo](./images/test.jpg "=1024x768")'
			const editor = createEditor()

			// Parse markdown
			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(originalMarkdown, true, { emitUpdate: false })

			// Verify parsed attributes
			const json = editor.getJSON()
			const imageNode = json.content?.[0]
			expect(imageNode?.attrs?.width).toBe(1024)
			expect(imageNode?.attrs?.height).toBe(768)

			// Serialize back to markdown (will be HTML format with dimensions)
			// @ts-expect-error - markdown storage extension
			const resultMarkdown = editor.storage.markdown.getMarkdown()
			expect(resultMarkdown).toContain(
				'<img src="./images/test.jpg" alt="My Photo" width="1024" height="768" />',
			)
		})

		it("should maintain width-only image through round-trip", () => {
			const originalMarkdown = '![Photo](./test.png "=600x")'
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(originalMarkdown, true, { emitUpdate: false })

			// Verify parsed attributes
			const json = editor.getJSON()
			const imageNode = json.content?.[0]
			expect(imageNode?.attrs?.width).toBe(600)
			expect(imageNode?.attrs?.height).toBeNull()

			// @ts-expect-error - markdown storage extension
			const resultMarkdown = editor.storage.markdown.getMarkdown()
			expect(resultMarkdown).toContain('<img src="./test.png" alt="Photo" width="600" />')
		})

		it("should maintain image without dimensions through round-trip", () => {
			const originalMarkdown = "![Photo](./test.png)"
			const editor = createEditor()

			// @ts-expect-error - setContent with markdown parsing options
			editor.commands.setContent(originalMarkdown, true, { emitUpdate: false })
			// @ts-expect-error - markdown storage extension
			const resultMarkdown = editor.storage.markdown.getMarkdown()

			// Without dimensions, should stay in markdown format
			expect(resultMarkdown.trim()).toBe(originalMarkdown)
		})
	})
})
