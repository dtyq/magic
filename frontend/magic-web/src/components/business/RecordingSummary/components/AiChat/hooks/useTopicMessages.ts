import { useEffect, useRef, useState } from "react"
import { useMemoizedFn, useUpdateEffect, useDeepCompareEffect } from "ahooks"
import { reaction } from "mobx"
import { isEmpty, isObject } from "lodash-es"
import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SuperMagicApi } from "@/apis"

interface UseTopicMessagesParams {
	selectedTopic: Topic | null
	selectedWorkspace: { id: string } | null
	checkNowDebounced: () => void
}

interface UseTopicMessagesReturn {
	messages: any[]
	showLoading: boolean
	isShowLoadingInit: boolean
	handlePullMoreMessage: (topicInfo: Topic | null, callback?: () => void) => void
	updateTopicMessages: (options?: { refreshMessages?: boolean }) => void
}

export function useTopicMessages({
	selectedTopic,
	selectedWorkspace,
	checkNowDebounced,
}: UseTopicMessagesParams): UseTopicMessagesReturn {
	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})
	const topicPageTokenMap = useRef<Record<string, string>>({})
	const [showLoading, setShowLoading] = useState(false)
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)

	// Clean up on unmount
	useEffect(() => {
		return () => {
			topicPageTokenMap.current = {}
		}
	}, [])

	const pullMessage = useMemoizedFn(
		({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = 20,
			updatePageToken = true,
			refreshMessages = false,
			callback,
		}: {
			conversation_id: string
			chat_topic_id: string
			page_token: string
			order: "asc" | "desc"
			limit?: number
			updatePageToken?: boolean
			refreshMessages?: boolean
			callback?: () => void
		}) => {
			if (
				topicNotHaveMoreMessageMap.current[chat_topic_id] &&
				page_token &&
				updatePageToken
			) {
				console.log("没有更多消息")
				return
			}
			SuperMagicApi.getMessagesByConversationId({
				conversation_id,
				chat_topic_id,
				page_token,
				limit,
				order,
			}).then((res) => {
				const newMessage = res?.items
					.filter((item: any) => {
						return (
							item?.seq?.message?.general_agent_card ||
							item?.seq?.message?.text?.content ||
							item?.seq?.message?.rich_text?.content
						)
					})
					?.map((item: any) => {
						const data = item?.seq?.message?.general_agent_card
							? item?.seq?.message?.general_agent_card
							: item?.seq?.message
						return {
							...data,
							seq_id: item?.seq?.seq_id,
							messageStatus: item?.seq?.message?.status,
						}
					})
					.filter((item: any) => !isEmpty(item))
				const hasAttachments = newMessage.some(
					(item: any) =>
						item?.attachments?.length > 0 || item?.tool?.attachments?.length > 0,
				)
				if (hasAttachments) {
					checkNowDebounced()
				}
				if (updatePageToken && res?.page_token) {
					topicPageTokenMap.current[chat_topic_id] = res?.page_token
				}

				if (refreshMessages) {
					res?.items?.reverse()?.forEach((o: any) => {
						superMagicStore.enqueueMessage(chat_topic_id, o)
					})
				} else {
					superMagicStore.initializeMessages(chat_topic_id, res?.items)
				}
				callback?.()
			})
		},
	)

	const updateTopicMessages = useMemoizedFn(
		({ refreshMessages = false }: { refreshMessages?: boolean } = {}) => {
			if (selectedTopic?.id && selectedWorkspace?.id) {
				pullMessage({
					conversation_id: selectedTopic?.chat_conversation_id,
					chat_topic_id: selectedTopic?.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: 100,
					updatePageToken: true,
					refreshMessages,
				})
			}
		},
	)

	const handlePullMoreMessage = useMemoizedFn(
		(topicInfo: Topic | null, callback?: () => void) => {
			if (selectedWorkspace?.id && topicInfo) {
				pullMessage({
					conversation_id: topicInfo.chat_conversation_id,
					chat_topic_id: topicInfo.chat_topic_id,
					page_token: topicPageTokenMap.current[topicInfo?.chat_topic_id] || "",
					order: "desc",
					limit: 100,
					updatePageToken: true,
					callback,
				})
			}
		},
	)

	// Subscribe to WebSocket messages
	useEffect(() => {
		pubsub.subscribe("super_magic_new_message", (data: any) => {
			console.log("我接受到的 ws 消息", data)
			const { topic_id: chat_topic_id = "" } = data.message || {}

			if (selectedTopic?.chat_conversation_id && chat_topic_id) {
				pullMessage({
					conversation_id: selectedTopic?.chat_conversation_id,
					chat_topic_id: chat_topic_id,
					page_token: "",
					order: "desc",
					limit: 10,
					updatePageToken: false,
					refreshMessages: true,
				})
			}
		})
		return () => {
			pubsub?.unsubscribe("super_magic_new_message")
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic])

	// Update messages when topic changes
	useDeepCompareEffect(() => {
		updateTopicMessages()
	}, [selectedTopic])

	// Handle message refresh after revoke
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, () =>
			updateTopicMessages({
				refreshMessages: true,
			}),
		)

		return () => {
			pubsub?.unsubscribe(PubSubEvents.Refresh_Topic_Messages)
		}
	}, [updateTopicMessages])

	// Calculate current messages
	const messages = selectedTopic?.chat_topic_id
		? superMagicStore.messages?.get(selectedTopic?.chat_topic_id) || []
		: []

	// Monitor message status for loading state
	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessages) => {
				if (topicMessages.length > 1) {
					const lastMessageWithRole = topicMessages.findLast(
						(m) => m.role === "assistant",
					)
					const lastMessage = topicMessages?.[topicMessages.length - 1]
					const lastMessageNode = superMagicStore.getMessageNode(
						lastMessageWithRole?.app_message_id,
					)

					const isLoading =
						lastMessageNode?.status === "running" ||
						lastMessage.type === "rich_text" ||
						isObject(lastMessageNode?.content) ||
						Boolean(lastMessageNode?.rich_text?.content) ||
						Boolean(lastMessageNode?.text?.content)

					setShowLoading(isLoading)
					setIsShowLoadingInit(true)
				} else if (topicMessages?.length === 1) {
					setShowLoading(true)
				}
			},
		)
	}, [selectedTopic?.chat_topic_id])

	return {
		messages,
		showLoading,
		isShowLoadingInit,
		handlePullMoreMessage,
		updateTopicMessages,
	}
}
