import { AttachmentItem } from "../../TopicFilesButton/hooks/types"

export const hasPPTMetadata = (attachmentItem: AttachmentItem) => {
	return attachmentItem?.display_config?.type === "slide"
}

/** Detect if a folder/file carries self-media metadata */
export const hasSelfMediaMetadata = (
	attachmentItem: AttachmentItem | { metadata?: Record<string, unknown> } | null,
) => {
	return attachmentItem?.metadata?.type === "self-media"
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

/**
 * Check if a file's extension matches any of the given types.
 * @param attachmentItem - the file to check
 * @param extensions - allowed extensions to match against
 *
 * @example
 * isConvertibleFile(item, ["html"])           // only html → PPTX export
 * isConvertibleFile(item, ["html", "md"])     // html + md → PDF export
 */
export const isConvertibleFile = (
	attachmentItem: AttachmentItem,
	extensions: string[],
): boolean => {
	const ext = attachmentItem?.file_extension?.toLowerCase() ?? ""
	return extensions.includes(ext)
}
