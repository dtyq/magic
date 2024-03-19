import { Topic, ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { ReactNode } from "react"

export interface TopicItem {
	id: string
	title: string
	icon: TopicIcon
	mode: TopicMode
	time?: string
	onClick?: () => void
	onMenuClick?: () => void
}

export interface TopicGroup {
	title: string
	items: Topic[]
}

export interface TopicIcon {
	type: "super-magic" | "file-description" | "chart-bar-popular" | "presentation"
	color: string
	backgroundColor: string
	borderColor: string
}

export interface TopicMode {
	name: string
	color: string
	backgroundColor: string
	borderColor: string
}

export interface TopicListProps {
	className?: string
	topicFilesCore: ReactNode
	openActionsPopup: (topic: Topic, project: ProjectListItem | null | undefined) => void
}
