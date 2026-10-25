import type React from "react"
import projectFilesStore from "@/stores/projectFiles"
import type { AttachmentItem } from "./types"
import { useAttachmentIndex } from "./useAttachmentIndex"
import { useVisibleTreeRows } from "./useVisibleTreeRows"
import { useLargeTreeDerivationPerf } from "./useTopicFilesPerf"

const LARGE_TREE_DERIVATION_THRESHOLD = 1000

interface UseTopicFilesTreeDerivationOptions {
	attachments: AttachmentItem[]
	mergedFiles: AttachmentItem[]
	expandedKeys: React.Key[]
	externalSearchValue?: string
	renamingItemId?: string | null
	refreshLoading: boolean
	selectedProjectId?: string | number
}

export function useTopicFilesTreeDerivation({
	attachments,
	mergedFiles,
	expandedKeys,
	externalSearchValue,
	renamingItemId,
	refreshLoading,
	selectedProjectId,
}: UseTopicFilesTreeDerivationOptions) {
	const hasActiveSearch = Boolean(externalSearchValue?.trim())
	const attachmentTotalCount =
		projectFilesStore.workspaceFileTree === attachments
			? projectFilesStore.workspaceFilesList.length
			: Math.max(attachments.length, mergedFiles.length)
	const isLargeTree = attachmentTotalCount > LARGE_TREE_DERIVATION_THRESHOLD
	const canReuseSessionAttachmentIndex =
		projectFilesStore.workspaceFileTree === attachments && mergedFiles === attachments
	const { attachmentIndex: treeIndex } = useAttachmentIndex({
		mergedFiles,
		cacheIdentity: String(selectedProjectId || ""),
		flatListSource: canReuseSessionAttachmentIndex
			? projectFilesStore.workspaceFilesList
			: undefined,
	})

	const { expandedKeySet, visibleRows, visibleNodes, visibleNodeIndexByKey } = useVisibleTreeRows(
		{
			expandedKeys,
			attachmentTree: mergedFiles,
			renamingItemId,
		},
	)

	useLargeTreeDerivationPerf({
		attachmentTotalCount,
		isLargeTree,
		refreshLoading,
		hasActiveSearch,
		hasRenamingItem: Boolean(renamingItemId),
		usesAttachmentIndex: true,
	})

	return {
		treeIndex,
		expandedKeySet,
		visibleRows,
		visibleNodes,
		visibleNodeIndexByKey,
	}
}
