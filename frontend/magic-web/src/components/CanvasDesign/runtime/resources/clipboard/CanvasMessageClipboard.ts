import type {
	CanvasClipboardMediaType,
	CanvasClipboardAsset,
} from "./CanvasClipboardPasteController"
import {
	MESSAGE_CLIPBOARD_MENTIONS_MIME,
	MESSAGE_CLIPBOARD_RICH_TEXT_MIME,
} from "@/utils/messageClipboardSerializer"

const MESSAGE_MIME_TYPES = new Set([
	MESSAGE_CLIPBOARD_RICH_TEXT_MIME,
	MESSAGE_CLIPBOARD_MENTIONS_MIME,
])

type MentionLike = {
	type?: unknown
	data?: unknown
}

type MessageClipboardMetadata = {
	mentions?: unknown
	richText?: unknown
	plainText?: string
}

export type CanvasClipboardMessagePart =
	| {
			kind: "text"
			text: string
	  }
	| {
			kind: "asset"
			occurrenceKey: string
			asset: Omit<CanvasClipboardAsset, "key">
			fallbackText: string
	  }

function decodeMetadata(value: string): MessageClipboardMetadata | null {
	try {
		return normalizeMetadata(JSON.parse(decodeURIComponent(atob(value))))
	} catch {
		return null
	}
}

function parseHtmlMetadata(html: string): MessageClipboardMetadata | null {
	const match = html.match(/data-magic-clipboard=["']([^"']+)["']/i)
	return match ? decodeMetadata(match[1]) : null
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value)
	} catch {
		return null
	}
}

function getDataByType(data: DataTransfer, type: string): string {
	if (typeof data.getData !== "function") return ""
	const exact = data.getData(type)
	if (exact) return exact
	const matchedType = Array.from(data.types ?? []).find(
		(candidate) => candidate.trim().toLowerCase() === type.toLowerCase(),
	)
	return matchedType ? data.getData(matchedType) : ""
}

function normalizeMetadata(value: unknown): MessageClipboardMetadata | null {
	if (!value || typeof value !== "object") return null
	const metadata = value as MessageClipboardMetadata
	const hasRichText = typeof metadata.richText === "string" && metadata.richText.trim().length > 0
	const hasMentions = Array.isArray(metadata.mentions) && metadata.mentions.length > 0
	return hasRichText || hasMentions ? metadata : null
}

function getMetadataCandidatesFromData(data: DataTransfer): MessageClipboardMetadata[] {
	if (typeof data.getData !== "function") return []
	const candidates: MessageClipboardMetadata[] = []
	const html = getDataByType(data, "text/html")
	const htmlMetadata = html ? parseHtmlMetadata(html) : null
	if (htmlMetadata) {
		const normalized = normalizeMetadata(htmlMetadata)
		if (normalized) candidates.push(normalized)
	}

	const richText = getDataByType(data, MESSAGE_CLIPBOARD_RICH_TEXT_MIME)
	const mentions = getDataByType(data, MESSAGE_CLIPBOARD_MENTIONS_MIME)
	const plainText = getDataByType(data, "text/plain")
	if (richText || mentions) {
		const candidate = normalizeMetadata({
			richText: richText || undefined,
			mentions: mentions ? parseJson(mentions) : undefined,
			plainText: plainText || undefined,
		})
		if (candidate) candidates.push(candidate)
	}

	return candidates
}

function mediaType(
	fileName: string,
	extension?: unknown,
	explicitType?: unknown,
): CanvasClipboardMediaType | null {
	if (explicitType === "image" || explicitType === "video" || explicitType === "audio") {
		return explicitType
	}
	const value = String(extension || fileName.split(".").pop() || "").toLowerCase()
	if (/^(png|jpe?g|gif|webp|bmp|avif|heic|heif|svg)$/.test(value)) return "image"
	if (/^(mp4|mov|webm|avi|mkv|m4v)$/.test(value)) return "video"
	if (/^(mp3|wav|ogg|m4a|aac|flac)$/.test(value)) return "audio"
	return null
}

