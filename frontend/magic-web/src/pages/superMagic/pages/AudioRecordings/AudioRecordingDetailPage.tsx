import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { useIsMobile } from "@/hooks/useIsMobile"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AudioProjectListItem, AudioRecordingCardStatus } from "@/types/audioProject"
import {
	recordingGroupsService,
	UNGROUPED_RECORDING_GROUP_ID,
	type AudioRecordingGroup,
} from "@/services/audioRecordings"
import { saveMediaSpeakersAndMagicProjectJs } from "@/pages/superMagic/components/Detail/contents/HTML/media/utils"
import { collectSpeakerIdsFromText } from "./utils/markdown-time-links"
import { normalizeSpeakerSelection } from "./utils/speaker-filter"
import { hasRecordingDetailTabStrip } from "./utils/recording-detail-files"
import { useRecordingDetailData } from "./hooks/useRecordingDetailData"
import { useRecordingAudioPlayer } from "./hooks/useRecordingAudioPlayer"
import { useRecordingColorSegments } from "./hooks/useRecordingColorSegments"
import { useRecordingDetailActions } from "./hooks/useRecordingDetailActions"
import {
	isAudioProjectSummarizing,
	isAudioProjectSummaryReady,
} from "./utils/audio-recordings-utils"
import { resolveDetailSummaryVisualState } from "./utils/summary-action-utils"
import { playTranscriptFromSegment } from "./utils/transcript-playback"
import { OWNER_RECORDING_DETAIL_CAPABILITIES } from "./types/recording-detail-capabilities"
import type { RecordingTranscriptSegment } from "./types/recording-detail"
import { RecordingDetailProvider } from "./components/recording-detail/RecordingDetailProvider"
import { RecordingDetailHeader } from "./components/recording-detail/RecordingDetailHeader"
import { RecordingDetailWorkbench } from "./components/recording-detail/RecordingDetailWorkbench"
import { RecordingDetailLeftColumn } from "./components/recording-detail/RecordingDetailLeftColumn"
import { RecordingDetailRightPanel } from "./components/recording-detail/RecordingDetailRightPanel"
import RecordingDetailChatPanel from "./components/recording-detail/RecordingDetailChatPanel"
import {
	RecordingDetailEmptyState,
	RecordingDetailPageSkeleton,
} from "./components/recording-detail/RecordingDetailEmptyState"
import { RecordingDetailSpeakerDialog } from "./components/recording-detail/RecordingDetailSpeakerDialog"
import { useRecordingDetailShareControls } from "./components/recording-detail/useRecordingDetailShareControls"
import RecordingShareManagementDialog from "./components/recording-detail/RecordingShareManagementDialog"
import { AudioRecordingMoveGroupDialog } from "./components/AudioRecordingGroupDialogs"
import { AudioRecordingCopyDialog } from "./components/AudioRecordingCopyDialog"
import ShareModal from "@/pages/superMagic/components/Share/Modal"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import { createRecordingShareUiConfig } from "@/pages/superMagic/components/Share/utils/recordingShareUiConfig"
import { AUDIO_RECORDINGS_PAGE_SHELL_CLASS } from "./constants/page-shell"
import { useAudioRecordingCopyToProject } from "./hooks/useAudioRecordingCopyToProject"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { useRecordingProjectChat } from "./hooks/useRecordingProjectChat"
import { useRecordingDetailConversationPanelState } from "./hooks/useRecordingDetailConversationPanelState"
import { useRecordingDetailTranscriptPanelState } from "./hooks/useRecordingDetailTranscriptPanelState"
import { RecordingDetailConversationResizeHandle } from "./components/recording-detail/RecordingDetailConversationResizeHandle"
import {
	RECORDING_CHAT_COLLAPSED_WIDTH,
	RECORDING_CHAT_HISTORY_WIDTH,
} from "./components/recording-detail/recording-detail-layout"
import type { ConversationPanelDragCommit } from "./stores/RecordingConversationPanelDragStore"

const MobileAudioRecordingDetailPage = lazy(
	() => import("@/pages/superMagicMobile/pages/AudioRecordingDetail"),
)

interface AudioRecordingDetailLocationState {
	projectName?: string
	cardStatus?: AudioRecordingCardStatus
	audioFileId?: string
}

