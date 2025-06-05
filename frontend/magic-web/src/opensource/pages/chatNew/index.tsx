// React 相关
import { observer } from "mobx-react-lite"

// 组件
import EmptyState from "./components/EmptyState"
import ChatContainer from "./components/ChatContainer"

// Store 和服务
import conversationStore from "@/opensource/stores/chatNew/conversation"

// Hooks 和工具
import useNavigateConversationByAgentIdInSearchQuery from "./hooks/navigateConversationByAgentId"
import { usePanelSizes } from "./hooks/usePanelSizes"

const ChatNew = observer(() => {
	useNavigateConversationByAgentIdInSearchQuery()

	const { sizes, totalWidth, mainMinWidth, handleSiderResize, handleInputResize } =
		usePanelSizes()

	if (!conversationStore.currentConversation) {
		return <EmptyState />
	}

	return (
		<ChatContainer
			sizes={sizes}
			totalWidth={totalWidth}
			mainMinWidth={mainMinWidth}
			onSiderResize={handleSiderResize}
			onInputResize={handleInputResize}
		/>
	)
})

export default ChatNew
