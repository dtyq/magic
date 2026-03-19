import { ComponentType, lazy } from "react"

export const ToolsMap: Record<string, ComponentType<any>> = {
	// web_search: lazy(() => import("./WebSearch")),
	// shell_exec: lazy(() => import("./ShellExec")),
	// write_file: lazy(() => import("./WriteFile")),
	// edit_file_range: lazy(() => import("./EditFile")),
	// multi_edit_file_range: lazy(() => import("./EditFile")),
	// edit_file: lazy(() => import("./EditFile")),
	// finish_task: lazy(() => import("./FinishTask")),
	// list_dir: lazy(() => import("./ListDir")),
	// read_files: lazy(() => import("./ReadFiles")),
	// read_webpages_as_markdown: lazy(() => import("./ReadWebAsMarkdown")),
	audio_understanding_progress: lazy(() =>
		import("./AudioUnderstandingProgress").then((module) => ({
			default: module.AudioUnderstandingProgress,
		})),
	),
	audio_understanding: lazy(() =>
		import("./AudioUnderstandingProgress").then((module) => ({
			default: module.AudioUnderstandingProgress,
		})),
	),
	mcp_init: lazy(() =>
		import("./MCP").then((module) => ({
			default: module.MCPInit,
		})),
	),
	mcp_tool_call: lazy(() =>
		import("./MCP").then((module) => ({
			default: module.MCPToolCall,
		})),
	),
	todo_create: lazy(() => import("./TodoWrite")),
	todo_write: lazy(() => import("./TodoWrite")),
	todo_update: lazy(() => import("./TodoWrite")),
}
