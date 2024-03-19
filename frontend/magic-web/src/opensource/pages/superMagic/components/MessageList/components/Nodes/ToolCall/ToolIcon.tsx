import defaultToolIcon from "@/opensource/pages/superMagic/assets/tool_icon/default.svg"

const iconModules = import.meta.glob<string>(
	"/src/opensource/pages/superMagic/assets/tool_icon/*.svg",
	{ import: "default" },
)

const iconNameMap: Record<string, string> = {
	shell_exec: "shell_exec",
	list_dir: "list_dir",
	use_browser_get_interactive_elements: "use_browser_get_interactive_elements",
	use_browser_input_text: "input_text",
	use_browser_read_as_markdown: "read_as_markdown",
	use_browser_read_more_as_markdown: "read_more_as_markdown",
	fetch_xiaohongshu_data: "fetch_xiaohongshu_data",
	fetch_zhihu_article_detail: "fetch_zhihu_article_detail",
	read_file: "read_file",
	read_files: "read_file",
	filebase_read_file: "read_file",
	wechat_article_search: "wechat_article_search",
	bing_search: "bing_search",
	web_search: "bing_search",
	image_search: "bing_search",
	use_browser_click: "click",
	file_search: "file_search",
	use_browser: "read_more_as_markdown",
	read_webpages_as_markdown: "read_more_as_markdown",
	use_browser_goto: "goto",
	python_execute: "python_execute",
	run_python_snippet: "python_execute",
	replace_in_file: "replace_in_file",
	edit_file: "replace_in_file",
	edit_file_range: "replace_in_file",
	multi_edit_file_range: "replace_in_file",
	multi_edit_file: "replace_in_file",
	delete_file: "delete_file",
	delete_files: "delete_file",
	finish_task: "finish_task",
	use_browser_scroll_page_down: "use_browser_scroll_page_down",
	use_browser_scroll_page_up: "use_browser_scroll_page_up",
	write_to_file: "write_to_file",
	write_file: "write_to_file",
	grep_search: "file_search",
	default: "default",
	thinking: "thinking",
	filebase_search: "file_search",
	reasoning: "reasoning",
	download_from_url: "download_from_url",
	download_from_urls: "download_from_url",
	visual_understanding: "visual_understanding",
	mcp_tool_call: "mcp",
	mcp_init: "mcp",
	create_memory: "long_memory",
	update_memory: "long_memory",
	delete_memory: "long_memory",
	audio_understanding_progress: "audio_understanding_progress",
	audio_understanding: "audio_understanding_progress",
	init_virtual_machine: "init_virtual_machine",
	todo_create: "todo_write",
	todo_update: "todo_write",
	todo_write: "todo_write",
	generate_image: "generate_image",
	long_memory: "long_memory",
	agent_think: "agent_think",
	create_design_project: "create_design_project",
	create_canvas_element: "create_design_project",
	update_canvas_element: "create_design_project",
	batch_create_canvas_elements: "create_design_project",
	batch_update_canvas_elements: "create_design_project",
	reorder_canvas_elements: "create_design_project",
	query_canvas_overview: "create_design_project",
	query_canvas_element: "create_design_project",
	generate_images_to_canvas: "create_design_project",
	search_images_to_canvas: "create_design_project",
	query_dashboard_cards: "list_dir",
	create_dashboard_cards: "write_to_file",
	delete_dashboard_cards: "delete_file",
	update_dashboard_cards: "write_to_file",
	backup_dashboard_template: "write_to_file",
	update_dashboard_template: "write_to_file",
	create_dashboard_project: "list_dir",
	validate_dashboard: "finish_task",
	download_dashboard_maps: "download_from_url",
}

/**
 * 支持的工具图标
 */
export const supportedToolIcons: string[] = Object.keys(iconNameMap)

export function loadToolIcon(toolName?: string): Promise<string> {
	const iconName = iconNameMap[toolName ?? ""] ?? "default"
	const iconPath = `/src/opensource/pages/superMagic/assets/tool_icon/${iconName}.svg`
	const loader = iconModules[iconPath]

	if (loader) return loader()

	return Promise.resolve(defaultToolIcon)
}

export { defaultToolIcon }

// 保持向后兼容的同步导出，返回默认图标
export const ToolIcon: Record<string, string> = {
	default: defaultToolIcon,
}
