import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation, useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { useDebounceFn, useDeepCompareEffect, useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import useNavigate from "@/routes/hooks/useNavigate"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { MessageHeaderTopicHistoryPanel } from "@/pages/superMagic/components/MessageHeader"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useCompositeDetailPanelController } from "@/pages/superMagic/hooks/useCompositeDetailPanelController"
import { useDeferUntilFileTabsCacheLoaded } from "@/pages/superMagic/hooks/useDeferUntilFileTabsCacheLoaded"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { loadProjectAttachments } from "@/pages/superMagic/services"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import { MY_AGENTS_WORKSPACE_DATA } from "@/pages/superMagic/constants"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import {
	FileAccessProvider,
	EDITOR_FILE_CONFIG,
	VIEWER_FILE_CONFIG,
} from "@/pages/superMagic/providers/FileAccessProvider"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { convertSearchParams } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { crewService } from "@/services/crew/CrewService"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode"
import {
	DEFAULT_MAX_WIDTH,
	DEFAULT_MIN_WIDTH,
	DEFAULT_WIDTH,
} from "@/pages/superMagic/constants/resizablePanel"
import { CrewEditStoreProvider, useCrewEditStore } from "./context"
import { useCrewEditErrorToasts } from "./hooks/useCrewEditErrorToasts"
import { useIdentityMarkdownSync } from "./hooks/useIdentityMarkdownSync"
import { useCrewEditInitialization } from "./hooks/useCrewEditInitialization"
import { useRefreshCrewDetailOnTopicMessage } from "./hooks/useRefreshCrewDetailOnTopicMessage"
import CrewEditPanels from "./components/CrewEditPanels"
import ConfigStepsPanel from "./components/ConfigStepsPanel"
import StepDetailPanel from "./components/StepDetailPanel"
import CrewTopicPanel from "./components/CrewTopicPanel"
import {
	CREW_EDIT_STEP,
	CREW_SIDEBAR_TAB,
	CREW_SKILLS_TAB,
	isCrewSidebarTabEnabled,
	isCrewStepEnabled,
	type CrewEditStep,
	type CrewSidebarTab,
	type CrewSkillsTab,
	type StepDetailKey,
} from "./store"

function CrewEditErrorFallback({ error, onBack }: { error: string; onBack: () => void }) {
	const { t } = useTranslation("crew/create")
	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-4"
			data-testid="crew-edit-error"
		>
			<p className="text-sm text-destructive">{error}</p>
			<button
				type="button"
				className="text-sm text-primary hover:underline"
				onClick={onBack}
				data-testid="on-back"
			>
				{t("backToMyCrew")}
			</button>
		</div>
	)
}

const SIDEBAR_DEFAULT_PX = 320
const SIDEBAR_MIN_PX = 240
const SIDEBAR_MAX_PX = 500
const CREW_EDIT_MESSAGE_PANEL_STORAGE_KEY = "MAGIC:crew-edit-message-panel-width"

const CREW_EDIT_SIDEBAR_STORAGE_KEY = "MAGIC:crew-edit-sidebar-width"
const CREW_EDIT_PANEL_QUERY_KEY = "panel"

/** 知识库详情 / 文档流程 URL 参数；从知识库切到附件预览时应清除 */
const CREW_EDIT_KNOWLEDGE_ROUTE_QUERY_KEYS = ["code", "mode", "type", "docCode", "rebind"] as const

function buildCrewEditQueryAfterLeavingKnowledgeDetail(search: string) {
	const searchParams = new URLSearchParams(search)
	for (const key of CREW_EDIT_KNOWLEDGE_ROUTE_QUERY_KEYS) {
		searchParams.delete(key)
	}
	if (searchParams.get(CREW_EDIT_PANEL_QUERY_KEY) === CREW_EDIT_STEP.KnowledgeBase) {
		searchParams.delete(CREW_EDIT_PANEL_QUERY_KEY)
	}
	const query = convertSearchParams(searchParams)
	return Object.keys(query).length > 0 ? query : undefined
}

