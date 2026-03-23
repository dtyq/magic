import { MessageReceiveType } from "@/types/chat"
import conversationStore from "@/stores/chatNew/conversation"
import type Conversation from "@/models/chat/conversation"
import GroupConversationItem from "../GroupConversationItem"
import UserConversationItem from "../UserConversationItem"
import AntdSkeleton from "@/components/base/AntdSkeleton"
import chatMenuStore from "@/stores/chatNew/chatMenu"

interface ConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
	enableMenu?: boolean
	/** 用于 DOM id 前缀（如 "message" / "aibots"），避免列表间同 id 重复导致右键菜单定位错误 */
	domIdPrefix?: string
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
	const { conversationId, onClick, enableMenu = true, domIdPrefix } = props
	const conversation = conversationStore.conversations?.[conversationId]

	if (!conversation) {
		return SkeletonItem
	}

	const menuElementId = domIdPrefix ? `${domIdPrefix}-${conversationId}` : undefined

	const handleMenuToggle = () => {
		chatMenuStore.openMenu(conversationId, "click", menuElementId)
	}

	const handleContextMenu = (e: React.MouseEvent) => {
		if (!enableMenu) return
		e.preventDefault()
		e.stopPropagation()
		chatMenuStore.openMenu(conversationId, "contextMenu", menuElementId)
	}

	const content =
		conversation.receive_type === MessageReceiveType.Group ? (
			<GroupConversationItem
				conversationId={conversationId}
				onClick={onClick}
				enableMenu={enableMenu}
				onMenuToggle={handleMenuToggle}
				onContextMenu={handleContextMenu}
				domIdPrefix={domIdPrefix}
			/>
		) : (
			<UserConversationItem
				conversationId={conversationId}
				onClick={onClick}
				enableMenu={enableMenu}
				onMenuToggle={handleMenuToggle}
				onContextMenu={handleContextMenu}
				domIdPrefix={domIdPrefix}
			/>
		)

	return content
}

export default ConversationItem
