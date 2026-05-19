import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useEffect, useMemo, useRef } from "react"
import type { Topic, TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { MessageItem } from "@/pages/superMagic/stores/types"
import {
	createTopicReadProgressService,
	normalizeMessageSendTimeToMs,
	resolveReadProgressPayloadFromMessages,
} from "@/pages/superMagic/services/topicReadProgressService"
import {
	handleArrivedTopicStatusChange as syncArrivedTopicStatusChange,
	syncTopicStatusPatch,
} from "@/pages/superMagic/services/topicStatusSyncService"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import dayjs from "@/lib/dayjs"

interface TopicMessagesChangePayload {
	lastMessageNode?: {
		status?: unknown
	}
	selectedTopic?: Topic | null
	topicMessages: SuperMagicMessageItem[]
}

interface UseScopedTopicReadProgressParams {
	scopeName: string
	topicStore: TopicStore
	selectedTopic: Topic | null
	isSelectedTopicMessagesReady: boolean
}

function resolveReadProgressPayloadFromMessage(message?: {
	send_time?: unknown
	app_message_id?: unknown
}) {
	const fallbackReadAt = dayjs().format("YYYY-MM-DD HH:mm:ss")
	const normalizedSendTimeMs = normalizeMessageSendTimeToMs(message?.send_time)
	const parsedReadAt =
		normalizedSendTimeMs && normalizedSendTimeMs > 0
			? dayjs(normalizedSendTimeMs).format("YYYY-MM-DD HH:mm:ss")
			: fallbackReadAt

	return {
		lastReadAt: parsedReadAt,
		lastReadMessageId:
			typeof message?.app_message_id === "string" ? message.app_message_id : undefined,
	}
}

/** 为 Crew / Skill 这类 scoped 页面复用统一的已读上报与状态同步生命周期。 */
export function useScopedTopicReadProgress({
	scopeName,
	topicStore,
	selectedTopic,
	isSelectedTopicMessagesReady,
}: UseScopedTopicReadProgressParams) {
	const topicReadProgressService = useMemo(
		() => createTopicReadProgressService(topicStore),
		[topicStore],
	)
	const previousTopicIdRef = useRef<string | null>(null)
	const currentTopicStatus = selectedTopic?.task_status
	const currentTopicStatusRef = useRef<TaskStatus | undefined>(currentTopicStatus)
	currentTopicStatusRef.current = currentTopicStatus
	const messages = (superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") ||
		[]) as SuperMagicMessageItem[]

	/** 仅让 arrived 新消息驱动 scoped 页面的话题状态，避免历史初始化消息误改状态。 */
	const handleArrivedTopicStatusChange = useMemoizedFn(
		({
			nextStatus,
			topicId,
			lastReadAt,
			lastReadMessageId,
		}: {
			nextStatus?: TaskStatus
			topicId: string
			lastReadAt?: string
			lastReadMessageId?: string
		}) => {
			syncArrivedTopicStatusChange({
				scopeName,
				topicStore,
				topicReadProgressService,
				currentTopicStatusRef,
				nextStatus,
				topicId,
				lastReadAt,
				lastReadMessageId,
			})
		},
	)

	useEffect(() => {
		if (!selectedTopic?.chat_topic_id || !selectedTopic?.id) return

		return superMagicStore.registerTopicMessageListener({
			topicId: selectedTopic.chat_topic_id,
			callback: ({
				message,
				messageNode,
			}: {
				message: MessageItem
				messageNode: { status?: unknown }
			}) => {
				// 只跳过纯用户消息；assistant / tool 都可能承载任务状态的有效变化。
				if (message?.role === "user") return
				const readProgressPayload = resolveReadProgressPayloadFromMessage(message)
				handleArrivedTopicStatusChange({
					nextStatus: messageNode?.status as TaskStatus | undefined,
					topicId: selectedTopic.id,
					lastReadAt: readProgressPayload.lastReadAt,
					lastReadMessageId: readProgressPayload.lastReadMessageId,
				})
			},
		})
	}, [handleArrivedTopicStatusChange, selectedTopic?.chat_topic_id, selectedTopic?.id])

	/** 在消息变化时同步未读状态，并按 TopicPage 的规则补齐已读上报。 */
	const handleTopicMessagesChange = useMemoizedFn(
		({ selectedTopic: currentTopic, topicMessages }: TopicMessagesChangePayload) => {
			const readProgressPayload = resolveReadProgressPayloadFromMessages(
				topicMessages as Array<{
					send_time?: unknown
					app_message_id?: unknown
				}>,
			)
			const targetTopicId = currentTopic?.id || selectedTopic?.id
			if (!targetTopicId) return

			topicReadProgressService.markTopicReadProgress({
				topicId: targetTopicId,
				lastReadAt: readProgressPayload.lastReadAt,
				lastReadMessageId: readProgressPayload.lastReadMessageId,
				reason: "message-change",
			})
		},
	)

	/** 页面卸载时尽量把当前话题的已读游标冲刷到服务端。 */
	useEffect(() => {
		return () => {
			void topicReadProgressService.flushCurrentTopicReadProgress("route-leave")
		}
	}, [topicReadProgressService])

	/** 切换话题前先 flush 上一个话题，避免本地游标滞留。 */
	useEffect(() => {
		const previousTopicId = previousTopicIdRef.current
		const currentTopicId = selectedTopic?.id || null
		if (previousTopicId && previousTopicId !== currentTopicId) {
			void topicReadProgressService.flushTopicReadProgress({
				topicId: previousTopicId,
				reason: "switch-topic",
			})
		}
		previousTopicIdRef.current = currentTopicId
	}, [selectedTopic?.id, topicReadProgressService])

	/** 页面隐藏或关闭前 flush 当前话题，减少已读状态丢失。 */
	useEffect(() => {
		function handleVisibilityChange() {
			if (document.visibilityState !== "hidden") return
			void topicReadProgressService.flushCurrentTopicReadProgress("page-hide")
		}

		function handleBeforeUnload() {
			void topicReadProgressService.flushCurrentTopicReadProgress("before-unload")
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("beforeunload", handleBeforeUnload)
		}
	}, [topicReadProgressService])

	/** 进入话题且首轮消息就绪后，立即同步 unread 状态并尝试上报已读。 */
	useUpdateEffect(() => {
		if (!isSelectedTopicMessagesReady || !selectedTopic?.id) return

		const readProgressPayload = resolveReadProgressPayloadFromMessages(
			messages as Array<{
				send_time?: unknown
				app_message_id?: unknown
			}>,
		)
		void syncTopicStatusPatch({
			topicStore,
			topicId: selectedTopic.id,
		})
			.catch((error) => {
				console.warn(`[${scopeName}] 进入话题触发前同步话题 unread 状态失败:`, error)
			})
			.finally(() => {
				topicReadProgressService.markTopicReadProgress({
					topicId: selectedTopic.id,
					lastReadAt: readProgressPayload.lastReadAt,
					lastReadMessageId: readProgressPayload.lastReadMessageId,
					reason: "enter-topic",
					immediate: true,
				})
			})
	}, [selectedTopic?.id, isSelectedTopicMessagesReady])

	return {
		handleTopicMessagesChange,
	}
}
