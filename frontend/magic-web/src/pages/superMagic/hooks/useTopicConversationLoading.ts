import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { isObject } from "lodash-es"
import { reaction } from "mobx"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"

interface TopicMessagesChangePayload<TStatus = unknown> {
	isLoading: boolean
	lastMessage?: SuperMagicMessageItem
	lastMessageNode?: {
		status?: TStatus
		[key: string]: unknown
	}
	selectedTopic?: Topic | null
	topicMessages: SuperMagicMessageItem[]
}

interface UseTopicConversationLoadingParams<TStatus = unknown> {
	hideLoadingWhenBufferHasContent?: boolean
	onConversationGeneratingChange?: (isGenerating: boolean) => void
	onTopicMessagesChange?: (payload: TopicMessagesChangePayload<TStatus>) => void
	selectedTopic?: Topic | null
}

export function useTopicConversationLoading<TStatus = unknown>({
	hideLoadingWhenBufferHasContent = false,
	onConversationGeneratingChange,
	onTopicMessagesChange,
	selectedTopic,
}: UseTopicConversationLoadingParams<TStatus>) {
	const [showLoading, setShowLoading] = useState(false)
	const messages = (superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") ||
		[]) as SuperMagicMessageItem[]

	const handleTopicMessagesChange = useMemoizedFn((topicMessages: SuperMagicMessageItem[]) => {
		if (topicMessages.length > 1) {
			const lastMessageWithRole = topicMessages.findLast(
				(message) => message.role === "assistant",
			)
			const lastMessage = topicMessages[topicMessages.length - 1]
			const lastMessageNode = superMagicStore.getMessageNode(
				lastMessageWithRole?.app_message_id,
			)

			const isLoading =
				lastMessageNode?.status === "running" ||
				lastMessage?.type === "rich_text" ||
				isObject(lastMessageNode?.content) ||
				Boolean(lastMessageNode?.rich_text?.content) ||
				Boolean(lastMessageNode?.text?.content)

			setShowLoading(isLoading)

			onTopicMessagesChange?.({
				isLoading,
				lastMessage,
				lastMessageNode:
					lastMessageNode as TopicMessagesChangePayload<TStatus>["lastMessageNode"],
				selectedTopic,
				topicMessages,
			})
		} else if (topicMessages.length === 1) {
			setShowLoading(true)
		}
	})

	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessages) => {
				handleTopicMessagesChange(topicMessages as SuperMagicMessageItem[])
			},
		)
	}, [handleTopicMessagesChange, selectedTopic?.chat_topic_id])

	useEffect(() => {
		if (!hideLoadingWhenBufferHasContent) {
			return
		}

		return reaction(
			() => superMagicStore.buffer.get(selectedTopic?.chat_topic_id || ""),
			(next) => {
				if (next && next.length > 0) {
					setShowLoading(false)
				}
			},
		)
	}, [hideLoadingWhenBufferHasContent, selectedTopic?.chat_topic_id])

	useEffect(() => {
		setShowLoading(false)
		onConversationGeneratingChange?.(false)
	}, [onConversationGeneratingChange, selectedTopic?.chat_topic_id])

	useEffect(() => {
		onConversationGeneratingChange?.(showLoading)

		return () => {
			onConversationGeneratingChange?.(false)
		}
	}, [onConversationGeneratingChange, showLoading])

	return {
		messages,
		showLoading,
	}
}
