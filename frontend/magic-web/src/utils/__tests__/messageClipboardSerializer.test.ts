import { Editor, Node } from "@/infrastructure/editors/tiptap/core"
import Document from "@/infrastructure/editors/tiptap/extension-document"
import Paragraph from "@/infrastructure/editors/tiptap/extension-paragraph"
import Text from "@/infrastructure/editors/tiptap/extension-text"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { afterEach, describe, expect, it } from "vitest"
import {
	MESSAGE_CLIPBOARD_MENTIONS_MIME,
	MESSAGE_CLIPBOARD_RICH_TEXT_MIME,
	serializeMessageClipboard,
	writeMessageClipboardPayload,
} from "../messageClipboardSerializer"
import { readMessageClipboardAssets } from "@/components/CanvasDesign/runtime/resources/clipboard/CanvasMessageClipboard"

const mention = (fileName: string, filePath: string): TiptapMentionAttributes => ({
	type: MentionItemType.PROJECT_FILE,
	data: {
		file_id: `id:${filePath}`,
		file_name: fileName,
		file_path: filePath,
		relative_file_path: filePath,
		file_extension: fileName.split(".").pop() || "",
	},
})

const MentionNode = Node.create({
	name: "mention",
	group: "inline",
	inline: true,
	atom: true,
	addAttributes() {
		return {
			type: { default: null },
			data: { default: null },
			pending: { default: false },
			pendingId: { default: null },
		}
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			{
				...HTMLAttributes,
				class: "magic-mention",
				"data-type": HTMLAttributes.type,
				"data-data": JSON.stringify(HTMLAttributes.data),
			},
			`@${(HTMLAttributes.data as { file_name?: string })?.file_name || "File"}`,
		]
	},
})

const editors: Editor[] = []

afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy())
})

function createEditor(content: Record<string, unknown>) {
	const editor = new Editor({
		extensions: [Document, Paragraph, Text, MentionNode],
		content,
	})
	editors.push(editor)
	return editor
}

