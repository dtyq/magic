import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Check, Ellipsis, FileAudio, Loader2, Pencil, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AudioProjectListItem, AudioRecordingCardStatus } from "@/types/audioProject"
import {
	recordingGroupsService,
	UNGROUPED_RECORDING_GROUP_ID,
	type AudioRecordingGroup,
} from "@/services/audioRecordings"
import {
	buildOptimisticSummarizingProject,
	deleteAudioRecordingProjects,
	moveAudioRecordingProjects,
	renameAudioRecordingProject,
	resubmitAudioRecordingSummary,
	submitAudioRecordingSummary,
} from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recording-actions"
import {
	isAudioProjectSummaryReady,
	isAudioProjectSummarizing,
	resolveRecordingDisplayName,
} from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recordings-utils"
import { resolveDetailSummaryVisualState } from "@/pages/superMagic/pages/AudioRecordings/utils/summary-action-utils"
import { saveMediaSpeakersAndMagicProjectJs } from "@/pages/superMagic/components/Detail/contents/HTML/media/utils"
import {
	MAX_PROJECT_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"
import type { MobileRecordingSourceTab, MobileRecordingTopTab } from "./types"
import { useMobileRecordingAudioPlayer } from "./hooks/useMobileRecordingAudioPlayer"
import { useRecordingColorSegments } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingColorSegments"
import { useMobileRecordingDetailData } from "./hooks/useMobileRecordingDetailData"
import { MobileRecordingAudioPlayer } from "./components/MobileRecordingAudioPlayer"
import { MobileRecordingSourcePanel } from "./components/MobileRecordingSourcePanel"
import { MobileRecordingSummaryPanel } from "./components/MobileRecordingSummaryPanel"
import { MobileRecordingSummaryPlaceholder } from "./components/MobileRecordingSummaryPlaceholder"
import { MobileRecordingSpeakerSheet } from "./components/MobileRecordingSpeakerSheet"
import { MobileRecordingShareExportSheet } from "./components/MobileRecordingShareExportSheet"
import { collectSpeakerIdsFromText } from "./utils/markdown-time-links"
import { normalizeSpeakerSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/speaker-filter"
import { MobileRecordingMoreSheet } from "@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileRecordingMoreSheet"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { useMobileRecordingContentSearch } from "./hooks/useMobileRecordingContentSearch"
import { MobileRecordingMoveGroupSheet } from "@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileRecordingMoveGroupSheet"
import {
	getMobileRecordingPlayerScrollPadding,
	MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT,
	MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT,
} from "./utils/mobile-recording-player-layout"
import type { MobileRecordingGroup } from "@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileRecordingGroupSheet"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import { buildRecordingShareSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/build-recording-share-selection"
import { hasConfiguredRecordingFile } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"
import { downloadRecordingAudioFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio"
import { AudioRecordingCopyDialog } from "@/pages/superMagic/pages/AudioRecordings/components/AudioRecordingCopyDialog"
import { useAudioRecordingCopyToProject } from "@/pages/superMagic/pages/AudioRecordings/hooks/useAudioRecordingCopyToProject"
import { canCopyAudioProject } from "@/pages/superMagic/pages/AudioRecordings/utils/copy-availability"
import { SuperMagicApi } from "@/apis"
import { analyticsService } from "@/services/analytics"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import ProjectTopicListView from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/ProjectTopicListView"
import recordingSummaryStore from "@/stores/recordingSummary"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"

const SEARCH_BAR_HEIGHT = 72

interface AudioRecordingDetailLocationState {
	projectName?: string
	cardStatus?: AudioRecordingCardStatus
	audioFileId?: string
}

/** Mobile H5 recording detail preview for completed transcript and summary attachments. */
export default function MobileAudioRecordingDetailPage() {
	const { t } = useTranslation("audioRecordings")
	const navigate = useNavigate()
	const location = useLocation()
	const [searchParams, setSearchParams] = useSearchParams()
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
		mutateAudioProjectItem,
	} = useMobileRecordingDetailData({
		projectId,
		initialTitle: locationState?.projectName,
	})
	const player = useMobileRecordingAudioPlayer(audioUrl)
	const [playerScrollSignal, setPlayerScrollSignal] = useState(0)
	const [detailItem, setDetailItem] = useState<AudioProjectListItem | null>(null)
	const [titleOverride, setTitleOverride] = useState("")
	const [renameDialogOpen, setRenameDialogOpen] = useState(false)
	const [speakerSettingsOpen, setSpeakerSettingsOpen] = useState(false)
	const [moreSheetOpen, setMoreSheetOpen] = useState(false)
	const [moveGroupSheetOpen, setMoveGroupSheetOpen] = useState(false)
	const [groups, setGroups] = useState<MobileRecordingGroup[]>([])
	const [ungroupedCount, setUngroupedCount] = useState(0)
	const [titleInput, setTitleInput] = useState("")
	const [speakerDraft, setSpeakerDraft] = useState<Record<string, string>>({})
	const [speakerNameOverrides, setSpeakerNameOverrides] = useState<Record<string, string>>({})
	const [speakerFilterProjectId, setSpeakerFilterProjectId] = useState(projectId)
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
	const [renaming, setRenaming] = useState(false)
	const [actionSubmitting, setActionSubmitting] = useState(false)
	const [summarySubmitting, setSummarySubmitting] = useState(false)
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const [shareExportSheetOpen, setShareExportSheetOpen] = useState(false)
	const [projectShareSheetOpen, setProjectShareSheetOpen] = useState(false)
	const [contentSearchOpen, setContentSearchOpen] = useState(false)
	const [contentSearchQuery, setContentSearchQuery] = useState("")
	const [sourceSubtab, setSourceSubtab] = useState<MobileRecordingSourceTab>("transcript")
	const [summaryType, setSummaryType] = useState("")
	const titleInputRef = useRef<HTMLInputElement>(null)
	const searchScopeRef = useRef<HTMLDivElement | null>(null)
	const defaultTab = useMemo<MobileRecordingTopTab>(() => {
		const cardStatus =
			detailItem?.card_status ?? projectItem?.card_status ?? locationState?.cardStatus
		return cardStatus === "summarized" ? "summary" : "source"
	}, [detailItem?.card_status, locationState?.cardStatus, projectItem?.card_status])
	const requestedTab = searchParams.get("tab")
	const [activeTab, setActiveTab] = useState<MobileRecordingTopTab>(defaultTab)
	// Remembers whether the user already picked a tab for the current recording so a
	// later default-tab change (detail request resolving card_status) or a dropped
	// `tab=ai` query never overrides that explicit choice.
	const tabPickedByUserRef = useRef(false)
	const [topics, setTopics] = useState<Topic[]>([])
	const [topicsLoading, setTopicsLoading] = useState(false)
	const [chatProject, setChatProject] = useState<ProjectListItem | null>(null)
	const [chatWorkspace, setChatWorkspace] = useState<Workspace | null>(null)
	const [composerTopic, setComposerTopic] = useState<Topic | null>(null)
	const [topicActionItem, setTopicActionItem] = useState<Topic | null>(null)
	const [topicActionsOpen, setTopicActionsOpen] = useState(false)
	const [topicRenameOpen, setTopicRenameOpen] = useState(false)
	const [topicRenameValue, setTopicRenameValue] = useState("")
	const [topicDeleteOpen, setTopicDeleteOpen] = useState(false)
	const [chatProjectFilesStore] = useState(() => new ProjectFilesStore())
	const [chatMentionStore] = useState(() => createMentionPanelStore(chatProjectFilesStore))

	useProjectAttachmentsChangeRealtime({
		projectId,
		enabled: activeTab === "ai",
		store: chatProjectFilesStore,
	})
	const recordingShareSelection = useMemo(() => buildRecordingShareSelection(fileMap), [fileMap])
	const copyController = useAudioRecordingCopyToProject()
	// Skeleton belongs to the first empty load only; pull-to-refresh and AI tab re-entry
	// reuse the already fetched rows so the list never blinks back into placeholders.
	const showTopicsSkeleton = topicsLoading && topics.length === 0

	useEffect(() => {
		// Clear scoped AI state at route boundaries so a previous recording never
		// flashes its topics, workspace, or composer selection in the next detail.
		setTopics([])
		setChatProject(null)
		setChatWorkspace(null)
		setComposerTopic(null)
		// A new recording starts without a manual choice, so it may fall back to its
		// own default tab again.
		tabPickedByUserRef.current = false
	}, [projectId])

	useEffect(() => {
		// Only the AI tab is mirrored in the URL, so `tab=ai` still wins over local state.
		if (requestedTab === "ai") {
			setActiveTab("ai")
			return
		}
		// A missing `tab` param means "not the AI tab", not "restore the default tab":
		// after the user switched to Source/Summary the local selection must survive
		// both the query cleanup and any later default-tab recalculation.
		if (tabPickedByUserRef.current) return
		setActiveTab(defaultTab)
	}, [defaultTab, projectId, requestedTab])

	useEffect(() => {
		if (activeTab !== "ai" || !projectId) return
		let disposed = false
		setTopicsLoading(true)
		// The recording detail keeps its own lightweight topic list so it can offer
		// the same multi-topic entry point without mounting the full project shell.
		SuperMagicApi.getTopicsByProjectId({ id: projectId, page: 1, page_size: 100 })
			.then((response) => {
				if (disposed) return
				setTopics(response.list ?? [])
			})
			.catch(() => {
				if (!disposed) setTopics([])
			})
			.finally(() => {
				if (!disposed) setTopicsLoading(false)
			})
		return () => {
			disposed = true
		}
	}, [activeTab, projectId])

	useEffect(() => {
		if (activeTab !== "ai" || !projectId) return
		let disposed = false
		SuperMagicApi.getProjectDetail({ id: projectId })
			.then(async (project) => {
				if (disposed) return
				const nextProject = project as ProjectListItem
				setChatProject(nextProject)
				if (nextProject.workspace_id) {
					const workspace = await SuperMagicApi.getWorkspaceDetail({
						id: nextProject.workspace_id,
					})
					if (!disposed) setChatWorkspace(workspace)
				}
			})
			.catch(() => undefined)
		return () => {
			disposed = true
		}
	}, [activeTab, projectId])

	useEffect(() => {
		if (activeTab !== "ai" || !projectId || loading || !chatProject) return
		// Share the detail snapshot with the scoped composer store to avoid a second
		// attachment request when users enter the AI tab.
		chatMentionStore.initLoadAttachments(projectId)
		chatProjectFilesStore.setSelectedProject(chatProject)
		chatProjectFilesStore.setWorkspaceFileTree(attachmentTree, {
			list: attachmentList,
			source: "mobile-recording-detail",
		})
		chatMentionStore.finishLoadAttachmentsPromise(projectId)
	}, [
		activeTab,
		attachmentList,
		attachmentTree,
		chatMentionStore,
		chatProject,
		chatProjectFilesStore,
		loading,
		projectId,
	])

	/** Updates the tab query so browser back/forward restores the AI tab. */
	function handleTabChange(nextTab: MobileRecordingTopTab) {
		if (nextTab === "ai") closeContentSearch()
		tabPickedByUserRef.current = true
		setActiveTab(nextTab)
		const nextParams = new URLSearchParams(searchParams)
		if (nextTab === "ai") nextParams.set("tab", "ai")
		else nextParams.delete("tab")
		setSearchParams(nextParams, { replace: true })
	}

	/** Opens an existing recording topic in the regular project conversation screen. */
	async function handleOpenTopic(topic: Topic) {
		// Route-level project detail logic owns global store hydration; recording detail
		// only provides the target IDs and preserves the ?tab=ai history entry.
		navigate({
			name: RouteName.SuperWorkspaceProjectTopicState,
			params: { projectId, topicId: topic.id },
		})
	}

	/** Refreshes the scoped topic list without touching the global project stores. */
	async function refreshRecordingTopics() {
		if (!projectId) return
		// Pull-to-refresh already renders its own indicator, so the loading flag stays
		// untouched here to keep the existing rows visible instead of swapping them for
		// the first-load skeleton. Failures bubble up to MagicPullToRefresh for toasting.
		const response = await SuperMagicApi.getTopicsByProjectId({
			id: projectId,
			page: 1,
			page_size: 100,
		})
		setTopics(response.list ?? [])
	}

	/** Applies the same pin/unpin topic operations used by the regular mobile project page. */
	async function handleRecordingTopicPin(topic: Topic) {
		const response = topic.is_pinned
			? await SuperMagicApi.unpinTopic(topic.id)
			: await SuperMagicApi.pinTopic(topic.id)
		const updated = response.topic
		setTopics((current) =>
			current.map((item) => (item.id === topic.id ? { ...item, ...updated } : item)),
		)
	}

	/** Preserves the project-detail minimum-one-topic deletion rule. */
	async function handleRecordingTopicDelete(topic: Topic) {
		if (topics.length <= 1) return
		if (recordingSummaryStore.isRecordingTopic(topic.id)) {
			toast.error(t("super:messageHeader.cannotDeleteCurrentTopicInRecording"))
			return
		}
		setTopicDeleteOpen(true)
		setTopicActionItem(topic)
	}

	/** Opens the project-detail-style rename sheet for a scoped recording topic. */
	function handleRecordingTopicRename(topic: Topic) {
		setTopicActionItem(topic)
		setTopicRenameValue(clampProjectName(topic.topic_name || "", MAX_PROJECT_NAME_LENGTH))
		setTopicRenameOpen(true)
	}

	/** Persists the rename-sheet value and keeps the scoped topic list in sync. */
	async function submitRecordingTopicRename() {
		const topic = topicActionItem
		const nextName = clampProjectName(topicRenameValue, MAX_PROJECT_NAME_LENGTH)
		if (!topic?.id || !nextName || nextName === topic.topic_name) {
			setTopicRenameOpen(false)
			return
		}
		await SuperMagicApi.editTopic({ id: topic.id, project_id: projectId, topic_name: nextName })
		setTopics((current) =>
			current.map((item) =>
				item.id === topic.id ? { ...item, topic_name: nextName } : item,
			),
		)
		setTopicActionItem(null)
		setTopicRenameOpen(false)
	}

	/** Confirms deletion while preserving the project-detail minimum-one-topic rule. */
	async function confirmRecordingTopicDelete() {
		const topic = topicActionItem
		if (!topic?.id || topics.length <= 1) return
		await SuperMagicApi.deleteTopic({ id: topic.id })
		setTopics((current) => current.filter((item) => item.id !== topic.id))
		setTopicActionItem(null)
		setTopicDeleteOpen(false)
	}

	/** Opens the same grouped mobile action sheet used by the regular project topic list. */
	function openRecordingTopicActions(topic: Topic) {
		setTopicActionItem(topic)
		setTopicActionsOpen(true)
	}

	/** Builds rename/delete actions while keeping pin/delete swipe actions on the shared list rows. */
	const topicActionGroups: ActionGroup[] = topicActionItem
		? [
				{
					actions: [
						{
							key: "rename",
							label: t("super:hierarchicalWorkspacePopup.rename"),
							onClick: () => {
								setTopicActionsOpen(false)
								handleRecordingTopicRename(topicActionItem)
							},
						},
					],
				},
				{
					actions: [
						{
							key: "delete",
							label: t("super:hierarchicalWorkspacePopup.deleteTopic"),
							variant: "danger" as const,
							disabled: topics.length <= 1,
							onClick: () => {
								setTopicActionsOpen(false)
								void handleRecordingTopicDelete(topicActionItem)
							},
						},
					],
				},
			]
		: []

	/** Creates a fully mapped topic for the bottom composer before its first send. */
	async function createTopicForComposer() {
		if (!chatProject?.id) return null
		analyticsService.report("topic_create_attempted", {
			projectId: chatProject.id,
			workspaceId: chatProject.workspace_id,
			sceneOverride: "ai_recording",
		})
		const created = await SuperMagicApi.createTopic({
			project_id: chatProject.id,
			topic_name: "",
			project_mode: chatProject.project_mode || undefined,
		})
		let topic = created as Topic
		if (topic?.id && (!topic.chat_topic_id || !topic.chat_conversation_id)) {
			topic = await SuperMagicApi.getTopicDetail({ id: topic.id })
		}
		if (topic?.id) {
			setComposerTopic(topic)
			setTopics((current) => [topic, ...current.filter((item) => item.id !== topic.id)])
		}
		return topic ?? null
	}

	/** Routes successful direct questions into the created topic while preserving ?tab=ai history. */
	function handleComposerSendSuccess({ currentTopic }: { currentTopic: Topic | null }) {
		if (!currentTopic?.id) return
		navigate({
			name: RouteName.SuperWorkspaceProjectTopicState,
			params: { projectId, topicId: currentTopic.id },
		})
	}

	useEffect(() => {
		setDetailItem(projectItem)
	}, [projectItem])

	useEffect(() => {
		// Hydrate speaker aliases from the saved bundle metadata so refresh restores the last confirmed names.
		setSpeakerNameOverrides(fileMap?.magicProjectConfig?.metadata?.speakers ?? {})
	}, [fileMap?.magicProjectConfig?.metadata?.speakers, projectId])

	const summaryReady = useMemo(() => {
		const item = detailItem ?? projectItem
		if (item) return isAudioProjectSummaryReady(item)
		return locationState?.cardStatus === "summarized"
	}, [detailItem, locationState?.cardStatus, projectItem])
	// Completed recordings keep the historical summary path; only in-progress previews require parsed config.

	const displayTitle = titleOverride || title || t("detail.untitled")
	const resolvedActionItem = useMemo(
		() =>
			detailItem ||
			projectItem ||
			buildFallbackActionItem({
				projectId,
				title: displayTitle,
				cardStatus: locationState?.cardStatus,
				audioFileId: locationState?.audioFileId,
			}),
		[
			detailItem,
			displayTitle,
			locationState?.audioFileId,
			locationState?.cardStatus,
			projectId,
			projectItem,
		],
	)
	const summaryPreviewAvailable =
		summaryReady ||
		(Boolean(resolvedActionItem && isAudioProjectSummarizing(resolvedActionItem)) &&
			Boolean(fileMap?.magicProject && fileMap.magicProjectConfig))
	const summaryVisualState = useMemo(
		() =>
			resolveDetailSummaryVisualState({
				summaryReady,
				phase: resolvedActionItem?.current_phase ?? null,
				status: resolvedActionItem?.phase_status ?? null,
				cardStatus: resolvedActionItem?.card_status ?? locationState?.cardStatus,
				isSubmitting: summarySubmitting,
				extra: {
					task_key: resolvedActionItem?.task_key,
					topic_id: resolvedActionItem?.topic_id,
					audio_file_id: resolvedActionItem?.audio_file_id,
					audio_source: resolvedActionItem?.audio_source,
					model_id: resolvedActionItem?.model_id,
				},
			}),
		[
			locationState?.cardStatus,
			resolvedActionItem?.audio_file_id,
			resolvedActionItem?.audio_source,
			resolvedActionItem?.card_status,
			resolvedActionItem?.current_phase,
			resolvedActionItem?.model_id,
			resolvedActionItem?.phase_status,
			resolvedActionItem?.task_key,
			resolvedActionItem?.topic_id,
			summaryReady,
			summarySubmitting,
		],
	)
	const detailUnavailable =
		!summaryReady && summaryVisualState.status === "unavailable" && Boolean(resolvedActionItem)
	const transcriptSpeakerIds = useMemo(
		() => collectRecordingSpeakerIds([texts.transcript?.content]),
		[texts.transcript?.content],
	)
	const activeSpeakerIds = useMemo(
		() =>
			collectRecordingSpeakerIds([
				texts.transcript?.content,
				texts.notes?.content,
				...Object.values(texts.summary).map((file) => file?.content),
			]),
		[texts.notes?.content, texts.summary, texts.transcript?.content],
	)
	const effectiveSelectedSpeakerIds = useMemo(
		() =>
			speakerFilterProjectId === projectId
				? normalizeSpeakerSelection(transcriptSpeakerIds, selectedSpeakerIds)
				: transcriptSpeakerIds,
		[projectId, selectedSpeakerIds, speakerFilterProjectId, transcriptSpeakerIds],
	)
	const speakerNameMap = useMemo(
		() =>
			Object.fromEntries(
				activeSpeakerIds.map((speakerId) => [
					speakerId,
					speakerNameOverrides[speakerId]?.trim() || speakerId,
				]),
			),
		[activeSpeakerIds, speakerNameOverrides],
	)
	const searchSupported =
		activeTab !== "ai" && !(activeTab === "summary" && summaryType === "metrics")
	const contentSearch = useMobileRecordingContentSearch(contentSearchQuery, {
		scopeRef: searchScopeRef,
		enabled: contentSearchOpen && searchSupported,
		contentKey: `${projectId}:${activeTab}:${sourceSubtab}:${summaryType}:${selectedSpeakerIds.join(",")}:${texts.transcript?.content?.length ?? 0}:${Object.values(
			texts.summary,
		)
			.map((file) => file?.content?.length ?? 0)
			.join(",")}`,
	})
	const scrollPaddingBottom = contentSearchOpen
		? SEARCH_BAR_HEIGHT + 20
		: getMobileRecordingPlayerScrollPadding(
				playerExpanded
					? MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT
					: MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT,
				20,
			)

	const colorSegments = useRecordingColorSegments(
		summaryPreviewAvailable,
		texts.summary.topics?.content,
	)

	/** Closes the floating player rate menu when source/summary panels scroll. */
	function handlePlayerContentScroll() {
		setPlayerScrollSignal((value) => value + 1)
	}

	/** Opens content search and hides the floating player without interrupting audio playback. */
	const openContentSearch = useCallback(() => {
		if (!searchSupported) return
		setMoreSheetOpen(false)
		setContentSearchOpen(true)
		setPlayerExpanded(false)
	}, [searchSupported])

	/** Closes content search and clears the detail-session query while preserving audio state. */
	const closeContentSearch = useCallback(() => {
		setContentSearchOpen(false)
		setContentSearchQuery("")
		setPlayerExpanded(false)
	}, [])

	useEffect(() => {
		if (!searchSupported && contentSearchOpen) closeContentSearch()
	}, [closeContentSearch, contentSearchOpen, searchSupported])

	useEffect(() => {
		setTitleOverride("")
		setRenameDialogOpen(false)
		setSpeakerSettingsOpen(false)
		setMoreSheetOpen(false)
		setMoveGroupSheetOpen(false)
		setPlayerExpanded(false)
		setShareExportSheetOpen(false)
		setProjectShareSheetOpen(false)
		setContentSearchOpen(false)
		setContentSearchQuery("")
		setTopicActionItem(null)
		setTopicActionsOpen(false)
		setTopicRenameOpen(false)
		setTopicDeleteOpen(false)
	}, [projectId])

	useEffect(() => {
		if (activeTab === "ai") closeContentSearch()
	}, [activeTab, closeContentSearch])

	useEffect(() => {
		if (speakerFilterProjectId === projectId) return
		setSpeakerFilterProjectId(projectId)
		setSelectedSpeakerIds([])
	}, [projectId, speakerFilterProjectId])

	useEffect(() => {
		if (!renameDialogOpen) return

		// Focus after the dialog paints so the mobile keyboard opens on the active field.
		requestAnimationFrame(() => {
			titleInputRef.current?.focus()
			titleInputRef.current?.select()
		})
	}, [renameDialogOpen])

	/** Navigates back to the shared recordings list route. */
	function handleBack() {
		navigate({ name: RouteName.AudioRecordings })
	}

	/** Navigates to the recording project route so the mobile Super Magic layout can restore its state. */
	function handleOpenProject(item: AudioProjectListItem) {
		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: item.id },
		})
	}

	/** Summary time chips only control playback so users can stay on the current summary tab. */
	function handleSummaryTimeClick(start: number, end?: number) {
		player.playSegment({ start, end })
	}

	/** Opens the rename sheet and collapses the player to keep the editor readable. */
	function openRenameDialog() {
		setTitleInput(displayTitle)
		setRenameDialogOpen(true)
		setPlayerExpanded(false)
	}

	/** Opens the shared more-actions sheet only when the detail payload is ready for safe actions. */
	function openMoreSheet() {
		if (loading || error || !resolvedActionItem) return
		setMoreSheetOpen(true)
		setPlayerExpanded(false)
	}

	/** Opens the shared speaker-name editor with the current effective display names. */
	function openSpeakerSettings() {
		setSpeakerDraft(
			Object.fromEntries(
				activeSpeakerIds.map((speakerId) => [
					speakerId,
					speakerNameMap[speakerId] ?? speakerId,
				]),
			),
		)
		setSpeakerSettingsOpen(true)
		setPlayerExpanded(false)
	}

	/** Keeps transcript filtering session-local while leaving rename/display speaker discovery sourced from all content files. */
	function handleSelectedSpeakerIdsChange(speakerIdsToSelect: string[]) {
		setSpeakerFilterProjectId(projectId)
		setSelectedSpeakerIds(speakerIdsToSelect)
	}

	/** Opens the prototype-aligned share/export sheet instead of routing share through the more-actions menu. */
	function openShareExportSheet() {
		if (!projectId || loading || error) return
		setShareExportSheetOpen(true)
		setMoreSheetOpen(false)
		setPlayerExpanded(false)
	}

	/** Downloads the original audio asset only, leaving format conversion for a later milestone. */
	async function handleDownloadOriginal() {
		const success = await downloadRecordingAudioFile({
			fileId: fileMap?.audio?.file_id || resolvedActionItem?.audio_file_id,
			audioFile: fileMap?.audio,
			fallbackName: displayTitle,
		})
		if (!success) {
			toast.error(t("detail.loadFailed"))
		}
	}

	/** Opens the existing project-share flow from the dedicated share/export launcher. */
	function openProjectShareSheet() {
		if (recordingShareSelection.defaultSelectedFileIds.length === 0) {
			toast.error(t("super:share.noShareableFiles"))
			return
		}

		setShareExportSheetOpen(false)
		setProjectShareSheetOpen(true)
	}

	/** Saves local speaker names so transcript and summary content update together. */
	async function submitSpeakerSettings() {
		const nextNames = Object.fromEntries(
			activeSpeakerIds
				.map((speakerId) => [speakerId, speakerDraft[speakerId]?.trim()] as const)
				.filter(([, name]) => Boolean(name)),
		)
		try {
			// Persist speaker aliases back into magic.project.js so refresh and desktop HTML preview stay in sync.
			if (texts.magicProject?.fileId) {
				await saveMediaSpeakersAndMagicProjectJs({
					mediaSpeakers: nextNames,
					magicProjectJsFileInfo: {
						fileId: texts.magicProject.fileId,
						content: texts.magicProject.content,
					},
				})
			}
			setSpeakerNameOverrides(nextNames)
			setSpeakerSettingsOpen(false)
		} catch {
			toast.error(t("detail.loadFailed"))
		}
	}

	/** Closes the rename dialog without mutating the current recording title. */
	function closeRenameDialog() {
		if (renaming) return
		setRenameDialogOpen(false)
		setTitleInput(displayTitle)
	}

	/** Persists the renamed title through the recording service. */
	async function submitRename() {
		const trimmed = titleInput.trim()
		if (renaming) return
		if (!projectId || !trimmed || trimmed === displayTitle) {
			setRenameDialogOpen(false)
			return
		}

		setRenaming(true)
		try {
			await renameAudioRecordingProject(projectId, trimmed)
			setTitleOverride(trimmed)
			setDetailItem((current) => (current ? { ...current, project_name: trimmed } : current))
			setRenameDialogOpen(false)
			toast.success(t("actions.renameSuccess"))
		} catch {
			toast.error(t("actions.renameFailed"))
		} finally {
			setRenaming(false)
		}
	}

	/** Loads move-target groups lazily so the detail page stays light until users open that flow. */
	async function ensureGroupsLoaded() {
		try {
			const result = await recordingGroupsService.listGroups()
			setGroups(result.groups.map(mapAudioRecordingGroupToMobileGroup))
			setUngroupedCount(result.ungroupedCount)
		} catch {
			toast.error(t("detail.loadFailed"))
		}
	}

	/** Opens the move-group sheet from the shared more-actions menu. */
	function handleOpenMoveGroup() {
		void ensureGroupsLoaded()
		setMoveGroupSheetOpen(true)
	}

	/** Deletes the current detail project and routes users back to the recordings list on success. */
	async function handleDelete(projectIdToDelete: string) {
		if (actionSubmitting) return false

		setActionSubmitting(true)
		try {
			await deleteAudioRecordingProjects([projectIdToDelete])
			toast.success(t("actions.deleteSuccess"))
			navigate({
				name: RouteName.AudioRecordings,
				state: { deletedProjectId: projectIdToDelete },
			})
			return true
		} catch {
			toast.error(t("actions.deleteFailed"))
			return false
		} finally {
			setActionSubmitting(false)
		}
	}

	/** Reuses the shared summary submit action and immediately flips the detail page into summarizing state. */
	async function handleSummarize(item: AudioProjectListItem) {
		if (summarySubmitting) return false

		setSummarySubmitting(true)
		try {
			const result = await submitAudioRecordingSummary(item)
			if (!result.ok) {
				if (result.reason === "missingParams") {
					toast.error(t("summary.missingParams"))
				} else if (result.reason === "missingModel") {
					toast.error(t("summary.missingModel"))
				} else {
					toast.error(t("summary.submitFailed"))
				}
				return false
			}

			const optimisticItem = buildOptimisticSummarizingProject(item)
			setDetailItem(optimisticItem)
			mutateAudioProjectItem(optimisticItem)
			setActiveTab("summary")
			return true
		} finally {
			setSummarySubmitting(false)
		}
	}

	/** Routes summary actions to initial generation or direct re-summary based on current detail state. */
	async function handleSummaryAction(item: AudioProjectListItem) {
		if (
			summaryReady ||
			summaryVisualState.status === "failed" ||
			item.card_status === "summarized"
		) {
			return handleResummarize()
		}
		return handleSummarize(item)
	}

	/** Submits direct re-summary and immediately flips the mobile detail into summarizing state. */
	async function handleResummarize() {
		if (!resolvedActionItem || summarySubmitting) return false

		setSummarySubmitting(true)
		try {
			const result = await resubmitAudioRecordingSummary(resolvedActionItem)
			if (!result.ok) {
				if (result.reason === "missingParams") {
					toast.error(t("summary.missingParams"))
				} else if (result.reason === "missingModel") {
					toast.error(t("summary.missingModel"))
				} else {
					toast.error(t("summary.submitFailed"))
				}
				return false
			}

			const optimisticItem = buildOptimisticSummarizingProject(resolvedActionItem)
			setDetailItem(optimisticItem)
			mutateAudioProjectItem(optimisticItem)
			setActiveTab("summary")
			return true
		} finally {
			setSummarySubmitting(false)
		}
	}

	/** Moves the current project to another group and patches local metadata without reloading the page. */
	async function handleMoveGroup(targetGroupId: string) {
		if (!detailItem || actionSubmitting) return

		setActionSubmitting(true)
		try {
			await moveAudioRecordingProjects([detailItem.id], targetGroupId)
			setDetailItem((current) =>
				current ? { ...current, workspace_id: targetGroupId } : current,
			)
			toast.success(t("super:mobile.recordingEntry.groupSheet.moveSuccess"))
		} catch {
			toast.error(t("super:mobile.recordingEntry.groupSheet.moveFailed"))
		} finally {
			setActionSubmitting(false)
		}
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-[#f7f7f8] text-foreground"
			data-testid="mobile-recording-detail-page"
		>
			<header className="shrink-0 border-b border-border/70 bg-[#f7f7f8]">
				{/* Reuse the shared mobile page-header sizing so the recording detail top bar matches project detail icon weight and button scale. */}
				<div className="mobile-page-header pb-0">
					<button
						type="button"
						className="mobile-page-header-btn transition-transform active:scale-95"
						onClick={handleBack}
						aria-label={t("detail.back")}
						data-testid="mobile-recording-detail-back"
					>
						<ChevronLeft className="size-[22px]" />
					</button>

					{/* Reserve the exact left/right action widths so all three labels stay on one line without overlapping the floating button. */}
					<div className="pointer-events-none absolute left-[66px] right-[66px] flex justify-center">
						{/* Use content-sized columns so Chinese stays compact while English labels retain their full width. */}
						<div className="pointer-events-auto flex w-max max-w-full rounded-full bg-muted p-[3px]">
							<TopTabButton
								active={activeTab === "source"}
								label={t("detail.tabs.source")}
								onClick={() => handleTabChange("source")}
							/>
							<TopTabButton
								active={activeTab === "summary"}
								label={t("detail.tabs.summaryRoot")}
								onClick={() => handleTabChange("summary")}
							/>
							<TopTabButton
								active={activeTab === "ai"}
								label={t("detail.tabs.ai")}
								onClick={() => handleTabChange("ai")}
							/>
						</div>
					</div>

					{/* Keep sharing inside the prototype-aligned more-actions menu while preserving the single 48px touch target. */}
					<div className="ml-auto flex h-12 shrink-0 items-stretch overflow-hidden rounded-full bg-card text-foreground shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] dark:shadow-[0px_8px_25px_0px_rgba(0,0,0,0.32)]">
						<HeaderIconButton
							label={t("card.moreActions")}
							icon={<Ellipsis className="size-[22px]" />}
							onClick={openMoreSheet}
						/>
					</div>
				</div>

				<div className="flex items-center gap-2 px-4 pb-2 pt-1">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
						<FileAudio
							className="size-[18px] text-muted-foreground"
							strokeWidth={1.8}
						/>
					</span>
					<h1 className="min-w-0 flex-1 truncate text-[17px] font-medium leading-6">
						{displayTitle}
					</h1>
					<HeaderIconButton
						label={t("card.rename")}
						icon={<Pencil className="size-4" />}
						onClick={openRenameDialog}
					/>
				</div>
			</header>

			<main className="relative flex min-h-0 flex-1 flex-col">
				{loading ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						<Loader2 className="mr-2 size-4 animate-spin" />
						{t("detail.loading")}
					</div>
				) : null}

				{!loading && error ? (
					<div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
						{t("detail.loadFailed")}
					</div>
				) : null}

				{!loading && !error && detailUnavailable ? (
					<div
						className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground"
						data-testid="mobile-recording-detail-unavailable"
					>
						{t("detail.loadFailed")}
					</div>
				) : null}

				{!loading && !error && !detailUnavailable && activeTab === "source" ? (
					<MobileRecordingSourcePanel
						transcriptContent={texts.transcript?.content}
						notesContent={texts.notes?.content}
						playing={player.playing}
						currentTime={player.currentTime}
						scrollPaddingBottom={scrollPaddingBottom}
						availableSpeakerIds={transcriptSpeakerIds}
						selectedSpeakerIds={effectiveSelectedSpeakerIds}
						speakerNameMap={speakerNameMap}
						onSelectedSpeakerIdsChange={handleSelectedSpeakerIdsChange}
						onOpenSpeakerSettings={openSpeakerSettings}
						onSeek={(seconds) => player.seekTo(seconds, { autoplay: true })}
						onContentScroll={handlePlayerContentScroll}
						searchScopeRef={searchScopeRef}
						onActiveTabChange={setSourceSubtab}
						showNotesTab={hasConfiguredRecordingFile(fileMap, "notes")}
						attachmentTree={attachmentTree as unknown as AttachmentFile[]}
						notesFilePath={fileMap?.notes?.relative_file_path ?? fileMap?.notes?.path}
						isGenerating={summaryVisualState.status === "generating"}
					/>
				) : null}

				{!loading && !error && !detailUnavailable && activeTab === "summary" ? (
					summaryPreviewAvailable ? (
						<MobileRecordingSummaryPanel
							summaryFiles={fileMap?.summaryFiles ?? []}
							summaryContent={Object.fromEntries(
								Object.entries(texts.summary).map(([type, file]) => [
									type,
									file?.content,
								]),
							)}
							attachmentList={attachmentList}
							scrollPaddingBottom={scrollPaddingBottom}
							speakerNameMap={speakerNameMap}
							onOpenSpeakerSettings={openSpeakerSettings}
							onTimeClick={handleSummaryTimeClick}
							onContentScroll={handlePlayerContentScroll}
							searchScopeRef={searchScopeRef}
							searchActive={contentSearchOpen}
							onActiveTypeChange={setSummaryType}
							isGenerating={summaryVisualState.status === "generating"}
						/>
					) : (
						<MobileRecordingSummaryPlaceholder
							status={summaryVisualState.status}
							canGenerate={summaryVisualState.canGenerate}
							submitting={summarySubmitting}
							onGenerate={() => {
								if (!resolvedActionItem) return
								void handleSummaryAction(resolvedActionItem)
							}}
						/>
					)
				) : null}

				{!loading && !error && !detailUnavailable && activeTab === "ai" ? (
					<div
						className="flex min-h-0 flex-1 flex-col bg-mobile-background"
						data-testid="mobile-recording-detail-ai"
					>
						{/* Keep list spacing independent from the edge-aligned shared mobile composer. */}
						<div
							className="flex min-h-0 flex-1 flex-col px-3 pt-2"
							data-testid="mobile-recording-detail-ai-topics"
						>
							<ProjectTopicListView
								className="min-h-0 flex-1"
								projectId={projectId}
								key={projectId}
								topics={topics}
								loading={showTopicsSkeleton}
								onRefresh={refreshRecordingTopics}
								onSelectTopic={(topic) => void handleOpenTopic(topic)}
								onTopicMore={openRecordingTopicActions}
								onTopicPin={(topic) => void handleRecordingTopicPin(topic)}
								onTopicDelete={(topic) => void handleRecordingTopicDelete(topic)}
							/>
						</div>
						{chatProject ? (
							/* Keep the safe-area gutter on the same surface as the shared composer. */
							<div
								className="shrink-0 bg-mobile-background pb-[max(env(safe-area-inset-bottom),8px)]"
								data-testid="mobile-recording-detail-ai-composer"
							>
								<ProjectPageInputContainer
									className="mx-auto max-w-3xl rounded-2xl"
									selectedProject={chatProject}
									selectedTopic={composerTopic}
									setSelectedProject={setChatProject}
									setSelectedTopic={setComposerTopic}
									selectedWorkspace={chatWorkspace}
									attachments={chatProjectFilesStore.workspaceFileTree}
									mentionPanelStore={chatMentionStore}
									isEmptyStatus
									createTopic={createTopicForComposer}
									onSendSuccess={handleComposerSendSuccess}
									// Detail Ask AI stays in text-editing mode even for the recording-summary agent.
									allowRecordingMode={false}
								/>
							</div>
						) : null}
					</div>
				) : null}
			</main>

			{activeTab !== "ai" ? (
				<MobileRecordingAudioPlayer
					audioRef={player.audioRef}
					audioUrl={audioUrl}
					currentSec={player.currentTime}
					duration={player.duration}
					playing={player.playing}
					expanded={playerExpanded}
					onToggle={player.toggle}
					onSeek={(seconds) => player.seekTo(seconds, { autoplay: false })}
					onExpandedChange={setPlayerExpanded}
					playbackRate={player.playbackRate}
					onPlaybackRateChange={player.setPlaybackRate}
					colorSegments={colorSegments}
					scrollSignal={playerScrollSignal}
					hidden={contentSearchOpen}
				/>
			) : null}

			{contentSearchOpen && searchSupported ? (
				<MobileBottomSearchBar
					value={contentSearchQuery}
					placeholder={t("detail.searchContentPlaceholder")}
					clearAriaLabel={t("detail.searchContentClear")}
					closeAriaLabel={t("detail.searchContentClose")}
					previousAriaLabel={t("detail.searchContentPrevious")}
					nextAriaLabel={t("detail.searchContentNext")}
					onValueChange={setContentSearchQuery}
					onClose={closeContentSearch}
					onPrevious={contentSearch.goToPrevious}
					onNext={contentSearch.goToNext}
					currentResult={contentSearch.currentIndex}
					totalResults={contentSearch.totalMatches}
					variant="recording-content"
					testIdPrefix="mobile-recording-content-search"
					autoFocus
				/>
			) : null}

			<ConversationActionsPopup
				visible={topicActionsOpen}
				title={topicActionItem?.topic_name || t("super:topic.unnamedTopic")}
				actionGroups={topicActionGroups}
				onClose={() => {
					setTopicActionsOpen(false)
					setTopicActionItem(null)
				}}
			/>

			<MagicPopup
				visible={topicRenameOpen}
				onClose={() => {
					setTopicRenameOpen(false)
					setTopicActionItem(null)
				}}
				position="bottom"
				title={t("super:hierarchicalWorkspacePopup.topicRename")}
				headerVariant="actionHeader"
				headerTitle={t("super:hierarchicalWorkspacePopup.topicRename")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("super:common.cancel"),
					onClick: () => {
						setTopicRenameOpen(false)
						setTopicActionItem(null)
					},
					testId: "mobile-recording-topic-rename-close",
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("super:common.confirm"),
					onClick: () => void submitRecordingTopicRename(),
					disabled:
						!topicRenameValue.trim() ||
						isProjectNameOverLimit(topicRenameValue, MAX_PROJECT_NAME_LENGTH),
					tone: "primary",
					testId: "mobile-recording-topic-rename-confirm",
				}}
				bodyClassName="max-h-[80dvh] p-4"
			>
				<div className="flex flex-col gap-2.5">
					<Input
						value={topicRenameValue}
						maxLength={MAX_PROJECT_NAME_LENGTH}
						onChange={(event) => setTopicRenameValue(event.target.value)}
						placeholder={t("super:hierarchicalWorkspacePopup.inputTopicName")}
						autoFocus
					/>
					{/* Character counter and limit reminder */}
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						{isProjectNameOverLimit(topicRenameValue, MAX_PROJECT_NAME_LENGTH) ? (
							<span className="text-destructive">
								{t("super:chat.nameMaxLengthTip", {
									maxLength: MAX_PROJECT_NAME_LENGTH,
								})}
							</span>
						) : isProjectNameAtLimit(topicRenameValue, MAX_PROJECT_NAME_LENGTH) ? (
							<span>
								{t("super:chat.nameMaxLengthTip", {
									maxLength: MAX_PROJECT_NAME_LENGTH,
								})}
							</span>
						) : (
							<span />
						)}
						<span
							className={
								isProjectNameOverLimit(topicRenameValue, MAX_PROJECT_NAME_LENGTH)
									? "text-destructive"
									: ""
							}
							data-testid="recording-topic-rename-char-count"
						>
							{topicRenameValue.length}/{MAX_PROJECT_NAME_LENGTH}
						</span>
					</div>
				</div>
			</MagicPopup>

			<MagicPopup
				visible={topicDeleteOpen}
				onClose={() => {
					setTopicDeleteOpen(false)
					setTopicActionItem(null)
				}}
				position="bottom"
				headerVariant="actionHeader"
				headerTitle={t("super:ui.deleteTopicConfirmTitle")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("super:common.cancel"),
					onClick: () => {
						setTopicDeleteOpen(false)
						setTopicActionItem(null)
					},
					testId: "mobile-recording-topic-delete-close",
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("super:common.confirm"),
					onClick: () => void confirmRecordingTopicDelete(),
					tone: "destructive",
					testId: "mobile-recording-topic-delete-confirm",
				}}
				bodyClassName="max-h-[80dvh] p-6"
			>
				<p className="text-base leading-6 text-muted-foreground">
					{t("super:ui.deleteTopicDescription", {
						name: topicActionItem?.topic_name || t("super:topic.unnamedTopic"),
					})}
				</p>
			</MagicPopup>

			<MobileRecordingRenameSheet
				isOpen={renameDialogOpen}
				inputRef={titleInputRef}
				value={titleInput}
				renaming={renaming}
				onValueChange={setTitleInput}
				onCancel={closeRenameDialog}
				onConfirm={() => void submitRename()}
			/>

			<MobileRecordingSpeakerSheet
				isOpen={speakerSettingsOpen}
				speakerIds={activeSpeakerIds}
				value={speakerDraft}
				onValueChange={setSpeakerDraft}
				onCancel={() => setSpeakerSettingsOpen(false)}
				onConfirm={() => void submitSpeakerSettings()}
			/>

			<MobileRecordingMoreSheet
				isOpen={moreSheetOpen}
				item={resolvedActionItem}
				onClose={() => setMoreSheetOpen(false)}
				onRename={async (projectIdToRename, name) => {
					const trimmed = name.trim()
					if (!trimmed || actionSubmitting) return false

					setActionSubmitting(true)
					try {
						await renameAudioRecordingProject(projectIdToRename, trimmed)
						setTitleOverride(trimmed)
						setDetailItem((current) =>
							current ? { ...current, project_name: trimmed } : current,
						)
						toast.success(t("actions.renameSuccess"))
						return true
					} catch {
						toast.error(t("actions.renameFailed"))
						return false
					} finally {
						setActionSubmitting(false)
					}
				}}
				onDelete={handleDelete}
				onOpenProject={handleOpenProject}
				onSummarize={handleSummaryAction}
				onMoveToGroup={handleOpenMoveGroup}
				onCopyToProject={(item) => {
					void copyController.openCopyToProject(item)
				}}
				// Wire the more-actions "share" entry to the same share & export sheet opened by the header share button,
				// matching the prototype's single-share-sheet behavior (RecordingDetailScreen onShare).
				onShare={openShareExportSheet}
				onSearch={searchSupported ? openContentSearch : undefined}
				isSubmittingAction={actionSubmitting}
				isSubmittingSummary={summarySubmitting}
				canCopyToProject={
					resolvedActionItem ? canCopyAudioProject(resolvedActionItem).canCopy : false
				}
				showRegenerateAction
			/>

			<MobileRecordingMoveGroupSheet
				open={moveGroupSheetOpen}
				onOpenChange={setMoveGroupSheetOpen}
				groups={groups}
				selectedGroupId={detailItem?.workspace_id ?? UNGROUPED_RECORDING_GROUP_ID}
				ungroupedCount={ungroupedCount}
				onSelect={(groupId) => {
					void handleMoveGroup(groupId)
				}}
			/>

			<MobileRecordingShareExportSheet
				open={shareExportSheetOpen}
				recordingName={displayTitle}
				fileMap={fileMap}
				projectId={projectId}
				onOpenChange={setShareExportSheetOpen}
				onShareLink={openProjectShareSheet}
				onDownloadRecording={() => {
					void handleDownloadOriginal()
				}}
			/>

			<ProjectShareSheet
				open={projectShareSheetOpen}
				onClose={() => setProjectShareSheetOpen(false)}
				mode="file"
				projectMode="audio"
				projectId={projectId}
				projectName={displayTitle}
				attachments={recordingShareSelection.shareableFiles}
				attachmentList={recordingShareSelection.shareableFiles}
				dependencyAttachments={attachmentList}
				dependencyBundleRootPath={fileMap?.bundleRootPath}
				fileMap={fileMap ?? undefined}
				defaultSelectedFileIds={recordingShareSelection.defaultSelectedFileIds}
			/>
			<AudioRecordingCopyDialog controller={copyController} />
		</div>
	)
}

