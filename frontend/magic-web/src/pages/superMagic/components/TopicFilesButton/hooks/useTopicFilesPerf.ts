import { useEffect } from "react"
import { manualPerfLogger, measureManualPerfOperation } from "@/utils/manualPerfLogger"
import { createFileTreePerfScope } from "@/pages/superMagic/utils/fileTreePerf"
import { recordLargeTreeFeatureFlagState } from "@/pages/superMagic/utils/attachmentPerf"
import type { AttachmentItem } from "./types"

interface UseTopicFilesPerfSessionOptions {
	attachments: AttachmentItem[]
	projectId?: string
	selectedProjectId?: string | number
}

export function useTopicFilesPerfSession({
	attachments,
	projectId,
	selectedProjectId,
}: UseTopicFilesPerfSessionOptions) {
	useEffect(() => {
		if (!manualPerfLogger.isEnabled()) return

		// Record one baseline size per tree session for later perf comparisons.
		const perf = createFileTreePerfScope(attachments)
		manualPerfLogger.ensureSession({
			source: "TopicFilesCore",
			has_project_id: Boolean(projectId || selectedProjectId),
			...(perf.stats || {}),
		})
		recordLargeTreeFeatureFlagState("TopicFilesCore", {
			has_project_id: Boolean(projectId || selectedProjectId),
			...(perf.stats || {}),
		})
		perf.snapshotHeap("topic_files_core_session_start")

		return () => {
			perf.snapshotHeap("topic_files_core_session_end")
			manualPerfLogger.finishSession({
				source: "TopicFilesCore",
				reason: "component_cleanup",
			})
		}
	}, [projectId, selectedProjectId])
}

export function measureMergedFilesBuild<T extends AttachmentItem[]>(
	filteredRootCount: number,
	callback: () => T,
): T {
	return measureManualPerfOperation("merged_files_build_ms", callback, (result) => ({
		filtered_root_count: filteredRootCount,
		merged_root_count: result.length,
	}))
}

interface LargeTreeDerivationStatePerfData {
	attachmentTotalCount: number
	isLargeTree: boolean
	refreshLoading: boolean
	hasActiveSearch: boolean
	hasRenamingItem: boolean
	preferAttachmentVisibleRows?: boolean
	usesAttachmentIndex: boolean
}

export function recordLargeTreeDerivationState(data: LargeTreeDerivationStatePerfData) {
	if (!manualPerfLogger.isEnabled()) return
	const preferAttachmentVisibleRows = data.preferAttachmentVisibleRows ?? true

	const payload = {
		attachment_total_count: data.attachmentTotalCount,
		is_large_tree: data.isLargeTree,
		refresh_loading: data.refreshLoading,
		has_active_search: data.hasActiveSearch,
		has_renaming_item: data.hasRenamingItem,
		prefer_attachment_visible_rows: preferAttachmentVisibleRows,
		uses_attachment_index: data.usesAttachmentIndex,
	}

	manualPerfLogger.recordMetric(
		"topic_files_large_tree_derivation_mode",
		data.isLargeTree ? 1 : 0,
		payload,
	)
	manualPerfLogger.recordMetric(
		"topic_files_attachment_visible_rows_mode",
		preferAttachmentVisibleRows ? 1 : 0,
		payload,
	)
	manualPerfLogger.recordMetric(
		"topic_files_attachment_index_mode",
		data.usesAttachmentIndex ? 1 : 0,
		payload,
	)
}

export function useLargeTreeDerivationPerf(data: LargeTreeDerivationStatePerfData) {
	useEffect(() => {
		recordLargeTreeDerivationState(data)
	}, [
		data.attachmentTotalCount,
		data.hasActiveSearch,
		data.hasRenamingItem,
		data.isLargeTree,
		data.preferAttachmentVisibleRows,
		data.refreshLoading,
		data.usesAttachmentIndex,
	])
}

interface SearchInputPerfData {
	source: string
	searchValueLength: number
	debounceWaitMs: number
	reason?: string
}

interface SearchFilterResultPerfData {
	hasSearch: boolean
	searchValueLength: number
	filteredRootCount: number
	matchedItemCount: number
	matchedAncestorCount: number
	resultTooLarge: boolean
}

export function recordSearchInputStarted(data: SearchInputPerfData) {
	if (!manualPerfLogger.isEnabled()) return

	// Start at user input; mark end after CustomTree renders visible rows.
	manualPerfLogger.markStart("search_input_to_visible", {
		source: data.source,
		search_value_length: data.searchValueLength,
		debounce_wait_ms: data.debounceWaitMs,
		...(data.reason ? { reason: data.reason } : {}),
	})
	manualPerfLogger.count("search_raw_input_change_count", 1, {
		source: data.source,
		search_value_length: data.searchValueLength,
	})
}

export function recordSearchDebounceDropped(data: SearchInputPerfData) {
	if (!manualPerfLogger.isEnabled()) return

	manualPerfLogger.count("search_debounce_dropped_count", 1, {
		source: data.source,
		search_value_length: data.searchValueLength,
		debounce_wait_ms: data.debounceWaitMs,
		...(data.reason ? { reason: data.reason } : {}),
	})
}

export function finishSearchInputToVisible(data: Record<string, unknown>) {
	manualPerfLogger.markEnd("search_input_to_visible", data)
}

export function recordSearchFilterResultMetrics(data: SearchFilterResultPerfData) {
	if (!manualPerfLogger.isEnabled()) return

	// Count search and non-search refreshes separately to avoid skewed metrics.
	const payload = {
		has_search: data.hasSearch,
		search_value_length: data.searchValueLength,
		filtered_root_count: data.filteredRootCount,
		matched_item_count: data.matchedItemCount,
		matched_ancestor_count: data.matchedAncestorCount,
		search_result_too_large: data.resultTooLarge,
	}

	if (data.hasSearch) {
		manualPerfLogger.count("search_compute_count", 1, payload)
		manualPerfLogger.recordMetric("search_match_count", data.matchedItemCount, payload)
		manualPerfLogger.recordMetric("matched_ancestor_count", data.matchedAncestorCount, payload)
		manualPerfLogger.count("filtered_files_rebuilt_count", 1, payload)
		manualPerfLogger.count("search_result_too_large", data.resultTooLarge ? 1 : 0, payload)
		return
	}

	manualPerfLogger.count("file_filter_compute_count", 1, payload)
}

export function startSearchExpandDebounce(data: Record<string, unknown>) {
	if (!manualPerfLogger.isEnabled()) return 0

	// Return the start time so hooks do not touch logger internals.
	manualPerfLogger.count("search_expand_debounce_scheduled_count", 1, data)
	return manualPerfLogger.now()
}

export function finishSearchExpandDebounce(startedAt: number, data: Record<string, unknown>) {
	if (!manualPerfLogger.isEnabled() || !startedAt) return

	manualPerfLogger.recordDuration("search_expand_debounce_ms", startedAt, data)
}
