import type { ReactElement, ReactNode, RefObject } from "react"

export type HelpTone = "neutral" | "indigo" | "red" | "amber" | "teal"

export interface HelpReadingLinks {
	further?: ReactNode
	recommended?: ReactNode
}

export interface HelpLocation {
	scope: string
	path: string
}

export interface HelpDefinition {
	title: string
	summary: string
	subtitle?: string
	identity?: {
		name: string
		scope?: string
		location?: HelpLocation
		renderIcon: (size: number) => ReactNode
	}
	points?: readonly string[]
	tone?: HelpTone
	/** 仅在打开完整说明后调用，避免文件列表提前创建所有正文。 */
	renderBody: (reading?: HelpReadingLinks, identity?: HelpDefinition["identity"]) => ReactNode
}

export interface HelpDialogContentProps {
	id: string
	help: HelpDefinition
	navigation?: ReactNode
	articleKey?: string
	reading?: HelpReadingLinks
	contentRef?: RefObject<HTMLDivElement>
}

export interface HelpDialogProps extends HelpDialogContentProps {
	header?: { title: string; description?: string }
	onCloseAutoFocus: (event: Event) => void
	header?: { title: string; description?: string }
}

export interface ContextHelpProps {
	/** 标题按当前学习场景提供；默认使用通用帮助标题，文件用途只是其中一种内容。 */
	header?: HelpDialogProps["header"]
	help: HelpDefinition
	mode: "preview" | "dialog"
	children: ReactElement
	/** 在已挂载的对话框内渲染目录与正文，不能再创建 DialogContent。 */
	renderDialog?: (props: HelpDialogContentProps) => ReactNode
}