describe("MessageClipboardSerializer", () => {
	it("serializes portable mentions using the shared message wire format", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "before " },
						{ type: "mention", attrs: mention("猫.png", "images/cat.png") },
						{ type: "text", text: " after" },
					],
				},
			],
		})
		editor.commands.selectAll()

		const payload = serializeMessageClipboard(editor.view)

		expect(payload).not.toBeNull()
		if (!payload) throw new Error("expected a portable clipboard payload")
		expect(payload?.plainText).toContain("[猫.png](./images/cat.png)")
		expect(payload?.htmlWithMetadata).toContain('data-magic-clipboard="')
		expect(payload?.metadata.mentions).toHaveLength(1)
		expect(payload?.metadata.mentions?.[0]?.attrs.data).toMatchObject({
			file_id: "id:images/cat.png",
			file_path: "images/cat.png",
		})

		const metadata = payload?.metadata
		expect(metadata?.richText).toContain('"type":"mention"')

		const values: Record<string, string> = {}
		const data = {
			setData: (type: string, value: string) => {
				values[type] = value
			},
		} as unknown as DataTransfer
		writeMessageClipboardPayload(data, payload)
		expect(values["text/plain"]).toBe(payload?.plainText)
		expect(values["text/html"]).toBe(payload?.htmlWithMetadata)
		expect(values[MESSAGE_CLIPBOARD_RICH_TEXT_MIME]).toBe(metadata?.richText)
		expect(values[MESSAGE_CLIPBOARD_MENTIONS_MIME]).toContain("images/cat.png")
		expect(MESSAGE_CLIPBOARD_RICH_TEXT_MIME).toBe("text/x-magic-message-rich-text")
		expect(MESSAGE_CLIPBOARD_MENTIONS_MIME).toBe("text/x-magic-message-mentions")

		const parsed = readMessageClipboardAssets({
			clipboardData: {
				types: Object.keys(values),
				getData: (type: string) => values[type] || "",
			},
		} as unknown as ClipboardEvent)
		expect(parsed.recognized).toBe(true)
		expect(parsed.assets).toHaveLength(1)
		expect(parsed.assets[0]).toMatchObject({
			origin: "message-reference",
			fileName: "猫.png",
			projectPath: "images/cat.png",
		})
	})

	it("serializes absolute workspace mention paths as magic clipboard payload", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: mention("皮卡丘.jpg", "/新建画布2/images/皮卡丘.jpg"),
						},
					],
				},
			],
		})
		editor.commands.selectAll()

		const payload = serializeMessageClipboard(editor.view)

		expect(payload).not.toBeNull()
		if (!payload) throw new Error("expected a magic clipboard payload")
		expect(payload.plainText).toContain("[皮卡丘.jpg](./新建画布2/images/皮卡丘.jpg)")
		expect(payload.htmlWithMetadata).toContain('data-magic-clipboard="')
		expect(payload.metadata.mentions?.[0]?.attrs.data).toMatchObject({
			file_id: "id:/新建画布2/images/皮卡丘.jpg",
			file_path: "/新建画布2/images/皮卡丘.jpg",
		})

		const values: Record<string, string> = {}
		writeMessageClipboardPayload(
			{
				setData: (type: string, value: string) => {
					values[type] = value
				},
			} as unknown as DataTransfer,
			payload,
		)
		const parsed = readMessageClipboardAssets({
			clipboardData: {
				types: Object.keys(values),
				getData: (type: string) => values[type] || "",
			},
		} as unknown as ClipboardEvent)
		expect(parsed.recognized).toBe(true)
		expect(parsed.assets[0]).toMatchObject({
			fileName: "皮卡丘.jpg",
			projectPath: "/新建画布2/images/皮卡丘.jpg",
			sourceFileId: "id:/新建画布2/images/皮卡丘.jpg",
		})
	})

	it("writes magic metadata for structured mentions even when portable href is unavailable", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: mention("opaque.bin", "asset://virtual-human-asset-id"),
						},
					],
				},
			],
		})
		editor.commands.selectAll()

		const payload = serializeMessageClipboard(editor.view)

		expect(payload).not.toBeNull()
		if (!payload) throw new Error("expected a magic clipboard payload")
		// Opaque schemes cannot become ./workspace markdown links, but internal paste
		// must still receive structured mention attrs via data-magic-clipboard.
		expect(payload.plainText).toContain("@opaque.bin")
		expect(payload.plainText).not.toContain("](./")
		expect(payload.htmlWithMetadata).toContain('data-magic-clipboard="')
		expect(payload.metadata.mentions).toHaveLength(1)
		expect(payload.metadata.mentions?.[0]?.attrs.data).toMatchObject({
			file_id: "id:asset://virtual-human-asset-id",
			file_path: "asset://virtual-human-asset-id",
			file_name: "opaque.bin",
		})
	})

	it("returns null for ordinary text and unstable file mentions", () => {
		const textEditor = createEditor({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
		})
		textEditor.commands.selectAll()
		expect(serializeMessageClipboard(textEditor.view)).toBeNull()

		const unstableEditor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: MentionItemType.PROJECT_FILE,
								data: { file_name: "temporary.png" },
							},
						},
					],
				},
			],
		})
		unstableEditor.commands.selectAll()
		expect(serializeMessageClipboard(unstableEditor.view)).toBeNull()
	})

	it("returns null for non-file mention types", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: MentionItemType.AGENT,
								data: { id: "agent-1", name: "助手" },
							},
						},
					],
				},
			],
		})
		editor.commands.selectAll()
		expect(serializeMessageClipboard(editor.view)).toBeNull()
	})

	it("still writes magic metadata when a file mention is mixed with other mention types", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: MentionItemType.AGENT,
								data: { id: "agent-1", name: "助手" },
							},
						},
						{ type: "mention", attrs: mention("猫.png", "images/cat.png") },
					],
				},
			],
		})
		editor.commands.selectAll()
		const payload = serializeMessageClipboard(editor.view)
		expect(payload).not.toBeNull()
		expect(
			payload?.metadata.mentions?.some(
				(item) => item.attrs.type === MentionItemType.PROJECT_FILE,
			),
		).toBe(true)
	})

	it("preserves an unstable mention as fallback text when another portable mention exists", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "mention", attrs: mention("猫.png", "images/cat.png") },
						{
							type: "mention",
							attrs: {
								type: MentionItemType.PROJECT_FILE,
								data: { file_name: "temporary.png" },
							},
						},
					],
				},
			],
		})
		editor.commands.selectAll()

		const payload = serializeMessageClipboard(editor.view)

		expect(payload).not.toBeNull()
		if (!payload) throw new Error("expected a portable clipboard payload")
		expect(payload.plainText).toContain("@temporary.png")
		expect(payload.metadata.richText).toContain("@temporary.png")
	})

	it("does not copy pending upload mentions or downgrade them to text", () => {
		const editor = createEditor({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "before " },
						{
							type: "mention",
							attrs: {
								...mention("pending.png", ""),
								pending: true,
								pendingId: "upload-1",
								data: {
									...mention("pending.png", "").data,
									pending: true,
								},
							},
						},
						{ type: "text", text: " after" },
					],
				},
			],
		})
		editor.commands.selectAll()

		expect(serializeMessageClipboard(editor.view)).toBeNull()
	})
})
