import type { Topic } from "@/pages/superMagic/pages/Workspace/types"

/** Returns true when topic is missing chat session ids required for message send/pull. */
export function topicNeedsChatDetailRestore(topic: Topic | null | undefined): boolean {
	return Boolean(topic?.id && (!topic.chat_topic_id || !topic.chat_conversation_id))
}
