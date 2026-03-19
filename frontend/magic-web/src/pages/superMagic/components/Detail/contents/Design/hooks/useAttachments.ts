import { useCallback, useMemo } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { flattenAttachmentsList } from "../utils/utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"

interface UseAttachmentsOptions {
	/** 附件列表 */
	attachments?: FileItem[]
	/** 已扁平化的附件列表 */
	attachmentList?: FileItem[]
}

interface UseAttachmentsReturn {
	/** 已扁平化的附件列表 */
	flatAttachments: FileItem[]
	/** 触发文件列表更新，返回新的文件列表 */
	updateAttachments: () => void
}

/**
 * 文件列表更新处理 Hook
 */
export function useAttachments(options: UseAttachmentsOptions): UseAttachmentsReturn {
	const { attachments, attachmentList } = options

	// 扁平化附件列表
	const flatAttachments = useMemo(() => {
		// 如果 attachmentList 存在，直接使用（已经是扁平化的）
		if (attachmentList && attachmentList.length > 0) {
			return attachmentList
		}
		// 否则从 attachments 扁平化
		if (!attachments) return []
		return flattenAttachmentsList(attachments)
	}, [attachments, attachmentList])

	/**
	 * 触发文件列表更新
	 */
	const updateAttachments = useCallback(() => {
		pubsub.publish(PubSubEvents.Update_Attachments)
	}, [])

	return {
		flatAttachments,
		updateAttachments,
	}
}
