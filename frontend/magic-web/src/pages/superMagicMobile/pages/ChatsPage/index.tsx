import {
	canDeleteRecordingProjects,
	handleRecordingProjectDeletionError,
} from "@/services/recordSummary/projectDeletionRecordingNotice"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState } from "react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import {
	SuperMobileShellRouteLayout,
	useOptionalSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"
import { MobileOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import SuperMagicService from "@/pages/superMagic/services"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { ChatConversationListItem } from "./hooks/useChatConversationList"
import { useChatConversationList } from "./hooks/useChatConversationList"
import { ChatConversationListView } from "./components/ChatConversationListView"
import {
	MOBILE_CHAT_DETAIL_ACTION_KEYS,
	MOBILE_CHAT_PIN_ENABLED,
} from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"

/**
 * 路由页只负责装配 Shell 能力与对话列表状态，后续接真实导航时不需要改动展示层。
 */
const ChatsPagePanel = observer(function ChatsPagePanel() {
	const { t } = useTranslation(["super", "common", "sidebar"])
	const location = useLocation()
	const navigate = useNavigate()
	const {
		items,
		isInitialChatListLoading,
		searchValue,
		setSearchValue,
		isEmpty,
		isSearchEmpty,
		hasMore,
		reload,
		loadMore,
		optimisticRemove,
		optimisticUpdatePin,
	} = useChatConversationList()
	// Route state is a one-shot bridge from detail deletion back to this list.
	const lastHandledDeletedProjectIdRef = useRef("")

	useEffect(() => {
		const routeState = location.state as Record<string, unknown> | null
		const pendingDeletedProjectId =
			typeof routeState?.pendingDeletedProjectId === "string"
				? routeState.pendingDeletedProjectId
				: undefined
		if (!pendingDeletedProjectId) return
		if (pendingDeletedProjectId === lastHandledDeletedProjectIdRef.current) return

		lastHandledDeletedProjectIdRef.current = pendingDeletedProjectId
		optimisticRemove(pendingDeletedProjectId)
		void reload({ silent: true })

		const nextState = { ...routeState }
		delete nextState.pendingDeletedProjectId
		// Consume the one-shot route message so history restores do not replay deletion handling.
		navigate({
			name: RouteName.SuperChatsList,
			replace: true,
			state: Object.keys(nextState).length ? nextState : undefined,
			viewTransition: false,
		})
	}, [location.state, navigate, optimisticRemove, reload])

	/** Execute the destructive operation only after the shared confirmation popup accepts it. */
	const handleDeleteConversation = useMemoizedFn(async (project: ProjectListItem) => {
		if (!canDeleteRecordingProjects([project.id])) return
		try {
			optimisticRemove(project.id)
			await SuperMagicService.deleteProject(project, {
				selectedProjectBehavior: "navigate-home",
			})
			await reload({ silent: true })
		} catch (error) {
			if (handleRecordingProjectDeletionError(error)) return
			await reload({ silent: true })
			magicToast.error(t("super:chat.deleteChatDescription"))
		}
	})

	/**
	 * 与对话详情页使用完全相同的参数调用 useProjectListActions，确保操作项（label/行为）严格一致。
	 * - visibleActionKeys 与详情页 MOBILE_CHAT_DETAIL_ACTION_KEYS 对齐，不展示「移动」「协作者」等列表页不相关的操作
	 * - chatActionContext:"detail" 控制"另存为项目"按钮可见
	 * - deleteSelectedProjectBehavior:"navigate-home" 删除后回到首页，而非切到下一个项目
	 */
	const {
		projectActions,
		projectActionComponents: chatProjectActionComponents,
		updateCurrentActionItem,
		openProjectDeleteConfirm,
	} = useProjectListActions({
		mode: "chat",
		chatActionContext: "detail",
		deleteSelectedProjectBehavior: "navigate-home",
		visibleActionKeys: MOBILE_CHAT_DETAIL_ACTION_KEYS,
		onProjectChanged: () => reload({ silent: true }),
		onDeleteProjectConfirmed: handleDeleteConversation,
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
			...(MOBILE_CHAT_PIN_ENABLED
				? [
						{
							actions: [
								{
									key: "pin-chat",
									label:
										projectActionMap.get("pinProject")?.label ||
										t("super:chat.pinChat"),
									onClick: () => {
										closeMorePopup()
										projectActionMap.get("pinProject")?.onClick?.()
									},
								},
							],
						},
					]
				: []),
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
	})

	/**
	 * Open the shared home composer in chat mode.
	 * The homepage defaults to task when homeMode is absent, so this entry must
	 * pass homeMode=chat or the conversation tab would not be selected.
	 * Project and topic creation still happens on the first send.
	 */
	const handleCreateChat = useMemoizedFn(() => {
		navigate({
			name: RouteName.MobileHome,
			query: { homeMode: "chat" },
		})
	})

	/**
	 * 左滑置顶/取消置顶：成功后先做一次本地乐观重排，再由列表自己的 reload 对齐服务端顺序。
	 * 这里避免调用 pinProjectAndRefresh，防止同时触发 participated 列表刷新和 chat queries 刷新。
	 */
	const handlePinConversation = useMemoizedFn(async (item: ChatConversationListItem) => {
		try {
			await SuperMagicService.project.pinProject(item.project, !item.isPinned)
			// 仅在操作成功后短暂重排本地列表；下一次 reload 仍完全以服务端顺序为准。
			optimisticUpdatePin(item.id, !item.isPinned)
			await reload({ silent: true })
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
				isInitialChatListLoading={isInitialChatListLoading}
				searchValue={searchValue}
				isEmpty={isEmpty}
				isSearchEmpty={isSearchEmpty}
				hasMore={hasMore}
				onSearchValueChange={setSearchValue}
				onCreateChat={handleCreateChat}
				onOpenConversation={handleOpenConversation}
				onMore={handleMoreConversation}
				onPin={MOBILE_CHAT_PIN_ENABLED ? handlePinConversation : undefined}
				onDelete={(item) => openProjectDeleteConfirm(item.project)}
				onRefresh={reload}
				loadMore={loadMore}
				title={t("super:chatList.title")}
				searchPlaceholder={t("super:chatList.searchPlaceholder")}
				clearSearchAriaLabel={t("super:common.cancel")}
				newChatAriaLabel={t("super:chatList.newChat")}
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
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const { t } = useTranslation("super")

	if (shellOutlet) {
		return (
			<MobileOnlyRoute>
				<ChatsPagePanel />
			</MobileOnlyRoute>
		)
	}

	return (
		<MobileOnlyRoute>
			<SuperMobileShellRouteLayout
				activeView="chats"
				testIdPrefix="mobile-chats-page"
				closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			>
				<ChatsPagePanel />
			</SuperMobileShellRouteLayout>
		</MobileOnlyRoute>
	)
}

export default ChatsPage
