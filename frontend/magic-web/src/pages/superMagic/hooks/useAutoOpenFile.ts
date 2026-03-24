import { useRef } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { TaskStatus } from "../pages/Workspace/types"
import { filterClickableMessageWithoutRevoked } from "../utils/handleMessage"
import { superMagicStore } from "../stores"
import type { SuperMagicMessageItem } from "../components/MessageList/type"
import { topicStore } from "../stores/core"

interface AutoOpenFileCommonParams {
	/** 最后一条消息节点（助手侧） */
	lastMessageNode?: any
	/** 最后一条可点击的详情消息节点 */
	lastDetailMessageNode?: any
	/** 当前打开的文件 ID（用于判断是否已有打开的 tab） */
	activeFileId?: string | null
	/** 读取最新活跃文件，避免闭包滞后于缓存恢复的 Update_Active_File_Id */
	getActiveFileId?: () => string | null | undefined
}

export interface CheckAndOpenFileByMessagesParams extends AutoOpenFileCommonParams {
	/** 状态是否发生变化（消息流内任务状态变化） */
	hasStatusChanged: boolean
}

export interface CheckAndOpenFileByTopicChangedParams {
	activeFileId?: string | null
	getActiveFileId?: () => string | null | undefined
}

/**
 * 根据消息 / 切换话题自动打开附件 tab（任务已完成、有附件、且无已打开文件时）
 */
export function useAutoOpenFile() {
	const lastOpenedMessageIdRef = useRef<string | null>(null)
	const selectedTopic = topicStore.selectedTopic

	const attemptOpenFromNodes = useMemoizedFn(
		(
			params: AutoOpenFileCommonParams & {
				requireStatusChange: boolean
				hasStatusChanged?: boolean
				/** 切换话题等场景不校验「相对 lastOpened 是否为新消息」 */
				requireNewMessage?: boolean
			},
		) => {
			const {
				lastMessageNode,
				lastDetailMessageNode,
				requireStatusChange,
				hasStatusChanged,
				activeFileId,
				getActiveFileId,
				requireNewMessage = true,
			} = params

			if (requireStatusChange && !hasStatusChanged) return

			const isTaskFinished =
				lastMessageNode?.status === TaskStatus.FINISHED ||
				lastMessageNode?.status === TaskStatus.ERROR

			if (!isTaskFinished) return

			if (requireNewMessage) {
				const isNewMessage =
					lastDetailMessageNode?.message_id &&
					lastDetailMessageNode.message_id !== lastOpenedMessageIdRef.current

				if (!isNewMessage) return
			}

			const firstFileId = lastDetailMessageNode?.attachments?.[0]?.file_id
			if (!firstFileId) return

			const currentActive = getActiveFileId?.() ?? activeFileId ?? null
			if (currentActive != null) {
				lastOpenedMessageIdRef.current = lastDetailMessageNode.message_id
				return
			}

			setTimeout(() => {
				const id = getActiveFileId?.() ?? activeFileId ?? null
				if (id != null) return
				pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: firstFileId })
			}, 100)

			lastOpenedMessageIdRef.current = lastDetailMessageNode.message_id
		},
	)

	const checkAndOpenFileByMessages = useMemoizedFn((params: CheckAndOpenFileByMessagesParams) => {
		attemptOpenFromNodes({
			...params,
			requireStatusChange: true,
		})
	})

	const checkAndOpenFileByTopicChanged = useMemoizedFn(
		(params: CheckAndOpenFileByTopicChangedParams) => {
			const { activeFileId, getActiveFileId } = params

			const topicMessages =
				superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || []

			lastOpenedMessageIdRef.current = null

			if (topicMessages.length <= 1) return

			const lastMessageWithRole = topicMessages.findLast((m) => m.role === "assistant")
			const lastMessageNode = superMagicStore.getMessageNode(
				lastMessageWithRole?.app_message_id,
			)

			const lastDetailMessageWithAttachments = topicMessages.findLast((m) => {
				const node = superMagicStore.getMessageNode(m?.app_message_id)
				return filterClickableMessageWithoutRevoked(node) && node?.attachments?.length > 0
			})
			const lastDetailMessageNode = superMagicStore.getMessageNode(
				lastDetailMessageWithAttachments?.app_message_id,
			)

			if (!filterClickableMessageWithoutRevoked(lastDetailMessageNode)) return

			attemptOpenFromNodes({
				lastMessageNode,
				lastDetailMessageNode,
				requireStatusChange: false,
				requireNewMessage: false,
				activeFileId,
				getActiveFileId,
			})
		},
	)

	const reset = () => {
		lastOpenedMessageIdRef.current = null
	}

	return {
		checkAndOpenFileByMessages,
		checkAndOpenFileByTopicChanged,
		reset,
	}
}
