import type { PopoverProps } from "antd"
import { Popover } from "antd"
import type { GroupInfo } from "@/types/organization"
import { MessageReceiveType } from "@/types/chat"
import { observer } from "mobx-react-lite"
import conversationStore from "@/stores/chatNew/conversation"
import { memo } from "react"
import useStyles from "./styles"
import UserPopoverContent from "./popoverContent/user"
import GroupPopoverContent from "./popoverContent/group"
import AiPopoverContent from "./popoverContent/ai"
import { ChatDomId } from "../../constants"

export interface ChatMenuProps extends PopoverProps {
	group?: GroupInfo
	conversationId: string
}

const ChatMenuContent = observer(({ conversationId }: ChatMenuProps) => {
	const { conversations } = conversationStore
	const conversation = conversations[conversationId]
	switch (conversation?.receive_type) {
		case MessageReceiveType.Ai:
			return (
				<AiPopoverContent
					receiveId={conversation?.receive_id}
					conversationId={conversationId}
				/>
			)
		case MessageReceiveType.User:
			return <UserPopoverContent conversationId={conversationId} />
		case MessageReceiveType.Group:
			return <GroupPopoverContent conversationId={conversationId} />
		default:
			return null
	}
})

const ChatMenu = memo(function ChatMenu({ conversationId, children, ...props }: ChatMenuProps) {
	const { styles } = useStyles()

	return (
		<Popover
			classNames={{ root: styles.popover }}
			placement="bottomLeft"
			arrow={false}
			content={<ChatMenuContent conversationId={conversationId} />}
			trigger="click"
			autoAdjustOverflow
			getPopupContainer={() => document.getElementById(ChatDomId.ChatContainer)!}
			{...props}
		>
			{children}
		</Popover>
	)
})

export default ChatMenu
