import Topic from "@/opensource/models/chat/topic"
import TopicService from "@/opensource/services/chat/topic/class"
import topicStore from "@/opensource/stores/chatNew/topic"
import ConversationStore from "@/opensource/stores/chatNew/conversation"

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
