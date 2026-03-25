import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation, useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { useDebounceFn, useDeepCompareEffect, useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import useNavigate from "@/routes/hooks/useNavigate"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useCompositeDetailPanelController } from "@/pages/superMagic/hooks/useCompositeDetailPanelController"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import {
	FileActionVisibilityProvider,
	HIDE_COPY_MOVE_SHARE_FILE_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"
import { convertSearchParams } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { SuperMagicApi } from "@/apis"
import { crewService } from "@/services/crew/CrewService"
import { CrewEditStoreProvider, useCrewEditStore } from "./context"
import { useCrewEditErrorToasts } from "./hooks/useCrewEditErrorToasts"
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

type CrewEditRoutePanel = CrewEditStep | typeof CREW_SIDEBAR_TAB.Files | null

interface CrewEditPanelRouteStore {
	activeDetailKey: StepDetailKey
	activeSidebarTab: CrewSidebarTab
	setActiveStep: (step: CrewEditStep | null) => void
	setActiveSidebarTab: (tab: CrewSidebarTab) => void
	openSkillsPanel: (tab?: CrewSkillsTab) => void
	openPlaybook: () => void
	openBuiltinSkills: () => void
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
}: {
	panel: CrewEditRoutePanel
	store: CrewEditPanelRouteStore
}) {
	if (panel === CREW_SIDEBAR_TAB.Files) {
		if (store.activeSidebarTab === CREW_SIDEBAR_TAB.Files) return
		store.setActiveStep(null)
		store.setActiveSidebarTab(CREW_SIDEBAR_TAB.Files)
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
	const store = useCrewEditStore()
	const { layout, conversation, identity, playbook } = store
	const navigate = useNavigate()
	const location = useLocation()
	const detailRef = useRef<DetailRef>(null)
	const routeSyncTargetRef = useRef<CrewEditRoutePanel>(null)
	const previousRoutePanelRef = useRef<CrewEditRoutePanel | undefined>(undefined)
	const previousRouteReadyRef = useRef<boolean | undefined>(undefined)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [, setIsDetailPanelFullscreen] = useState(false)
	const selectedProject = conversation.selectedProject
	const selectedTopic = conversation.topicStore.selectedTopic
	const isRouteReady = store.crewCode === crewId && !store.initLoading
	const attachments = store.projectFilesStore.workspaceFileTree
	const attachmentList = store.projectFilesStore.workspaceFilesList
	const handleUserSelectDetail = useMemoizedFn((detail: unknown) => {
		setUserSelectDetail(detail)
	})
	const setAttachments = useMemoizedFn((nextAttachments: AttachmentItem[]) => {
		store.projectFilesStore.setWorkspaceFileTree(nextAttachments)
	})

	useCrewEditErrorToasts({
		initError: store.initError,
		identity,
		playbook,
	})
	useCrewEditInitialization({ store, crewId })
	useRefreshCrewDetailOnTopicMessage({ store })

	const routePanel = useMemo(() => getPanelFromSearch(location.search), [location.search])
	const currentRoutePanel: CrewEditRoutePanel =
		layout.activeSidebarTab === CREW_SIDEBAR_TAB.Files &&
		isCrewSidebarTabEnabled(CREW_SIDEBAR_TAB.Files)
			? CREW_SIDEBAR_TAB.Files
			: layout.activeDetailKey && isCrewStepEnabled(layout.activeDetailKey)
				? layout.activeDetailKey
				: null
	const shouldShowStepDetailPanel =
		layout.activeSidebarTab === CREW_SIDEBAR_TAB.Advanced && layout.showDetailPanel
	const updateAttachments = useDebounceFn(
		(projectId?: string, callback?: () => void) => {
			if (!projectId) {
				store.projectFilesStore.setWorkspaceFileTree([])
				callback?.()
				return
			}

			const temporaryToken =
				(window as Window & { temporary_token?: string }).temporary_token || ""

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			SuperMagicApi.getAttachmentsByProjectId({
				projectId,
				temporaryToken,
			})
				.then((res) => {
					const processedData = AttachmentDataProcessor.processAttachmentData(res)
					store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
					store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
				})
				.catch((error) => {
					console.error("Failed to fetch crew attachments:", error)
					store.projectFilesStore.setWorkspaceFileTree([])
				})
				.finally(() => {
					pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
					callback?.()
				})
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

	const { shouldShowDetailPanel, topicFilesPropsWithPanel, handleActiveDetailTabChange } =
		useCompositeDetailPanelController({
			detailRef,
			isReadOnly: false,
			activeFileId,
			setActiveFileId,
			handleFileClick,
			topicFilesProps,
			extraPanelVisible: shouldShowStepDetailPanel,
			resetDeps: [selectedProject?.id],
			onReset: () => {
				setUserSelectDetail(undefined)
				setIsDetailPanelFullscreen(false)
			},
		})

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
		applyRoutePanelToStore({ panel: routePanel, store: layout })
	}, [currentRoutePanel, isRouteReady, layout, routePanel])

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
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll crew attachments:", error)
		}),
	})

	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (!projectId) return

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId)

		return () => {
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [selectedProject?.id])

	useEffect(() => {
		const handleUpdateAttachments = (callback: () => void) => {
			updateAttachments(selectedProject?.id, callback)
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
			projectId={selectedProject?.id}
			showFallbackWhenEmpty
		/>
	)

	function handleBack() {
		navigate({ delta: -1 })
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
		<FileActionVisibilityProvider value={HIDE_COPY_MOVE_SHARE_FILE_ACTIONS}>
			<div className="flex h-full w-full overflow-hidden" data-testid="crew-edit-page">
				<CrewEditPanels
					sidebarWidthPx={sidebarWidthPx}
					detailPanelWidthPx={detailPanelWidthPx}
					messagePanelWidthPx={MESSAGE_PANEL_WIDTH_PX}
					showDetailPanel={shouldShowDetailPanel}
					isConversationPanelCollapsed={layout.isConversationPanelCollapsed}
					hideMessagePanel={shouldHideMessagePanel}
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
