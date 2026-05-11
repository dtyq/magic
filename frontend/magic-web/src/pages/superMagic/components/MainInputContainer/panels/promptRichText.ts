import type { JSONContent } from "@tiptap/react"
import {
	getMentionDisplayName,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"

export const PROMPT_PRESET_VALUE_TOKEN = "{preset_value}"
export const PROMPT_PRESET_VALUE_NODE_NAME = "promptPresetValue"

const DOC_NODE_TYPE = "doc"
const PARAGRAPH_NODE_TYPE = "paragraph"
const TEXT_NODE_TYPE = "text"
const HARD_BREAK_NODE_TYPE = "hardBreak"
const CARET_GUARD_TEXT = "\u200b"

function createEmptyPromptRichTextDoc(): JSONContent {
	return {
		type: DOC_NODE_TYPE,
		content: [{ type: PARAGRAPH_NODE_TYPE }],
	}
}

function isPromptRichTextDoc(value: unknown): value is JSONContent {
	if (!value || typeof value !== "object") return false
	const type = (value as { type?: unknown }).type
	return type === DOC_NODE_TYPE
}

function createParagraphNode(text: string): JSONContent {
	if (!text) return { type: PARAGRAPH_NODE_TYPE }
	return {
		type: PARAGRAPH_NODE_TYPE,
		content: [{ type: TEXT_NODE_TYPE, text }],
	}
}

function normalizeTextValue(text: string): string {
	return text.replace(/\r\n?/g, "\n")
}

function getDocumentFromPlainText(text: string): JSONContent {
	const normalized = normalizeTextValue(text)
	const lines = normalized.split("\n")

	return {
		type: DOC_NODE_TYPE,
		content: lines.map((line) => createParagraphNode(line)),
	}
}

function getNormalizedPromptRichTextDoc(content: JSONContent | null | undefined): JSONContent {
	if (!isPromptRichTextDoc(content)) return createEmptyPromptRichTextDoc()
	if (!Array.isArray(content.content) || content.content.length === 0) {
		return createEmptyPromptRichTextDoc()
	}
	return content
}

function removeCaretGuard(text: string): string {
	return text.replace(/\u200b/g, "")
}

function getPlainTextFromNode(node: JSONContent | null | undefined): string {
	if (!node) return ""

	if (node.type === TEXT_NODE_TYPE) {
		return removeCaretGuard(node.text ?? "")
	}

	if (node.type === HARD_BREAK_NODE_TYPE) {
		return "\n"
	}

	if (node.type === "mention") {
		const displayName = getMentionDisplayName((node.attrs ?? {}) as TiptapMentionAttributes)
		return displayName ? `@${displayName}` : "@"
	}

	if (node.type === PROMPT_PRESET_VALUE_NODE_NAME) {
		return PROMPT_PRESET_VALUE_TOKEN
	}

	const childText = Array.isArray(node.content)
		? node.content.map((child) => getPlainTextFromNode(child)).join("")
		: ""

	if (node.type === DOC_NODE_TYPE) {
		const blocks = Array.isArray(node.content)
			? node.content.map((child) => getPlainTextFromNode(child))
			: []
		return blocks.join("\n")
	}

	return childText
}

function hasSemanticContent(node: JSONContent | null | undefined): boolean {
	if (!node) return false

	if (node.type === TEXT_NODE_TYPE) {
		return removeCaretGuard(node.text ?? "").trim().length > 0
	}

	if (node.type === "mention" || node.type === PROMPT_PRESET_VALUE_NODE_NAME) {
		return true
	}

	if (!Array.isArray(node.content)) return false
	return node.content.some((child) => hasSemanticContent(child))
}

export function parsePromptRichText(value: string | null | undefined): JSONContent {
	if (!value) return createEmptyPromptRichTextDoc()

	const trimmed = value.trim()
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		try {
			const parsed = JSON.parse(trimmed)
			if (isPromptRichTextDoc(parsed)) {
				return getNormalizedPromptRichTextDoc(parsed)
			}
		} catch {
			// Fallback to legacy plain text handling.
		}
	}

	return getDocumentFromPlainText(value)
}

export function serializePromptRichText(content: JSONContent | null | undefined): string {
	return JSON.stringify(getNormalizedPromptRichTextDoc(content))
}

export function serializePromptRichTextLocaleValue(
	content: JSONContent | null | undefined,
): string {
	const normalized = getNormalizedPromptRichTextDoc(content)
	return isPromptRichTextEmpty(normalized) ? "" : serializePromptRichText(normalized)
}

export function getPromptRichTextPlainText(value: string | JSONContent | null | undefined): string {
	const doc = typeof value === "string" ? parsePromptRichText(value) : value
	return getPlainTextFromNode(getNormalizedPromptRichTextDoc(doc)).trim()
}

export function isPromptRichTextEmpty(value: string | JSONContent | null | undefined): boolean {
	const doc = typeof value === "string" ? parsePromptRichText(value) : value
	return !hasSemanticContent(getNormalizedPromptRichTextDoc(doc))
}

export function maybeResolvePromptRichTextPlainText(value: string | undefined): string | undefined {
	if (typeof value !== "string" || !value.trim()) return value

	const trimmed = value.trim()
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return value

	try {
		const parsed = JSON.parse(trimmed)
		if (!isPromptRichTextDoc(parsed)) return value
		return getPromptRichTextPlainText(parsed)
	} catch {
		return value
	}
}
