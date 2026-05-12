import { useEffect, useMemo, useState } from "react"
import mentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import projectFilesStore from "@/stores/projectFiles"
import type { MentionItem } from "../../../../types"
import {
	buildMentionFilePreviewIndexes,
	buildMentionFilePreviewSyncMap,
	collectMentionImagePreviewFileIds,
	hasMentionPanelImagePreviewItems,
	type MentionFilePreviewSourceRow,
} from "./preview-utils"
import {
	getCachedMentionPreviewUrls,
	requestMentionPreviewUrls,
	updateMentionPreviewUrlCache,
} from "./preview-url-cache"

const EMPTY_FILE_PREVIEW_BY_ID: Readonly<Record<string, string>> = {}
const EMPTY_PREVIEW_ROWS: readonly MentionFilePreviewSourceRow[] = []
const EMPTY_PENDING_IDS: string[] = []
const EMPTY_UPDATED_AT_MAP = new Map<string, string>()

function buildMentionFileUpdatedAtMap(
	rows: readonly MentionFilePreviewSourceRow[],
): Map<string, string> {
	const fileUpdatedAtMap = new Map<string, string>()

	for (const row of rows) {
		const fileId = row.file_id != null ? String(row.file_id) : ""
		if (!fileId || !row.updated_at) continue
		fileUpdatedAtMap.set(fileId, row.updated_at)
	}

	return fileUpdatedAtMap
}

export function useMentionPanelFilePreviewById(
	items: MentionItem[],
): Readonly<Record<string, string>> {
	const hasProjectImageItems = useMemo(() => hasMentionPanelImagePreviewItems(items), [items])

	const workspaceRows = hasProjectImageItems
		? (projectFilesStore.workspaceFilesList as readonly MentionFilePreviewSourceRow[])
		: EMPTY_PREVIEW_ROWS
	const tabRows = hasProjectImageItems
		? (mentionPanelStore.currentTabPreviewRows as readonly MentionFilePreviewSourceRow[])
		: EMPTY_PREVIEW_ROWS

	const batchPlan = useMemo(() => {
		if (!hasProjectImageItems) {
			return {
				syncMap: EMPTY_FILE_PREVIEW_BY_ID,
				pending: EMPTY_PENDING_IDS,
				fileUpdatedAtMap: EMPTY_UPDATED_AT_MAP,
			}
		}

		const sources = [
			buildMentionFilePreviewIndexes(workspaceRows),
			buildMentionFilePreviewIndexes(tabRows),
		]
		const fileUpdatedAtMap = buildMentionFileUpdatedAtMap(workspaceRows)
		buildMentionFileUpdatedAtMap(tabRows).forEach((updatedAt, fileId) => {
			fileUpdatedAtMap.set(fileId, updatedAt)
		})
		const syncMap = buildMentionFilePreviewSyncMap(items, sources)
		const pending = collectMentionImagePreviewFileIds(items, syncMap)

		return { syncMap, pending, fileUpdatedAtMap }
	}, [hasProjectImageItems, items, tabRows, workspaceRows])

	const [filePreviewById, setFilePreviewById] =
		useState<Readonly<Record<string, string>>>(EMPTY_FILE_PREVIEW_BY_ID)

	useEffect(() => {
		let cancelled = false

		if (!hasProjectImageItems) {
			setFilePreviewById(EMPTY_FILE_PREVIEW_BY_ID)
			return
		}

		const nextSyncMap = batchPlan.syncMap
		const { cached, missing } = getCachedMentionPreviewUrls({
			fileIds: batchPlan.pending,
			fileUpdatedAtMap: batchPlan.fileUpdatedAtMap,
		})
		const cachedMap = cached.reduce(
			(prev, current) => {
				if (current.file_id && current.url) prev[current.file_id] = current.url
				return prev
			},
			{} as Record<string, string>,
		)

		setFilePreviewById({ ...nextSyncMap, ...cachedMap })

		if (missing.length === 0) return

		void requestMentionPreviewUrls(missing)
			.then((res) => {
				if (cancelled) return

				const fromApi: Record<string, string> = {}
				for (const row of res ?? []) {
					const fileId = row.file_id
					const previewUrl = row.url?.trim()
					if (fileId && previewUrl) fromApi[fileId] = previewUrl
				}

				updateMentionPreviewUrlCache({
					urlData: res ?? [],
					fileUpdatedAtMap: batchPlan.fileUpdatedAtMap,
				})

				setFilePreviewById({ ...nextSyncMap, ...cachedMap, ...fromApi })
			})
			.catch(() => undefined)

		return () => {
			cancelled = true
		}
	}, [batchPlan, hasProjectImageItems])

	return filePreviewById
}
