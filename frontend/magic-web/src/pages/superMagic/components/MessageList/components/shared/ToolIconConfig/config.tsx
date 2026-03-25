import {
	BrainCircuit,
	MonitorCloud,
	Search,
	Plug,
	FileScan,
	FilePlus,
	FilePenLine,
	Trash2,
	FolderSearch2,
	FileSearch,
	TextSearch,
	SquareTerminal,
	FileTerminal,
	AppWindow,
	CloudDownload,
	ScanEye,
	Sparkles,
	FileBox,
	Gauge,
	Presentation,
	AudioWaveform,
	FileMusic,
	BrainCog,
	FileText,
	ListTodo,
	ListChecks,
	Frame,
	Shapes,
	Layers3,
	LayoutGrid,
	HelpCircle,
	CandlestickChart,
} from "lucide-react"
import type { ToolIconConfig } from "./types"
import { AgentIcon, ImageSearch, SkillIcon } from "./CustomIcons"

/**
 * 工具图标配置映射
 * 基于 Figma 设计规范：https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=96-61394
 */
export const toolIconMap: Record<string, ToolIconConfig> = {
	// AI 思考相关
	agent_think: {
		icon: BrainCircuit,
		bgColor: "#5E39F4",
	},

	// 虚拟机初始化
	init_virtual_machine: {
		icon: MonitorCloud,
		bgColor: "#6B84FF",
	},

	// MCP 工具调用
	mcp_tool_call: {
		icon: Plug,
		bgColor: "#242424",
	},
	mcp_init: {
		icon: Plug,
		bgColor: "#242424",
	},

	// 金融分析
	financial_analysis: {
		icon: CandlestickChart,
		bgColor: "#F55B5E",
	},

	// 文件操作
	read_files: {
		icon: FileScan,
		bgColor: "#3FCCFF",
	},
	read_file: {
		icon: FileScan,
		bgColor: "#3FCCFF",
	},
	write_file: {
		icon: FilePlus,
		bgColor: "#285AFF",
	},
	write_to_file: {
		icon: FilePlus,
		bgColor: "#285AFF",
	},
	edit_file: {
		icon: FilePenLine,
		bgColor: "#00CEB9",
	},
	multi_edit_file: {
		icon: FilePenLine,
		bgColor: "#00CEB9",
	},
	replace_in_file: {
		icon: FilePenLine,
		bgColor: "#00CEB9",
	},
	delete_files: {
		icon: Trash2,
		bgColor: "#FF3F59",
	},
	delete_file: {
		icon: Trash2,
		bgColor: "#FF3F59",
	},
	list_dir: {
		icon: FolderSearch2,
		bgColor: "#FD57B0",
	},
	file_search: {
		icon: FileSearch,
		bgColor: "#FFAF3F",
	},
	filebase_search: {
		icon: FileSearch,
		bgColor: "#FFAF3F",
	},
	grep_search: {
		icon: TextSearch,
		bgColor: "#FF623F",
	},

	// 代码执行
	shell_exec: {
		icon: SquareTerminal,
		bgColor: "#341F8E",
	},
	run_python_snippet: {
		icon: FileTerminal,
		bgColor: "#484A6F",
	},
	python_execute: {
		icon: FileTerminal,
		bgColor: "#484A6F",
	},

	// Web 搜索和获取
	web_search: {
		icon: Search,
		bgColor: "#00B38C",
	},
	bing_search: {
		icon: Search,
		bgColor: "#00B38C",
	},
	image_search: {
		icon: ImageSearch,
		bgColor: "#00ABE5",
	},
	read_webpages_as_markdown: {
		icon: AppWindow,
		bgColor: "#FF7E29",
	},
	use_browser_read_as_markdown: {
		icon: AppWindow,
		bgColor: "#FF7E29",
	},
	use_browser_read_more_as_markdown: {
		icon: AppWindow,
		bgColor: "#FF7E29",
	},
	use_browser: {
		icon: AppWindow,
		bgColor: "#FF7E29",
	},
	download_from_urls: {
		icon: CloudDownload,
		bgColor: "#76D700",
	},
	download_from_markdown: {
		icon: CloudDownload,
		bgColor: "#76D700",
	},
	download_from_url: {
		icon: CloudDownload,
		bgColor: "#76D700",
	},

	// 内容理解
	visual_understanding: {
		icon: ScanEye,
		bgColor: "#6430FF",
	},
	audio_understanding: {
		icon: AudioWaveform,
		bgColor: "#3583FF",
	},
	audio_understanding_progress: {
		icon: AudioWaveform,
		bgColor: "#3583FF",
	},

	// 内容生成
	generate_image: {
		icon: Sparkles,
		bgColor: "#A109FF",
	},

	// 文件转换
	convert_to_markdown: {
		icon: FileBox,
		bgColor: "#3586FF",
	},
	convert_pdf: {
		icon: FileBox,
		bgColor: "#3586FF",
	},

	// 项目创建
	create_dashboard_project: {
		icon: Gauge,
		bgColor: "#8335FF",
	},
	update_dashboard_template: {
		icon: Gauge,
		bgColor: "#8335FF",
	},
	backup_dashboard_template: {
		icon: Gauge,
		bgColor: "#8335FF",
	},
	validate_dashboard: {
		icon: Gauge,
		bgColor: "#8335FF",
	},
	create_slide_project: {
		icon: Presentation,
		bgColor: "#FF7C35",
	},
	create_slide: {
		icon: Presentation,
		bgColor: "#FF7C35",
	},
	setup_audio_project: {
		icon: FileMusic,
		bgColor: "#002BFF",
	},
	analyze_audio_project: {
		icon: FileMusic,
		bgColor: "#002BFF",
	},
	create_design_project: {
		icon: Frame,
		bgColor: "#484848",
	},

	// 设计画布操作
	create_canvas_element: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	update_canvas_element: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	delete_canvas_element: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	query_canvas_element: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	batch_create_canvas_elements: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	batch_update_canvas_elements: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	generate_images_to_canvas: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	search_images_to_canvas: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},
	reorder_canvas_elements: {
		icon: Layers3,
		bgColor: "#FF7300",
	},
	query_canvas_overview: {
		icon: LayoutGrid,
		bgColor: "#FC4B9A",
	},

	// 记忆管理
	create_memory: {
		icon: BrainCog,
		bgColor: "#17B1CD",
	},
	update_memory: {
		icon: BrainCog,
		bgColor: "#17B1CD",
	},
	delete_memory: {
		icon: BrainCog,
		bgColor: "#17B1CD",
	},
	long_memory: {
		icon: BrainCog,
		bgColor: "#17B1CD",
	},

	// 历史记录
	compact_chat_history: {
		icon: FileText,
		bgColor: "#9747FF",
	},

	// TODO 管理
	todo_create: {
		icon: ListTodo,
		bgColor: "#00CBD5",
	},
	todo_read: {
		icon: ListTodo,
		bgColor: "#00CBD5",
	},
	todo_write: {
		icon: ListTodo,
		bgColor: "#00CBD5",
	},
	todo_update: {
		icon: ListChecks,
		bgColor: "#0ACD65",
	},

	// 默认图标
	default: {
		icon: HelpCircle,
		bgColor: "#333333",
	},
	thinking: {
		icon: BrainCircuit,
		bgColor: "#5E39F4",
	},
	reasoning: {
		icon: BrainCircuit,
		bgColor: "#5E39F4",
	},
	create_skill: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	upload_skill: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	edit_skill: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	skills_read: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	read_skills: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	skill_read_references: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	skill_list: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	get_agent_info: {
		icon: AgentIcon,
		bgColor: "#4B4EFC",
	},
	update_agent: {
		icon: AgentIcon,
		bgColor: "#4B4EFC",
	},
}

/**
 * 获取工具图标配置
 * @param toolName 工具名称
 * @returns 工具图标配置
 */
export function getToolIconConfig(toolName?: string): ToolIconConfig {
	if (!toolName) {
		return toolIconMap.default
	}

	return toolIconMap[toolName] ?? toolIconMap.default
}
