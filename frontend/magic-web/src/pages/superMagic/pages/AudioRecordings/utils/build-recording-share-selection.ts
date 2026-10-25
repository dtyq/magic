import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { RecordingDetailFileMap } from "../types/recording-detail"
import { resolveRecordingShareItemLabel } from "../components/recording-share/resolve-recording-share-item-label"

/** Identifies which detail tab group a shareable recording file belongs to. */
export type RecordingShareGroupKey = "audio" | "transcript" | "notes" | "summary"

/** One whitelisted file entry used by PC/H5 share pickers. */
export interface RecordingShareGroupedItem {
	groupKey: RecordingShareGroupKey
	summaryType?: string
	file: AttachmentItem
	fileId: string
}

/** Flat and grouped share selection derived from the recording detail file map. */
export interface RecordingShareSelection {
	shareableFiles: AttachmentItem[]
	groupedItems: RecordingShareGroupedItem[]
	defaultSelectedFileIds: string[]
}

/** Collects every visible attachment id that users can explicitly include in a recording share. */
export function collectExportableFileIds(fileMap: RecordingDetailFileMap | null): string[] {
	if (!fileMap) return []

	const ids: string[] = []
	const seen = new Set<string>()

	function pushId(fileId?: string) {
		if (!fileId || seen.has(fileId)) return
		seen.add(fileId)
		ids.push(fileId)
	}

	pushId(fileMap.audio?.file_id)
	pushId(fileMap.transcript?.file_id)
	pushId(fileMap.notes?.file_id)
	fileMap.summaryFiles.forEach((ref) => pushId(ref.file?.file_id))

	return ids
}

/** Collects hidden-but-required bundle files that the shared recording viewer depends on. */
export function collectRecordingRequiredShareFileIds(
	fileMap: RecordingDetailFileMap | null,
): string[] {
	if (!fileMap) {
		return []
	}

	// Keep runtime bundle files as hidden dependencies so the readonly shell can recover
	// metadata and HTML entry resources without exposing them in the share content picker.
	const requiredFileIds = [fileMap.magicProject?.file_id, fileMap.indexHtml?.file_id].filter(
		(fileId): fileId is string => Boolean(fileId),
	)

	return Array.from(new Set(requiredFileIds))
}

/** Merges visible user selections with hidden required files while keeping a stable submission order. */
export function mergeRecordingShareFileIds(
	selectedFileIds: string[],
	requiredFileIds: string[],
): string[] {
	return Array.from(new Set([...selectedFileIds, ...requiredFileIds]))
}

/**
 * Builds the recording share whitelist from the same fileMap used by the detail workbench.
 * Excludes hidden runtime files like magic.project.js/index.html and only includes surfaced content.
 */
export function buildRecordingShareSelection(
	fileMap: RecordingDetailFileMap | null,
): RecordingShareSelection {
	const defaultSelectedFileIds = collectExportableFileIds(fileMap)
	if (!fileMap) {
		return { shareableFiles: [], groupedItems: [], defaultSelectedFileIds: [] }
	}

	const groupedItems: RecordingShareGroupedItem[] = []
	const shareableFiles: AttachmentItem[] = []
	const seen = new Set<string>()

	function pushItem(
		file: AttachmentItem | undefined,
		groupKey: RecordingShareGroupKey,
		summaryType?: string,
	) {
		const fileId = file?.file_id
		if (!file || !fileId || seen.has(fileId)) return

		seen.add(fileId)
		const groupedItem: RecordingShareGroupedItem = { groupKey, summaryType, file, fileId }
		groupedItems.push(groupedItem)
		// Keep the backend attachment untouched; this field exists only for share-picker UI.
		shareableFiles.push({
			...file,
			share_display_name: resolveRecordingShareItemLabel(groupedItem),
		})
	}

	pushItem(fileMap.audio, "audio")
	pushItem(fileMap.transcript, "transcript")
	pushItem(fileMap.notes, "notes")
	fileMap.summaryFiles.forEach((ref) => {
		pushItem(ref.file, "summary", ref.type)
	})

	return { shareableFiles, groupedItems, defaultSelectedFileIds }
}
