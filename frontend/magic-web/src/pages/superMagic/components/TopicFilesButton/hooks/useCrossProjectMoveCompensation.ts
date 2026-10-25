import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "./types"

type CrossProjectOperationSuccessResult = {
	operationType: "move" | "copy"
	fileIds: string[]
	targetProjectId: string
	targetWorkspaceId?: string
	targetProjectName?: string
}

interface UseCrossProjectMoveCompensationOptions {
	attachments: AttachmentItem[]
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
	onUpdateAttachments?: () => void
}

const removeMovedFilesFromAttachments = (
	sourceAttachments: AttachmentItem[],
	fileIds: string[],
): AttachmentItem[] => {
	if (sourceAttachments.length === 0 || fileIds.length === 0) return sourceAttachments

	const fileIdSet = new Set(fileIds.filter(Boolean))
	if (fileIdSet.size === 0) return sourceAttachments

	const removeFromTree = (items: AttachmentItem[]): AttachmentItem[] => {
		let hasChanged = false
		const nextItems: AttachmentItem[] = []

		for (const item of items) {
			const itemId = item.file_id || item.id

			if (itemId && fileIdSet.has(itemId)) {
				hasChanged = true
				continue
			}

			let nextItem = item
			if (item.children?.length) {
				const nextChildren = removeFromTree(item.children)
				if (nextChildren !== item.children) {
					nextItem = {
						...item,
						children: nextChildren,
					}
					hasChanged = true
				}
			}

			nextItems.push(nextItem)
		}

		return hasChanged ? nextItems : items
	}

	return removeFromTree(sourceAttachments)
}

export function useCrossProjectMoveCompensation({
	attachments,
	onAttachmentsChange,
	onUpdateAttachments,
}: UseCrossProjectMoveCompensationOptions) {
	return useMemoizedFn((result?: CrossProjectOperationSuccessResult) => {
		if (result?.operationType === "move" && onAttachmentsChange) {
			const updatedAttachments = removeMovedFilesFromAttachments(attachments, result.fileIds)

			if (updatedAttachments !== attachments) {
				onAttachmentsChange(updatedAttachments)
			}
		}

		onUpdateAttachments?.()
	})
}
