import { FetchTopicsParams } from "@/pages/superMagic/hooks/useTopics"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { Dispatch, SetStateAction } from "react"

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
	topics: Topic[]
	className?: string
	fetchTopics: (params: FetchTopicsParams) => void
	setTopics: Dispatch<SetStateAction<Topic[]>>
	setSelectedTopic?: (topic: Topic) => void
	setSelectedProject?: (project: ProjectListItem) => void
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	setUserSelectDetail?: (detail: any) => void
	handleCreateTopic?: () => void
	selectedWorkspace?: Workspace | null
	projects?: ProjectListItem[]
}
