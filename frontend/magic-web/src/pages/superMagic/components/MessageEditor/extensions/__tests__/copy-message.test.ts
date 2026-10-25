import { Editor, Node } from "@/infrastructure/editors/tiptap/core"
import { Document } from "@/infrastructure/editors/tiptap/extension-document"
import { Paragraph } from "@/infrastructure/editors/tiptap/extension-paragraph"
import { Text } from "@/infrastructure/editors/tiptap/extension-text"
import { Slice } from "prosemirror-model"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import CopyMessageExtension from "../copy-message"

const mentionAttrs: TiptapMentionAttributes = {
	type: MentionItemType.MEMORY_FILE,
	data: {
		file_id: "memory-file-1",
		file_name: "notes.md",
		file_path: "/notes.md",
		file_extension: "md",
	},
}

const MentionNode = Node.create({
	name: "mention",
	group: "inline",
	inline: true,
	atom: true,
	addAttributes() {
		return {
			type: { default: null },
			data: { default: null },
		}
	},
	renderHTML() {
		return ["span", { "data-test-mention": "" }]
	},
})

const editors: Editor[] = []

afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy())
	vi.restoreAllMocks()
})

function createEditor(
	onMentionsInsert: (items: TiptapMentionAttributes[]) => void,
	options: { getWorkspaceFilesList?: () => AttachmentItem[] } = {},
) {
	const editor = new Editor({
		content: "",
		extensions: [
			Document,
			Paragraph,
			Text,
			MentionNode,
			CopyMessageExtension.configure({ onMentionsInsert, ...options }),
		],
	})
	editors.push(editor)
	return editor
}

function createClipboardEvent(richText: string | undefined, mentions: unknown[]) {
	const metadata = {
		...(richText !== undefined ? { richText } : {}),
		mentions,
	}
	const encodedMetadata = btoa(encodeURIComponent(JSON.stringify(metadata)))
	const values: Record<string, string> = {
		"text/html": `<div data-magic-clipboard="${encodedMetadata}"></div>`,
	}

	return {
		clipboardData: {
			types: Object.keys(values),
			getData: (type: string) => values[type] ?? "",
		},
	} as ClipboardEvent
}

function getHandlePaste(editor: Editor) {
	const plugin = editor.state.plugins.find((item) => item.props.handlePaste)
	if (!plugin?.props.handlePaste)
		throw new Error("CopyMessageExtension handlePaste is unavailable")
	return plugin.props.handlePaste as (
		view: typeof editor.view,
		event: ClipboardEvent,
		slice: Slice,
	) => boolean
}

describe("CopyMessageExtension handlePaste", () => {
	it.each([
		["missing richText", undefined],
		["empty richText", ""],
		["invalid richText", "not-json"],
	])("syncs mentions when %s", (_label, richText) => {
		const onMentionsInsert = vi.fn()
		const editor = createEditor(onMentionsInsert)
		vi.spyOn(console, "error").mockImplementation(() => undefined)

		const handled = getHandlePaste(editor)(
			editor.view,
			createClipboardEvent(richText, [{ attrs: mentionAttrs }]),
			Slice.empty,
		)

		expect(handled).toBe(false)
		expect(onMentionsInsert).toHaveBeenCalledTimes(1)
		expect(onMentionsInsert).toHaveBeenCalledWith([mentionAttrs])
	})

	it("syncs mentions only after rich text insertion succeeds", () => {
		const onMentionsInsert = vi.fn()
		const editor = createEditor(onMentionsInsert)
		const richText = JSON.stringify({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
		})

		const handled = getHandlePaste(editor)(
			editor.view,
			createClipboardEvent(richText, [{ attrs: mentionAttrs }]),
			Slice.empty,
		)

		expect(handled).toBe(true)
		expect(onMentionsInsert).toHaveBeenCalledWith([mentionAttrs])
	})

	it("does not sync mentions when rich text insertion fails", () => {
		const onMentionsInsert = vi.fn()
		const editor = createEditor(onMentionsInsert)
		Object.defineProperty(editor, "commands", {
			configurable: true,
			value: {
				focus: vi.fn(),
				insertContent: vi.fn(() => false),
			},
		})
		const richText = JSON.stringify({ type: "doc", content: [] })

		const handled = getHandlePaste(editor)(
			editor.view,
			createClipboardEvent(richText, [{ attrs: mentionAttrs }]),
			Slice.empty,
		)

		expect(handled).toBe(false)
		expect(onMentionsInsert).not.toHaveBeenCalled()
	})

	it("falls back to portable markdown rematch when magic metadata cannot be decoded", () => {
		const onMentionsInsert = vi.fn()
		const editor = createEditor(onMentionsInsert, {
			getWorkspaceFilesList: () => [
				{
					file_id: "workspace-cat-id",
					file_name: "cat.png",
					relative_file_path: "77/images/cat.png",
					file_extension: "png",
				},
			],
		})

		const handled = getHandlePaste(editor)(
			editor.view,
			{
				clipboardData: {
					types: ["text/html", "text/plain"],
					getData: (type: string) => {
						if (type === "text/html") {
							return '<div data-magic-clipboard="not-valid-base64!!!">cat</div>'
						}
						if (type === "text/plain") {
							return "[cat.png](./77/images/cat.png)"
						}
						return ""
					},
				},
			} as ClipboardEvent,
			Slice.empty,
		)

		expect(handled).toBe(true)
		expect(onMentionsInsert).toHaveBeenCalledWith([
			expect.objectContaining({
				type: MentionItemType.PROJECT_FILE,
				data: expect.objectContaining({
					file_id: "workspace-cat-id",
					file_path: "77/images/cat.png",
				}),
			}),
		])
	})

	it("resolves path-only Canvas mentions from workspace attachments", () => {
		const onMentionsInsert = vi.fn()
		const canvasAttrs: TiptapMentionAttributes = {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "images/cat.png",
				file_name: "cat.png",
				file_path: "./images/cat.png",
				file_extension: "png",
			},
		}
		const editor = createEditor(onMentionsInsert, {
			getWorkspaceFilesList: () => [
				{
					file_id: "workspace-cat-id",
					file_name: "cat.png",
					relative_file_path: "images/cat.png",
					file_extension: "png",
				},
			],
		})

		const richText = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: canvasAttrs }],
				},
			],
		})
		const handled = getHandlePaste(editor)(
			editor.view,
			createClipboardEvent(richText, [{ attrs: canvasAttrs }]),
			Slice.empty,
		)

		expect(handled).toBe(true)
		expect(onMentionsInsert).toHaveBeenCalledWith([
			expect.objectContaining({
				type: MentionItemType.PROJECT_FILE,
				data: expect.objectContaining({
					file_id: "workspace-cat-id",
					file_path: "images/cat.png",
				}),
			}),
		])
	})
})
