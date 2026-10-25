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
import { getCachedMentionPreviewUrls, requestMentionPreviewUrls } from "./preview-url-cache"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

const EMPTY_FILE_PREVIEW_BY_ID: Readonly<Record<string, string>> = {}
const EMPTY_PREVIEW_ROWS: readonly MentionFilePreviewSourceRow[] = []
const EMPTY_PENDING_IDS: string[] = []
const EMPTY_UPDATED_AT_MAP = new Map<string, string>()
const EMPTY_RESOURCE_VERSION_MAP = new Map<string, string>()
const EMPTY_FILE_VERSION_MAP = new Map<string, number>()

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

function buildMentionFileResourceVersionMap(
	rows: readonly MentionFilePreviewSourceRow[],
): Map<string, string> {
	const fileResourceVersionMap = new Map<string, string>()
	for (const row of rows) {
		const fileId = row.file_id != null ? String(row.file_id) : ""
		const version = row.resource_version ?? row.version
		if (!fileId) continue
		if (version != null && String(version).trim() !== "") {
			fileResourceVersionMap.set(fileId, String(version))
		}
	}
	return fileResourceVersionMap
}

function buildMentionFileVersionMap(
	rows: readonly MentionFilePreviewSourceRow[],
): Map<string, number> {
	const fileVersions = new Map<string, number>()
	for (const row of rows) {
		const fileId = row.file_id != null ? String(row.file_id) : ""
		if (!fileId || row.file_version == null) continue
		fileVersions.set(fileId, row.file_version)
	}
	return fileVersions
}

export function useMentionPanelFilePreviewById(
	items: MentionItem[],
): Readonly<Record<string, string>> {
	const hasProjectImageItems = useMemo(() => hasMentionPanelImagePreviewItems(items), [items])
	// The mention panel renders on share pages too; its thumbnail requests must
	// carry the ambient identity or the leaf guard returns an empty list.
	const fileApi = useFileApi()

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
				fileResourceVersionMap: EMPTY_RESOURCE_VERSION_MAP,
				fileVersions: EMPTY_FILE_VERSION_MAP,
			}
		}

		const sources = [
			buildMentionFilePreviewIndexes(workspaceRows),
			buildMentionFilePreviewIndexes(tabRows),
		]
		const fileUpdatedAtMap = buildMentionFileUpdatedAtMap(workspaceRows)
		const fileResourceVersionMap = buildMentionFileResourceVersionMap(workspaceRows)
		const fileVersions = buildMentionFileVersionMap(workspaceRows)
		buildMentionFileUpdatedAtMap(tabRows).forEach((updatedAt, fileId) => {
			fileUpdatedAtMap.set(fileId, updatedAt)
		})
		buildMentionFileResourceVersionMap(tabRows).forEach((version, fileId) => {
			fileResourceVersionMap.set(fileId, version)
		})
		buildMentionFileVersionMap(tabRows).forEach((version, fileId) => {
			fileVersions.set(fileId, version)
		})
		const syncMap = buildMentionFilePreviewSyncMap(items, sources)
		const pending = collectMentionImagePreviewFileIds(items, syncMap)

		return { syncMap, pending, fileUpdatedAtMap, fileResourceVersionMap, fileVersions }
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
			fileResourceVersionMap: batchPlan.fileResourceVersionMap,
			fileVersions: batchPlan.fileVersions,
			fileApi,
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

		void requestMentionPreviewUrls(missing, {
			fileUpdatedAtMap: batchPlan.fileUpdatedAtMap,
			fileResourceVersionMap: batchPlan.fileResourceVersionMap,
			fileVersions: batchPlan.fileVersions,
			fileApi,
		})
			.then((res) => {
				if (cancelled) return

				const fromApi: Record<string, string> = {}
				for (const row of res ?? []) {
					const fileId = row.file_id
					const previewUrl = row.url?.trim()
					if (fileId && previewUrl) fromApi[fileId] = previewUrl
				}

				setFilePreviewById({ ...nextSyncMap, ...cachedMap, ...fromApi })
			})
			.catch(() => undefined)

		return () => {
			cancelled = true
		}
	}, [batchPlan, fileApi, hasProjectImageItems])

	return filePreviewById
}
