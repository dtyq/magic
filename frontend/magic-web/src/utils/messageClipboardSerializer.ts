import { serializeWechatChatContent } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/transform"
import { WECHAT_CHAT_HISTORY } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { DOMSerializer } from "prosemirror-model"
import type { EditorView } from "prosemirror-view"
import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import {
	getMentionDisplayName,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	getClipboardHtml,
	getClipboardPlainText,
	resolveMentionForClipboard,
} from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"

export {
	getClipboardHtml,
	getClipboardPlainText,
	getMentionClipboardRepresentation,
} from "@/pages/superMagic/components/MessageList/utils/mentionClipboard"

export const MESSAGE_CLIPBOARD_RICH_TEXT_MIME = "text/x-magic-message-rich-text"
export const MESSAGE_CLIPBOARD_MENTIONS_MIME = "text/x-magic-message-mentions"

const INSPECTOR_DETAIL_TYPE = "inspector-detail"

export interface MessageClipboardMentionItem {
	attrs: TiptapMentionAttributes
}

export interface MessageClipboardMetadata {
	sourceProjectId?: string
	richText: string
	mentions?: MessageClipboardMentionItem[]
}

export interface MessageClipboardPayload {
	plainText: string
	htmlWithMetadata: string
	metadata: MessageClipboardMetadata
}

type MentionDataRecord = Record<string, unknown>

function asRecord(value: unknown): MentionDataRecord | null {
	return value && typeof value === "object" ? (value as MentionDataRecord) : null
}

function normalizeMentionAttrs(attrs: TiptapMentionAttributes): TiptapMentionAttributes | null {
	const rawData = asRecord(attrs.data)
	if (attrs.pending === true || rawData?.pending === true) return null
	if (
		attrs.type !== MentionItemType.PROJECT_FILE &&
		attrs.type !== MentionItemType.UPLOAD_FILE &&
		attrs.type !== MentionItemType.FOLDER
	) {
		return attrs
	}

	const data = asRecord(attrs.data)
	if (!data) return null

	if (attrs.type === MentionItemType.FOLDER) {
		const folderData = data as Partial<DirectoryMentionData>
		const path = String(folderData.directory_path || "").trim()
		const name = String(folderData.directory_name || "").trim()
		return path && name ? attrs : null
	}

	const source = data as Partial<ProjectFileMentionData & UploadFileMentionData>
	const fileName = String(data.file_name || data.filename || "").trim()
	const filePath = String(source.file_path || source.relative_file_path || "").trim()
	const relativeFilePath = String(source.relative_file_path || filePath).trim()
	const fileId = String(source.file_id || "").trim() || filePath
	const fileExtension = String(source.file_extension || fileName.split(".").pop() || "").trim()

	if (!fileName || !fileId || !filePath) return null

	return {
		...attrs,
		data: {
			...data,
			file_id: fileId,
			file_name: fileName,
			file_path: filePath,
			relative_file_path: relativeFilePath,
			file_extension: fileExtension,
		},
	}
}

function getMentionFallbackText(attrs: unknown): string | null {
	const record = asRecord(attrs)
	const data = asRecord(record?.data)
	const name = String(
		data?.file_name ||
			data?.filename ||
			data?.directory_name ||
			(record ? getMentionDisplayName(record as unknown as TiptapMentionAttributes) : "") ||
			"",
	).trim()
	return name ? `@${name}` : null
}

function normalizeRichTextNode(node: JSONContent): JSONContent | null {
	let normalized = node
	if (node.type === "mention" && node.attrs) {
		const rawAttrs = node.attrs as TiptapMentionAttributes
		if (rawAttrs.pending === true || asRecord(rawAttrs.data)?.pending === true) return null
		const attrs = normalizeMentionAttrs(rawAttrs)
		if (!attrs) {
			const fallbackText = getMentionFallbackText(node.attrs)
			return fallbackText ? { type: "text", text: fallbackText } : null
		}
		normalized = { ...normalized, attrs }
	}
	if (node.type === INSPECTOR_DETAIL_TYPE && node.attrs?.fileMention) {
		const fileMention = normalizeMentionAttrs(node.attrs.fileMention as TiptapMentionAttributes)
		if (fileMention) {
			normalized = { ...normalized, attrs: { ...node.attrs, fileMention } }
		} else {
			const restAttrs = { ...node.attrs }
			delete restAttrs.fileMention
			normalized = { ...normalized, attrs: restAttrs }
		}
	}
	if (node.content) {
		normalized = {
			...normalized,
			content: node.content
				.map(normalizeRichTextNode)
				.filter((child): child is JSONContent => child !== null),
		}
	}
	return normalized
}

