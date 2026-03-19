import { useRef } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { TaskStatus } from "../pages/Workspace/types"

interface UseAutoOpenFileOnTaskCompleteParams {
	/** 当前话题状态 */
	currentTopicStatus?: TaskStatus
	/** 最后一条消息节点 */
	lastMessageNode?: any
	/** 最后一条可点击的详情消息节点 */
	lastDetailMessageNode?: any
	/** 状态是否发生变化 */
	hasStatusChanged: boolean
	/** 当前打开的文件 ID（用于判断是否已有打开的 tab） */
	activeFileId?: string | null
}

/**
 * 自动打开文件的 Hook
 *
 * 仅在以下条件全部满足时才会自动打开文件：
 * 1. 任务状态发生变化
 * 2. 任务完成（finished 或 error）
 * 3. 最后的可点击消息是新的（未打开过）
 * 4. 消息有附件
 * 5. 当前没有打开任何文件 tab（activeFileId 为 null）
 */
export function useAutoOpenFileOnTaskComplete() {
	// 记录已打开的消息 ID，避免重复打开
	const lastOpenedMessageIdRef = useRef<string | null>(null)

	/**
	 * 检查并打开文件
	 */
	const checkAndOpenFile = (params: UseAutoOpenFileOnTaskCompleteParams) => {
		const { lastMessageNode, lastDetailMessageNode, hasStatusChanged, activeFileId } = params

		// 条件1: 状态必须发生变化
		if (!hasStatusChanged) return

		// 条件2: 任务必须完成（finished 或 error）
		const isTaskFinished =
			lastMessageNode?.status === TaskStatus.FINISHED ||
			lastMessageNode?.status === TaskStatus.ERROR

		if (!isTaskFinished) return

		// 条件3: 消息必须是新的
		const isNewMessage =
			lastDetailMessageNode?.message_id &&
			lastDetailMessageNode.message_id !== lastOpenedMessageIdRef.current

		if (!isNewMessage) return

		// 条件4: 必须有附件
		const firstFileId = lastDetailMessageNode?.attachments?.[0]?.file_id
		if (!firstFileId) return

		// 条件5: 当前没有打开任何文件 tab
		if (activeFileId !== null) return

		// 满足所有条件，打开文件
		setTimeout(() => {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: firstFileId })
		}, 100)

		// 记录已打开的消息 ID
		lastOpenedMessageIdRef.current = lastDetailMessageNode.message_id
	}

	/**
	 * 清理记录（用于话题切换时）
	 */
	const reset = () => {
		lastOpenedMessageIdRef.current = null
	}

	return {
		checkAndOpenFile,
		reset,
	}
}