/** Maps service group DTOs into the mobile sheet shape without leaking service-only fields into the view. */
function mapAudioRecordingGroupToMobileGroup(group: AudioRecordingGroup): MobileRecordingGroup {
	return {
		id: group.id,
		name: group.name,
		projectCount: group.projectCount,
		isVirtual: false,
		workspaceType: group.workspaceType,
	}
}

/** Builds a minimal detail action item so header actions still work during direct-link recovery. */
function buildFallbackActionItem(input: {
	projectId: string
	title: string
	cardStatus?: AudioRecordingCardStatus
	audioFileId?: string
}): AudioProjectListItem | null {
	if (!input.projectId) return null

	return {
		id: input.projectId,
		project_name: resolveRecordingDisplayName(input.title, 0),
		created_at: 0,
		duration: 0,
		tags: [],
		device_id: "",
		audio_source: "recorded",
		current_phase: input.cardStatus === "summarized" ? "summarizing" : "merging",
		phase_status: input.cardStatus === "summarized" ? "completed" : "in_progress",
		card_status: input.cardStatus ?? "not_summarized",
		is_summarized: input.cardStatus === "summarized",
		task_key: "",
		topic_id: "",
		audio_file_id: input.audioFileId ?? "",
		model_id: "",
		workspace_id: "",
	}
}