function collectMentionAttrs(node: JSONContent, mentions: TiptapMentionAttributes[]): void {
	if (node.type === "mention" && node.attrs) {
		mentions.push(node.attrs as TiptapMentionAttributes)
	} else if (node.type === INSPECTOR_DETAIL_TYPE && node.attrs) {
		for (const key of ["fileMention", "screenshotMention"] as const) {
			if (!node.attrs[key]) continue
			const attrs = normalizeMentionAttrs(node.attrs[key] as TiptapMentionAttributes)
			if (attrs) mentions.push(attrs)
		}
	}
	node.content?.forEach((child) => collectMentionAttrs(child, mentions))
}

export interface SerializeMessageClipboardOptions {
	workspaceFiles?: ReadonlyArray<AttachmentItem>
	sourceProjectId?: string
	enrichMentionAttrs?: (attrs: TiptapMentionAttributes) => TiptapMentionAttributes
}

function escapeClipboardHtml(text: string): string {
	return text.replace(/[&<>"']/g, (character) => {
		const escaped: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		}
		return escaped[character] ?? character
	})
}

/** Programmatic copy for history / reconstructed docs that have no EditorView selection. */
export function createMessageClipboardPayloadFromContent(
	content: JSONContent,
	options?: SerializeMessageClipboardOptions,
): MessageClipboardPayload {
	const enrichMentionAttrs = options?.enrichMentionAttrs
	const workspaceFiles = options?.workspaceFiles ?? []
	const sourceProjectId = options?.sourceProjectId
	const applyEnrichment = (attrs: TiptapMentionAttributes): TiptapMentionAttributes =>
		enrichMentionAttrs ? enrichMentionAttrs(attrs) : attrs

	const projected = serializeWechatChatContent(
		content.type === "doc" ? content : { type: "doc", content: [content] },
	)
	const sourceNodes = projected.content ?? []
	const richTextContent: JSONContent[] = []
	sourceNodes.forEach((node) => {
		const enriched = enrichRichTextMentions(node, applyEnrichment)
		const normalized = normalizeRichTextNode(enriched)
		if (normalized) richTextContent.push(normalized)
	})
	const richTextJson: JSONContent = serializeWechatChatContent({
		type: "doc",
		content: richTextContent,
	})
	const mentions: TiptapMentionAttributes[] = []
	collectMentionAttrs(richTextJson, mentions)

	const metadata: MessageClipboardMetadata = {
		richText: JSON.stringify(richTextJson),
		sourceProjectId,
		mentions: mentions.map((attrs) => ({ attrs })),
	}
	const metadataBase64 = btoa(encodeURIComponent(JSON.stringify(metadata)))
	const plainText = getClipboardPlainText(richTextJson, workspaceFiles, sourceProjectId)

	return {
		plainText,
		htmlWithMetadata: `<div data-magic-clipboard="${metadataBase64}">${escapeClipboardHtml(
			plainText,
		)}</div>`,
		metadata,
	}
}

