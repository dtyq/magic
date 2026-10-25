import type { AttachmentIndex } from "./attachmentIndex"
import type { AttachmentItem } from "../hooks/types"

let attachmentIndexSessionCache: {
	mergedFiles: AttachmentItem[]
	flatList: AttachmentItem[]
	index: AttachmentIndex
} | null = null

export function readAttachmentIndexSessionCache(
	mergedFiles: AttachmentItem[],
	flatList: AttachmentItem[],
) {
	if (
		attachmentIndexSessionCache?.mergedFiles === mergedFiles &&
		attachmentIndexSessionCache?.flatList === flatList
	) {
		return attachmentIndexSessionCache.index
	}
	return null
}

export function writeAttachmentIndexSessionCache(
	mergedFiles: AttachmentItem[],
	flatList: AttachmentItem[],
	index: AttachmentIndex,
) {
	attachmentIndexSessionCache = { mergedFiles, flatList, index }
}

export function clearAttachmentIndexSessionCache() {
	attachmentIndexSessionCache = null
}
