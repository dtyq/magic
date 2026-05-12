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
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import {
	releaseAttachmentsRefreshWaitersWithoutFetch,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import {
	FileActionVisibilityProvider,
	HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"
import { convertSearchParams } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { SuperMagicApi } from "@/apis"
import { crewService } from "@/services/crew/CrewService"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
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
			<button type="button" className="text-sm text-primary hover:underline" onClick={onBack}>
				{t("backToMyCrew")}
			</button>
		</div>
	)
}

const SIDEBAR_DEFAULT_PX = 320
const SIDEBAR_MIN_PX = 240
const SIDEBAR_MAX_PX = 500
const DETAIL_DEFAULT_PX = 688
const DETAIL_MIN_PX = 400
const DETAIL_MAX_PX = 900
const MESSAGE_PANEL_WIDTH_PX = 360

const CREW_EDIT_SIDEBAR_STORAGE_KEY = "MAGIC:crew-edit-sidebar-width"
const CREW_EDIT_DETAIL_STORAGE_KEY = "MAGIC:crew-edit-detail-panel-width"
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
	const selectedProject = conversation.selectedProject
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
				callback?.(false)
				return
			}

			const temporaryToken =
				(window as Window & { temporary_token?: string }).temporary_token || ""
			let didLoad = false

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				SuperMagicApi.getAttachmentsByProjectId({
					projectId,
					temporaryToken,
				})
					.then((res) => {
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
						didLoad = true
					})
					.catch((error) => {
						console.error("Failed to fetch crew attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.(didLoad)
					}),
			)
		},
		{ wait: 500 },
	).run

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace: undefined,
		selectedTopic,
		projects: [],
		workspaces: [],
		attachments,
		setAttachments,
		setUserSelectDetail: handleUserSelectDetail,
		detailRef,
		isReadOnly: false,
	})

	/** 知识库详情占用了右侧 StepDetailPanel 时 Detail 未挂载，需先清 URL 再打开文件预览 */
	const handleFileClickWithKnowledgeRouteReset = useMemoizedFn((fileItem?: unknown) => {
		if (!isCrewEditKnowledgeDetailSearch(location.search)) {
			handleFileClick(fileItem)
			return
		}
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: buildCrewEditQueryAfterLeavingKnowledgeDetail(location.search),
			replace: true,
		})
		window.setTimeout(() => {
			handleFileClick(fileItem)
		}, 120)
	})

	const { shouldShowDetailPanel, topicFilesPropsWithPanel, handleActiveDetailTabChange } =
		useCompositeDetailPanelController({
			detailRef,
			isReadOnly: false,
			activeFileId,
			setActiveFileId,
			handleFileClick: handleFileClickWithKnowledgeRouteReset,
			topicFilesProps,
			extraPanelVisible: shouldShowStepDetailPanel,
			resetDeps: [selectedProject?.id],
			onReset: () => {
				setUserSelectDetail(undefined)
				setIsDetailPanelFullscreen(false)
			},
		})

	const { onFileTabsCacheLoaded } = useDeferUntilFileTabsCacheLoaded(selectedProject?.id)

	const {
		width: sidebarWidthPx,
		isDragging: isDraggingSidebar,
		handleMouseDown: onSidebarResizeStart,
	} = useResizablePanel({
		minWidth: SIDEBAR_MIN_PX,
		maxWidth: SIDEBAR_MAX_PX,
		defaultWidth: SIDEBAR_DEFAULT_PX,
		storageKey: CREW_EDIT_SIDEBAR_STORAGE_KEY,
		direction: "left",
	})

	const {
		width: detailPanelWidthPx,
		isDragging: isDraggingDetail,
		handleMouseDown: onDetailResizeStart,
	} = useResizablePanel({
		minWidth: DETAIL_MIN_PX,
		maxWidth: DETAIL_MAX_PX,
		defaultWidth: DETAIL_DEFAULT_PX,
		storageKey: CREW_EDIT_DETAIL_STORAGE_KEY,
		direction: "left",
	})

	useLayoutEffect(() => {
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
	}, [currentRoutePanel, isRouteReady, layout, location.search, routePanel])

	useEffect(() => {
		store.projectFilesStore.setSelectedProject(selectedProject)
		return () => {
			store.projectFilesStore.setSelectedProject(null)
		}
	}, [selectedProject, store.projectFilesStore])

	useAttachmentsPolling({
		projectId: selectedProject?.id,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
				setIsInitialAttachmentsLoaded(true)
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll crew attachments:", error)
		}),
	})

	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (!projectId) {
			setIsInitialAttachmentsLoaded(false)
			return
		}

		let isActive = true
		setIsInitialAttachmentsLoaded(false)

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId, (didLoad) => {
			if (!isActive || !didLoad) return
			setIsInitialAttachmentsLoaded(true)
		})

		return () => {
			isActive = false
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [selectedProject?.id])

	useEffect(() => {
		const handleUpdateAttachments = (callback?: () => void) => {
			const pid = selectedProject?.id
			if (!pid) {
				callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, callback)
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

	const shouldHideMessagePanel = shouldShowStepDetailPanel ? layout.isMessagePanelHidden : false

	const {
		isTopicHistoryPanelOpen,
		openTopicHistoryPanel,
		closeTopicHistoryPanel,
		toggleTopicHistoryPanel,
	} = useTopicHistoryLayoutState({
		storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.crewEdit,
		isEnabled: !shouldHideMessagePanel,
	})
	const detailPanel = shouldShowStepDetailPanel ? (
		<StepDetailPanel />
	) : (
		<Detail
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
			allowEdit
			selectedTopic={selectedTopic}
			selectedProject={selectedProject}
			activeFileId={activeFileId}
			onActiveFileChange={setActiveFileId}
			onActiveTabChange={handleActiveDetailTabChange}
			onFullscreenChange={setIsDetailPanelFullscreen}
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
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
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
		<FileActionVisibilityProvider value={HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS}>
			<div className="flex h-full w-full overflow-hidden" data-testid="crew-edit-page">
				<CrewEditPanels
					sidebarWidthPx={sidebarWidthPx}
					detailPanelWidthPx={detailPanelWidthPx}
					messagePanelWidthPx={MESSAGE_PANEL_WIDTH_PX}
					showDetailPanel={shouldShowDetailPanel}
					isDetailPanelFullscreen={isDetailPanelFullscreen}
					isConversationPanelCollapsed={layout.isConversationPanelCollapsed}
					hideMessagePanel={shouldHideMessagePanel}
					keepDetailMountedWhenHidden
					historyLayout={{
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
								isConversationPanelCollapsed={isConversationPanelCollapsed}
								onExpandConversationPanel={onExpandConversationPanel}
								hideTopicListModeIcon
								onClose={onClose}
								closeButtonRef={closeButtonRef}
							/>
						),
					}}
					onSidebarResizeStart={onSidebarResizeStart}
					onDetailResizeStart={onDetailResizeStart}
					isDraggingSidebar={isDraggingSidebar}
					isDraggingDetail={isDraggingDetail}
					sidebar={
						<ConfigStepsPanel
							onBack={handleBack}
							filesContent={
								<TopicFilesButton
									{...topicFilesPropsWithPanel}
									className="h-full"
									title={tSuper("topicFiles.fileTitle")}
								/>
							}
						/>
					}
					detailPanel={detailPanel}
					messagePanel={
						<CrewTopicPanel
							selectedProject={selectedProject}
							topicStore={conversation.topicStore}
							mentionPanelStore={store.mentionPanelStore}
							projectFilesStore={store.projectFilesStore}
							isConversationPanelCollapsed={
								shouldShowDetailPanel ? layout.isConversationPanelCollapsed : false
							}
							onToggleConversationPanel={() => layout.toggleConversationPanel()}
							onExpandConversationPanel={() => layout.expandConversationPanel()}
							detailPanelVisible={shouldShowDetailPanel}
							crewId={crewId}
						/>
					}
				/>
			</div>
		</FileActionVisibilityProvider>
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

export default CrewEditPage
