import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import { isEmpty } from "lodash-es"
import { useEffect, useRef, useState } from "react"
import { SuperMagicApi } from "@/opensource/apis"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { Topic } from "../pages/Workspace/types"

interface UseTopicMessagesParams {
	selectedTopic: Topic | null
	checkNowDebounced?: () => void
}

interface PullMessageParams {
	conversation_id: string
	chat_topic_id: string
	page_token: string
	order: "asc" | "desc"
	limit?: number
	updatePageToken?: boolean
	refreshMessages?: boolean
	callback?: () => void
}

export function useTopicMessages({ selectedTopic, checkNowDebounced }: UseTopicMessagesParams) {
	// topic_id和page_token的映射
	const topicPageTokenMap = useRef<Record<string, string>>({})
	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})
	// Track which topics have completed their initial load
	const initialLoadedTopicsRef = useRef<Set<string>>(new Set())
	const [isMessagesInitialLoading, setIsMessagesInitialLoading] = useState(() =>
		Boolean(selectedTopic?.chat_topic_id),
	)

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
		}: PullMessageParams) => {
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
					checkNowDebounced?.()
				}
				if (updatePageToken && res?.page_token) {
					topicPageTokenMap.current[chat_topic_id] = res?.page_token
				}

				callback?.()
				if (refreshMessages) {
					res?.items?.reverse()?.forEach((o: any) => {
						superMagicStore.enqueueMessage(chat_topic_id, o)
					})
				} else {
					superMagicStore.initializeMessages(chat_topic_id, res?.items)
				}
				// Mark initial load complete for this topic
				if (!initialLoadedTopicsRef.current.has(chat_topic_id)) {
					initialLoadedTopicsRef.current.add(chat_topic_id)
					setIsMessagesInitialLoading(false)
				}
			})
		},
	)

	const updateTopicMessages = useMemoizedFn(
		({
			refreshMessages = false,
			messageCount = 100,
		}: { refreshMessages?: boolean; messageCount?: number } = {}) => {
			// if (selectedTopic?.id && selectedWorkspace) {
			if (selectedTopic?.id) {
				pullMessage({
					conversation_id: selectedTopic.chat_conversation_id,
					chat_topic_id: selectedTopic.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: messageCount,
					updatePageToken: true,
					refreshMessages,
				})
			}
		},
	)

	const handlePullMoreMessage = useMemoizedFn(
		(topicInfo: Topic | null, callback?: () => void) => {
			// if (selectedWorkspace && topicInfo) {
			if (topicInfo) {
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

	// Initialize messages when topic changes
	useDeepCompareEffect(() => {
		const topicId = selectedTopic?.chat_topic_id
		if (topicId && !initialLoadedTopicsRef.current.has(topicId)) {
			setIsMessagesInitialLoading(true)
		} else {
			setIsMessagesInitialLoading(false)
		}
		updateTopicMessages()
	}, [selectedTopic])

	// Subscribe to WebSocket new message events
	useEffect(() => {
		const handleNewMessage = (data: any) => {
			console.log("我接受到的 ws 消息", data)
			const { topic_id: chat_topic_id = "" } = data.message || {}

			if (
				selectedTopic?.chat_conversation_id &&
				chat_topic_id /** selectedTopic?.chat_topic_id */
			) {
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
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_New_Message, handleNewMessage)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Super_Magic_New_Message, handleNewMessage)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic])

	// Timer: poll messages every 30 seconds
	useEffect(() => {
		const timer = setInterval(() => {
			if (
				selectedTopic?.id &&
				selectedTopic.chat_conversation_id &&
				selectedTopic.chat_topic_id
			) {
				pullMessage({
					conversation_id: selectedTopic?.chat_conversation_id,
					chat_topic_id: selectedTopic?.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: 30,
					updatePageToken: false,
					refreshMessages: true,
				})
			}
		}, 20 * 1000)

		// Cleanup timer
		return () => {
			clearInterval(timer)
		}
	}, [selectedTopic, pullMessage])

	// Handle refresh topic messages after revoke
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, () =>
			updateTopicMessages({
				// Must use initializeMessages (refreshMessages: false) here.
				// Using enqueueMessage (refreshMessages: true) calls sortMessages after each
				// individual status update, which permanently filters out revoked messages that
				// appear before the last non-revoked message at the time of processing.
				// When multiple messages are revoked at once (e.g. undoMessage), only the
				// last revoked message survives in the revoked section — earlier ones are lost.
				// initializeMessages applies all status updates in one batch and calls
				// sortMessages only once at the end, preserving all revoked messages correctly.
				refreshMessages: false,
				messageCount: 500,
			}),
		)

		return () => {
			pubsub?.unsubscribe(PubSubEvents.Refresh_Topic_Messages)
		}
	}, [updateTopicMessages])

	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			// Cleanup topic_id and page_token mapping
			topicPageTokenMap.current = {}
		}
	}, [])

	return {
		pullMessage,
		updateTopicMessages,
		handlePullMoreMessage,
		topicPageTokenMap,
		isMessagesInitialLoading,
	}
}
