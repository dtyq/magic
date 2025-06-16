import ConversationStore from "@/opensource/stores/chatNew/conversation"

class ConversationDsipatchService {
	/**
	 * 置顶会话
	 */
	setTopConversationStatus(conversationId: string, isTop: 0 | 1) {
		// 更新会话状态（包含分组移动逻辑）
		ConversationStore.updateTopStatus(conversationId, isTop)
	}

	/**
	 * 设置会话免打扰状态
	 */
	setNotDisturbStatus(conversationId: string, isNotDisturb: 0 | 1) {
		ConversationStore.updateConversationDisturbStatus(conversationId, isNotDisturb)
	}
}

export default new ConversationDsipatchService()