export function serializeMessageClipboard(
	view: EditorView,
	options?: SerializeMessageClipboardOptions,
): MessageClipboardPayload | null {
	const { state } = view
	const enrichMentionAttrs = options?.enrichMentionAttrs
	const workspaceFiles = options?.workspaceFiles ?? []
	const sourceProjectId = options?.sourceProjectId
	if (state.selection.empty) return null

	const fragment = state.selection.content()
	const serializer = DOMSerializer.fromSchema(state.schema)
	const dom = serializer.serializeFragment(fragment.content)
	const tempDiv = document.createElement("div")
	tempDiv.appendChild(dom)

	const applyEnrichment = (attrs: TiptapMentionAttributes): TiptapMentionAttributes =>
		resolveMentionForClipboard(
			enrichMentionAttrs ? enrichMentionAttrs(attrs) : attrs,
			workspaceFiles,
			sourceProjectId,
		)

	const mentions: TiptapMentionAttributes[] = []
	const richTextContent: JSONContent[] = []
	fragment.content.forEach((node) => {
		// 先用所属工作区补全历史引用，再校验；不能先把缺路径但可恢复的节点丢掉。
		const enriched = enrichRichTextMentions(node.toJSON() as JSONContent, applyEnrichment)
		const normalized = normalizeRichTextNode(enriched)
		if (normalized) richTextContent.push(normalized)
	})
	const richTextJson: JSONContent = serializeWechatChatContent({
		type: "doc",
		content: richTextContent,
	})
	collectMentionAttrs(richTextJson, mentions)

	// Require structured file/folder mention identity, not portable markdown hrefs.
	// Absolute workspace paths, canvas-relative paths, and opaque asset refs can all
	// round-trip through metadata even when external plain-text links are unavailable.
	// 独立元素标签和非文件 Mention 也有结构语义，不能回退为浏览器纯文本。
	const containsInspector = (node: JSONContent): boolean =>
		node.type === INSPECTOR_DETAIL_TYPE ||
		node.type === WECHAT_CHAT_HISTORY ||
		Boolean(node.content?.some(containsInspector))
	if (mentions.length === 0 && !containsInspector({ type: "doc", content: richTextContent }))
		return null

	const metadata: MessageClipboardMetadata = {
		richText: JSON.stringify(richTextJson),
		sourceProjectId,
		mentions: mentions.map((attrs) => ({ attrs })),
	}
	const metadataBase64 = btoa(encodeURIComponent(JSON.stringify(metadata)))

	return {
		plainText: getClipboardPlainText(richTextJson, workspaceFiles, sourceProjectId),
		htmlWithMetadata: `<div data-magic-clipboard="${metadataBase64}">${getClipboardHtml(
			tempDiv.innerHTML,
			workspaceFiles,
			sourceProjectId,
		)}</div>`,
		metadata,
	}
}

function enrichRichTextMentions(
	node: JSONContent,
	enrichMentionAttrs: (attrs: TiptapMentionAttributes) => TiptapMentionAttributes,
): JSONContent {
	let next = node
	if (node.type === "mention" && node.attrs) {
		next = {
			...node,
			attrs: enrichMentionAttrs(node.attrs as TiptapMentionAttributes),
		}
	}
	if (node.type === INSPECTOR_DETAIL_TYPE && node.attrs) {
		for (const key of ["fileMention", "screenshotMention"] as const) {
			if (!node.attrs[key]) continue
			next = {
				...next,
				attrs: {
					...next.attrs,
					[key]: enrichMentionAttrs(node.attrs[key] as TiptapMentionAttributes),
				},
			}
		}
	}
	if (next.content?.length) {
		next = {
			...next,
			content: next.content.map((child) => enrichRichTextMentions(child, enrichMentionAttrs)),
		}
	}
	return next
}

export function writeMessageClipboardPayload(
	clipboardData: DataTransfer,
	payload: MessageClipboardPayload,
): void {
	clipboardData.setData("text/html", payload.htmlWithMetadata)
	clipboardData.setData("text/plain", payload.plainText)
	try {
		clipboardData.setData(MESSAGE_CLIPBOARD_RICH_TEXT_MIME, payload.metadata.richText)
		if (payload.metadata.mentions) {
			clipboardData.setData(
				MESSAGE_CLIPBOARD_MENTIONS_MIME,
				JSON.stringify(payload.metadata.mentions),
			)
		}
	} catch {
		// Browser/WebView may reject custom MIME types; standard formats remain available.
	}
}