function normalizeMention(value: unknown): Omit<CanvasClipboardAsset, "key"> | null {
	if (!value || typeof value !== "object") return null
	const mention = (value as { attrs?: unknown }).attrs
	const attrs = (mention && typeof mention === "object" ? mention : value) as MentionLike
	if ((attrs as Record<string, unknown>).pending === true) return null
	if (attrs.type !== "project_file" && attrs.type !== "upload_file") return null
	if (!attrs.data || typeof attrs.data !== "object") return null
	const data = attrs.data as Record<string, unknown>
	if (data.pending === true) return null
	const fileName = String(data.file_name || data.filename || "").trim()
	const sourceFileId = String(data.source_file_id || data.file_id || "").trim() || undefined
	const projectPath = String(data.file_path || data.relative_file_path || "").trim() || undefined
	const sourceProjectId =
		String(data.source_project_id || data.project_id || "").trim() || undefined
	const resourceIdentity = sourceFileId || projectPath
	const type = mediaType(fileName, data.file_extension, data.media_type)
	if (!type || !resourceIdentity || !fileName) return null
	return {
		type,
		mimeType: `${type}/octet-stream`,
		fileName,
		sourceProjectId,
		sourceFileId,
		resourceIdentity,
		projectPath,
		sourcePath: data.relative_file_path ? String(data.relative_file_path) : projectPath,
		origin: "message-reference",
	}
}

function getMentionFallbackText(value: unknown): string {
	if (!value || typeof value !== "object") return ""
	const mention = (value as { attrs?: unknown }).attrs
	const attrs = (mention && typeof mention === "object" ? mention : value) as MentionLike
	const data =
		attrs.data && typeof attrs.data === "object" ? (attrs.data as Record<string, unknown>) : {}
	const name = String(
		data.file_name ||
			data.filename ||
			data.directory_name ||
			data.name ||
			(attrs as Record<string, unknown>).label ||
			"",
	).trim()
	return name ? `@${name}` : ""
}

function appendMessageText(parts: CanvasClipboardMessagePart[], text: string): void {
	if (!text) return
	const previous = parts[parts.length - 1]
	if (previous?.kind === "text") previous.text += text
	else parts.push({ kind: "text", text })
}

function getMentionAttrs(value: unknown): MentionLike | null {
	if (!value || typeof value !== "object") return null
	const mention = (value as { attrs?: unknown }).attrs
	const attrs = mention && typeof mention === "object" ? mention : value
	return attrs && typeof attrs === "object" ? (attrs as MentionLike) : null
}

function parseMentionList(
	mentions: unknown[],
	parts: CanvasClipboardMessagePart[],
	startIndex = 0,
): boolean {
	let valid = true
	mentions.forEach((mention, index) => {
		const asset = normalizeMention(mention)
		const fallbackText = getMentionFallbackText(mention)
		if (asset) {
			const occurrenceKey = `${asset.resourceIdentity || asset.sourcePath || asset.fileName}\0${startIndex + index}`
			parts.push({ kind: "asset", occurrenceKey, asset, fallbackText })
		} else if (fallbackText) {
			appendMessageText(parts, fallbackText)
		} else {
			valid = false
		}
	})
	return valid
}

