import { Editor, Extension } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { afterEach, describe, expect, it } from "vitest"
import { Placeholder } from "../placeholder"

const SuggestionAttribute = Extension.create({
	name: "suggestion-attribute",

	addGlobalAttributes() {
		return [
			{
				types: ["paragraph"],
				attributes: {
					suggestion: {
						default: "",
						renderHTML: (attrs) => {
							if (!attrs.suggestion) return {}

							return { "data-suggestion": attrs.suggestion }
						},
					},
				},
			},
		]
	},
})

const editors: Editor[] = []
const elements: HTMLElement[] = []

afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy())
	elements.splice(0).forEach((element) => element.remove())
})

describe("Placeholder", () => {
	it("does not render placeholder when an empty paragraph has a suggestion", () => {
		const editor = createEditor()

		editor.commands.updateAttributes("paragraph", {
			suggestion: "上次上传白壁纸能再次上次不换行",
		})

		const paragraph = editor.view.dom.querySelector("p")

		expect(paragraph?.getAttribute("data-suggestion")).toBe("上次上传白壁纸能再次上次不换行")
		expect(paragraph?.classList.contains("is-editor-empty")).toBe(false)
		expect(paragraph?.getAttribute("data-placeholder")).toBeNull()
	})
})

function createEditor() {
	const element = document.createElement("div")
	document.body.appendChild(element)
	elements.push(element)

	const editor = new Editor({
		element,
		content: "",
		extensions: [
			Document,
			Paragraph,
			Text,
			SuggestionAttribute,
			Placeholder.configure({
				placeholder: "请输入您的需求，或上传文件",
			}),
		],
	})

	editors.push(editor)

	return editor
}
