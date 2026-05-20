import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useSuperMobileShellOutlet } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import { routesMatch } from "@/routes/history/helpers"
import { baseHistory } from "@/routes/history"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import { roleStore } from "@/pages/superMagic/stores"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { useChatWorkspace } from "@/pages/superMagic/hooks/useChatWorkspace"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { ChatConversationListItem } from "./hooks/useChatConversationList"
import { useChatConversationList } from "./hooks/useChatConversationList"
import { ChatConversationListView } from "./components/ChatConversationListView"

/**
 * 路由页只负责装配 Shell 能力与对话列表状态，后续接真实导航时不需要改动展示层。
 */
const ChatsPagePanel = observer(function ChatsPagePanel() {
	const { t } = useTranslation(["super", "common", "sidebar"])
	const { openSidebar } = useSuperMobileShellOutlet()
	const navigate = useNavigate()
	const { createProjectInChatWorkspace } = useChatWorkspace()
	const {
		items,
		isLoading,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		isEmpty,
		isSearchEmpty,
		hasMore,
		reload,
		loadMore,
		optimisticRemove,
	} = useChatConversationList()
	const currentRole = roleStore.currentRole

	/**
	 * 业务页兜底：当公共路由服务在重挂载空窗期未完成跳转时，
	 * 仅在 ChatsPage 内补一次目标会话路由，避免出现“请求成功但页面不跳”。
	 */
	const ensureNavigateToChatProject = useMemoizedFn((projectId: string, topicId?: string) => {
		const matchedRoute = routesMatch(baseHistory.location.pathname)
		const currentProjectId = matchedRoute?.params?.projectId
		const currentTopicId = matchedRoute?.params?.topicId

		if (
			matchedRoute?.route.name === RouteName.SuperChatProjectState &&
			currentProjectId === projectId &&
			currentTopicId === topicId
		) {
			return
		}

		navigate({
			name: RouteName.SuperChatProjectState,
			params: { projectId, topicId },
			viewTransition: false,
		})
	})

	/**
	 * 与对话详情页使用完全相同的参数调用 useProjectListActions，确保操作项（label/行为）严格一致。
	 * - visibleActionKeys 仅暴露详情页有的 4 项，不展示「移动」「协作者」等列表页不相关的操作
	 * - chatActionContext:"detail" 控制"另存为项目"按钮可见
	 * - deleteSelectedProjectBehavior:"navigate-home" 删除后回到首页，而非切到下一个项目
	 */
	const {
		projectActions,
		projectActionComponents: chatProjectActionComponents,
		updateCurrentActionItem,
	} = useProjectListActions({
		mode: "chat",
		chatActionContext: "detail",
		deleteSelectedProjectBehavior: "navigate-home",
		visibleActionKeys: ["pinProject", "rename", "saveAsProject", "delete"],
		onProjectChanged: reload,
	})

	/** 当前待操作的对话（点击更多时设置，面板关闭时清空） */
	const [currentMoreProject, setCurrentMoreProject] = useState<ProjectListItem | null>(null)
	const [morePopupVisible, { setTrue: openMorePopup, setFalse: closeMorePopup }] =
		useBoolean(false)

	/**
	 * 从 projectActions 按 key 建立映射，与 useChatConversationActions 保持相同的构建方式。
	 */
	const projectActionMap = useMemo(
		() => new Map(projectActions.map((action) => [action.key, action])),
		[projectActions],
	)

	/**
	 * 构建与对话详情页完全一致的操作分组（去掉"查看文件"和"分享话题"，因为列表页没有文件/话题上下文）。
	 * 顺序和分组严格对齐 useChatConversationActions.conversationActionGroups。
	 */
	const conversationActionGroups = useMemo<ActionGroup[]>(
		() => [
			{
				actions: [
					{
						key: "pin-chat",
						label: projectActionMap.get("pinProject")?.label || t("super:chat.pinChat"),
						onClick: () => {
							closeMorePopup()
							projectActionMap.get("pinProject")?.onClick?.()
						},
					},
				],
			},
			{
				actions: [
					{
						key: "rename-chat",
						label: projectActionMap.get("rename")?.label || t("super:chat.renameChat"),
						onClick: () => {
							closeMorePopup()
							projectActionMap.get("rename")?.onClick?.()
						},
					},
					{
						key: "save-as-project",
						label:
							projectActionMap.get("saveAsProject")?.label ||
							t("super:chat.saveAsProject"),
						onClick: () => {
							closeMorePopup()
							projectActionMap.get("saveAsProject")?.onClick?.()
						},
					},
				],
			},
			{
				actions: [
					{
						key: "delete-chat",
						label: projectActionMap.get("delete")?.label || t("super:chat.deleteChat"),
						onClick: () => {
							closeMorePopup()
							projectActionMap.get("delete")?.onClick?.()
						},
						variant: "danger" as const,
					},
				],
			},
		],
		[closeMorePopup, projectActionMap, t],
	)

	/** 更多面板标题：优先用对话名称，回退到通用文案 */
	const morePopupTitle = useMemo(
		() => currentMoreProject?.project_name?.trim() || t("super:chat.unnamedChat"),
		[currentMoreProject, t],
	)

	/**
	 * 对话列表项直接复用既有 chat 切换链路，保证一级列表与抽屉进入项目的行为一致。
	 */
	const handleOpenConversation = useMemoizedFn(async (item: ChatConversationListItem) => {
		await SuperMagicService.switchChatProject(item.project)
		ensureNavigateToChatProject(item.project.id, item.project.current_topic_id || undefined)
	})

	/**
	 * 新建对话统一走 chat workspace 创建链路，避免列表页和抽屉页出现两套创建口径。
	 */
	const handleCreateChat = useMemoizedFn(async () => {
		try {
			const createdProject = await createProjectInChatWorkspace({
				projectMode: currentRole || TopicMode.General,
			})

			if (!createdProject?.project || !createdProject.topic) {
				magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
				return
			}

			await reload()
			await SuperMagicService.switchChatProject(createdProject.project, createdProject.topic)
			ensureNavigateToChatProject(createdProject.project.id, createdProject.topic.id)
		} catch {
			magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
		}
	})

	/**
	 * 左滑删除：先乐观移除（即时 UI 反馈），再并行调用删除服务并在后台静默刷新列表。
	 * 这样规避了 projectService.deleteProject 非阻塞 API + reload 竞态导致的"删了没更新"问题。
	 * 若服务端删除失败，reload 会恢复列表并还原乐观删除。
	 */
	const handleDeleteConversation = useMemoizedFn(async (item: ChatConversationListItem) => {
		try {
			// 立即从列表移除，给用户即时视觉反馈
			optimisticRemove(item.id)
			await SuperMagicService.deleteProject(item.project, {
				selectedProjectBehavior: "navigate-home",
			})
			// 后台静默同步，不 await 避免阻塞 UI
			void reload()
		} catch {
			// 删除失败时 reload 会清空 pendingRemoveIds，自动恢复被乐观移除的行
			await reload()
			magicToast.error(t("super:chat.deleteChatDescription"))
		}
	})

	/**
	 * 左滑置顶/取消置顶：调用 pin 链路（pinProjectAndRefresh 内部已处理乐观更新与刷新）。
	 * 刷新后通过 reload 同步本地列表状态。
	 */
	const handlePinConversation = useMemoizedFn(async (item: ChatConversationListItem) => {
		try {
			await SuperMagicService.project.pinProjectAndRefresh(
				item.project,
				!item.isPinned,
				item.project.workspace_id,
			)
			await reload()
		} catch {
			magicToast.error(
				item.isPinned ? t("super:chat.unpinChatFailed") : t("super:chat.pinChatFailed"),
			)
		}
	})

	/**
	 * 左滑更多：与对话详情页的"更多"操作项严格对齐（置顶、重命名、另存为项目、删除）。
	 * 先同步当前项目上下文到 useProjectListActions，再打开操作面板。
	 */
	const handleMoreConversation = useMemoizedFn((item: ChatConversationListItem) => {
		setCurrentMoreProject(item.project)
		updateCurrentActionItem(item.project)
		openMorePopup()
	})

	return (
		<>
			<ChatConversationListView
				items={items}
				isLoading={isLoading}
				searchValue={searchValue}
				debouncedSearchValue={debouncedSearchValue}
				isEmpty={isEmpty}
				isSearchEmpty={isSearchEmpty}
				hasMore={hasMore}
				onSearchValueChange={setSearchValue}
				onOpenSidebar={openSidebar}
				onCreateChat={handleCreateChat}
				onOpenConversation={handleOpenConversation}
				onMore={handleMoreConversation}
				onPin={handlePinConversation}
				onDelete={handleDeleteConversation}
				onRefresh={reload}
				loadMore={loadMore}
				title={t("super:chatList.title")}
				searchPlaceholder={t("super:chatList.searchPlaceholder")}
				clearSearchAriaLabel={t("super:common.cancel")}
				emptyTitle={t("super:chatList.emptyTitle")}
				emptyDescription={t("super:chatList.emptyDescription")}
				newChatAriaLabel={t("super:chatList.newChat")}
				menuAriaLabel={t("sidebar:appsMenu.more")}
			/>
			{/* 更多操作面板：操作项与对话详情页完全一致（置顶、重命名、另存为项目、删除） */}
			<ConversationActionsPopup
				visible={morePopupVisible}
				title={morePopupTitle}
				subtitle={t("super:chatList.title")}
				actionGroups={conversationActionGroups}
				onClose={closeMorePopup}
			/>
			{/* 各操作的二级弹层（重命名输入框、另存为确认等），由 useProjectListActions 管理 */}
			{chatProjectActionComponents}
		</>
	)
})

function ChatsPage() {
	return (
		<MobileOnlyRoute>
			<ChatsPagePanel />
		</MobileOnlyRoute>
	)
}

export default ChatsPage
