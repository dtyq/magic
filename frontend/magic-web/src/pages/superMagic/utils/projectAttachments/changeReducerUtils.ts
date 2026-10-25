import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { AttachmentDataProcessor } from "../attachmentDataProcessor"
import { flattenAttachmentTree, removeHiddenAttachmentItems, sortAttachmentTree } from "./treeUtils"

export interface ProjectAttachmentsChangeOperationCounts {
	add: number
	delete: number
	update: number
	unknown: number
}

export function createProjectAttachmentsChangeOperationCounts(): ProjectAttachmentsChangeOperationCounts {
	return {
		add: 0,
		delete: 0,
		update: 0,
		unknown: 0,
	}
}

export function toProcessedAttachmentTree(tree: AttachmentItem[], locale?: string) {
	// fallback or legacy callers may pass unfiltered/unsorted trees; normalize them.
	const visibleTree = removeHiddenAttachmentItems(tree)
	const sortedTree = sortAttachmentTree(visibleTree, locale)
	return toProcessedSortedAttachmentTree(sortedTree)
}

export function toProcessedSortedAttachmentTree(sortedTree: AttachmentItem[]) {
	// sortedTree is sorted but has no list; flatten once in this compatibility entry.
	return toProcessedSortedAttachmentData(sortedTree, flattenAttachmentTree(sortedTree))
}

function resolveChangeFile(change: SuperMagicFileChangeItem) {
	return change.file as AttachmentItem | undefined
}

function resolveAttachmentFileName(item: AttachmentItem | undefined) {
	if (!item) return ""
	return String(item.file_name || item.filename || item.display_filename || item.name || "")
}

export function shouldReprocessDisplayConfigAfterChanges(
	changes: SuperMagicFileChangeItem[],
): boolean {
	for (const change of changes) {
		if (change.operation === "add" || change.operation === "delete") {
			return true
		}

		const file = resolveChangeFile(change)
		if (!file) continue
		if (file.is_directory) return true
		if (resolveAttachmentFileName(file).toLowerCase() === "index.html") return true
		if (file.display_config?.type) return true
	}

	return false
}

export function toProcessedSortedAttachmentData(
	sortedTree: AttachmentItem[],
	sortedList: AttachmentItem[],
) {
	// Successful reducer returns tree/list; preserveList avoids another flatten pass.
	// Keep display_config/metadata post-processing consistent with first load.
	const processedData = AttachmentDataProcessor.processAttachmentData(
		{
			tree: sortedTree,
			list: sortedList,
		},
		{
			preserveList: true,
		},
	)

	return {
		tree: processedData.tree as AttachmentItem[],
		list: processedData.list as AttachmentItem[],
	}
}
