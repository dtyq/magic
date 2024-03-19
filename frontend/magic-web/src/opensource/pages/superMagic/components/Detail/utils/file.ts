import { AttachmentItem } from "../../TopicFilesButton/hooks/types"

export const hasPPTMetadata = (attachmentItem: AttachmentItem) => {
	return attachmentItem?.metadata?.type === "slide"
}

/**
 * Check if a file is in PPT mode by checking its parent folder's metadata
 */
export const isFileInPPTMode = (fileId: string, attachmentList: AttachmentItem[]): boolean => {
	const parentId = attachmentList?.find((item) => item.file_id === fileId)?.parent_id

	if (!parentId) return false

	const parentFolder = attachmentList.find((item) => item.file_id === parentId)

	return parentFolder ? hasPPTMetadata(parentFolder) : false
}
