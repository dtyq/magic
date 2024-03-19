import useMacTouch from "@/opensource/hooks/useMacTouch"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import { lazy } from "react"

const EmptyState = lazy(() => import("./components/EmptyState"))
const ChatContainer = lazy(() => import("./components/ChatContainer"))

const ChatNew = observer(() => {
	useMacTouch()

	// 没有当前会话，显示缺省页
	if (!conversationStore.currentConversation) {
		return <EmptyState />
	}

	// 有当前会话，显示聊天页面
	return <ChatContainer />
})

export default ChatNew