function isCrewEditKnowledgeDetailSearch(search: string) {
	const sp = new URLSearchParams(search)
	if (sp.get("code")) return true
	return sp.get(CREW_EDIT_PANEL_QUERY_KEY) === CREW_EDIT_STEP.KnowledgeBase
}

type CrewEditRoutePanel = CrewEditStep | typeof CREW_SIDEBAR_TAB.Files | null

interface CrewEditPanelRouteStore {
	activeDetailKey: StepDetailKey
	activeSidebarTab: CrewSidebarTab
	setActiveStep: (step: CrewEditStep | null) => void
	setActiveSidebarTab: (tab: CrewSidebarTab) => void
	openSkillsPanel: (tab?: CrewSkillsTab) => void
	openPlaybook: () => void
	openBuiltinSkills: () => void
	applyKnowledgeRouteFromSearch: (search: string) => void
}

function getPanelFromSearch(search: string): CrewEditRoutePanel {
	const panel = new URLSearchParams(search).get(CREW_EDIT_PANEL_QUERY_KEY)
	if (!panel) return null
	if (panel === CREW_SIDEBAR_TAB.Files)
		return isCrewSidebarTabEnabled(CREW_SIDEBAR_TAB.Files) ? CREW_SIDEBAR_TAB.Files : null
	if (!Object.values(CREW_EDIT_STEP).includes(panel as CrewEditStep)) return null
	if (!isCrewStepEnabled(panel as CrewEditStep)) return null
	return panel as CrewEditRoutePanel
}

function buildCrewEditQuery({ search, panel }: { search: string; panel: CrewEditRoutePanel }) {
	const searchParams = new URLSearchParams(search)
	if (panel) {
		searchParams.set(CREW_EDIT_PANEL_QUERY_KEY, panel)
	} else {
		searchParams.delete(CREW_EDIT_PANEL_QUERY_KEY)
	}
	const query = convertSearchParams(searchParams)
	return Object.keys(query).length > 0 ? query : undefined
}

function applyRoutePanelToStore({
	panel,
	store,
	search,
}: {
	panel: CrewEditRoutePanel
	store: CrewEditPanelRouteStore
	search: string
}) {
	if (panel === CREW_SIDEBAR_TAB.Files) {
		if (store.activeSidebarTab === CREW_SIDEBAR_TAB.Files) return
		store.setActiveStep(null)
		store.setActiveSidebarTab(CREW_SIDEBAR_TAB.Files)
		return
	}
	if (panel === CREW_EDIT_STEP.KnowledgeBase) {
		store.applyKnowledgeRouteFromSearch(search)
		return
	}
	if (panel === store.activeDetailKey) return
	if (panel === null) {
		store.setActiveStep(null)
		return
	}
	if (panel === CREW_EDIT_STEP.Playbook) {
		store.openPlaybook()
		return
	}
	if (panel === CREW_EDIT_STEP.BuiltinSkills) {
		store.openBuiltinSkills()
		return
	}
	if (panel === CREW_EDIT_STEP.Skills) {
		store.openSkillsPanel(CREW_SKILLS_TAB.MySkills)
		return
	}
	store.setActiveStep(panel)
}

