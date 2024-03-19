import { MessageEditorSize } from "../types"

export const BUTTON_PADDING_CLASS_MAP = new Map<MessageEditorSize, string>([
	["small", "p-1"],
	["default", "p-2"],
	["mobile", "p-2"],
])

export const getButtonPaddingClass = (size: MessageEditorSize) => {
	return BUTTON_PADDING_CLASS_MAP.get(size) || "p-2"
}
