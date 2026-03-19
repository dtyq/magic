import { JSONContent } from "@tiptap/react"

export interface TipTapEditorData {
	// html: string
	// json: JSONContent
	// text: string
	markdown: string
}

export interface AgentEditorProps {
	agent: any
	value?: string
	onChange?: (value: string) => void
	onSave?: (data: TipTapEditorData) => void
	onReady?: () => void
	setEditorAgent: (agent: any) => void
	setLoading: (loading: boolean) => void
	loading: boolean
}

export interface AgentEditorRef {
	setData: (data: JSONContent | string) => Promise<void>
	getData: () => Promise<string | null>
	clear: () => Promise<void>
	focus: () => void
}

export interface MarkdownBlock {
	type: string
	data: Record<string, any>
}

export interface MarkdownConverterOptions {
	includeImages?: boolean
	includeEmbeds?: boolean
	preserveFormatting?: boolean
}

export interface EditorToolConfig {
	placeholder?: string
	levels?: number[]
	defaultLevel?: number
	defaultStyle?: string
	quotePlaceholder?: string
	captionPlaceholder?: string
	titlePlaceholder?: string
	messagePlaceholder?: string
	endpoint?: string
	endpoints?: {
		byFile?: string
		byUrl?: string
	}
	services?: Record<string, boolean>
	rows?: number
	cols?: number
}

// 内置的Agent模式
export enum AgentBuiltInMode {
	/** 通用模式 */
	General = "general",
	/** 聊天模式 */
	Chat = "chat",
	/** 数据分析 */
	DataAnalysis = "data_analysis",
	/** PPT */
	PPT = "ppt",
	/** 研报模式 */
	Report = "report",
	/** 录音总结 */
	Summary = "summary",
}
