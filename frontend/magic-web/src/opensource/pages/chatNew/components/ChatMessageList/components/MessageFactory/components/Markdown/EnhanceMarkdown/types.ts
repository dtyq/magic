import type { ComponentType } from "react"

export interface MarkdownProps {
	content?: string
	allowHtml?: boolean
	enableLatex?: boolean
	isSelf?: boolean
	hiddenDetail?: boolean
	isStreaming?: boolean
	className?: string
	components?: Record<string, ComponentType<any>>
}
