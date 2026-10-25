/**
 * @deprecated Import from `@/utils/messageClipboardSerializer` instead.
 * Kept as a thin re-export so Canvas-local relative imports keep working.
 */
export {
	MESSAGE_CLIPBOARD_RICH_TEXT_MIME,
	MESSAGE_CLIPBOARD_MENTIONS_MIME,
	getMentionClipboardRepresentation,
	getClipboardPlainText,
	getClipboardHtml,
	serializeMessageClipboard,
	writeMessageClipboardPayload,
} from "@/utils/messageClipboardSerializer"

export type {
	MessageClipboardMentionItem,
	MessageClipboardMetadata,
	MessageClipboardPayload,
	SerializeMessageClipboardOptions,
} from "@/utils/messageClipboardSerializer"
