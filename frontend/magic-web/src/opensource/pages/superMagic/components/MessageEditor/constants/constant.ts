import { ToolbarButton, MessageEditorLayoutConfig } from "../types"

export const EDITOR_BUTTON_SIZE_MAP = {
	small: 14,
	default: 20,
	mobile: 20,
} as const

export const EDITOR_ICON_SIZE_MAP = {
	small: 16,
	default: 16,
	mobile: 16,
} as const

export const TOP_BAR_ICON_SIZE_MAP = {
	small: 12,
	default: 16,
	mobile: 16,
} as const

export const GAP_SIZE_MAP = {
	small: 4,
	default: 4,
	mobile: 4,
} as const

// Default layout configuration
export const DEFAULT_LAYOUT_CONFIG: Required<MessageEditorLayoutConfig> = {
	topBarLeft: [ToolbarButton.DRAFT_BOX, ToolbarButton.AT],
	topBarRight: [ToolbarButton.TOKEN_USAGE],
	bottomLeft: [ToolbarButton.MODEL_SWITCH],
	outsideTop: [],
	bottomRight: [
		ToolbarButton.INTERNET_SEARCH,
		ToolbarButton.MCP,
		ToolbarButton.UPLOAD,
		ToolbarButton.DIVIDER,
		ToolbarButton.VOICE_INPUT,
		ToolbarButton.EDITOR_MODE_SWITCH,
		ToolbarButton.SEND_BUTTON,
	],
	outsideBottom: [],
}

// Default mobile layout configuration
export const DEFAULT_MOBILE_LAYOUT_CONFIG = {
	topBarLeft: [ToolbarButton.DRAFT_BOX, ToolbarButton.AT],
	bottomLeft: [ToolbarButton.INTERNET_SEARCH, ToolbarButton.MCP, ToolbarButton.UPLOAD],
	outsideBottom: [ToolbarButton.MODEL_SWITCH],
	bottomRight: [
		ToolbarButton.VOICE_INPUT,
		ToolbarButton.EDITOR_MODE_SWITCH,
		ToolbarButton.SEND_BUTTON,
	],
	outsideTop: [],
}
