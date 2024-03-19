import { memo } from "react"
import { isEmpty } from "lodash-es"
import {
	StandardTool,
	ThinkingTool,
	WriteToFileTool,
	WebSearchTool,
	TerminalTool,
	McpTool,
} from "./components/Tools"
import type { ToolProps } from "./types"
import McpInitTool from "./components/Tools/McpInitTool"

// Define special tool types that need specific visual treatment
const SPECIAL_TOOL_TYPES = {
	THINKING: "thinking",
	WRITE_TO_FILE: "write_to_file",
	WEB_SEARCH: "web_search",
	BING_SEARCH: "bing_search",
	REPLACE_IN_FILE: "replace_in_file",
	EDIT_FILE: "edit_file",
	MULTI_EDIT_FILE: "multi_edit_file",
	TERMINAL: "shell_exec",
	VISUAL_UNDERSTANDING: "visual_understanding",
	MCP: "mcp_tool_call",
	MCP_INIT: "mcp_init",
	TEXT_TO_IMAGE: "text_to_image",
	IMAGE_EDIT: "image_edit",
} as const

function Tool({ data }: ToolProps) {
	// Early return if no content to display
	if (isEmpty(data?.action) && isEmpty(data?.remark)) {
		return null
	}

	const toolName = data?.name || ""
	const isLoading = data?.status !== "finished"

	// Common props for all tool components
	const commonProps = {
		identifier: toolName,
		action: data.action || "",
		remark: data.remark || "",
		url: data.url,
		loading: isLoading,
		detail: data.detail,
		id: data?.id,
	}

	switch (toolName) {
		case SPECIAL_TOOL_TYPES.THINKING:
			return <ThinkingTool {...commonProps} />
		case SPECIAL_TOOL_TYPES.WRITE_TO_FILE:
		case SPECIAL_TOOL_TYPES.REPLACE_IN_FILE:
		case SPECIAL_TOOL_TYPES.EDIT_FILE:
		case SPECIAL_TOOL_TYPES.VISUAL_UNDERSTANDING:
		case SPECIAL_TOOL_TYPES.MULTI_EDIT_FILE:
			// case SPECIAL_TOOL_TYPES.TEXT_TO_IMAGE:
			// case SPECIAL_TOOL_TYPES.IMAGE_EDIT:
			return <WriteToFileTool {...commonProps} />
		case SPECIAL_TOOL_TYPES.WEB_SEARCH:
		case SPECIAL_TOOL_TYPES.BING_SEARCH:
			return <WebSearchTool {...commonProps} />
		case SPECIAL_TOOL_TYPES.TERMINAL:
			return <TerminalTool {...commonProps} />
		case SPECIAL_TOOL_TYPES.MCP:
			return <McpTool {...commonProps} />
		case SPECIAL_TOOL_TYPES.MCP_INIT:
			return <McpInitTool {...commonProps} />
		default:
			return <StandardTool {...commonProps} />
	}
}

export default memo(Tool)
