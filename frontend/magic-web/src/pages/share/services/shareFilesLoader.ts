import { SuperMagicApi } from "@/apis"
import type { ShareFilesV2NextParentState } from "@/apis/modules/superMagic"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	createProjectAttachmentsBatchSnapshotScheduler,
	type ProjectAttachmentsBatchSnapshotPayload,
} from "@/pages/superMagic/services/projectAttachmentsLoader"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { createProjectAttachmentsV2Builder } from "@/pages/superMagic/utils/projectAttachments/v2Adapter"

const DEFAULT_SHARE_FILES_PAGE_SIZE = 1000

export type ShareFilesBatchSnapshotPayload = ProjectAttachmentsBatchSnapshotPayload

export interface LoadShareFilesOptions {
	resourceId: string
	password?: string
	pageSize?: number
	signal?: AbortSignal
	/**
	 * Reuses the project-file batch scheduler: first paints immediately, middle pages
	 * coalesce behind idle/gap throttling, final always commits the complete tree.
	 */
	onBatchSnapshot?: (payload: ShareFilesBatchSnapshotPayload) => void
}

function normalizeNextParentIds(nextParentIds: ShareFilesV2NextParentState[] | null | undefined) {
	// The cursor is owned by the backend. Keep the array and every cursor field unchanged.
	return Array.isArray(nextParentIds) ? nextParentIds : []
}

function createCursorKey(nextParentIds: ShareFilesV2NextParentState[]) {
	// Cursor queues are small protocol state, so serialization is bounded and avoids a paging loop.
	return JSON.stringify(nextParentIds)
}

function throwIfAborted(signal?: AbortSignal) {
	if (!signal?.aborted) return
	throw new DOMException("Share files request aborted", "AbortError")
}

function toProcessedResult(data: { tree: AttachmentItem[]; list: AttachmentItem[] }) {
	return AttachmentDataProcessor.processAttachmentData(
		{ tree: data.tree, list: data.list },
		{ preserveList: true },
	) as { tree: AttachmentItem[]; list: AttachmentItem[] }
}

/**
 * Loads every V2 cursor page and reuses the project attachment builder so share pages keep the
 * same tree/list contract, path normalization, hidden-file handling, and display configuration.
 * Incremental UI updates reuse the project batch snapshot scheduler rather than committing every page.
 */
export async function loadShareFilesV2({
	resourceId,
	password,
	pageSize = DEFAULT_SHARE_FILES_PAGE_SIZE,
	signal,
	onBatchSnapshot,
}: LoadShareFilesOptions) {
	const builder = createProjectAttachmentsV2Builder()
	const seenCursorKeys = new Set<string>()
	let nextParentIds: ShareFilesV2NextParentState[] = []
	let shouldContinue = true
	let pageIndex = 0
	let isFirstSnapshot = true

	const batchSnapshotScheduler = createProjectAttachmentsBatchSnapshotScheduler(
		onBatchSnapshot
			? (payload) => {
					const processed = toProcessedResult(payload)
					onBatchSnapshot({
						...payload,
						tree: processed.tree,
						list: processed.list,
						total: processed.list.length,
					})
				}
			: undefined,
		{ signal },
	)

	try {
		while (shouldContinue) {
			throwIfAborted(signal)
			const requestParams = {
				resourceId,
				password,
				pageSize,
				nextParentIds,
			}
			const response = await SuperMagicApi.getShareResourceFilesV2Page(requestParams, {
				signal,
			})
			throwIfAborted(signal)

			const rows = Array.isArray(response.list) ? response.list : []
			builder.mergeBatch(rows)

			const responseCursor = normalizeNextParentIds(response.next_parent_ids)
			const hasMoreAfterPage = Boolean(response.has_more && responseCursor.length > 0)
			if (response.has_more && responseCursor.length === 0) {
				throw new Error("share_files_v2_empty_cursor")
			}

			// Match project loader: only materialize intermediate UI snapshots while more pages remain.
			if (onBatchSnapshot && hasMoreAfterPage) {
				const snapshot = builder.snapshot()
				const payload = {
					...snapshot,
					level: pageIndex,
					projectId: resourceId,
				}
				if (isFirstSnapshot) {
					batchSnapshotScheduler.commitFirst(payload)
					isFirstSnapshot = false
				} else {
					batchSnapshotScheduler.scheduleMiddle(payload)
				}
			}

			if (!hasMoreAfterPage) {
				shouldContinue = false
				continue
			}

			const cursorKey = createCursorKey(responseCursor)
			if (seenCursorKeys.has(cursorKey)) {
				throw new Error("share_files_v2_repeated_cursor")
			}

			seenCursorKeys.add(cursorKey)
			nextParentIds = responseCursor
			pageIndex += 1
		}

		throwIfAborted(signal)
		const snapshot = builder.finalize()
		batchSnapshotScheduler.commitFinal({
			...snapshot,
			level: pageIndex,
			projectId: resourceId,
		})
		return toProcessedResult(snapshot)
	} catch (error) {
		batchSnapshotScheduler.cancelPending("load_error")
		throw error
	}
}
