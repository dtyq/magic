import {
	BrainCircuit,
	MonitorCloud,
	Search,
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
	Shapes,
	CandlestickChart,
} from "lucide-react"
import type { ToolIconConfig } from "./types"
import { AgentIcon, ImageSearch, SkillIcon, DefaultIcon } from "./CustomIcons"
import createFieldIcon from "@/pages/superMagic/assets/tool_icon/create_field.svg"
import createTableIcon from "@/pages/superMagic/assets/tool_icon/create_table.svg"
import deleteFieldIcon from "@/pages/superMagic/assets/tool_icon/delete_field.svg"
import deleteTableIcon from "@/pages/superMagic/assets/tool_icon/delete_table.svg"
import queryTableIcon from "@/pages/superMagic/assets/tool_icon/query_table.svg"
import updateFieldIcon from "@/pages/superMagic/assets/tool_icon/update_field.svg"
import updateTablePermissionsIcon from "@/pages/superMagic/assets/tool_icon/update_table_permissions.svg"
import viewTableIcon from "@/pages/superMagic/assets/tool_icon/view_table.svg"
import longMemoryIcon from "@/pages/superMagic/assets/tool_icon/long_memory.svg"
import todoWriteIcon from "@/pages/superMagic/assets/tool_icon/todo_write.svg"
import legacyFileMusicIcon from "@/pages/superMagic/assets/tool_icon/builtin-file-music-002bff.svg"
import legacyFileTextIcon from "@/pages/superMagic/assets/tool_icon/builtin-file-text-9747ff.svg"
import legacySkillIconIcon from "@/pages/superMagic/assets/tool_icon/builtin-skill-icon-00b5c2.svg"
import legacyPresentationIcon from "@/pages/superMagic/assets/tool_icon/builtin-presentation-ff7c35.svg"
import legacyCloudDownloadIcon from "@/pages/superMagic/assets/tool_icon/builtin-cloud-download-76d700.svg"
import legacySparklesIcon from "@/pages/superMagic/assets/tool_icon/builtin-sparkles-a109ff.svg"
import legacyAgentIconIcon from "@/pages/superMagic/assets/tool_icon/builtin-agent-icon-4b4efc.svg"
import legacyListTodoIcon from "@/pages/superMagic/assets/tool_icon/builtin-list-todo-00cbd5.svg"
import { platformToolIconGroups } from "./platformIcons"
import { builtinToolIconGroups } from "./builtinIcons"

// 两种渲染入口均读取这份配置；SVG 已包含背景和 12px 图形，不能再套一层底色。
const assetToolIconMap: Record<string, ToolIconConfig> = Object.fromEntries(
	[...platformToolIconGroups, ...builtinToolIconGroups].flatMap(([assetUrl, toolNames]) =>
		toolNames.map((toolName) => [
			toolName,
			{ icon: DefaultIcon, bgColor: "transparent", assetUrl } satisfies ToolIconConfig,
		]),
	),
)

/**
 * 工具图标配置映射
 * 基于 Figma 设计规范：https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=96-61394
 */
export const toolIconMap: Record<string, ToolIconConfig> = {
	create_client_side_file_bundle: { icon: FileBox, bgColor: "#285AFF" },
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

	// 微应用流程
	micro_app_plan: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: todoWriteIcon,
	},
	update_html_app_memory: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: longMemoryIcon,
	},

	// 数据表操作
	query_magicbase_tables: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: queryTableIcon,
	},
	get_magicbase_table: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: viewTableIcon,
	},
	create_magicbase_table: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: createTableIcon,
	},
	create_magicbase_column: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: createFieldIcon,
	},
	update_magicbase_table_permissions: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: updateTablePermissionsIcon,
	},
	delete_magicbase_table: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: deleteTableIcon,
	},
	update_magicbase_column: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: updateFieldIcon,
	},
	delete_magicbase_column: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: deleteFieldIcon,
	},
	query_magicbase_rows: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: queryTableIcon,
	},
	batch_get_magicbase_rows: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: queryTableIcon,
	},
	get_magicbase_row: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: viewTableIcon,
	},
	create_magicbase_row: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: createTableIcon,
	},
	update_magicbase_row: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: updateFieldIcon,
	},
	batch_create_magicbase_rows: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: createTableIcon,
	},
	delete_magicbase_row: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: deleteTableIcon,
	},
	batch_delete_magicbase_rows: {
		icon: DefaultIcon,
		bgColor: "transparent",
		assetUrl: deleteTableIcon,
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
		assetUrl: legacyCloudDownloadIcon,
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
	video_generation_progress: {
		icon: Shapes,
		bgColor: "#3D74FF",
	},

	// 内容生成
	generate_image: {
		icon: Sparkles,
		bgColor: "#A109FF",
	},
	generate_images: {
		icon: Sparkles,
		bgColor: "#A109FF",
		assetUrl: legacySparklesIcon,
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
		assetUrl: legacyPresentationIcon,
	},
	create_slide: {
		icon: Presentation,
		bgColor: "#FF7C35",
		assetUrl: legacyPresentationIcon,
	},
	setup_audio_project: {
		icon: FileMusic,
		bgColor: "#002BFF",
		assetUrl: legacyFileMusicIcon,
	},
	analyze_audio_project: {
		icon: FileMusic,
		bgColor: "#002BFF",
		assetUrl: legacyFileMusicIcon,
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
		assetUrl: legacyFileTextIcon,
	},

	// TODO 管理
	todo_create: {
		icon: ListTodo,
		bgColor: "#00CBD5",
	},
	todo_read: {
		icon: ListTodo,
		bgColor: "#00CBD5",
		assetUrl: legacyListTodoIcon,
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
		icon: DefaultIcon,
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
		assetUrl: legacySkillIconIcon,
	},
	upload_skill: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
		assetUrl: legacySkillIconIcon,
	},
	edit_skill: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
		assetUrl: legacySkillIconIcon,
	},
	skills_read: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
	},
	read_skills: {
		icon: SkillIcon,
		bgColor: "#00B5C2",
		assetUrl: legacySkillIconIcon,
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
		assetUrl: legacyAgentIconIcon,
	},
	update_agent: {
		icon: AgentIcon,
		bgColor: "#4B4EFC",
		assetUrl: legacyAgentIconIcon,
	},
	...assetToolIconMap,
	call_subagent: {
		icon: AgentIcon,
		bgColor: "#4B4EFC",
		assetUrl: legacyAgentIconIcon,
	},
	wait_for_subagents: {
		icon: AgentIcon,
		bgColor: "#4B4EFC",
		assetUrl: legacyAgentIconIcon,
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
