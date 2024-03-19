import { MessageReceiveType } from "@/opensource/types/chat"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import type Conversation from "@/opensource/models/chat/conversation"
import GroupConversationItem from "../GroupConversationItem"
import UserConversationItem from "../UserConversationItem"
import AntdSkeleton from "@/opensource/components/base/AntdSkeleton"
import chatMenuStore from "@/opensource/stores/chatNew/chatMenu"

interface ConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
	enableMenu?: boolean
}

const SkeletonItem = (
	<AntdSkeleton
		style={{ padding: 4, width: "100%" }}
		avatar
		active
		title={{ style: { marginBlockStart: 0 } }}
		paragraph={{ rows: 1, width: "100%", style: { marginBlockStart: 4 } }}
	/>
)

const ConversationItem = (props: ConversationItemProps) => {
	const { conversationId, onClick, enableMenu = true } = props
	const conversation = conversationStore.conversations?.[conversationId]

	if (!conversation) {
		return SkeletonItem
	}

	const handleMenuToggle = () => {
		chatMenuStore.openMenu(conversationId)
	}

	const handleContextMenu = (e: React.MouseEvent) => {
		if (!enableMenu) return
		e.preventDefault()
		e.stopPropagation()
		chatMenuStore.openMenu(conversationId, "contextMenu")
	}

	const content =
		conversation.receive_type === MessageReceiveType.Group ? (
			<GroupConversationItem
				conversationId={conversationId}
				onClick={onClick}
				enableMenu={enableMenu}
				onMenuToggle={handleMenuToggle}
				onContextMenu={handleContextMenu}
			/>
		) : (
			<UserConversationItem
				conversationId={conversationId}
				onClick={onClick}
				enableMenu={enableMenu}
				onMenuToggle={handleMenuToggle}
				onContextMenu={handleContextMenu}
			/>
		)

	return content
}

export default ConversationItem
