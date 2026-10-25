import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { copyWithMetadata } from "@/utils/clipboard-helpers"
import { createMessageClipboardPayloadFromContent } from "@/utils/messageClipboardSerializer"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { enrichCanvasMentionForClipboard } from "../../../runtime/resources/clipboard/enrichCanvasMentionForClipboard"
import {
	getCanvasResourceFileName,
	isOpaqueAssetReference,
} from "../../../runtime/shared/path/canvasResourcePath"
import { createReferenceResourcePanelItem } from "../../editors/message/reference-assets/createReferenceResourcePanelItem"
import {
	parsePromptPlaceholderTokenMatches,
	type PromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import { getStringFromContent } from "../../editors/message/tiptap/contentUtils"
import { getFullscreenMediaFileLabel } from "../../fullscreen/shell/getFullscreenMediaFileLabel"

export interface HistoryPromptClipboardInput {
	text: string
	tokenConfig: PromptPlaceholderTokenConfig
	placeholderPaths: Partial<Record<PromptPlaceholderTokenKind, string[]>>
	resolveResourceReference?: ResolveCanvasResourceReference
}

function resolveHistoryPlaceholderFileName(path: string): string {
	if (isOpaqueAssetReference(path)) return path
	return getFullscreenMediaFileLabel(path) || getCanvasResourceFileName(path) || path
}

function appendTextNodes(nodes: JSONContent[], text: string): void {
	if (!text) return
	const lines = text.replace(/\r\n?/g, "\n").split("\n")
	lines.forEach((line, index) => {
		if (line) nodes.push({ type: "text", text: line })
		if (index < lines.length - 1) nodes.push({ type: "hardBreak" })
	})
}

function createHistoryMentionNode(
	path: string,
	fileName: string,
	mediaType: PromptPlaceholderTokenKind,
): JSONContent {
	const item = createReferenceResourcePanelItem({
		path,
		fileName,
		relativeFilePath: path,
		mediaType,
	})
	return {
		type: "mention",
		attrs: {
			type: item.type,
			data: item.data,
		},
	}
}

/**
 * History stores generation prompts as [图片1] tokens.
 * Rebuild the same mention JSON the canvas editor copies, so SuperMagic can rematch @files.
 */
export function buildHistoryPromptClipboardContent(
	input: HistoryPromptClipboardInput,
): JSONContent {
	const { text, tokenConfig, placeholderPaths } = input
	const nodes: JSONContent[] = []
	const matches = parsePromptPlaceholderTokenMatches(text, tokenConfig)
	let cursor = 0

	for (const match of matches) {
		if (match.start > cursor) {
			appendTextNodes(nodes, text.slice(cursor, match.start))
		}

		const path = placeholderPaths[match.kind]?.[match.index - 1]?.trim()
		const fileName = path ? resolveHistoryPlaceholderFileName(path) : ""
		if (path && fileName) {
			nodes.push(createHistoryMentionNode(path, fileName, match.kind))
		} else {
			appendTextNodes(nodes, match.rawText)
		}
		cursor = match.end
	}

	if (cursor < text.length) {
		appendTextNodes(nodes, text.slice(cursor))
	}

	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: nodes.length ? nodes : undefined,
			},
		],
	}
}

export async function copyHistoryPromptToClipboard(
	input: HistoryPromptClipboardInput,
): Promise<void> {
	const text = input.text
	if (!text.trim()) return

	const content = buildHistoryPromptClipboardContent(input)
	const payload = createMessageClipboardPayloadFromContent(content, {
		enrichMentionAttrs: (attrs: TiptapMentionAttributes) =>
			enrichCanvasMentionForClipboard(attrs, input.resolveResourceReference),
	})
	// Metadata restores mention chips; plain text keeps @fileName if rematch is unavailable.
	await copyWithMetadata(getStringFromContent(content) || payload.plainText, payload.metadata)
}
