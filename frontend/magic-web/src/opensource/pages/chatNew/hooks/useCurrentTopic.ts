import conversationStore from "@/opensource/stores/chatNew/conversation"
import topicStore from "@/opensource/stores/chatNew/topic"

const useCurrentTopic = () => {
	const { currentConversation: conversation } = conversationStore

	return conversation?.current_topic_id
		? topicStore.topicList.find((i) => i.id === conversation.current_topic_id)
		: undefined
}

export default useCurrentTopic
