import type { RefObject } from "react"
import type { HierarchicalWorkspacePopupRef } from "@/opensource/pages/superMagicMobile/components/HierarchicalWorkspacePopup/types"

export interface ChatItem {
	id: string
	title: string
	subtitle: string
	icon?: string
}

export interface ChatDrawerProps {
	open: boolean
	onClose: () => void
	hierarchicalWorkspacePopupRef?: RefObject<HierarchicalWorkspacePopupRef>
}

export interface SwipeableChatItemProps {
	item: ChatItem
	isActive: boolean
	onSwipeStart: (id: string) => void
	onMore: (id: string) => void
	onPin: (id: string) => void
	onDelete: (id: string) => void
}
