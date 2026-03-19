import { MessageReceiveType } from "@/types/chat"
import { type HTMLAttributes } from "react"
import { observer } from "mobx-react-lite"
import conversationStore from "@/stores/chatNew/conversation"
import UserHeader from "./UserHeader/index.user"
import AiHeader from "./AiHeader/index.ai"
import GroupHeader from "./GroupHeader/index.group"

interface HeaderProps extends HTMLAttributes<HTMLDivElement> { }

const Header = observer((props: HeaderProps) => {
	const { currentConversation: conversation } = conversationStore

	switch (conversation?.receive_type) {
		case MessageReceiveType.Ai:
			return <AiHeader conversation={conversation} {...props} />
		case MessageReceiveType.User:
			return <UserHeader conversation={conversation} {...props} />
		case MessageReceiveType.Group:
			return <GroupHeader conversation={conversation} {...props} />
		default:
			return null
	}
})

export default Header
