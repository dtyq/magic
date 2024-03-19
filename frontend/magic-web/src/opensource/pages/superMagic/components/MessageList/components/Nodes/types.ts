import { TaskStatus, Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { MouseEvent } from "react"

export interface NodeProps {
	node: any
	/** 新版本点击事件 */
	onClick?: () => void
	prevNode?: any
	onSelectDetail?: (detail: any) => void
	isSelected?: boolean
	isShare?: boolean
	selectedTopic: Topic | null
	currentTopicStatus?: TaskStatus
	checkIsLastNode?: (messageId: string) => boolean
	checkIsLastMessage?: (messageId: string) => boolean
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
	onFileClick?: (fileItem: any) => void
	classNames?: {
		markdown?: string
	}
	/** Whether this node is newly inserted into the current message list render stream */
	isNewlyInserted?: boolean
	/** Stagger order for newly inserted nodes */
	entryAnimationOrder?: number
}
