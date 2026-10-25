import {
	canDeleteRecordingProjects,
	handleRecordingProjectDeletionError,
} from "@/services/recordSummary/projectDeletionRecordingNotice"
import type { ComponentType, ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { InfiniteScroll } from "antd-mobile"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AudioProjectListItem } from "@/types/audioProject"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { MobileResourceListSkeletonList } from "@/pages/superMagicMobile/components/skeletons"
import {
	isAudioProjectPreviewReady,
	resolveRecordingDisplayName,
} from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recordings-utils"
import { useAudioRecordingsOptimisticSync } from "@/pages/superMagic/pages/AudioRecordings/hooks/useAudioRecordingsOptimisticSync"
import { UNGROUPED_RECORDING_GROUP_ID } from "@/services/audioRecordings/RecordingGroupsConstants"
import { SuperMagicApi } from "@/apis"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { useMobileAudioRecordingsList } from "./hooks/useMobileAudioRecordingsList"
import { MobileRecordingCard } from "./components/MobileRecordingCard"
import { MobileRecordingFab } from "./components/MobileRecordingFab"
import { MobileRecordingFilterSheet } from "./components/MobileRecordingFilterSheet"
import { MobileRecordingGroupSheet } from "./components/MobileRecordingGroupSheet"
import { MobileRecordingImportSheet } from "./components/MobileRecordingImportSheet"
import { MobileRecordingListToolbar } from "./components/MobileRecordingListToolbar"
import { MobileRecordingMoveGroupSheet } from "./components/MobileRecordingMoveGroupSheet"
import { MobileRecordingMoreSheet } from "./components/MobileRecordingMoreSheet"
import { MobileActiveRecordingCard } from "./components/MobileActiveRecordingCard"
import { MobileActiveRecordingIndicator } from "./components/MobileActiveRecordingIndicator"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { RecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import { buildRecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"
import { buildRecordingShareSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/build-recording-share-selection"
import { AudioRecordingCopyDialog } from "@/pages/superMagic/pages/AudioRecordings/components/AudioRecordingCopyDialog"
import { useAudioRecordingCopyToProject } from "@/pages/superMagic/pages/AudioRecordings/hooks/useAudioRecordingCopyToProject"
import { canCopyAudioProject } from "@/pages/superMagic/pages/AudioRecordings/utils/copy-availability"
import recordingSummaryStore from "@/stores/recordingSummary"
import { cn } from "@/utils/cn"

/**
 * Mobile recordings list panel: toolbar, pull-to-refresh list, sheets, and FAB placeholder.
 * Data layer reuses PC AudioRecordingsStore scoped to this panel's lifecycle.
 */
interface AudioRecordingListPanelProps {
	isSessionActive?: boolean
	sessionTitle?: string
	sessionDuration?: string
	isSessionPaused?: boolean
	isSessionBusy?: boolean
	onResumeRecording?: () => void
	onStartRecording?: () => void
	onPauseRecording?: () => void
	onContinueRecording?: () => void
	onFinishRecording?: () => void
	WaveformComponent?: ComponentType<{ isRecording: boolean; isPaused: boolean }>
	optimisticItems?: AudioProjectListItem[]
	refreshToken?: number
	onImportFiles?: (files: FileList) => void
	isImporting?: boolean
	onResolveOptimisticItem?: (projectId: string) => void
	AudioUploadActionComponent?: ComponentType<{
		handler: (onUpload: () => void) => ReactNode
		onFileChange?: (files: FileList) => void
	}>
	onRetryUpload?: (projectId: string) => Promise<void>
	isOtherTabRecording?: boolean
}

interface ShareSheetState {
	projectId: string
	projectName: string
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	dependencyAttachments: AttachmentItem[]
	dependencyBundleRootPath?: string
	fileMap: RecordingDetailFileMap
	defaultSelectedFileIds: string[]
}

function AudioRecordingListPanel({
	isSessionActive = false,
	sessionTitle = "",
	sessionDuration = "00:00:00",
	isSessionPaused = false,
	isSessionBusy = false,
	onResumeRecording,
	onStartRecording,
	onPauseRecording,
	onContinueRecording,
	onFinishRecording,
	WaveformComponent,
	optimisticItems: propsOptimisticItems = [],
	refreshToken = 0,
	onImportFiles,
	isImporting = false,
	onResolveOptimisticItem,
	AudioUploadActionComponent,
	onRetryUpload,
	isOtherTabRecording = false,
}: AudioRecordingListPanelProps) {
	const { t } = useTranslation(["audioRecordings", "super"])
	const navigate = useNavigate()
	const [shareSheetState, setShareSheetState] = useState<ShareSheetState | null>(null)
	const [isActiveCardVisible, setIsActiveCardVisible] = useState(true)
	const [activeRecordingCardElement, setActiveRecordingCardElement] =
		useState<HTMLDivElement | null>(null)
	const {
		store,
		searchKeyword,
		setSearchKeyword,
		setIsSearchComposing,
		searchOpen,
		filterState,
		filterSheetOpen,
		setFilterSheetOpen,
		importSheetOpen,
		setImportSheetOpen,
		groupSheetOpen,
		setGroupSheetOpen,
		moveGroupSheetOpen,
		setMoveGroupSheetOpen,
		moveTarget,
		groups,
		totalGroupCount,
		ungroupedCount,
		currentGroupId,
		currentGroupLabel,
		currentGroupCount,
		groupActionSubmitting,
		activeFilterCount,
		debouncedKeyword,
		moreTarget,
		handleRefresh,
		handleLoadMore,
		handleSummaryFilterChange,
		handleFilterStateChange,
		handleOpenSearch,
		handleDismissSearch,
		handleOpenMore,
		handleCloseMore,
		handleGroupChange,
		handleCreateGroup,
		handleRenameGroup,
		handleDeleteGroup,
		handleOpenMoveGroup,
		handleMoveGroupChange,
		refreshGroups,
	} = useMobileAudioRecordingsList()
	const copyController = useAudioRecordingCopyToProject({
		onSuccess: handleRefresh,
	})

	// Prioritize store.optimisticItems to guarantee MobX reactive tracking,
	// falling back to propsOptimisticItems (mainly for unit tests where store is mocked).
	const optimisticItems =
		store.optimisticItems !== undefined ? store.optimisticItems : propsOptimisticItems

	// Calculate mergedList and sync optimistic items with backend via shared sync hook
	const mergedList = useAudioRecordingsOptimisticSync({
		storeList: store.list,
		optimisticItems,
		onResolveOptimisticItem,
		onRefresh: handleRefresh,
	})

	const showInitialSkeleton = store.showInitialSkeleton
	const isEmpty = !showInitialSkeleton && mergedList.length === 0
	const isSearchEmpty = isEmpty && debouncedKeyword.trim().length > 0
	const shouldStretchPullToRefresh = !showInitialSkeleton && (isEmpty || isSearchEmpty)
	// Mirror other mobile list pages: the pull-to-refresh wrapper must also hide overflow
	// while empty so the inner antd-mobile structure keeps the remaining viewport height.
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"
	// Let the list content consume the remaining viewport height when the page is empty,
	// so the empty-state block can center itself within the area below the toolbar.
	const listContentClassName = shouldStretchPullToRefresh
		? "flex min-h-full flex-1 flex-col gap-2.5 px-3 pb-20 pt-4"
		: "flex min-h-full flex-col gap-2.5 px-3 pb-20 pt-4"

	/**
	 * Re-syncs the list after a recording is completed so the optimistic card can
	 * later be replaced by the authoritative backend row.
	 */
	useEffect(() => {
		if (!refreshToken) return
		void handleRefresh()
	}, [handleRefresh, refreshToken])

	/**
	 * Mirrors the prototype behavior: once the active recording card scrolls out
	 * of view, promote a floating indicator so users can jump back immediately.
	 */
	useEffect(() => {
		if (!isSessionActive) {
			setIsActiveCardVisible(true)
			return
		}

		if (!WaveformComponent) {
			setIsActiveCardVisible(true)
			return
		}

		if (typeof IntersectionObserver === "undefined") {
			setIsActiveCardVisible(true)
			return
		}

		const target = activeRecordingCardElement
		if (!target) {
			setIsActiveCardVisible(true)
			return
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsActiveCardVisible(entry?.isIntersecting ?? true)
			},
			{ threshold: 0.1 },
		)

		observer.observe(target)

		return () => {
			observer.disconnect()
			setIsActiveCardVisible(true)
		}
	}, [WaveformComponent, activeRecordingCardElement, isSessionActive])

	useEffect(() => {
		// Keep global FloatPanel suppression in sync with list-page card visibility.
		recordingSummaryStore.floatPanel.setExternallyHidden(isSessionActive && isActiveCardVisible)

		return () => {
			recordingSummaryStore.floatPanel.setExternallyHidden(false)
			// When the user navigates away from the recordings list while a session is
			// active, collapse the legacy FloatPanel so it appears as the small
			// floating capsule on other pages rather than as a pre-opened bottom sheet.
			if (isSessionActive) {
				recordingSummaryStore.floatPanel.setExpanded(false)
			}
		}
	}, [isActiveCardVisible, isSessionActive])

	function handleOpenDetail(item: AudioProjectListItem) {
		if (!isAudioProjectPreviewReady(item)) return

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

	/** Navigates mobile recordings to the project entry route; MainLayout restores mobile state. */
	function handleOpenProject(item: AudioProjectListItem) {
		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: item.id },
		})
	}

	async function handleSummarize(item: AudioProjectListItem) {
		const result = await store.submitSummary(item)
		if (result.ok) return true

		if (result.reason === "missingParams") {
			toast.error(t("audioRecordings:summary.missingParams"))
			return false
		}
		if (result.reason === "missingModel") {
			toast.error(t("audioRecordings:summary.missingModel"))
			return false
		}
		if (result.reason === "api") {
			toast.error(t("audioRecordings:summary.submitFailed"))
			return false
		}
		return false
	}

	/** Routes completed or failed summary attempts to direct re-summary without a scope dialog. */
	async function handleSummaryAction(item: AudioProjectListItem) {
		if (item.card_status === "summarized" || item.card_status === "summary_failed") {
			return handleResummarize(item)
		}
		return handleSummarize(item)
	}

	/** Submits direct re-summary through the shared list store. */
	async function handleResummarize(item: AudioProjectListItem) {
		const result = await store.resubmitSummary(item)
		if (result.ok) return true

		if (result.reason === "missingParams") {
			toast.error(t("audioRecordings:summary.missingParams"))
			return false
		}
		if (result.reason === "missingModel") {
			toast.error(t("audioRecordings:summary.missingModel"))
			return false
		}
		if (result.reason === "api") {
			toast.error(t("audioRecordings:summary.submitFailed"))
			return false
		}
		return false
	}

	/** Recovers a merge_failed recording by calling the backend finish-recording recovery API. */
	async function handleRetryMerge(item: AudioProjectListItem) {
		const result = await store.retryMerge(item)
		if (result.ok) return

		if (result.reason === "missingParams") {
			toast.error(t("audioRecordings:summary.missingParams"))
			return
		}
		if (result.reason === "api") {
			toast.error(t("audioRecordings:summary.retryMergeFailed"))
		}
	}

	async function handleRename(projectId: string, name: string) {
		const success = await store.renameProject(projectId, name)
		if (success) {
			toast.success(t("audioRecordings:actions.renameSuccess"))
			return true
		}
		toast.error(t("audioRecordings:actions.renameFailed"))
		return false
	}

	async function handleDelete(projectId: string) {
		if (!canDeleteRecordingProjects([projectId])) return false
		let success: boolean
		try {
			success = await store.deleteProject(projectId)
		} catch (error) {
			if (handleRecordingProjectDeletionError(error)) return false
			throw error
		}
		if (success) {
			onResolveOptimisticItem?.(projectId)
			toast.success(t("audioRecordings:actions.deleteSuccess"))
			void refreshGroups()
			return true
		}
		toast.error(t("audioRecordings:actions.deleteFailed"))
		return false
	}

	async function handleMoveToGroup(groupId: string) {
		const success = await handleMoveGroupChange(groupId)
		if (success) {
			toast.success(t("super:mobile.recordingEntry.groupSheet.moveSuccess"))
			return
		}
		toast.error(t("super:mobile.recordingEntry.groupSheet.moveFailed"))
	}

	/**
	 * Loads the target project's attachments on demand so the list-page share action
	 * can reuse the same mobile project-share sheet as the detail page.
	 */
	async function handleShareProject() {
		if (!moreTarget?.id) return

		try {
			const response = await SuperMagicApi.getAttachmentsByProjectId({
				projectId: moreTarget.id,
				temporaryToken: "",
			})
			const processed = AttachmentDataProcessor.processAttachmentData(response)
			const fileMap = buildRecordingDetailFileMap({
				tree: processed.tree,
				list: processed.list,
			})
			const shareSelection = buildRecordingShareSelection(fileMap)

			if (shareSelection.defaultSelectedFileIds.length === 0) {
				toast.error(t("super:share.noShareableFiles"))
				return
			}

			setShareSheetState({
				projectId: moreTarget.id,
				projectName: resolveRecordingDisplayName(
					moreTarget.project_name,
					moreTarget.created_at,
				),
				attachments: shareSelection.shareableFiles,
				attachmentList: shareSelection.shareableFiles,
				dependencyAttachments: processed.list,
				dependencyBundleRootPath: fileMap.bundleRootPath,
				fileMap,
				defaultSelectedFileIds: shareSelection.defaultSelectedFileIds,
			})
		} catch {
			toast.error(t("audioRecordings:detail.loadFailed"))
		}
	}

	return (
		<div
			className="relative flex min-h-0 flex-1 flex-col"
			data-testid="mobile-audio-recording-list-panel"
		>
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				contentDeps={[
					store.list.length,
					showInitialSkeleton,
					store.summaryFilter,
					filterState,
				]}
			>
				<MagicPullToRefresh
					embedInParentScroll
					onRefresh={handleRefresh}
					containerClassName={cn(
						"relative min-h-0 flex-1",
						shouldStretchPullToRefresh &&
							cn("h-full !overflow-hidden", pullToRefreshStretchClassName),
					)}
					showSuccessMessage={false}
				>
					<div className={listContentClassName}>
						{showInitialSkeleton ? (
							<MobileResourceListSkeletonList testId="mobile-recording-list-skeleton" />
						) : (
							<>
								{/* Active Recording Card shown ABOVE the toolbar row */}
								{isSessionActive && !isOtherTabRecording && WaveformComponent ? (
									<div ref={setActiveRecordingCardElement}>
										<MobileActiveRecordingCard
											title={sessionTitle}
											duration={sessionDuration}
											isPaused={isSessionPaused}
											isBusy={isSessionBusy}
											onOpen={() => onResumeRecording?.()}
											onPause={() => onPauseRecording?.()}
											onResume={() => onContinueRecording?.()}
											onFinish={() => onFinishRecording?.()}
										/>
									</div>
								) : null}

								{/* Toolbar row (Filter, Search, Upload, Group Picker) */}
								<MobileRecordingListToolbar
									groupLabel={currentGroupLabel}
									groupCount={currentGroupCount}
									activeFilterCount={activeFilterCount}
									searchOpen={searchOpen}
									searchKeyword={searchKeyword}
									onSearchKeywordChange={setSearchKeyword}
									onSearchCompositionStart={() => setIsSearchComposing(true)}
									onSearchCompositionEnd={() => setIsSearchComposing(false)}
									onOpenSearch={handleOpenSearch}
									onDismissSearch={handleDismissSearch}
									onOpenGroupSheet={() => setGroupSheetOpen(true)}
									onOpenFilterSheet={() => setFilterSheetOpen(true)}
									onOpenImportSheet={() => setImportSheetOpen(true)}
								/>

								{/* Data area (Empty states or the list of recording cards) */}
								{isSearchEmpty ? (
									<DataEmptyState
										variant="search"
										className="flex-1 py-0"
										testId="mobile-recording-search-empty-state"
									/>
								) : isEmpty ? (
									<DataEmptyState
										variant="recording"
										className="flex-1 py-0"
										testId="mobile-recording-list-empty-state"
									/>
								) : (
									<div
										className="flex flex-col gap-2.5"
										data-testid="mobile-recording-card-list"
									>
										{mergedList.map((item) => (
											<MobileRecordingCard
												key={item.id}
												item={item}
												onOpen={handleOpenDetail}
												onSummarize={(entry) =>
													void handleSummaryAction(entry)
												}
												onMore={handleOpenMore}
												onRetry={(entry) => void onRetryUpload?.(entry.id)}
												onRetryMerge={handleRetryMerge}
												isSubmitting={store.isSubmittingSummary(item.id)}
											/>
										))}
									</div>
								)}

								{/* Infinite scroll pagination */}
								{mergedList.length > 0 ? (
									<InfiniteScroll
										loadMore={handleLoadMore}
										hasMore={store.hasMore}
										threshold={120}
									/>
								) : null}
							</>
						)}
					</div>
				</MagicPullToRefresh>
			</ScrollEdgeFadeContainer>

			<MobileRecordingFab hidden={isSessionActive} onClick={() => onStartRecording?.()} />

			<MobileActiveRecordingIndicator
				hidden={!isSessionActive || isOtherTabRecording || isActiveCardVisible}
				duration={sessionDuration}
				isPaused={isSessionPaused}
				onOpen={() => onResumeRecording?.()}
			/>

			<MobileRecordingFilterSheet
				open={filterSheetOpen}
				onOpenChange={setFilterSheetOpen}
				filter={filterState}
				summaryFilter={store.summaryFilter}
				onChange={handleFilterStateChange}
				onSummaryFilterChange={handleSummaryFilterChange}
			/>

			<MobileRecordingGroupSheet
				open={groupSheetOpen}
				onOpenChange={setGroupSheetOpen}
				groups={groups}
				selectedGroupId={currentGroupId}
				totalCount={totalGroupCount}
				ungroupedCount={ungroupedCount}
				onSelect={handleGroupChange}
				onCreateGroup={handleCreateGroup}
				onRenameGroup={handleRenameGroup}
				onDeleteGroup={handleDeleteGroup}
				isSubmitting={groupActionSubmitting}
			/>

			{AudioUploadActionComponent ? (
				<MobileRecordingImportSheet
					open={importSheetOpen}
					onOpenChange={setImportSheetOpen}
					onImportFiles={(files) => onImportFiles?.(files)}
					isImporting={isImporting}
					AudioUploadActionComponent={AudioUploadActionComponent}
				/>
			) : null}

			<MobileRecordingMoreSheet
				isOpen={moreTarget != null}
				item={moreTarget}
				onClose={handleCloseMore}
				onRename={handleRename}
				onDelete={handleDelete}
				onOpenProject={handleOpenProject}
				onSummarize={handleSummaryAction}
				onMoveToGroup={handleOpenMoveGroup}
				onCopyToProject={(item) => {
					void copyController.openCopyToProject(item)
				}}
				onShare={() => {
					void handleShareProject()
				}}
				isSubmittingAction={moreTarget != null && store.isSubmittingAction(moreTarget.id)}
				isSubmittingSummary={moreTarget != null && store.isSubmittingSummary(moreTarget.id)}
				canCopyToProject={moreTarget ? canCopyAudioProject(moreTarget).canCopy : false}
				showRegenerateAction
			/>

			<MobileRecordingMoveGroupSheet
				open={moveGroupSheetOpen}
				onOpenChange={setMoveGroupSheetOpen}
				groups={groups}
				selectedGroupId={moveTarget?.workspace_id ?? UNGROUPED_RECORDING_GROUP_ID}
				ungroupedCount={ungroupedCount}
				onSelect={(groupId) => void handleMoveToGroup(groupId)}
			/>

			<ProjectShareSheet
				open={shareSheetState != null}
				onClose={() => setShareSheetState(null)}
				mode="file"
				projectMode="audio"
				projectId={shareSheetState?.projectId}
				projectName={shareSheetState?.projectName}
				attachments={shareSheetState?.attachments ?? []}
				attachmentList={shareSheetState?.attachmentList ?? []}
				dependencyAttachments={shareSheetState?.dependencyAttachments ?? []}
				dependencyBundleRootPath={shareSheetState?.dependencyBundleRootPath}
				fileMap={shareSheetState?.fileMap}
				defaultSelectedFileIds={shareSheetState?.defaultSelectedFileIds}
			/>
			<AudioRecordingCopyDialog controller={copyController} />
		</div>
	)
}

export default observer(AudioRecordingListPanel)
