import Topic from "@/models/chat/topic"
import TopicService from "@/services/chat/topic/class"
import topicStore from "@/stores/chatNew/topic"
import ConversationStore from "@/stores/chatNew/conversation"

class TopicDispatchService {
	// 创建话题
	createTopic(conversationId: string, topic: Topic) {
		if (ConversationStore.currentConversation?.id === conversationId) {
			topicStore.unshiftTopic(topic)
		}
	}

	// 更新话题
	updateTopic(conversationId: string, topicId: string, updates: Partial<Topic>) {
		if (ConversationStore.currentConversation?.id === conversationId) {
			topicStore.updateTopic(topicId, updates)
		}
	}
}

export default new TopicDispatchService()
