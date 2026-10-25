import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	getAttachmentName,
	normalizeAttachmentId,
	removeHiddenAttachmentItems,
} from "@/pages/superMagic/utils/projectAttachments/treeUtils"

interface RecordingAttachmentsReadyInput {
	treeLength: number
	source?: string
}

interface SelectRecordingImageLookupTreeInput {
	current: AttachmentItem[]
	incoming: AttachmentItem[]
	source?: string
}

/**
 * Walks an attachment tree to detect any is_hidden node used for image path lookup.
 */
function attachmentTreeHasHiddenItems(tree: AttachmentItem[]): boolean {
	const stack = [...tree]
	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue
		if (item.is_hidden) return true
		if (item.children?.length) {
			stack.push(...item.children)
		}
	}
	return false
}

/**
 * Realtime WS/fallback snapshots only settle image loading when the visible
 * tree is non-empty. Empty trees would exhaust image retries before the
 * includeHidden HTTP lookup arrives. HTTP success/failure still marks ready
 * in the load callback itself.
 */
export function shouldMarkRecordingAttachmentsReady(
	input: RecordingAttachmentsReadyInput,
): boolean {
	return input.treeLength > 0
}

/**
 * Builds the file-UI/store tree from an includeHidden snapshot.
 * Nested hidden files under visible folders must not reach AiChat/@ mentions.
 */
export function getVisibleRecordingAttachmentTree(tree: AttachmentItem[]): AttachmentItem[] {
	return removeHiddenAttachmentItems(tree)
}

/** Finds the images directory by both its parent directory and its name. */
export function findRecordingImagesFolderId(
	tree: AttachmentItem[],
	parentId: string,
	folderName: string,
): string | undefined {
	const expectedParentId = normalizeAttachmentId(parentId)
	const stack = [...tree]

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue

		if (
			item.is_directory &&
			normalizeAttachmentId(item.parent_id) === expectedParentId &&
			getAttachmentName(item) === folderName &&
			item.file_id
		) {
			return item.file_id
		}

		if (item.children?.length) stack.push(...item.children)
	}

	return undefined
}

/**
 * Chooses the recording overlay image lookup tree.
 * Hidden-inclusive HTTP snapshots replace the lookup cache; filtered WS/fallback
 * trees must not wipe already-loaded recording images.
 */
export function selectRecordingImageLookupTree(
	input: SelectRecordingImageLookupTreeInput,
): AttachmentItem[] {
	if (attachmentTreeHasHiddenItems(input.incoming)) {
		return input.incoming
	}
	if (input.current.length > 0) {
		return input.current
	}
	return input.incoming
}
