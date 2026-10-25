import {
	canDeleteRecordingProjects,
	handleRecordingProjectDeletionError,
} from "@/services/recordSummary/projectDeletionRecordingNotice"
import { useCallback, useEffect, useState } from "react"
import type { RefObject } from "react"
import { Check, Loader2 } from "lucide-react"
import { useDebounce } from "ahooks"
import { observer } from "mobx-react-lite"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import SuperMagicService from "@/pages/superMagic/services"
import type { AudioProjectListItem } from "@/types/audioProject"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import AudioRecordingCard from "./components/AudioRecordingCard"
import { AudioRecordingDeleteDialog } from "./components/AudioRecordingDeleteDialog"
import { AudioRecordingRenameDialog } from "./components/AudioRecordingRenameDialog"
import AudioRecordingsFilters, {
	type AudioRecordingsDatePreset,
} from "./components/AudioRecordingsFilters"
import { resolveDatePresetRange } from "./utils/resolve-date-preset-range"
import { audioRecordingsStore } from "./stores/audio-recordings-store"
import { resolveRecordingDisplayName } from "./utils/audio-recordings-utils"
import { useRecordingEntryFacade } from "./hooks/useRecordingEntryFacade"
import { useAudioRecordingsOptimisticSync } from "./hooks/useAudioRecordingsOptimisticSync"
import {
	recordingGroupsService,
	audioRecordingsService,
	ALL_RECORDING_GROUP_ID,
	UNGROUPED_RECORDING_GROUP_ID,
	type AudioRecordingGroup,
} from "@/services/audioRecordings"
import {
	AudioRecordingGroupManageDialog,
	AudioRecordingMoveGroupDialog,
} from "./components/AudioRecordingGroupDialogs"
import { AudioRecordingSettingsDialog } from "./components/AudioRecordingSettingsDialog"
import { AudioRecordingsPrimaryActions } from "./components/AudioRecordingsPrimaryActions"
import { AudioRecordingCopyDialog } from "./components/AudioRecordingCopyDialog"
import { registerAudioRecordingsShellRefreshHandler } from "./utils/request-audio-recordings-shell-refresh"
import {
	patchAudioRecordingsFilterSession,
	readAudioRecordingsFilterSession,
	resolveAvailableAudioRecordingGroupId,
} from "./utils/audio-recordings-filter-session"
import { useAudioRecordingCopyToProject } from "./hooks/useAudioRecordingCopyToProject"

const SEARCH_DEBOUNCE_MS = 300

interface AudioRecordingsDesktopProps {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

/** Desktop list panel container driving group selection, settings modal, file imports, and infinite card feed */
function AudioRecordingsDesktop({ scrollViewportRef }: AudioRecordingsDesktopProps) {
	const { t } = useTranslation(["audioRecordings", "super"])
	const navigate = useNavigate()
	const store = audioRecordingsStore
	const facade = useRecordingEntryFacade()
	const [initialFilterSession] = useState(() => readAudioRecordingsFilterSession())

	const [searchKeyword, setSearchKeyword] = useState(initialFilterSession.searchKeyword)
	const [isSearchComposing, setIsSearchComposing] = useState(false)
	const [datePreset, setDatePreset] = useState<AudioRecordingsDatePreset>(
		initialFilterSession.datePreset,
	)
	const [hasHydratedFilters, setHasHydratedFilters] = useState(false)
	const [renameTarget, setRenameTarget] = useState<AudioProjectListItem | null>(null)
	const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null)
	const debouncedKeyword = useDebounce(searchKeyword, { wait: SEARCH_DEBOUNCE_MS })

