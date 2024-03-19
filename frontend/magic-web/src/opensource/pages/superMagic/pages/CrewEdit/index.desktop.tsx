import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useLocation, useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import useResizablePanel from "@/opensource/pages/superMagic/hooks/useResizablePanel"
import { convertSearchParams } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"
import { crewService } from "@/opensource/services/crew/CrewService"
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
	CREW_SKILLS_TAB,
	type CrewEditStep,
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
const CREW_EDIT_ROUTE_PANELS = new Set<CrewEditStep>(Object.values(CREW_EDIT_STEP))

interface CrewEditPanelRouteStore {
	activeDetailKey: StepDetailKey
	setActiveStep: (step: CrewEditStep | null) => void
	openSkillsPanel: (tab?: CrewSkillsTab) => void
	openPlaybook: () => void
	openBuiltinSkills: () => void
}

function getPanelFromSearch(search: string): StepDetailKey {
	const panel = new URLSearchParams(search).get(CREW_EDIT_PANEL_QUERY_KEY)
	if (!panel) return null
	if (!CREW_EDIT_ROUTE_PANELS.has(panel as CrewEditStep)) return null
	return panel as CrewEditStep
}

function buildCrewEditQuery({ search, panel }: { search: string; panel: StepDetailKey }) {
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
	panel: StepDetailKey
	store: CrewEditPanelRouteStore
}) {
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

	useCrewEditErrorToasts({
		initError: store.initError,
		identity,
		playbook,
	})
	useCrewEditInitialization({ store, crewId })
	useRefreshCrewDetailOnTopicMessage({ store })

	const routePanel = useMemo(() => getPanelFromSearch(location.search), [location.search])

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
		applyRoutePanelToStore({ panel: routePanel, store: layout })
	}, [layout, routePanel])

	useEffect(() => {
		if (routePanel === layout.activeDetailKey) return
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: buildCrewEditQuery({
				search: location.search,
				panel: layout.activeDetailKey,
			}),
			replace: true,
			viewTransition: false,
		})
	}, [crewId, layout.activeDetailKey, location.search, navigate, routePanel])

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
		<div className="flex h-full w-full overflow-hidden" data-testid="crew-edit-page">
			<CrewEditPanels
				sidebarWidthPx={sidebarWidthPx}
				detailPanelWidthPx={detailPanelWidthPx}
				messagePanelWidthPx={MESSAGE_PANEL_WIDTH_PX}
				showDetailPanel={layout.showDetailPanel}
				isConversationPanelCollapsed={layout.isConversationPanelCollapsed}
				hideMessagePanel={layout.isMessagePanelHidden}
				onSidebarResizeStart={onSidebarResizeStart}
				onDetailResizeStart={onDetailResizeStart}
				isDraggingSidebar={isDraggingSidebar}
				isDraggingDetail={isDraggingDetail}
				sidebar={<ConfigStepsPanel onBack={handleBack} />}
				detailPanel={<StepDetailPanel />}
				messagePanel={
					<CrewTopicPanel
						selectedProject={conversation.selectedProject}
						topicStore={conversation.topicStore}
						isConversationPanelCollapsed={
							layout.showDetailPanel ? layout.isConversationPanelCollapsed : false
						}
						onToggleConversationPanel={() => layout.toggleConversationPanel()}
						onExpandConversationPanel={() => layout.expandConversationPanel()}
						detailPanelVisible={layout.showDetailPanel}
						crewId={crewId}
					/>
				}
			/>
		</div>
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
