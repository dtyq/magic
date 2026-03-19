/** 详情类型 */
export enum DetailType {
	Terminal = "terminal",
	Browser = "browser",
	Search = "search",
	Html = "html",
	Text = "text",
	Md = "md",
	Pdf = "pdf",
	Code = "code",
	Empty = "empty",
	Docx = "docx",
	Excel = "excel",
	PowerPoint = "powerpoint",
	Image = "image",
	Deleted = "deleted",
	NotSupport = "notSupport",
	FileTree = "file_tree",
	Video = "video",
	Audio = "audio",
	Design = "design",
}

/** 详情 */
export interface DetailData {
	[DetailType.Terminal]: DetailTerminalData
	[DetailType.Browser]: DetailBrowserData
	[DetailType.Search]: DetailSearchData
	[DetailType.Html]: DetailHTMLData
	[DetailType.Text]: DetailTextData
	[DetailType.Md]: DetailMDData
	[DetailType.Empty]: any
	[DetailType.Excel]: DetailUniverData
	[DetailType.PowerPoint]: DetailUniverData
	[DetailType.FileTree]: DetailFileTreeData
}

/** 终端 Terminal */
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

/** 浏览器 Browser */
export interface DetailBrowserData {
	url: string
	screenshot: string
	preview: string
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
	metadata?: Record<string, any>
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
