// Common tool data interface
export interface ToolData {
	name?: string
	action?: string
	remark?: string
	url?: string
	status?: string
	detail?: Record<string, any>
	id?: string
}

// Tool category types
export type ToolCategory = "thinking" | "file-operation" | "web-search" | "standard"

// Common props for all tool components
export interface BaseToolProps {
	identifier: string
	action: string
	remark?: string | React.ReactNode
	url?: string
	loading?: boolean
	id?: string
}

// Main Tool component props
export interface ToolProps {
	data: ToolData
}
