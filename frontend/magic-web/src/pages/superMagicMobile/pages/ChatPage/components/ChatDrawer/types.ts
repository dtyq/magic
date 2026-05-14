import type { RefObject } from "react"
import type { HierarchicalWorkspacePopupRef } from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/types"
import type {
	CreatedProject,
	ProjectListItem,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"

export interface ChatItem {
	id: string
	title: string
	subtitle: string
	icon?: string
	isPinned?: boolean
}

export interface ChatDrawerProps {
	open: boolean
	onClose: () => void
	hierarchicalWorkspacePopupRef?: RefObject<HierarchicalWorkspacePopupRef>
	chatWorkspace: Workspace | null
	chatProjects: ProjectListItem[]
	isLoadingChatWorkspace?: boolean
	isLoadingChatProjects?: boolean
	refreshChatProjects: (options?: {
		pageSize?: number
		keyword?: string
		silent?: boolean
	}) => Promise<ProjectListItem[]>
	createProjectInChatWorkspace: (params: {
		projectMode: TopicMode
		workdir?: string
	}) => Promise<CreatedProject | null>
}

export interface SwipeableChatItemProps {
	item: ChatItem
	isSwiped?: boolean
	onSwipeChange?: (isSwiped: boolean) => void
	onSwipeStart: (id: string) => void
	onClick: (id: string) => void
	onMore: (id: string) => void
	onPin: (id: string) => void
	onDelete: (id: string) => void
}
