import type { SaveConfirmationStage } from "./contents/HTML/hooks/useSaveConfirmation"

/** 已验证完整内容的只读供数入口，不承担草稿或保存职责。 */
export interface TextReadOnlyPreview {
	content: string
	refresh: () => Promise<void>
}

/** 详情类型 */
export enum DetailType {
	Terminal = "terminal",
	ScriptExecution = "script_execution",
	Browser = "browser",
	Search = "search",
	KnowledgeSearch = "knowledge_search",
	Html = "html",
	Text = "text",
	Md = "md",
	Pdf = "pdf",
	Code = "code",
	Empty = "empty",
	Docx = "docx",
	Doc = "doc",
	Excel = "excel",
	PowerPoint = "powerpoint",
	Image = "image",
	Deleted = "deleted",
	NotSupport = "notSupport",
	FileTree = "file_tree",
	Video = "video",
	Audio = "audio",
	Design = "design",
	SelfMedia = "self-media",
	AICard = "ai-card",
	SlidesTemplate = "slides-template",
	Subagents = "subagents",
	OperationResultList = "operation_result_list",
	FileDownload = "file_download",
}

/** 等待子智能体卡片里的一行，字段与后端 SubagentItemContent 一一对应 */
export interface DetailSubagentItem {
	agent_id: string
	label: string
	/** pending / running / done / error / interrupted / not_found / ambiguous */
	status: string
	elapsed_seconds?: number
	last_activity?: string
	result?: string
	error?: string
}

/** 等待子智能体卡片，字段与后端 SubagentsContent 一一对应 */
export interface DetailSubagentsData {
	/** 已结束个数占比，0-100；不是工作量进度 */
	progress: number
	/** 只等一个时没有中间进度，显示转圈而不是 0% */
	indeterminate: boolean
	message: string
	total_agents: number
	finished_agents: number
	elapsed_seconds: number
	phase: "waiting" | "settled"
	agents: DetailSubagentItem[]
}

export interface FileDownloadItem {
	file_id: string
	relative_file_path: string
	file_name: string
	file_size: number
}

export interface FileDownloadData {
	title: string
	archive_name: string
	project_id: string
	total_bytes: number
	items: FileDownloadItem[]
}

/** Self-media platform values supported by the dispatcher */
export type SelfMediaPlatform =
	| "rednote"
	| "instagram"
	| "x"
	| "facebook"
	| "wechat-official-accounts"
	| "tiktok"
	| "wechat-channels"

/** In-memory one-shot target when opening self-media from the file tree */
export interface SelfMediaInitialNavigation {
	activePostId: string
	initialView: "detail"
	/** If omitted, the store picks the first slice that declares the post */
	activePlatform?: SelfMediaPlatform
}

/** In-memory one-shot target when opening ai-card from the file tree */
export interface AICardInitialNavigation {
	activeCardId?: string
	initialView?: "detail" | "dashboard"
}

/** Self-media folder detail payload */
export interface DetailSelfMediaData {
	file_id: string
	file_name?: string
	is_directory?: boolean
	metadata?: Record<string, unknown>
	children?: unknown[]
	/** Optional jump target when opening a nested post from the file tree */
	initialNavigation?: SelfMediaInitialNavigation
	[key: string]: unknown
}

/** 详情 */
export interface DetailData {
	[DetailType.FileDownload]: FileDownloadData
	[DetailType.Terminal]: DetailTerminalData
	[DetailType.ScriptExecution]: DetailScriptExecutionData
	[DetailType.Browser]: DetailBrowserData
	[DetailType.Search]: DetailSearchData
	[DetailType.KnowledgeSearch]: any
	[DetailType.Html]: DetailHTMLData
	[DetailType.Text]: DetailTextData
	[DetailType.Md]: DetailMDData
	[DetailType.Empty]: any
	[DetailType.Excel]: DetailUniverData
	[DetailType.PowerPoint]: DetailUniverData
	[DetailType.SlidesTemplate]: DetailHTMLData
	[DetailType.FileTree]: DetailFileTreeData
	[DetailType.OperationResultList]: DetailOperationResultListData
}

export interface OperationResultCanvasTarget {
	type: "canvas_element"
	project_path: string
	element_id: string
	content_id?: string
	content_type?: "image" | "video" | "audio"
}

export interface OperationResultFileTarget {
	type: "file"
	relative_file_path: string
}