/** Top-level segmented tab that keeps all three mobile detail labels on one line. */
function TopTabButton({
	active,
	label,
	onClick,
}: {
	active: boolean
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			className={cn(
				"h-[30px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] leading-5 transition-colors",
				active
					? "bg-card font-medium text-foreground shadow-[0_8px_25px_rgba(0,0,0,0.10)]"
					: "font-normal text-muted-foreground",
			)}
			onClick={onClick}
		>
			{label}
		</button>
	)
}

/** Header icon-only affordance used to match the prototype while deferring share/more logic. */
function HeaderIconButton({
	label,
	icon,
	onClick,
}: {
	label: string
	icon: ReactNode
	onClick?: () => void
}) {
	return (
		<button
			type="button"
			/* Use 48px touch targets inside the shared capsule so the recording detail header matches the project detail affordance geometry. */
			className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-transparent active:opacity-70"
			aria-label={label}
			onClick={onClick}
		>
			{icon}
		</button>
	)
}

/** Bottom rename form that mirrors the APP prototype sheet controls. */
function MobileRecordingRenameSheet({
	isOpen,
	inputRef,
	value,
	renaming,
	onValueChange,
	onCancel,
	onConfirm,
}: {
	isOpen: boolean
	inputRef: React.RefObject<HTMLInputElement>
	value: string
	renaming: boolean
	onValueChange: (value: string) => void
	onCancel: () => void
	onConfirm: () => void
}) {
	const { t } = useTranslation("audioRecordings")

	/** Submits from the keyboard without letting the browser reload the H5 route. */
	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		onConfirm()
	}

	return (
		<MagicPopup
			visible={isOpen}
			onClose={onCancel}
			position="bottom"
			title={t("actions.renameTitle")}
			headerVariant="actionHeader"
			headerTitle={t("actions.renameTitle")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("actions.cancel"),
				onClick: onCancel,
				testId: "mobile-recording-rename-cancel",
			}}
			headerTrailingAction={{
				icon: <Check />,
				ariaLabel: t("actions.confirm"),
				onClick: onConfirm,
				disabled: renaming || !value.trim(),
				tone: "primary",
				testId: "mobile-recording-rename-confirm",
			}}
			className="flex flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0"
			bodyClassName="no-scrollbar flex flex-col gap-2 overflow-y-auto px-[14px] pb-6 pt-[10px]"
			style={{ boxShadow: "0 -14px 44px rgba(0,0,0,0.18)" }}
			data-testid="mobile-recording-rename-dialog"
		>
			<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
				<div className="flex flex-col gap-2">
					<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
						{t("actions.renameLabel")}
					</p>
					<div className="overflow-hidden rounded-lg bg-card">
						<input
							ref={inputRef}
							type="text"
							value={value}
							onChange={(event) => onValueChange(event.target.value)}
							placeholder={t("actions.renamePlaceholder")}
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							className="h-12 w-full border-0 bg-transparent px-[14px] py-0 text-[16px] leading-6 text-foreground outline-none"
							data-testid="mobile-recording-title-input"
						/>
					</div>
				</div>
			</form>
		</MagicPopup>
	)
}

/** Collects every speaker id from loaded detail text files for the shared editor. */
function collectRecordingSpeakerIds(contents: Array<string | undefined>) {
	return Array.from(
		new Set(contents.flatMap((content) => (content ? collectSpeakerIdsFromText(content) : []))),
	)
}
