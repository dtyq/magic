import { MessageEditorSize } from "../types"

export const EDITOR_SPAN_CLASS_MAP = new Map<MessageEditorSize, string>([
	["small", "p-[0.35rem] gap-[0.35rem]"],
	["default", "p-2 gap-2"],
	["mobile", "p-2 gap-2"],
])

export const getEditorSpanClass = (size: MessageEditorSize) => {
	return EDITOR_SPAN_CLASS_MAP.get(size) || "p-2"
}