function parseRichTextParts(
	value: unknown,
	parts: CanvasClipboardMessagePart[],
	mentionIndex: { value: number },
): boolean {
	if (!value || typeof value !== "object") return false
	const node = value as Record<string, unknown>
	const type = typeof node.type === "string" ? node.type : ""

	if (type === "text") {
		appendMessageText(parts, typeof node.text === "string" ? node.text : "")
		return true
	}
	if (type === "hardBreak" || type === "hard_break") {
		appendMessageText(parts, "\n")
		return true
	}
	if (type === "mention") {
		const attrs = getMentionAttrs(node)
		if (!attrs) return false
		if ((attrs as Record<string, unknown>).pending === true) return true
		const asset = attrs ? normalizeMention(attrs) : null
		const fallbackText = getMentionFallbackText(attrs)
		if (asset) {
			const occurrenceKey = `${asset.resourceIdentity || asset.sourcePath || asset.fileName}\0${mentionIndex.value++}`
			parts.push({
				kind: "asset",
				occurrenceKey,
				asset,
				fallbackText,
			})
		} else if (fallbackText) {
			appendMessageText(parts, fallbackText)
		} else {
			return false
		}
		return true
	}
	if (type === "super-placeholder") {
		const props = safeRecord(node.attrs)?.props
		const placeholderProps = safeRecord(props)
		appendMessageText(
			parts,
			String(
				placeholderProps?.value ||
					placeholderProps?.defaultValue ||
					placeholderProps?.placeholder ||
					"",
			),
		)
		return true
	}
	if (type === "inspector-detail") {
		const attrs = safeRecord(node.attrs)
		const lines: string[] = []
		if (attrs?.selector) lines.push(`selector: ${String(attrs.selector)}`)
		if (attrs?.size) lines.push(`size: ${String(attrs.size)}`)
		if (attrs?.textContent) lines.push(`textContent: "${String(attrs.textContent)}"`)
		if (lines.length > 0) appendMessageText(parts, `${lines.join("\n")}\n`)
		return true
	}

	const content = node.content
	let valid = type.length > 0
	if (Array.isArray(content)) {
		content.forEach((child) => {
			if (!parseRichTextParts(child, parts, mentionIndex)) valid = false
		})
	} else if (
		type !== "doc" &&
		type !== "paragraph" &&
		type !== "blockquote" &&
		type !== "listItem"
	) {
		valid = false
	}
	if (type === "paragraph" || type === "blockquote" || type === "listItem") {
		appendMessageText(parts, "\n")
	}
	return valid
}

function safeRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export function hasMessageClipboardMimeType(
	eventOrTypes?: ClipboardEvent | readonly string[],
): boolean {
	if (!eventOrTypes) return false
	const types =
		typeof eventOrTypes === "object" && "clipboardData" in eventOrTypes
			? [
					...Array.from(eventOrTypes.clipboardData?.types ?? []),
					...Array.from(eventOrTypes.clipboardData?.items ?? []).map((item) => item.type),
				]
			: eventOrTypes
	return types.some((type) => MESSAGE_MIME_TYPES.has(type.trim().toLowerCase()))
}

export function hasMessageClipboardData(event?: ClipboardEvent): boolean {
	if (!event?.clipboardData) return false
	return readMessageClipboardContent(event).recognized
}

export function readMessageClipboardContent(event: ClipboardEvent | undefined): {
	recognized: boolean
	parts: CanvasClipboardMessagePart[]
} {
	const candidates = event?.clipboardData
		? getMetadataCandidatesFromData(event.clipboardData)
		: []
	if (candidates.length === 0) return { recognized: false, parts: [] }

	for (const metadata of candidates) {
		const parts: CanvasClipboardMessagePart[] = []
		const richText = typeof metadata.richText === "string" ? parseJson(metadata.richText) : null
		const isRichTextDocument =
			richText &&
			typeof richText === "object" &&
			(richText as Record<string, unknown>).type === "doc" &&
			Array.isArray((richText as Record<string, unknown>).content)
		if (isRichTextDocument) {
			if (!parseRichTextParts(richText, parts, { value: 0 })) continue
		} else if (Array.isArray(metadata.mentions) && metadata.mentions.length > 0) {
			if (!parseMentionList(metadata.mentions, parts)) continue
		} else {
			continue
		}

		while (
			parts[parts.length - 1]?.kind === "text" &&
			parts[parts.length - 1]?.text.endsWith("\n")
		) {
			const last = parts[parts.length - 1]
			if (last?.kind !== "text") break
			last.text = last.text.replace(/\n$/, "")
			if (!last.text) parts.pop()
		}
		return { recognized: true, parts }
	}

	return { recognized: false, parts: [] }
}

export function readMessageClipboardAssets(event: ClipboardEvent | undefined): {
	recognized: boolean
	assets: Array<Omit<CanvasClipboardAsset, "key">>
} {
	const content = readMessageClipboardContent(event)
	return {
		recognized: content.recognized,
		assets: content.parts
			.filter(
				(part): part is Extract<CanvasClipboardMessagePart, { kind: "asset" }> =>
					part.kind === "asset",
			)
			.map((part) => part.asset),
	}
}