export interface OperationResultUrlTarget {
	type: "url"
	url: string
}

export type OperationResultTarget =
	OperationResultCanvasTarget | OperationResultFileTarget | OperationResultUrlTarget

/** 操作结果显示对象名称与执行状态，可选提供稳定的导航目标。 */
export interface OperationResultItem {
	label: string
	kind: "file" | "directory" | "text"
	status: "success" | "error" | "skipped"
	message: string
	description?: string
	target?: OperationResultTarget
	changes?: { added_lines: number; deleted_lines: number; modified_lines?: number }
	started_at?: string
	expected_finished_at?: string
	is_processing?: boolean | null
}

export interface OperationResultSummary {
	stage?: "read" | "edit" | "find" | "download" | "analyze" | "load"
	total_count?: number
	success_count?: number
	failed_count?: number
	skipped_count?: number
	omitted_count?: number
}

export interface DetailOperationResultListItemsData extends OperationResultSummary {
	items: OperationResultItem[]
}

/** 正文与文件化引用保持顶层结构，卡片只提供原有 Markdown 详情入口。 */
export interface DetailOperationResultListReportData extends DetailOperationResultListItemsData {
	file_name: string
	content: string
	file_id?: string
	storage_type?: string
	file_extension?: string
	target_file_path?: string
	report_type?: DetailType
}

export type DetailOperationResultListData =
	DetailOperationResultListItemsData | DetailOperationResultListReportData

/** 终端 Terminal */
export interface TerminalToolInfo {
	id: string
	action: string
	remark: string
}

export interface DetailTerminalData {
	action: "execute" | string
	finished: boolean
	shellId: string
	command: string
	outputType?: "append" | string
	output: string
	code: string
	exit_code: number
}

/** Python 脚本执行详情。代码、标准输出和标准错误保持独立，避免前端重新猜测文本来源。 */
export interface DetailScriptExecutionData {
	code: string
	args?: string | null
	stdout: string
	stderr: string
	exit_code: number
	success: boolean
}

/** 浏览器 Browser */
export interface DetailBrowserAttachment {
	file_key?: string
	file_url?: string
	file_id?: string | null
}

export interface DetailBrowserData {
	url: string
	title?: string
	file_id?: string | null
	file_key?: string | null
	screenshot?: string
	preview?: string
	action?: string
	summary?: string
	detail?: string
	page_title?: string
	target?: string
	status?: "succeeded" | "failed"
}

/** MD文件 TextEditor */
export interface DetailMdData {
	action: "write" | "update" | string
	path: string
	content: string
	oldContent?: string
}

/** 搜索 Search */
export interface DetailSearchData {
	data: {
		favicon?: string
		title: string
		link: string
		snippet: string
	}[]
}

/** 参数 Arguments */
export interface DetailArgumentsData {
	command: string
	file: string
	path: string
	content?: string
}

/** 超文本标记语言 HTML */
export interface DetailHTMLData {
	file_name?: string
	file_id: string
	file_extension?: string
	content?: string
	display_config?: Record<string, any>
}

/** 工具 Tool */
export interface DetailToolData {
	name: string
	action: string
}

/** 文本 Text */
export interface DetailTextData {
	content: string
}

/** 富文本 MD */
export interface DetailMDData {
	content: string
}

export interface DetailTodoData {
	content: string
}

/** Univer数据 */
export interface DetailUniverData {
	content: any
	file_name: string
	file_extension?: string
	file_id?: string
	file_url?: string
}

/** 文件树数据 */
export interface DetailFileTreeData {
	root_path: string
	level: number
	filter_binary: boolean
	total_files: number
	total_dirs: number
	total_size: number
	tree: FileTreeNode[]
}

/** 文件树节点 */
export interface FileTreeNode {
	file_name: string
	relative_file_path: string
	is_directory: boolean
	file_size: number | null
	updated_at: string
	children: FileTreeNode[] | null
	type: "file" | "directory"
	error: string | null
}

/** 文本预览复用原 UI；外部会话独占内容、草稿与修订基准，保存失败必须 reject。 */
export interface TextFileSession {
	content: string
	draft: string
	loading: boolean
	loadError: boolean
	saving: boolean
	/** Drives the top-right save chip; omitted sessions never show save feedback. */
	saveStage?: SaveConfirmationStage
	setDraft: (content: string) => void
	refresh: () => Promise<void>
	save: () => Promise<void>
}
