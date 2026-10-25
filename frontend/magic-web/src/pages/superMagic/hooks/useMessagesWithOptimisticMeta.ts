import { useMemo } from "react"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"

/**
 * Attaches the local send status (sending / failed) to user messages so the message list can draw the
 * status icon. Must be called from a mobx observer component: it reads the optimistic store during render.
 * Without this, a failed send leaves no visible trace and no retry entry.
 */
export function useMessagesWithOptimisticMeta<T extends { app_message_id?: string }>(
	chatTopicId: string | undefined,
	messages: T[],
) {
	const topicOptimisticMessages = chatTopicId
		? optimisticMessageStore.topicOptimisticMap[chatTopicId]
		: undefined

	return useMemo(() => {
		return messages.map((message) => {
			const optimisticStatus = chatTopicId
				? topicOptimisticMessages?.[message?.app_message_id || ""]?.status
				: undefined
			if (!optimisticStatus) return message

			return {
				...message,
				optimisticMeta: {
					status: optimisticStatus,
				},
			}
		})
	}, [chatTopicId, messages, topicOptimisticMessages])
}
