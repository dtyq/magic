import { useRef } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { TaskStatus } from "../pages/Workspace/types"
import { filterClickableMessageWithoutRevoked } from "../utils/handleMessage"
import { superMagicStore } from "../stores"
import type { SuperMagicMessageItem } from "../components/MessageList/type"
import { topicStore } from "../stores/core"
import { buildFilePathAttachments } from "../components/MessageList/utils/attachmentByFilePath"
import type { FilePathAttachment } from "../components/MessageList/utils/attachmentByFilePath"

interface AutoOpenFileCommonParams {
	/** 最后一条消息节点（助手侧） */
	lastMessageNode?: any
	/** 最后一条可点击的详情消息节点 */
	lastDetailMessageNode?: any
	/** lastDetailMessageNode 对应的 MessageItem（含 app_message_id，用于在 topicMessages 中定位） */
	lastDetailMessage?: { app_message_id: string; [key: string]: unknown }
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
 * 根据 lastDetailMessage 在 topicMessages 中找到前一条消息，
 * 解析其 content 中的 @file_path 引用，返回路径附件数组。
 */
function getPrevMessageFilePathAttachments(
	topicId: string,
	lastDetailMessage?: { app_message_id: string; [key: string]: unknown },
): FilePathAttachment[] {
	if (!lastDetailMessage?.app_message_id || !topicId) return []

	const topicMessages = superMagicStore.messages?.get(topicId) || []
	const detailIndex = topicMessages.findIndex(
		(m) => m.app_message_id === lastDetailMessage.app_message_id,
	)
	if (detailIndex <= 0) return []

	const prevMessage = topicMessages[detailIndex - 1]
	const prevNode = superMagicStore.getMessageNode(prevMessage.app_message_id) as
		| Record<string, unknown>
		| undefined
	const prevContent = prevNode && typeof prevNode?.content === "string" ? prevNode.content : ""

	return buildFilePathAttachments(prevContent)
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
				lastDetailMessage,
				requireStatusChange,
				hasStatusChanged,
				activeFileId,
				getActiveFileId,
				requireNewMessage = true,
			} = params

			if (requireStatusChange && !hasStatusChanged) return

			const isTaskFinished =
				lastMessageNode?.status === TaskStatus.FINISHED ||
				lastMessageNode?.status === TaskStatus.ERROR ||
                lastMessageNode?.status === TaskStatus.SUSPENDED

			if (!isTaskFinished) return

			if (requireNewMessage) {
				const isNewMessage =
					lastDetailMessageNode?.message_id &&
					lastDetailMessageNode.message_id !== lastOpenedMessageIdRef.current

				if (!isNewMessage) return
			}

			// 优先：检查前一条消息 content 中是否有 @file_path 引用
			const filePathAttachments = getPrevMessageFilePathAttachments(
				selectedTopic?.chat_topic_id || "",
				lastDetailMessage,
			)

			if (filePathAttachments.length > 0) {
				const firstPathAttachment = filePathAttachments[0]
				const currentActive = getActiveFileId?.() ?? activeFileId ?? null
				if (currentActive != null) {
					lastOpenedMessageIdRef.current = lastDetailMessageNode.message_id
					return
				}

				setTimeout(() => {
					const id = getActiveFileId?.() ?? activeFileId ?? null
					if (id != null) return
					pubsub.publish(PubSubEvents.Switch_Detail_Mode, "files")
					pubsub.publish(PubSubEvents.Open_File_Tab_By_Path, {
						filePath: firstPathAttachment.filePath,
						fileName: firstPathAttachment.fileName,
					})
				}, 100)

				lastOpenedMessageIdRef.current = lastDetailMessageNode.message_id
				return
			}

			// 兜底：使用原始 attachments 中的第一个文件
			const attachments = lastDetailMessageNode?.attachments || []

			const firstFileId = attachments.find(
				(attachment: { file_id?: string; file_extension?: string }) => {
					const fileId = attachment?.file_id
					if (!fileId) return false

					// Folders have empty file_extension
					const isFolder = attachment.file_extension === ""
					return !isFolder
				},
			)?.file_id

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

			const lastMessageWithRole = topicMessages.findLast((m) => {
				return m.role === "assistant" || m.role === "tool"
			})
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
				lastDetailMessage: lastDetailMessageWithAttachments,
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
