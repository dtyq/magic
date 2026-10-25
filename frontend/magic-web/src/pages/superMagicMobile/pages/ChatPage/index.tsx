import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	SuperMobileShellRouteLayout,
	useOptionalSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"
import ChatPageHeader from "./components/ChatPageHeader"
import SloganSection from "./components/SloganSection"
import { useMemoizedFn } from "ahooks"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import MobileInputContainer from "./components/MobileInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MainInputContainer/components/editors/constant"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { userStore } from "@/models/user"
import useAgentCodeModeFromSearch from "@/pages/superMagic/hooks/useAgentCodeModeFromSearch"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import { refreshFeaturedModeList } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import ProjectTopicService from "@/services/superMagic/ProjectTopicService"
import {
	getFallbackTopicModeIdentifier,
	resolveDefaultAgentSelection,
} from "@/services/superMagic/DefaultAgentSelectionService"
import { useLocation } from "react-router"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { routesPathMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { shouldClearResolvedAgentCodeFromUrl } from "./agentCodeRoutePolicy"
import { resolveHomepageDisplayTopicMode } from "./homepageModeState"

import { useChatHomeContext } from "@/pages/superMagic/pages/ChatHomePage/useChatHomeContext"
import {
	MessageEditorStore,
	MessageEditorStoreProvider,
} from "@/pages/superMagic/components/MessageEditor/stores"
import {
	createSceneStateStore,
	SceneStateProvider,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTaskHomeContext } from "./hooks/useTaskHomeContext"
import MobileHomeModeControls, { type MobileHomeMode } from "./components/MobileHomeModeControls"
import TaskWorkspaceSheet from "./components/TaskWorkspaceSheet"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { UploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"

/**
 * 首页面板继续复用既有欢迎区与输入区逻辑，但顶部菜单入口改由共享 MobileShell 注入。
 */
const ChatPagePanel = observer(function ChatPagePanel() {
	const location = useLocation()
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const openSidebar = shellOutlet?.openSidebar ?? (() => undefined)
	const { t } = useTranslation("super/mainInput")
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false)
	const query = new URLSearchParams(location.search)
	// Tasks are the default homepage entry; explicit chat links keep their existing destination.
	const homeMode: MobileHomeMode = query.get("homeMode") === "chat" ? "chat" : "task"
	const isChat = homeMode === "chat"
	const [homepageModeOverride, setHomepageModeOverride] = useState<TopicMode | null>(null)
	const wasHomepageEmptyRef = useRef(false)
	// Track the account context used for the last homepage mode refresh so an organization switch
	// cannot reuse the previous organization's runtime fallback while the homepage stays empty.
	const homepageRefreshContextRef = useRef<string | null>(null)
	// Ignore older refresh results so a slower request cannot overwrite a newer homepage selection.
	const homepageRefreshRequestIdRef = useRef(0)
	const activeTab = new URLSearchParams(location.search).get("tab") ?? MobileTabParam.Super
	const isMobileHomeRoute = routesPathMatch(RouteName.MobileHome, location.pathname)
	// MobileTabs（/mobile-tabs?tab=super）和 MobileHome（/mobile-home）都应视为首页，
	// 以便 useAgentCodeModeFromSearch 在两条入口路径下均能读取 agentCode 并选中对应数字员工。
	const isOnHomepage =
		(routesPathMatch(RouteName.MobileTabs, location.pathname) &&
			activeTab === MobileTabParam.Super) ||
		isMobileHomeRoute
	const organizationCode = userStore.user.organizationCode
	const userId = userStore.user.userInfo?.user_id
	const homepageContextKey = `${organizationCode ?? ""}:${userId ?? ""}`
	const chatContext = useChatHomeContext()
	const taskHome = useTaskHomeContext(homepageContextKey, query.get("workspaceId"), !isChat)
	const selectedTopic = taskHome.context.selectedTopic ?? null
	const selectedProject = taskHome.context.selectedProject ?? null
	const isHomepageEmpty = isOnHomepage && !selectedProject && !selectedTopic
	const currentRole = roleStore.currentRole
	// Retain each mode's store while rendering only one editor, including uploaded attachments.
	const [modeStores] = useState(() => ({
		chat: {
			editor: new MessageEditorStore({ uploadTokenService: new UploadTokenService() }),
			scene: createSceneStateStore(),
			ready: false,
		},
		task: {
			editor: new MessageEditorStore({ uploadTokenService: new UploadTokenService() }),
			scene: createSceneStateStore(),
			ready: false,
		},
	}))
	const activeStores = modeStores[homeMode]
	// Upload callbacks belong to the mounted editor; finish uploads before switching its mode.
	const controlsBusy = busy || !activeStores.editor.fileUploadStore.isAllFilesUploaded
	useEffect(
		() => () => {
			modeStores.chat.editor.dispose()
			modeStores.task.editor.dispose()
		},
		[modeStores],
	)

	const {
		topicMode,
		setTopicMode: setTopicModeFromHook,
		recoverTopicMode: recoverTopicModeFromHook,
	} = useTopicMode({
		selectedTopic: selectedTopic ?? null,
		selectedProject: selectedProject ?? null,
	})
	const displayTopicMode = resolveHomepageDisplayTopicMode({
		topicMode,
		homepageModeOverride,
		selectedProject: selectedProject ?? null,
		selectedTopic: selectedTopic ?? null,
	})

	useEffect(() => {
		// 一旦进入具体项目/话题，后续模式应完全由真实上下文驱动，避免首页 override 泄漏到对话页。
		if (!selectedProject && !selectedTopic) return
		setHomepageModeOverride(null)
	}, [selectedProject, selectedTopic])

	/**
	 * 与 ProjectPageInputContainer 内 SceneEditorContext 一致：useTopicMode 的 setTopicMode；
	 * 额外同步 roleStore，供首页与其它依赖全局角色的逻辑使用。
	 */
	const setTopicMode = useMemoizedFn((mode: TopicMode) => {
		// 首页空态没有真实 topic/project 承载模式，所以额外保留一个本地 override
		// 来抵御初始化期间的 store 清空回写。
		if (!selectedProject && !selectedTopic) {
			setHomepageModeOverride(mode)
		}
		setTopicModeFromHook(mode)
		roleStore.setCurrentRole(mode)
	})

	const recoverTopicMode = useMemoizedFn((mode: TopicMode) => {
		if (!selectedProject && !selectedTopic) {
			setHomepageModeOverride(mode)
		}
		recoverTopicModeFromHook(mode)
		roleStore.applyResolvedRole(mode)
	})

	const refreshHomepageModeList = useMemoizedFn(async () => {
		const requestId = ++homepageRefreshRequestIdRef.current
		const requestContextKey = homepageContextKey
		const nextModeList = await refreshFeaturedModeList().catch(() => null)
		const currentContextKey = `${userStore.user.organizationCode ?? ""}:${userStore.user.userInfo?.user_id ?? ""}`
		if (
			requestId !== homepageRefreshRequestIdRef.current ||
			currentContextKey !== requestContextKey
		) {
			return
		}
		if (!nextModeList?.length) return

		// 运行时 roleStore 可能被话题恢复流程临时修改；首页应以用户持久化选择为准。
		const savedHomepageMode = ProjectTopicService.getRawGlobalTopicMode()
		const defaultMode = getFallbackTopicModeIdentifier()
		// Skip hidden employees so the homepage never falls back to an unavailable mode.
		const firstAvailableMode = nextModeList.find((item) => item.agent?.is_visible !== false)
			?.mode?.identifier as TopicMode | undefined
		const resolvedHomepageMode =
			savedHomepageMode && superMagicModeService.isModeValid(savedHomepageMode)
				? savedHomepageMode
				: superMagicModeService.isModeValid(defaultMode)
					? defaultMode
					: firstAvailableMode
		if (!resolvedHomepageMode || resolvedHomepageMode === displayTopicMode) return

		recoverTopicMode(resolvedHomepageMode)
	})

	useEffect(() => {
		const wasHomepageEmpty = wasHomepageEmptyRef.current
		const previousRefreshContext = homepageRefreshContextRef.current
		const hasContextChanged = previousRefreshContext !== homepageContextKey
		// When agentCode is present, we must refresh even if already on homepage.
		// Without this, wasHomepageEmpty=true short-circuits the refresh, leaving fetchPromise=null.
		// useAgentCodeModeFromSearch then sees no pending fetch and prematurely clears the URL
		// before the modeList can include the newly-pinned employee.
		const hasAgentCode = new URLSearchParams(location.search).has("agentCode")

		wasHomepageEmptyRef.current = isHomepageEmpty
		homepageRefreshContextRef.current = homepageContextKey
		if (!isHomepageEmpty || (wasHomepageEmpty && !hasAgentCode && !hasContextChanged)) return

		void refreshHomepageModeList()
	}, [homepageContextKey, isHomepageEmpty, location.search, refreshHomepageModeList])

	useAgentCodeModeFromSearch({
		// /mobile-home 需要把 agentCode 留在 URL 里，刷新后才能再次还原首页选中的数字员工。
		clearAgentCodeFromUrl: shouldClearResolvedAgentCodeFromUrl(
			isMobileHomeRoute ? RouteName.MobileHome : RouteName.MobileTabs,
		),
		currentMode: displayTopicMode,
		enabled: isOnHomepage && !isChat,
		onModeResolved: setTopicMode,
	})

	const defaultAgent = resolveDefaultAgentSelection()
	const baseContext = isChat ? chatContext : taskHome.context
	const editorContext: SceneEditorContext = {
		selectedTopic: null,
		selectedProject: null,
		...baseContext,
		topicMode: isChat ? defaultAgent.topicPattern : displayTopicMode,
		agentCode: isChat ? defaultAgent.agentCode : selectedTopic?.agent_code,
		modelTopicMode: isChat ? (defaultAgent.modeIdentifier as TopicMode) : displayTopicMode,
		setTopicMode: isChat ? undefined : setTopicMode,
		recoverTopicMode: isChat ? undefined : recoverTopicMode,
		topicExamplesMode: isChat ? defaultAgent.topicPattern : currentRole,
		layoutConfig: MOBILE_LAYOUT_CONFIG,
		isChatPageHomepage: isOnHomepage,
		showModeToggle: !isChat,
		showModelSelector: isChat,
		placeholder: isChat ? t("mobileHome.chatPlaceholder") : undefined,
		autoFocus: false,
		skipInitialDraftRestore: activeStores.ready,
		onReady: () => {
			activeStores.ready = true
		},
		onSendStart: () => setBusy(true),
		onSendComplete: ({ success, currentProject, currentTopic }) => {
			setBusy(false)
			if (!success || !baseContext.topicStore) return
			applyOptimisticTopicRunningState({
				topicStore: baseContext.topicStore,
				topic: currentTopic,
				project: currentProject,
				workspace: baseContext.selectedWorkspace,
			})
		},
	}
	const changeHomeMode = (next: MobileHomeMode) => {
		if (controlsBusy || next === homeMode) return
		query.set("homeMode", next)
		navigate({
			name: isMobileHomeRoute ? RouteName.MobileHome : RouteName.MobileTabs,
			query: Object.fromEntries(query),
			replace: true,
			viewTransition: false,
		})
	}

	return (
		<>
			<div className="relative flex size-full flex-col overflow-hidden bg-mobile-background">
				<ChatPageHeader onMenuClick={openSidebar} />

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{/* Flow layout: bottom inset is owned by GlobalSafeArea, not absolute bottom-0. */}
					{/* Short screens and the soft keyboard may scroll the hero without moving the input. */}
					<ScrollArea
						className="min-h-0 flex-1"
						viewportClassName="[&>div]:!flex [&>div]:min-h-full [&>div]:flex-col"
					>
						<div className="flex flex-1 flex-col items-center justify-center px-4 py-4">
							<SloganSection isChat={isChat} />
							<MobileHomeModeControls
								mode={homeMode}
								onModeChange={changeHomeMode}
								workspace={taskHome.workspace}
								loading={taskHome.loading}
								error={taskHome.error}
								busy={controlsBusy}
								onChooseWorkspace={() => setWorkspaceSheetOpen(true)}
							/>
						</div>
					</ScrollArea>
					<div className="shrink-0 bg-mobile-background">
						<MessageEditorStoreProvider store={activeStores.editor}>
							<SceneStateProvider store={activeStores.scene}>
								<MobileInputContainer
									key={homeMode}
									editorContext={editorContext}
								/>
							</SceneStateProvider>
						</MessageEditorStoreProvider>
					</div>
				</div>
			</div>

			<TaskWorkspaceSheet
				open={workspaceSheetOpen}
				onClose={() => setWorkspaceSheetOpen(false)}
				selectedId={taskHome.workspace?.id}
				onSelect={(workspace) => {
					taskHome.selectWorkspace(workspace)
					// Replace an entry destination so refresh restores the user's new explicit choice.
					query.set("workspaceId", workspace.id)
					navigate({
						name: isMobileHomeRoute ? RouteName.MobileHome : RouteName.MobileTabs,
						query: Object.fromEntries(query),
						replace: true,
						viewTransition: false,
					})
				}}
			/>
		</>
	)
})

/** Mobile-home route entry: desktop viewport redirects to /super. */
const MobileHomePage = observer(function MobileHomePage() {
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const { t } = useTranslation("super")

	if (shellOutlet) {
		return (
			<MobileOnlyRoute>
				<ChatPagePanel
					key={`${userStore.user.organizationCode}:${userStore.user.userInfo?.user_id}`}
				/>
			</MobileOnlyRoute>
		)
	}

	return (
		<MobileOnlyRoute>
			<SuperMobileShellRouteLayout
				activeView=""
				testIdPrefix="mobile-chat-home-page"
				closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			>
				<ChatPagePanel
					key={`${userStore.user.organizationCode}:${userStore.user.userInfo?.user_id}`}
				/>
			</SuperMobileShellRouteLayout>
		</MobileOnlyRoute>
	)
})

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<MobileHomePage />
		</FileAccessProvider>
	)
}
