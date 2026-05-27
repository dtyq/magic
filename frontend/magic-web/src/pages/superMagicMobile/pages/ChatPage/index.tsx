import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useSuperMobileShellOutlet } from "@/pages/superMagicMobile/components/MobileShell"
import ChatPageHeader from "./components/ChatPageHeader"
import SloganSection from "./components/SloganSection"
import type { HierarchicalWorkspacePopupRef } from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/types"
import { useMemoizedFn, useMount } from "ahooks"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import MobileInputContainer, {
	type MobileInputContainerRef,
} from "./components/MobileInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MainInputContainer/components/editors/constant"
import { INPUT_CONTAINER_MIN_HEIGHT } from "@/pages/superMagic/components/MainInputContainer/constants"
import { topicStore, projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { superMagicStore } from "@/pages/superMagic/stores"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { userStore } from "@/models/user"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { useChatWorkspace } from "@/pages/superMagic/hooks/useChatWorkspace"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import useAgentCodeModeFromSearch from "@/pages/superMagic/hooks/useAgentCodeModeFromSearch"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import { refreshFeaturedModeList } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { useLocation } from "react-router"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { routesPathMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { interfaceStore } from "@/stores/interface"
import { shouldClearResolvedAgentCodeFromUrl } from "./agentCodeRoutePolicy"
import { resolveHomepageDisplayTopicMode } from "./homepageModeState"

const HierarchicalWorkspacePopup = lazy(
	() => import("@/pages/superMagicMobile/components/HierarchicalWorkspacePopup"),
)

/**
 * 首页面板继续复用既有欢迎区与输入区逻辑，但顶部菜单入口改由共享 MobileShell 注入。
 */
const ChatPagePanel = observer(function ChatPagePanel() {
	const { t } = useTranslation(["super", "sidebar"])
	const location = useLocation()
	const { openSidebar } = useSuperMobileShellOutlet()
	const [stopEventLoading, setStopEventLoading] = useState(false)
	const [isCreatingEmptyChat, setIsCreatingEmptyChat] = useState(false)
	const [isHierarchicalWorkspacePopupInitialized, setIsHierarchicalWorkspacePopupInitialized] =
		useState(false)
	const [homepageModeOverride, setHomepageModeOverride] = useState<TopicMode | null>(null)
	const hierarchicalWorkspacePopupRef = useRef<HierarchicalWorkspacePopupRef>(null)
	const mobileInputContainerRef = useRef<MobileInputContainerRef>(null)
	const wasOnHomepageRef = useRef(false)
	const activeTab = new URLSearchParams(location.search).get("tab") ?? MobileTabParam.Super
	const isMobileHomeRoute = routesPathMatch(RouteName.MobileHome, location.pathname)
	// MobileTabs（/mobile-tabs?tab=super）和 MobileHome（/mobile-home）都应视为首页，
	// 以便 useAgentCodeModeFromSearch 在两条入口路径下均能读取 agentCode 并选中对应数字员工。
	const isOnHomepage =
		(routesPathMatch(RouteName.MobileTabs, location.pathname) &&
			activeTab === MobileTabParam.Super) ||
		isMobileHomeRoute
	// 记录挂载状态，避免创建完成后跳转离开页面时再回写本页 loading 状态。
	const isMountedRef = useRef(true)
	// 额外使用 ref 做同步门闩，避免按钮状态尚未刷新时发生连点重复创建。
	const isCreatingEmptyChatRef = useRef(false)
	const { chatWorkspace, createProjectInChatWorkspace } = useChatWorkspace({
		projectPageSize: 100,
	})

	const currentRole = roleStore.currentRole

	const initializeHierarchicalWorkspacePopup = useMemoizedFn(() => {
		setIsHierarchicalWorkspacePopupInitialized((initialized) => initialized || true)
	})

	useEffect(() => {
		return () => {
			isMountedRef.current = false
		}
	}, [])

	/**
	 * 首页右上入口只负责“创建并进入空白对话”，沿用抽屉页同一条创建后切换链路。
	 */
	const handleCreateEmptyChat = useMemoizedFn(async () => {
		if (isCreatingEmptyChatRef.current) return

		isCreatingEmptyChatRef.current = true
		setIsCreatingEmptyChat(true)

		try {
			const createdProject = await createProjectInChatWorkspace({
				projectMode: currentRole || TopicMode.General,
			})

			if (!createdProject?.project || !createdProject.topic) {
				magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
				return
			}

			// 这里显式传入 project + topic，确保进入动态 ChatProjectState 的空白对话页。
			await SuperMagicService.switchChatProject(createdProject.project, createdProject.topic)
		} catch {
			magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
		} finally {
			isCreatingEmptyChatRef.current = false
			if (isMountedRef.current) {
				setIsCreatingEmptyChat(false)
			}
		}
	})

	useMount(() => {
		const initialize = () => {
			initializeHierarchicalWorkspacePopup()
		}

		if ("requestIdleCallback" in window) {
			requestIdleCallback(() => {
				initialize()
			})
			return
		}

		setTimeout(initialize, 0)
	})

	// editor state
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject

	const { topicMode, setTopicMode: setTopicModeFromHook } = useTopicMode({
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

	const refreshHomepageModeList = useMemoizedFn(async () => {
		const nextModeList = await refreshFeaturedModeList().catch(() => null)
		if (!nextModeList?.length) return

		const currentAgentCode = selectedTopic?.agent_code ?? null
		if (superMagicModeService.isModeValid(displayTopicMode, currentAgentCode)) return

		const fallbackMode = nextModeList[0]?.mode?.identifier as TopicMode | undefined
		if (!fallbackMode || fallbackMode === displayTopicMode) return

		setTopicMode(fallbackMode)
	})

	useEffect(() => {
		const wasOnHomepage = wasOnHomepageRef.current
		// When agentCode is present, we must refresh even if already on homepage.
		// Without this, wasOnHomepage=true short-circuits the refresh, leaving fetchPromise=null.
		// useAgentCodeModeFromSearch then sees no pending fetch and prematurely clears the URL
		// before the modeList can include the newly-pinned employee.
		const hasAgentCode = new URLSearchParams(location.search).has("agentCode")

		wasOnHomepageRef.current = isOnHomepage
		if (!isOnHomepage || (wasOnHomepage && !hasAgentCode)) return

		void refreshHomepageModeList()
	}, [activeTab, isOnHomepage, location.pathname, location.search, refreshHomepageModeList])

	useAgentCodeModeFromSearch({
		// /mobile-home 需要把 agentCode 留在 URL 里，刷新后才能再次还原首页选中的数字员工。
		clearAgentCodeFromUrl: shouldClearResolvedAgentCodeFromUrl(
			isMobileHomeRoute ? RouteName.MobileHome : RouteName.MobileTabs,
		),
		currentMode: displayTopicMode,
		enabled: isOnHomepage,
		onModeResolved: setTopicMode,
	})

	const chatTopicId = selectedTopic?.chat_topic_id
	const threadMessageCount =
		chatTopicId != null ? (superMagicStore.messages?.get(chatTopicId) ?? []).length : 0
	const userId = userStore.user.userInfo?.user_id
	const isTaskRunning = selectedTopic?.task_status === TaskStatus.RUNNING
	const mobileInputBottomOffset = interfaceStore.mobileTabBarVisible
		? "calc(12px + var(--mobile-tabbar-height, 60px) + 8px)"
		: "12px"
	// 欢迎区与真实输入区共享同一套底部留白来源，避免出现固定像素的视觉断层。
	const welcomeSectionBottomSpacing = `calc(${mobileInputBottomOffset} + ${INPUT_CONTAINER_MIN_HEIGHT.HomePage}px)`

	const { handleInterrupt } = useTaskInterrupt({
		selectedTopic,
		userId,
		isStopping: stopEventLoading,
		setIsStopping: setStopEventLoading,
		canInterrupt: isTaskRunning,
	})

	const editorContext = useMemo<SceneEditorContext>(
		() => ({
			selectedTopic,
			selectedProject,
			selectedWorkspace: chatWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: projectStore.setSelectedProject,
			setSelectedWorkspace: workspaceStore.setSelectedWorkspace,
			createProject: createProjectInChatWorkspace,
			topicMode: displayTopicMode,
			agentCode: selectedTopic?.agent_code,
			setTopicMode,
			topicExamplesMode: currentRole,
			messagesLength: threadMessageCount,
			layoutConfig: MOBILE_LAYOUT_CONFIG,
			showLoading: isTaskRunning,
			isTaskRunning,
			stopEventLoading,
			isChatPageHomepage: isOnHomepage,
			handleInterrupt,
			onSendComplete: ({ success, currentProject, currentTopic }) => {
				if (!success) return

				applyOptimisticTopicRunningState({
					topicStore,
					topic: currentTopic ?? topicStore.selectedTopic,
					project: currentProject ?? projectStore.selectedProject,
					workspace: chatWorkspace,
				})
			},
			onSendSuccess: ({ currentProject, currentTopic }) => {
				if (!chatWorkspace || !currentProject || !currentTopic) return
				mobileInputContainerRef.current?.closeRealInput()
				void SuperMagicService.switchChatProject(currentProject, currentTopic)
			},
			autoFocus: true,
		}),
		[
			chatWorkspace,
			createProjectInChatWorkspace,
			selectedTopic,
			selectedProject,
			displayTopicMode,
			setTopicMode,
			currentRole,
			threadMessageCount,
			isTaskRunning,
			stopEventLoading,
			isOnHomepage,
			handleInterrupt,
		],
	)

	return (
		<>
			<div className="relative flex size-full flex-col overflow-hidden bg-sidebar">
				<ChatPageHeader
					onMenuClick={openSidebar}
					onPrimaryAction={handleCreateEmptyChat}
					isPrimaryActionLoading={isCreatingEmptyChat}
				/>

				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
					{/* 中部欢迎区沿用原型的居中节奏，底部预留真实输入区高度，避免视觉重心被输入条打断。 */}
					<div
						className="flex min-h-0 flex-1 items-center justify-center px-4"
						style={{ paddingBottom: welcomeSectionBottomSpacing }}
					>
						<SloganSection />
					</div>
					{/* 底部真实输入区继续复用现有 MobileInputContainer，不额外造首页输入状态。 */}
					<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
						<div className="pointer-events-auto">
							<MobileInputContainer
								ref={mobileInputContainerRef}
								editorContext={editorContext}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* 工作区/项目选择弹窗 */}
			{isHierarchicalWorkspacePopupInitialized && (
				<Suspense fallback={null}>
					<HierarchicalWorkspacePopup ref={hierarchicalWorkspacePopupRef} />
				</Suspense>
			)}
		</>
	)
})

/** Mobile-home route entry: desktop viewport redirects to /super. */
function MobileHomePage() {
	return (
		<MobileOnlyRoute>
			<ChatPagePanel />
		</MobileOnlyRoute>
	)
}

export default MobileHomePage