	// Group and Dialog management states
	const [groups, setGroups] = useState<AudioRecordingGroup[]>([])
	const [totalGroupCount, setTotalGroupCount] = useState(0)
	const [ungroupedCount, setUngroupedCount] = useState(0)
	const [currentGroupId, setCurrentGroupId] = useState(initialFilterSession.groupId)
	const [hasLoadedGroups, setHasLoadedGroups] = useState(false)
	const [groupLoading, setGroupLoading] = useState(false)
	const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false)
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [moveTarget, setMoveTarget] = useState<AudioProjectListItem | null>(null)

	/** Keeps the active group filter aligned across UI state, store queries, and session cache. */
	const handleGroupChange = useCallback(
		(groupId: string) => {
			setCurrentGroupId(groupId)
			store.setWorkspaceId(groupId)
			patchAudioRecordingsFilterSession({ groupId })
		},
		[store],
	)

	// Fetch recording groups metadata
	const refreshGroups = useCallback(async () => {
		setGroupLoading(true)
		try {
			const result = await recordingGroupsService.listGroups()
			setGroups(result.groups)
			setTotalGroupCount(result.totalCount)
			setUngroupedCount(result.ungroupedCount)
			setHasLoadedGroups(true)
		} catch (error) {
			console.error("Failed to load recording groups:", error)
		} finally {
			setGroupLoading(false)
		}
	}, [])

	const handleRefresh = useCallback(async () => {
		if (!hasHydratedFilters) return
		await Promise.all([
			store.fetchList({ page: 1, keyword: debouncedKeyword.trim() }),
			refreshGroups(),
		])
	}, [store, debouncedKeyword, refreshGroups, hasHydratedFilters])

	const copyController = useAudioRecordingCopyToProject({
		onSuccess: handleRefresh,
	})

	// Sync local optimistic items and handle background polling
	const mergedList = useAudioRecordingsOptimisticSync({
		storeList: store.list,
		optimisticItems: facade.optimisticItems,
		onResolveOptimisticItem: facade.clearOptimisticItem,
		onRefresh: handleRefresh,
	})

	const handleAutoLoadMore = useCallback(() => {
		void store.loadMore()
	}, [store])

	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: store.loading || store.loadingMore || !store.hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	useEffect(() => {
		store.registerPollerCallbacks()
		void refreshGroups()
		return () => {
			store.disposePoller()
			store.reset()
		}
	}, [store, refreshGroups])

	// Restore query filters before the first fetch so refresh/re-entry uses the saved session state.
	useEffect(() => {
		store.hydrateFiltersFromSession(initialFilterSession)
		setHasHydratedFilters(true)
	}, [store, initialFilterSession])

	// Keep list + group metadata in sync when a recording finishes on this page.
	useEffect(() => {
		return registerAudioRecordingsShellRefreshHandler(handleRefresh)
	}, [handleRefresh])

	useEffect(() => {
		if (!hasLoadedGroups) return
		const availableGroupId = resolveAvailableAudioRecordingGroupId(currentGroupId, groups)
		if (availableGroupId !== currentGroupId) {
			handleGroupChange(availableGroupId)
		}
	}, [currentGroupId, groups, handleGroupChange, hasLoadedGroups])

	useEffect(() => {
		if (!hasHydratedFilters) return
		if (isSearchComposing) return
		void store.fetchList({ page: 1, keyword: debouncedKeyword.trim() })
	}, [
		store,
		hasHydratedFilters,
		debouncedKeyword,
		isSearchComposing,
		store.summaryFilter,
		store.createdAtStart,
		store.createdAtEnd,
		store.sortBy,
		store.sortOrder,
		currentGroupId, // Re-query list on group switcher change
	])

	/** Applies the selected summary tab and mirrors it into the session filter snapshot. */
	function handleSummaryFilterChange(value: typeof store.summaryFilter) {
		store.setSummaryFilter(value)
		patchAudioRecordingsFilterSession({ summaryFilter: value })
	}

	/** Recomputes rolling date ranges while storing only the stable preset key. */
	function handleDatePresetChange(value: AudioRecordingsDatePreset) {
		setDatePreset(value)
		const range = resolveDatePresetRange(value)
		store.setDateRange(range.start, range.end)
		patchAudioRecordingsFilterSession({ datePreset: value })
	}

	/** Persists search text without changing the existing debounce-based request cadence. */
	function handleSearchKeywordChange(value: string) {
		setSearchKeyword(value)
		patchAudioRecordingsFilterSession({ searchKeyword: value })
	}

	/** Persists the combined sort dropdown as the API-level sort field and direction. */
	function handleSortChange(sortBy: typeof store.sortBy, sortOrder: typeof store.sortOrder) {
		store.setSort(sortBy, sortOrder)
		patchAudioRecordingsFilterSession({ sortBy, sortOrder })
	}

	// Group Manage callbacks — manage dialog switches list filter after create
	const handleCreateGroupFromManage = async (name: string) => {
		const created = await recordingGroupsService.createGroup(name)
		await refreshGroups()
		handleGroupChange(created.id)
		return created
	}

	// Move dialog create only refreshes groups; selection stays inside the dialog
	const handleCreateGroupFromMove = async (name: string) => {
		const created = await recordingGroupsService.createGroup(name)
		await refreshGroups()
		return created
	}

	const handleRenameGroup = async (id: string, name: string) => {
		await recordingGroupsService.renameGroup(id, name)
		await refreshGroups()
	}

	const handleDeleteGroup = async (id: string) => {
		await recordingGroupsService.deleteGroup(id)
		if (currentGroupId === id) {
			handleGroupChange(ALL_RECORDING_GROUP_ID)
		}
		await refreshGroups()
		void store.fetchList({ page: 1, keyword: debouncedKeyword.trim() })
	}

	// Move item to group callback
	const handleMoveGroupChange = async (targetGroupId: string) => {
		if (!moveTarget) return
		try {
			await audioRecordingsService.batchMoveProjects([moveTarget.id], targetGroupId)
			await refreshGroups()
			void store.fetchList({ page: 1, keyword: debouncedKeyword.trim() })
			setMoveTarget(null)
			toast.success(t("super:mobile.recordingEntry.groupSheet.moveSuccess"))
		} catch {
			toast.error(t("super:mobile.recordingEntry.groupSheet.moveFailed"))
		}
	}

	function handleOpenDetail(item: AudioProjectListItem) {
		navigate({
			name: RouteName.AudioRecordingDetail,
			params: { projectId: item.id },
			state: {
				projectName: resolveRecordingDisplayName(item.project_name, item.created_at),
				cardStatus: item.card_status,
				audioFileId: item.audio_file_id,
			},
		})
	}

	/** Initializes Super Magic state before navigating from the recording card to its project view. */
	async function handleOpenProject(item: AudioProjectListItem) {
		try {
			await SuperMagicService.initializeState({ projectId: item.id })
		} catch (error) {
			console.error("Failed to initialize project state before navigation:", error)
		}

		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: item.id },
			state: { isAudioProjectEntry: true },
		})
	}

	function handleRenameRequest(item: AudioProjectListItem) {
		setRenameTarget(item)
	}

	function handleDeleteRequest(item: AudioProjectListItem) {
		setDeleteTargetIds([item.id])
	}

	async function handleRenameConfirm(projectId: string, name: string) {
		const success = await store.renameProject(projectId, name)
		if (success) {
			toast.success(t("actions.renameSuccess"))
			setRenameTarget(null)
			return
		}

		toast.error(t("actions.renameFailed"))
	}

	async function handleDeleteConfirm(projectIds: string[]) {
		if (!canDeleteRecordingProjects(projectIds)) return
		let success: boolean
		try {
			success = await store.batchDeleteProjects(projectIds)
		} catch (error) {
			if (handleRecordingProjectDeletionError(error)) return
			throw error
		}
		if (success) {
			toast.success(t("actions.deleteSuccess"))
			setDeleteTargetIds(null)
			// Trigger groups count refresh since projects are deleted
			void refreshGroups()
			return
		}

		toast.error(t("actions.deleteFailed"))
	}

	async function handleSummarize(item: AudioProjectListItem) {
		const result = await store.submitSummary(item)
		if (result.ok) return

		if (result.reason === "missingParams") {
			toast.error(t("summary.missingParams"))
			return
		}
		if (result.reason === "missingModel") {
			toast.error(t("summary.missingModel"))
			return
		}
		if (result.reason === "api") {
			toast.error(t("summary.submitFailed"))
		}
	}

	/** Submits a re-summary request immediately without a secondary scope dialog. */
	async function handleResummarize(item: AudioProjectListItem) {
		const result = await store.resubmitSummary(item)
		if (result.ok) return

		if (result.reason === "missingParams") {
			toast.error(t("summary.missingParams"))
			return
		}
		if (result.reason === "missingModel") {
			toast.error(t("summary.missingModel"))
			return
		}
		if (result.reason === "api") {
			toast.error(t("summary.submitFailed"))
		}
	}

	/** Recovers a merge_failed recording by calling the backend finish-recording recovery API. */
	async function handleRetryMerge(item: AudioProjectListItem) {
		const result = await store.retryMerge(item)
		if (result.ok) return

		if (result.reason === "missingParams") {
			toast.error(t("summary.missingParams"))
			return
		}
		if (result.reason === "api") {
			toast.error(t("summary.retryMergeFailed"))
		}
	}

	const isRefreshing = store.loading && !store.loadingMore
	const isSearchEmptyState = Boolean(debouncedKeyword.trim())
	// Keep the default empty state concise while preserving search-specific guidance.
	const emptyMessage = isSearchEmptyState ? t("empty.search") : ""

	return (
		<div
			className="mt-5 flex w-full min-w-0 flex-col gap-5 sm:gap-6"
			data-testid="audio-recordings-desktop"
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<h1 className="h-8 break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-lg font-semibold leading-8 text-transparent sm:h-9 sm:text-xl sm:leading-9 lg:h-10 lg:text-2xl lg:leading-10">
						{t("pageTitle")}
					</h1>
					<p className="max-w-2xl break-words text-sm text-muted-foreground">
						{t("subtitle")}
					</p>
				</div>
				{/* Desktop creation actions live beside the page title so the filter row stays query-focused. */}
				<AudioRecordingsPrimaryActions
					onOpenSettings={() => setIsSettingsOpen(true)}
					onImportFiles={(files) => void facade.importAudioFiles(files)}
					onStartRecording={() => void facade.startRecording()}
					isStartingRecording={
						facade.startupState === "starting" || facade.isPreparingRecordingStart
					}
				/>
			</div>

			<AudioRecordingsFilters
				listCount={store.list.length}
				summaryFilter={store.summaryFilter}
				datePreset={datePreset}
				sortBy={store.sortBy}
				sortOrder={store.sortOrder}
				searchKeyword={searchKeyword}
				isRefreshing={isRefreshing}
				groups={groups}
				totalGroupCount={totalGroupCount}
				ungroupedCount={ungroupedCount}
				currentGroupId={currentGroupId}
				onGroupChange={handleGroupChange}
				onManageGroups={() => setIsManageGroupsOpen(true)}
				onSummaryFilterChange={handleSummaryFilterChange}
				onDatePresetChange={handleDatePresetChange}
				onSortByChange={(value) => handleSortChange(value, store.sortOrder)}
				onSortOrderChange={(value) => handleSortChange(store.sortBy, value)}
				onSearchKeywordChange={handleSearchKeywordChange}
				onSearchCompositionStart={() => setIsSearchComposing(true)}
				onSearchCompositionEnd={() => setIsSearchComposing(false)}
				onRefresh={handleRefresh}
			/>

			{store.showInitialSkeleton ? (
				<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					{t("loading")}
				</div>
			) : null}

			{!store.showInitialSkeleton && mergedList.length === 0 ? (
				<div
					className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center"
					data-testid="audio-recordings-empty"
				>
					<p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
					{emptyMessage ? (
						<p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
					) : null}
				</div>
			) : null}

			{!store.showInitialSkeleton && mergedList.length > 0 ? (
				<div
					className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
					data-testid="audio-recordings-card-list"
				>
					{mergedList.map((item) => (
						<AudioRecordingCard
							key={item.id}
							item={item}
							onOpen={handleOpenDetail}
							onOpenProject={(entry) => void handleOpenProject(entry)}
							onSummarize={(entry) => {
								if (
									entry.card_status === "summarized" ||
									entry.card_status === "summary_failed"
								) {
									void handleResummarize(entry)
									return
								}
								void handleSummarize(entry)
							}}
							onRetryMerge={handleRetryMerge}
							onRename={handleRenameRequest}
							onDelete={handleDeleteRequest}
							onCopyToProject={(entry) => {
								void copyController.openCopyToProject(entry)
							}}
							onRetry={(entry) => void facade.retryImport(entry.id)}
							onMoveToGroup={setMoveTarget}
							isSubmitting={store.isSubmittingSummary(item.id)}
						/>
					))}
				</div>
			) : null}

			{store.loadingMore ? (
				<div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					{t("loadingMore")}
				</div>
			) : null}

			{!store.hasMore && mergedList.length > 0 && !store.loading ? (
				<div
					className="flex items-center justify-center gap-1 py-2 opacity-30"
					data-testid="audio-recordings-no-more"
				>
					<Check className="size-4" />
					<span className="text-xs">{t("end")}</span>
				</div>
			) : null}

			<div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />

			<AudioRecordingRenameDialog
				open={renameTarget != null}
				item={renameTarget}
				isSubmitting={renameTarget != null && store.isSubmittingAction(renameTarget.id)}
				onOpenChange={(open) => {
					if (!open) setRenameTarget(null)
				}}
				onConfirm={handleRenameConfirm}
			/>

			<AudioRecordingDeleteDialog
				projectIds={deleteTargetIds}
				onClose={() => setDeleteTargetIds(null)}
				onConfirm={handleDeleteConfirm}
			/>

			<AudioRecordingGroupManageDialog
				open={isManageGroupsOpen}
				onOpenChange={setIsManageGroupsOpen}
				groups={groups}
				onCreateGroup={handleCreateGroupFromManage}
				onRenameGroup={handleRenameGroup}
				onDeleteGroup={handleDeleteGroup}
				isSubmitting={groupLoading}
			/>

			<AudioRecordingMoveGroupDialog
				open={moveTarget != null}
				onOpenChange={(open) => {
					if (!open) setMoveTarget(null)
				}}
				groups={groups}
				ungroupedCount={ungroupedCount}
				selectedGroupId={moveTarget?.workspace_id ?? UNGROUPED_RECORDING_GROUP_ID}
				onSelect={handleMoveGroupChange}
				onCreateGroup={handleCreateGroupFromMove}
				onRenameGroup={handleRenameGroup}
				onDeleteGroup={handleDeleteGroup}
				isSubmitting={groupLoading}
			/>

			<AudioRecordingSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
			<AudioRecordingCopyDialog controller={copyController} />
		</div>
	)
}

export default observer(AudioRecordingsDesktop)