/** Desktop recording detail workbench replacing the legacy iframe HTML preview. */
function AudioRecordingDetailPageDesktop() {
	const { t } = useTranslation("audioRecordings")
	const navigate = useNavigate()
	const location = useLocation()
	const { projectId = "" } = useParams<{ projectId: string }>()
	const locationState = location.state as AudioRecordingDetailLocationState | null

	const {
		loading,
		error,
		projectItem,
		fileMap,
		texts,
		audioUrl,
		title,
		attachmentTree,
		attachmentList,
		refresh,
		mutateAudioProjectItem,
	} = useRecordingDetailData({
		projectId,
		initialTitle: locationState?.projectName,
	})

	const player = useRecordingAudioPlayer(audioUrl)
	const { seekTo, playSegment } = player
	const [detailItem, setDetailItem] = useState<AudioProjectListItem | null>(null)
	const [titleOverride, setTitleOverride] = useState("")
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const [speakerSettingsOpen, setSpeakerSettingsOpen] = useState(false)
	const [speakerDraft, setSpeakerDraft] = useState<Record<string, string>>({})
	const [speakerNameOverrides, setSpeakerNameOverrides] = useState<Record<string, string>>({})
	const [speakerFilterProjectId, setSpeakerFilterProjectId] = useState(projectId)
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
	const [moveGroupOpen, setMoveGroupOpen] = useState(false)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [groups, setGroups] = useState<AudioRecordingGroup[]>([])
	const [ungroupedCount, setUngroupedCount] = useState(0)
	const [chatHistoryOpen, setChatHistoryOpen] = useState(false)
	const {
		isConversationPanelCollapsed,
		conversationPanelWidth,
		conversationPanelRef,
		toggleConversationPanel,
		expandConversationPanel,
		collapseConversationPanel,
		setConversationPanelWidth,
	} = useRecordingDetailConversationPanelState()
	const chat = useRecordingProjectChat({
		projectId,
		attachmentsLoading: loading,
		attachmentTree,
		attachmentList,
	})

	const resolvedItem = detailItem ?? projectItem
	const displayTitle = titleOverride || title || t("detail.untitled")

	const actions = useRecordingDetailActions({
		projectId,
		projectItem: resolvedItem,
		fileMap,
		recordingName: displayTitle,
		onProjectItemChange: (item) => {
			setDetailItem(item)
			mutateAudioProjectItem(item)
		},
		onRefresh: refresh,
	})

	const shareControls = useRecordingDetailShareControls({
		projectId,
		fileMap,
	})
	const copyController = useAudioRecordingCopyToProject({
		onSuccess: refresh,
	})

	useEffect(() => {
		setDetailItem(projectItem)
	}, [projectItem])

	useEffect(() => {
		setChatHistoryOpen(false)
	}, [projectId])

	/** Toggles the conversation rail and dismisses topic history before collapsing it. */
	const handleToggleConversationPanel = useCallback(() => {
		if (!isConversationPanelCollapsed) setChatHistoryOpen(false)
		toggleConversationPanel()
	}, [isConversationPanelCollapsed, toggleConversationPanel])

	/** Restores the full conversation width without changing the selected topic or messages. */
	const handleExpandConversationPanel = useCallback(() => {
		expandConversationPanel()
	}, [expandConversationPanel])

	/**
	 * Persists a finished conversation drag. Collapse closes topic history first and keeps the
	 * pre-drag conversation width; a normal release only updates that width.
	 */
	const handleConversationDragCommit = useCallback(
		(result: ConversationPanelDragCommit) => {
			if (result.collapsed) {
				setChatHistoryOpen(false)
				collapseConversationPanel()
				return
			}
			setConversationPanelWidth(result.width)
		},
		[collapseConversationPanel, setConversationPanelWidth],
	)

	useEffect(() => {
		setSpeakerNameOverrides(fileMap?.magicProjectConfig?.metadata?.speakers ?? {})
	}, [fileMap?.magicProjectConfig?.metadata?.speakers, projectId])

	useEffect(() => {
		if (!moveGroupOpen) return
		void recordingGroupsService.listGroups().then((result) => {
			setGroups(result.groups)
			setUngroupedCount(result.ungroupedCount)
		})
	}, [moveGroupOpen])

	/** Refreshes move-target groups after inline CRUD without reloading the detail page */
	const refreshMoveGroups = useCallback(async () => {
		const result = await recordingGroupsService.listGroups()
		setGroups(result.groups)
		setUngroupedCount(result.ungroupedCount)
	}, [])

	const handleCreateGroupFromMove = useCallback(
		async (name: string) => {
			const created = await recordingGroupsService.createGroup(name)
			await refreshMoveGroups()
			return created
		},
		[refreshMoveGroups],
	)

	const handleRenameGroupFromMove = useCallback(
		async (id: string, name: string) => {
			await recordingGroupsService.renameGroup(id, name)
			await refreshMoveGroups()
		},
		[refreshMoveGroups],
	)

	const handleDeleteGroupFromMove = useCallback(
		async (id: string) => {
			await recordingGroupsService.deleteGroup(id)
			await refreshMoveGroups()
		},
		[refreshMoveGroups],
	)

	const summaryReady = useMemo(() => {
		if (resolvedItem) return isAudioProjectSummaryReady(resolvedItem)
		return locationState?.cardStatus === "summarized"
	}, [locationState?.cardStatus, resolvedItem])
	// Completed recordings keep the historical summary path; only in-progress previews require parsed config.
	const summaryPreviewAvailable =
		summaryReady ||
		(Boolean(resolvedItem && isAudioProjectSummarizing(resolvedItem)) &&
			Boolean(fileMap?.magicProject && fileMap.magicProjectConfig))

	// A collapsed transcript column needs a tab-strip expand entry, so collapse only when the summary is ready.
	const canCollapseTranscript =
		summaryPreviewAvailable && hasRecordingDetailTabStrip(fileMap, true)
	const {
		isTranscriptPanelCollapsed,
		transcriptPanelWidth,
		workbenchGridRef,
		expandTranscriptPanel,
		collapseTranscriptPanel,
		setTranscriptPanelWidth,
	} = useRecordingDetailTranscriptPanelState()

	/** Routes a finished transcript drag to the matching persisted transition. */
	const handleTranscriptDragCommit = useCallback(
		(result: { collapsed: boolean; width: number }) => {
			if (result.collapsed) collapseTranscriptPanel()
			else setTranscriptPanelWidth(result.width)
		},
		[collapseTranscriptPanel, setTranscriptPanelWidth],
	)

	const detailSummaryState = useMemo(
		() =>
			resolveDetailSummaryVisualState({
				summaryReady,
				phase: resolvedItem?.current_phase ?? null,
				status: resolvedItem?.phase_status ?? null,
				cardStatus: resolvedItem?.card_status ?? locationState?.cardStatus,
				isSubmitting: actions.summarySubmitting,
				extra: {
					task_key: resolvedItem?.task_key,
					topic_id: resolvedItem?.topic_id,
					audio_file_id: resolvedItem?.audio_file_id,
					audio_source: resolvedItem?.audio_source,
					model_id: resolvedItem?.model_id,
				},
			}),
		[
			actions.summarySubmitting,
			locationState?.cardStatus,
			resolvedItem?.audio_file_id,
			resolvedItem?.audio_source,
			resolvedItem?.card_status,
			resolvedItem?.current_phase,
			resolvedItem?.model_id,
			resolvedItem?.phase_status,
			resolvedItem?.task_key,
			resolvedItem?.topic_id,
			summaryReady,
		],
	)
	const detailUnavailable =
		!summaryReady && detailSummaryState.status === "unavailable" && Boolean(resolvedItem)

	const shouldUseResummarize =
		summaryReady ||
		detailSummaryState.status === "failed" ||
		resolvedItem?.card_status === "summarized"

	const speakerNameMap = useMemo(() => {
		const merged = {
			...(fileMap?.magicProjectConfig?.metadata?.speakers ?? {}),
			...speakerNameOverrides,
		}
		return merged
	}, [fileMap?.magicProjectConfig?.metadata?.speakers, speakerNameOverrides])

	/** Routes summary actions to initial generation or direct re-summary based on current detail state. */
	function handleSummaryAction() {
		if (shouldUseResummarize) {
			void actions.resubmitSummary()
			return
		}
		void actions.submitSummary()
	}

	const speakerIds = useMemo(
		() =>
			collectRecordingSpeakerIds([
				texts.transcript?.content,
				texts.notes?.content,
				...Object.values(texts.summary).map((entry) => entry?.content),
			]),
		[texts],
	)
	const effectiveSelectedSpeakerIds = useMemo(
		() =>
			speakerFilterProjectId === projectId
				? normalizeSpeakerSelection(speakerIds, selectedSpeakerIds)
				: speakerIds,
		[projectId, selectedSpeakerIds, speakerFilterProjectId, speakerIds],
	)

	useEffect(() => {
		if (speakerFilterProjectId === projectId) return
		setSpeakerFilterProjectId(projectId)
		setSelectedSpeakerIds([])
	}, [projectId, speakerFilterProjectId])

	const summaryContent = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(texts.summary).map(([key, value]) => [key, value?.content]),
			),
		[texts.summary],
	)

	const colorSegments = useRecordingColorSegments(
		summaryPreviewAvailable,
		texts.summary.topics?.content,
	)

	function handleBack() {
		navigate({ name: RouteName.AudioRecordings })
	}

	/** Routes to the normal project view while leaving project-state hydration to the route owner. */
	function handleOpenProject() {
		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId },
		})
	}

	async function handleRename(name: string) {
		const ok = await actions.renameProject(name)
		if (ok) setTitleOverride(name)
		return ok
	}

	const openSpeakerSettings = useCallback(() => {
		const draft = Object.fromEntries(
			speakerIds.map((speakerId) => [speakerId, speakerNameMap[speakerId] ?? speakerId]),
		)
		setSpeakerDraft(draft)
		setSpeakerSettingsOpen(true)
	}, [speakerIds, speakerNameMap])

	const handleSummaryTimeClick = useCallback(
		(seconds: number, end?: number) => {
			if (end != null) playSegment({ start: seconds, end })
			else seekTo(seconds, { autoplay: true })
		},
		[playSegment, seekTo],
	)

	const handlePlaySegment = useCallback(
		(segment: RecordingTranscriptSegment) => {
			// Desktop transcript clicks should jump into the full recording and continue playback from that sentence.
			playTranscriptFromSegment({ seekTo }, segment.start)
		},
		[seekTo],
	)

	/** Binds speaker-filter changes to the current project so the selection resets only across detail-page boundaries. */
	const handleSelectedSpeakerIdsChange = useCallback(
		(speakerIdsToSelect: string[]) => {
			setSpeakerFilterProjectId(projectId)
			setSelectedSpeakerIds(speakerIdsToSelect)
		},
		[projectId],
	)

	async function handleSaveSpeakers() {
		if (!texts.magicProject?.fileId || !texts.magicProject.content) return
		const nextSpeakers = { ...speakerNameMap, ...speakerDraft }
		try {
			await saveMediaSpeakersAndMagicProjectJs({
				mediaSpeakers: nextSpeakers,
				magicProjectJsFileInfo: {
					fileId: texts.magicProject.fileId,
					content: texts.magicProject.content,
				},
			})
			setSpeakerNameOverrides(nextSpeakers)
			setSpeakerSettingsOpen(false)
			// Keep the rendered detail and active player mounted while persisted speaker metadata syncs.
			void refresh({ silent: true })
		} catch {
			// save errors surface through shared media util logging
		}
	}

	// Collapsed is the 24px rail. Expanded width is the persisted conversation surface; history adds 240 on top.
	const conversationRailWidth = isConversationPanelCollapsed
		? RECORDING_CHAT_COLLAPSED_WIDTH
		: conversationPanelWidth
	const chatPanelWidth =
		conversationRailWidth +
		(!isConversationPanelCollapsed && chatHistoryOpen ? RECORDING_CHAT_HISTORY_WIDTH : 0)

	return (
		<RecordingDetailProvider capabilities={OWNER_RECORDING_DETAIL_CAPABILITIES}>
			<>
				<div
					className="flex h-full min-h-0 w-full min-w-0 gap-2 overflow-hidden"
					data-testid="audio-recording-detail-page"
				>
					<div
						className={`${AUDIO_RECORDINGS_PAGE_SHELL_CLASS} min-w-0 flex-1`}
						data-testid="audio-recording-detail-card"
					>
						<RecordingDetailHeader
							title={displayTitle}
							projectItem={resolvedItem}
							fileMap={fileMap}
							exportAvailability={actions.exportAvailability}
							canGenerateSummary={actions.canGenerateSummary}
							summarySubmitting={actions.summarySubmitting}
							renaming={actions.renaming}
							onBack={handleBack}
							onRename={handleRename}
							onGenerateSummary={handleSummaryAction}
							onExportAudio={() => void actions.downloadAudio()}
							onExportTranscript={() => void actions.downloadTranscript()}
							onExportNotes={() => void actions.downloadNotes()}
							onExportSummaryType={(type) => void actions.downloadSummaryType(type)}
							onExportAll={() => void actions.downloadAll()}
							onCreateShare={shareControls.openCreateShare}
							onManageShare={shareControls.openManageShare}
							onOpenProject={() => void handleOpenProject()}
							onMoveGroup={() => setMoveGroupOpen(true)}
							onCopyToProject={() => {
								if (resolvedItem)
									void copyController.openCopyToProject(resolvedItem)
							}}
							onDelete={() => setDeleteOpen(true)}
						/>

						{loading ? <RecordingDetailPageSkeleton /> : null}

						{!loading && error ? (
							<RecordingDetailEmptyState
								variant="pageError"
								className="flex-1"
								onAction={handleBack}
								actionLabel={t("detail.back")}
							/>
						) : null}

						{!loading && !error && detailUnavailable ? (
							<RecordingDetailEmptyState
								variant="pageError"
								className="flex-1"
								onAction={handleBack}
								actionLabel={t("detail.back")}
							/>
						) : null}

						{!loading && !error && !detailUnavailable ? (
							<RecordingDetailWorkbench
								transcriptCollapsed={isTranscriptPanelCollapsed}
								transcriptWidth={transcriptPanelWidth}
								canCollapseTranscript={canCollapseTranscript}
								onTranscriptDragCommit={handleTranscriptDragCommit}
								gridRef={workbenchGridRef}
								left={
									<RecordingDetailLeftColumn
										searchScopeKey={projectId}
										audioRef={player.audioRef}
										audioUrl={audioUrl}
										transcriptMarkdown={texts.transcript?.content}
										currentSec={player.currentTime}
										currentTime={player.currentTime}
										duration={player.duration}
										playing={player.playing}
										expanded={playerExpanded}
										playbackRate={player.playbackRate}
										colorSegments={colorSegments}
										speakerNameMap={speakerNameMap}
										selectedSpeakerIds={effectiveSelectedSpeakerIds}
										onSelectedSpeakerIdsChange={handleSelectedSpeakerIdsChange}
										onToggle={player.toggle}
										onSeek={player.seekTo}
										onPlaySegment={handlePlaySegment}
										onExpandedChange={setPlayerExpanded}
										onPlaybackRateChange={player.setPlaybackRate}
										onOpenSpeakerSettings={openSpeakerSettings}
										isSummarizing={detailSummaryState.status === "generating"}
									/>
								}
								right={
									<RecordingDetailRightPanel
										fileMap={fileMap}
										summaryContent={summaryContent}
										notesContent={texts.notes?.content}
										attachmentTree={
											attachmentTree as unknown as AttachmentFile[]
										}
										notesFilePath={
											fileMap?.notes?.relative_file_path ??
											fileMap?.notes?.path
										}
										attachmentList={attachmentList}
										summaryReady={summaryPreviewAvailable}
										summarizing={detailSummaryState.status === "generating"}
										summaryFailed={detailSummaryState.status === "failed"}
										speakerNameMap={speakerNameMap}
										onOpenSpeakerSettings={openSpeakerSettings}
										onTimeClick={handleSummaryTimeClick}
										onGenerateSummary={handleSummaryAction}
										summarySubmitting={actions.summarySubmitting}
										transcriptCollapsed={isTranscriptPanelCollapsed}
										onExpandTranscript={expandTranscriptPanel}
									/>
								}
							/>
						) : null}
					</div>

					{/* Mount chat as soon as the page is not fatal; detail attachment loading must not unmount it. */}
					{!error && !detailUnavailable ? (
						<div
							ref={conversationPanelRef}
							className="relative h-full min-h-0 max-w-full shrink-0 bg-sidebar transition-[width,min-width] duration-300 data-[resizing=true]:select-none [&[data-resizing=true]>div]:pointer-events-none [&[data-resizing=true]_[data-slot=resizable-handle]]:pointer-events-auto"
							style={{ width: chatPanelWidth, minWidth: chatPanelWidth }}
							data-testid="recording-detail-chat-rail"
							data-collapsed={String(isConversationPanelCollapsed)}
						>
							{/* Keep the handle outside the clipped chat so it can sit in the page gap. */}
							{isConversationPanelCollapsed ? null : (
								<RecordingDetailConversationResizeHandle
									panelRef={conversationPanelRef}
									conversationWidth={conversationPanelWidth}
									historyOffset={
										chatHistoryOpen ? RECORDING_CHAT_HISTORY_WIDTH : 0
									}
									onCommit={handleConversationDragCommit}
								/>
							)}
							{/* Clip chat independently so collapse still hides overflowing messages. */}
							<div className="h-full min-h-0 overflow-hidden">
								{/* Keep the conversation mounted while only its sibling rail width changes. */}
								<RecordingDetailChatPanel
									isConversationPanelCollapsed={isConversationPanelCollapsed}
									historyOpen={chatHistoryOpen}
									onToggleConversationPanel={handleToggleConversationPanel}
									onExpandConversationPanel={handleExpandConversationPanel}
									onToggleHistory={() =>
										setChatHistoryOpen((current) => !current)
									}
									topicsLoading={chat.topicsLoading}
									topicStore={chat.topicStore}
									topicActions={chat.topicActions}
									selectedTopic={chat.selectedTopic}
									project={chat.project}
									workspace={chat.workspace}
									setSelectedTopic={chat.topicStore.setSelectedTopic}
									projectFilesStore={chat.projectFilesStore}
									mentionPanelStore={chat.mentionPanelStore}
									attachments={chat.projectFilesStore.workspaceFileTree}
									attachmentList={chat.projectFilesStore.workspaceFilesList}
								/>
							</div>
						</div>
					) : null}
				</div>

				<RecordingDetailSpeakerDialog
					open={speakerSettingsOpen}
					speakerIds={speakerIds}
					value={speakerDraft}
					onValueChange={setSpeakerDraft}
					onOpenChange={setSpeakerSettingsOpen}
					onConfirm={() => void handleSaveSpeakers()}
				/>

				<AudioRecordingMoveGroupDialog
					open={moveGroupOpen}
					onOpenChange={setMoveGroupOpen}
					groups={groups.filter((group) => group.id !== UNGROUPED_RECORDING_GROUP_ID)}
					ungroupedCount={ungroupedCount}
					selectedGroupId={resolvedItem?.workspace_id ?? UNGROUPED_RECORDING_GROUP_ID}
					onSelect={async (groupId) => {
						await actions.moveToGroup(groupId)
					}}
					onCreateGroup={handleCreateGroupFromMove}
					onRenameGroup={handleRenameGroupFromMove}
					onDeleteGroup={handleDeleteGroupFromMove}
					isSubmitting={actions.moving}
				/>

				<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t("actions.deleteTitle")}</AlertDialogTitle>
							<AlertDialogDescription>
								{t("actions.deleteConfirmSingle")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => void actions.deleteProject()}
								disabled={actions.deleting}
							>
								{t("actions.confirm")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<ShareModal
					open={shareControls.shareModalOpen}
					onCancel={shareControls.closeShareModal}
					shareMode={ShareMode.File}
					projectId={projectId}
					attachments={shareControls.attachments}
					attachmentList={shareControls.attachmentList}
					projectName={displayTitle}
					defaultSelectedFileIds={shareControls.defaultSelectedFileIds}
					displayNameByFileId={shareControls.displayNameByFileId}
					displayNameByFileName={shareControls.displayNameByFileName}
					requiredFileIds={shareControls.requiredFileIds}
					types={[ShareType.PasswordProtected, ShareType.Organization, ShareType.Public]}
					fileShareUiConfig={createRecordingShareUiConfig({
						dependencyAttachments: attachmentList,
						dependencyBundleRootPath: fileMap?.bundleRootPath,
					})}
				/>

				<RecordingShareManagementDialog
					open={shareControls.shareManagementOpen}
					projectId={projectId}
					dependencyAttachments={attachmentList}
					dependencyBundleRootPath={fileMap?.bundleRootPath}
					displayNameByFileId={shareControls.displayNameByFileId}
					displayNameByFileName={shareControls.displayNameByFileName}
					onClose={shareControls.closeManageShare}
				/>
				<AudioRecordingCopyDialog controller={copyController} />
			</>
		</RecordingDetailProvider>
	)
}

const ObservedAudioRecordingDetailPageDesktop = observer(AudioRecordingDetailPageDesktop)

/** Shared recording detail route: mobile renders H5 preview, desktop renders React workbench. */
function AudioRecordingDetailPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<MobileAudioRecordingDetailPage />
			</Suspense>
		)
	}

	return <ObservedAudioRecordingDetailPageDesktop />
}

/** Collects every speaker id from loaded detail text files for the shared editor. */
function collectRecordingSpeakerIds(contents: Array<string | undefined>) {
	return Array.from(
		new Set(contents.flatMap((content) => (content ? collectSpeakerIdsFromText(content) : []))),
	).sort()
}

/*
 * Future share-link entry hook:
 * if (isAudioProjectMode(projectMode)) return <RecordingDetailShareShell projectId={...} />
 * See types/recording-detail-capabilities.ts SHARE_RECORDING_DETAIL_CAPABILITIES.
 */

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<AudioRecordingDetailPage />
		</FileAccessProvider>
	)
}
