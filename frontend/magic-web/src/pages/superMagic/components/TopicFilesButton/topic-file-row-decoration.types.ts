import type { ReactNode } from "react"
import type { AttachmentItem } from "./hooks/types"
import type { TreeNodeData } from "./utils/treeDataConverter"

export interface TopicFileRowDecorationContext {
	item: AttachmentItem
	node: TreeNodeData
	isVirtual: boolean
}

export interface TopicFileRowDecoration {
	icon?: ReactNode
	tag?: ReactNode
}

export interface TopicFileRowDecorationResolver {
	(context: TopicFileRowDecorationContext): TopicFileRowDecoration | null | undefined
}
