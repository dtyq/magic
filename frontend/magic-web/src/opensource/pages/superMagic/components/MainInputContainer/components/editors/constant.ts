import { MessageEditorLayoutConfig, ToolbarButton } from "../../../MessageEditor"

// 移动端布局配置
export const MOBILE_LAYOUT_CONFIG: MessageEditorLayoutConfig = {
	// top-left toolbar buttons: none
	topBarLeft: [],
	// bottom-left toolbar buttons: model switch + tools
	bottomLeft: [
		ToolbarButton.MODEL_SWITCH,
		ToolbarButton.INTERNET_SEARCH,
		ToolbarButton.AT,
		ToolbarButton.MCP,
		ToolbarButton.UPLOAD,
	],
	// bottom-right toolbar buttons: mic + send
	bottomRight: [ToolbarButton.VOICE_INPUT, ToolbarButton.SEND_BUTTON],
	// outside bottom area: none
	outsideBottom: [],
}