function CrewEditInner({ crewId }: { crewId: string }) {
	const { t: tCrewCreate } = useTranslation("crew/create")
	const { t: tSuper } = useTranslation("super")
	const agentsWorkspace = useMemo(() => MY_AGENTS_WORKSPACE_DATA(tSuper), [tSuper])
	const store = useCrewEditStore()
	const { layout, conversation, identity, playbook } = store
	const navigate = useNavigate()
	const location = useLocation()
	const detailRef = useRef<DetailRef>(null)
	const routeSyncTargetRef = useRef<CrewEditRoutePanel>(null)
	const previousRoutePanelRef = useRef<CrewEditRoutePanel | undefined>(undefined)
	const previousRouteReadyRef = useRef<boolean | undefined>(undefined)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	const [isInitialAttachmentsLoaded, setIsInitialAttachmentsLoaded] = useState(false)
	const [isInitialAttachmentsLoadFailed, setIsInitialAttachmentsLoadFailed] = useState(false)
	const selectedProject = conversation.selectedProject
	const isViewer = isReadOnlyProject(selectedProject?.user_role)
	const selectedTopic = conversation.topicStore.selectedTopic
	const topicActions = useScopedMessageHeaderTopicActions({
		selectedProject,
		selectedTopic,
		topicStore: conversation.topicStore,
	})
	const crewDisplayName = identity.name_i18n.default?.trim() || tCrewCreate("untitledCrew")
	const isRouteReady = store.crewCode === crewId && !store.initLoading
	const attachments = store.projectFilesStore.workspaceFileTree
	const attachmentList = store.projectFilesStore.workspaceFilesList
	const handleUserSelectDetail = useMemoizedFn((detail: unknown) => {
		setUserSelectDetail(detail)
	})
	const setAttachments = useMemoizedFn((nextAttachments: AttachmentItem[]) => {
		store.projectFilesStore.setWorkspaceFileTree(nextAttachments)
	})
	const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
	const knowledgeCode = searchParams.get("code")

	useCrewEditErrorToasts({
		initError: store.initError,
		identity,
		playbook,
	})
	useCrewEditInitialization({ store, crewId })
	useRefreshCrewDetailOnTopicMessage({ store })
	useIdentityMarkdownSync({
		projectId: selectedProject?.id,
		files: attachmentList,
		identity,
		isInitialAttachmentsLoaded,
	})
	useNamedPageTitle({
		entityName: crewDisplayName,
		isReady: !store.initLoading && !store.initError,
	})
	useDefaultModeModelListRefreshOnMount()
	useCreateTopicListener({
		selectedProject,
		topicStore: conversation.topicStore,
	})

	const routePanel = useMemo(() => getPanelFromSearch(location.search), [location.search])
	const currentRoutePanel: CrewEditRoutePanel =
		layout.activeSidebarTab === CREW_SIDEBAR_TAB.Files &&
		isCrewSidebarTabEnabled(CREW_SIDEBAR_TAB.Files)
			? CREW_SIDEBAR_TAB.Files
			: layout.activeDetailKey && isCrewStepEnabled(layout.activeDetailKey)
				? layout.activeDetailKey
				: null
	const shouldShowKnowledgeDetailPanel =
		layout.activeDetailKey === CREW_EDIT_STEP.KnowledgeBase && !!knowledgeCode
	const shouldShowStepDetailPanel =
		(layout.activeSidebarTab === CREW_SIDEBAR_TAB.Advanced && layout.showDetailPanel) ||
		shouldShowKnowledgeDetailPanel
	const updateAttachments = useDebounceFn(
		(projectId?: string, callback?: (didLoad: boolean) => void) => {
			if (!projectId) {
				store.projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				setIsInitialAttachmentsLoadFailed(false)
				callback?.(false)
				return
			}

			let didLoad = false

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				loadProjectAttachments({
					projectId,
				})
					.then((res) => {
						store.projectFilesStore.setWorkspaceFileTree(res.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
						if (selectedProject?.id === projectId) {
							setIsInitialAttachmentsLoadFailed(false)
						}
						didLoad = true
					})
					.catch((error) => {
						console.error("Failed to fetch crew attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
						if (selectedProject?.id === projectId) {
							setIsInitialAttachmentsLoadFailed(true)
						}
					})
					.finally(() => {
						resolveAttachmentsRefreshWaitersForProject(projectId, didLoad)
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.(didLoad)
					}),
			)
		},
		{ wait: 500 },
	).run

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace: agentsWorkspace,
		selectedTopic,
		projects: [],
		workspaces: [],
		attachments,
		setAttachments,
		setUserSelectDetail: handleUserSelectDetail,
		detailRef,
		isReadOnly: isViewer,
	})

	/** 右侧被步骤/知识库占用时 Detail 未挂载，打开预览前先关掉步骤面板 */
	const closeStepPanelForFilePreview = useMemoizedFn((payload?: unknown) => {
		if (
			payload &&
			typeof payload === "object" &&
			"action" in payload &&
			(payload as { action?: string }).action === "download"
		) {
			return
		}
		if (layout.activeDetailKey !== null) layout.setActiveStep(null)
		if (!isCrewEditKnowledgeDetailSearch(location.search)) return
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: buildCrewEditQueryAfterLeavingKnowledgeDetail(location.search),
			replace: true,
		})
	})

	const handleFileClickWithPreviewPanel = useMemoizedFn((fileItem?: unknown) => {
		const wasKnowledgeDetail = isCrewEditKnowledgeDetailSearch(location.search)
		closeStepPanelForFilePreview()
		if (!wasKnowledgeDetail) {
			handleFileClick(fileItem)
			return
		}
		window.setTimeout(() => handleFileClick(fileItem), 120)
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Open_File_Tab, closeStepPanelForFilePreview)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, closeStepPanelForFilePreview)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, closeStepPanelForFilePreview)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, closeStepPanelForFilePreview)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, closeStepPanelForFilePreview)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, closeStepPanelForFilePreview)
		}
	}, [closeStepPanelForFilePreview])

	const { shouldShowDetailPanel, topicFilesPropsWithPanel, handleActiveDetailTabChange } =
		useCompositeDetailPanelController({
			detailRef,
			isReadOnly: isViewer,
			activeFileId,
			setActiveFileId,
			handleFileClick: handleFileClickWithPreviewPanel,
			topicFilesProps,
			extraPanelVisible: shouldShowStepDetailPanel,
			resetDeps: [selectedProject?.id],
			onReset: () => {
				setUserSelectDetail(undefined)
				setIsDetailPanelFullscreen(false)
			},
			attachmentList,
		})

	const { onFileTabsCacheLoaded } = useDeferUntilFileTabsCacheLoaded(selectedProject?.id)

	useEffect(() => {
		if (!isViewer) return
		if (routePanel !== CREW_EDIT_STEP.Publishing && routePanel !== CREW_EDIT_STEP.RunAndDebug) {
			return
		}

		routeSyncTargetRef.current = null
		layout.setActiveStep(null)
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: buildCrewEditQuery({ search: location.search, panel: null }),
			replace: true,
			viewTransition: false,
		})
	}, [crewId, isViewer, layout, location.search, navigate, routePanel])

	const {
		width: sidebarWidthPx,
		isDragging: isDraggingSidebar,
		handleResizeStart: onSidebarResizeStart,
	} = useResizablePanel({
		minWidth: SIDEBAR_MIN_PX,
		maxWidth: SIDEBAR_MAX_PX,
		defaultWidth: SIDEBAR_DEFAULT_PX,
		storageKey: CREW_EDIT_SIDEBAR_STORAGE_KEY,
		direction: "left",
	})

	const {
		width: messagePanelWidthPx,
		isDragging: isDraggingMessagePanel,
		handleResizeStart: onMessagePanelResizeStart,
	} = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
		maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
		storageKey: CREW_EDIT_MESSAGE_PANEL_STORAGE_KEY,
		direction: "right",
	})

	useLayoutEffect(() => {
		if (
			isViewer &&
			(routePanel === CREW_EDIT_STEP.Publishing || routePanel === CREW_EDIT_STEP.RunAndDebug)
		) {
			layout.setActiveStep(null)
			return
		}

		const previousRoutePanel = previousRoutePanelRef.current
		previousRoutePanelRef.current = routePanel
		const previousRouteReady = previousRouteReadyRef.current
		previousRouteReadyRef.current = isRouteReady
		const didRouteBecomeReady = previousRouteReady === false && isRouteReady

		// Only let URL changes drive store state. Otherwise a local close
		// action is immediately overwritten by the stale route param.
		if (
			!didRouteBecomeReady &&
			previousRoutePanel === routePanel &&
			previousRoutePanel !== undefined
		) {
			return
		}

		if (routePanel !== null && routePanel !== currentRoutePanel) {
			routeSyncTargetRef.current = routePanel
		}
		applyRoutePanelToStore({ panel: routePanel, store: layout, search: location.search })
	}, [currentRoutePanel, isRouteReady, isViewer, layout, location.search, routePanel])

	useEffect(() => {
		store.projectFilesStore.setSelectedProject(selectedProject)
		return () => {
			store.projectFilesStore.setSelectedProject(null)
		}
	}, [selectedProject, store.projectFilesStore])

	const { checkNowDebounced: checkAttachmentsNowDebounced } = useAttachmentsPolling({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		autoStart: false,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
				setIsInitialAttachmentsLoadFailed(false)
				setIsInitialAttachmentsLoaded(true)
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll crew attachments:", error)
		}),
	})

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		onAttachmentsChange: undefined,
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime crew attachments:", error)
			setIsInitialAttachmentsLoadFailed(true)
		}),
	})

	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (!projectId) {
			setIsInitialAttachmentsLoaded(false)
			setIsInitialAttachmentsLoadFailed(false)
			return
		}

		let isActive = true
		setIsInitialAttachmentsLoaded(false)
		setIsInitialAttachmentsLoadFailed(false)

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId, (didLoad) => {
			if (!isActive || !didLoad) return
			setIsInitialAttachmentsLoadFailed(false)
			setIsInitialAttachmentsLoaded(true)
		})

		return () => {
			isActive = false
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [selectedProject?.id])

	useEffect(() => {
		const handleUpdateAttachments = (
			payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
		) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)
			const pid = selectedProject?.id
			if (!pid) {
				payload?.callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, payload?.callback)
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [selectedProject?.id, updateAttachments])

	useEffect(() => {
		if (routeSyncTargetRef.current !== null) {
			if (currentRoutePanel !== routeSyncTargetRef.current) return
			routeSyncTargetRef.current = null
		}
		if (routePanel === currentRoutePanel) return
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: buildCrewEditQuery({
				search: location.search,
				panel: currentRoutePanel,
			}),
			replace: true,
			viewTransition: false,
		})
	}, [crewId, currentRoutePanel, location.search, navigate, routePanel])

	const shouldHideMessagePanel =
		isViewer || (shouldShowStepDetailPanel ? layout.isMessagePanelHidden : false)

	const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
		useTopicHistoryLayoutState({
			storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.crewEdit,
			isEnabled: !isViewer && !shouldHideMessagePanel,
		})
	const detailPanel = shouldShowStepDetailPanel ? (
		<StepDetailPanel />
	) : (
		<Detail
			fileHelpContext={
				selectedProject?.id
					? { kind: "crew", projectId: String(selectedProject.id) }
					: { kind: "unknown" }
			}
			ref={detailRef}
			disPlayDetail={userSelectDetail}
			userSelectDetail={userSelectDetail}
			setUserSelectDetail={handleUserSelectDetail}
			attachments={attachments}
			attachmentList={attachmentList}
			topicId={selectedTopic?.id}
			baseShareUrl={`${window.location.origin}/share`}
			currentTopicStatus={selectedTopic?.task_status}
			messages={[]}
			allowEdit={!isViewer}
			selectedTopic={selectedTopic}
			selectedProject={selectedProject}
			activeFileId={activeFileId}
			onActiveFileChange={setActiveFileId}
			onActiveTabChange={handleActiveDetailTabChange}
			onFullscreenChange={setIsDetailPanelFullscreen}
			isFullscreen={isDetailPanelFullscreen}
			onFileTabsCacheLoaded={onFileTabsCacheLoaded}
			projectId={selectedProject?.id}
			showFallbackWhenEmpty
		/>
	)

	function handleBack() {
		navigate({ name: RouteName.MyCrew })
	}

	if (store.initLoading) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="crew-edit-loading"
			>
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.initError) {
		return (
			<CrewEditErrorFallback
				error={store.initError.message}
				onBack={() => navigate({ name: RouteName.MyCrew })}
			/>
		)
	}

	return (
		<HostConversationProvider
			selectedProject={selectedProject}
			topicStore={conversation.topicStore}
		>
			<FileAccessProvider {...(isViewer ? VIEWER_FILE_CONFIG : EDITOR_FILE_CONFIG)}>
				<div className="flex h-full w-full overflow-hidden" data-testid="crew-edit-page">
					<CrewEditPanels
						sidebarWidthPx={sidebarWidthPx}
						messagePanelWidthPx={messagePanelWidthPx}
						showDetailPanel={shouldShowDetailPanel}
						isDetailPanelFullscreen={isDetailPanelFullscreen}
						isConversationPanelCollapsed={layout.isConversationPanelCollapsed}
						hideMessagePanel={shouldHideMessagePanel}
						keepDetailMountedWhenHidden
						historyLayout={
							isViewer
								? undefined
								: {
										isOpen: isTopicHistoryPanelOpen,
										onClose: closeTopicHistoryPanel,
										onToggle: toggleTopicHistoryPanel,
										renderPanel: ({
											isConversationPanelCollapsed,
											onExpandConversationPanel,
											onClose,
											closeButtonRef,
										}) => (
											<MessageHeaderTopicHistoryPanel
												selectedProject={selectedProject}
												topicStore={conversation.topicStore}
												topicActions={topicActions}
												isConversationPanelCollapsed={
													isConversationPanelCollapsed
												}
												onExpandConversationPanel={
													onExpandConversationPanel
												}
												hideTopicListModeIcon
												hideTopicTypeFilter
												onClose={onClose}
												closeButtonRef={closeButtonRef}
											/>
										),
									}
						}
						onSidebarResizeStart={onSidebarResizeStart}
						onMessagePanelResizeStart={onMessagePanelResizeStart}
						isDraggingSidebar={isDraggingSidebar}
						isDraggingMessagePanel={isDraggingMessagePanel}
						sidebar={
							<ConfigStepsPanel
								onBack={handleBack}
								isAttachmentsLoaded={isInitialAttachmentsLoaded}
								isAttachmentsLoadFailed={isInitialAttachmentsLoadFailed}
								filesContent={
									<TopicFilesButton
										{...topicFilesPropsWithPanel}
										fileHelpContext={
											selectedProject?.id
												? {
														kind: "crew",
														projectId: String(selectedProject.id),
													}
												: { kind: "unknown" }
										}
										className="h-full"
										title={tSuper("topicFiles.fileTitle")}
									/>
								}
							/>
						}
						detailPanel={detailPanel}
						messagePanel={
							isViewer ? null : (
								<CrewTopicPanel
									selectedProject={selectedProject}
									topicStore={conversation.topicStore}
									mentionPanelStore={store.mentionPanelStore}
									projectFilesStore={store.projectFilesStore}
									setSelectedDetail={handleUserSelectDetail}
									onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
									isConversationPanelCollapsed={
										shouldShowDetailPanel
											? layout.isConversationPanelCollapsed
											: false
									}
									onToggleConversationPanel={() =>
										layout.toggleConversationPanel()
									}
									onExpandConversationPanel={() =>
										layout.expandConversationPanel()
									}
									detailPanelVisible={shouldShowDetailPanel}
									crewId={crewId}
								/>
							)
						}
					/>
				</div>
			</FileAccessProvider>
		</HostConversationProvider>
	)
}

const CrewEditInnerObserver = observer(CrewEditInner)

function CrewEditPage() {
	const { id } = useParams<{ id: string }>()
	const navigate = useNavigate()
	const [resolvingCreate, setResolvingCreate] = useState(id === "create")

	useEffect(() => {
		if (!id) {
			navigate({ name: RouteName.MyCrew, replace: true })
			return
		}
		if (id === "create") {
			setResolvingCreate(true)
			crewService
				.createDefaultAgent()
				.then(({ code }) => {
					navigate({
						name: RouteName.CrewEdit,
						params: { id: code },
						replace: true,
					})
				})
				.catch(() => {
					navigate({ name: RouteName.MyCrew, replace: true })
				})
				.finally(() => {
					setResolvingCreate(false)
				})
			return
		}
		setResolvingCreate(false)
	}, [id, navigate])

	if (!id || resolvingCreate) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="crew-edit-resolving"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	return (
		<CrewEditStoreProvider>
			<CrewEditInnerObserver crewId={id} />
		</CrewEditStoreProvider>
	)
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<CrewEditPage />
		</FileAccessProvider>
	)
}
