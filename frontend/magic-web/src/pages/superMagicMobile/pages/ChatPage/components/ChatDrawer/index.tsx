import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Sheet, SheetContent, SheetHeader } from "@/components/shadcn-ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { Button } from "@/components/shadcn-ui/button"
import DeleteDangerModal from "@/components/business/DeleteDangerModal"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import projectStore from "@/pages/superMagic/stores/core/project"
import { roleStore } from "@/pages/superMagic/stores"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { Workspace, ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useSharedWorkspace } from "@/pages/superMagic/hooks/useSharedWorkspace"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import type { ActionButtonConfig } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import RenameModal from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ActionModals/RenameModal"
import type { ChatDrawerProps } from "./types"
import SwipeableChatItem from "./SwipeableChatItem"
import WorkspaceItemMobile from "./WorkspaceItemMobile"
import DrawerFooter from "./DrawerFooter"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { X, Check } from "lucide-react"

enum ChatDrawerTab {
	Chats = "chats",
	Workspaces = "workspaces",
}

interface ActionItem {
	type: "workspace" | "topic" | "project"
	workspace?: Workspace
	topic?: Topic
	project?: ProjectListItem
}

function ChatDrawer({
	open,
	onClose,
	hierarchicalWorkspacePopupRef,
	chatWorkspace,
	chatProjects,
	isLoadingChatWorkspace = false,
	isLoadingChatProjects = false,
	refreshChatProjects,
	createProjectInChatWorkspace,
}: ChatDrawerProps) {
	const { t } = useTranslation("super")

	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const currentRole = roleStore.currentRole

	const { getSharedWorkspaceData } = useSharedWorkspace()

	const [activeTab, setActiveTab] = useState(ChatDrawerTab.Chats)
	const [swipedChatId, setSwipedChatId] = useState<string | null>(null)
	const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
	const [swipedProjectId, setSwipedProjectId] = useState<string | null>(null)
	const [workspaceActionsPopupVisible, setWorkspaceActionsPopupVisible] = useState(false)
	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [currentActionItem, setCurrentActionItem] = useState<ActionItem | null>(null)
	const [projectDeleteModalVisible, setProjectDeleteModalVisible] = useState(false)
	const [workspaceDeleteModalVisible, setWorkspaceDeleteModalVisible] = useState(false)
	const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false)

	const hadSwipeOnTouchStartRef = useRef(false)

	const chatItems = chatProjects.map((project) => ({
		id: project.id,
		title: project.project_name || t("chat.unnamedChat"),
		subtitle: project.updated_at || project.created_at,
		isPinned: project.is_pinned,
	}))

	const isChatProjectsLoading = isLoadingChatProjects || isLoadingChatWorkspace

	useEffect(() => {
		if (!open) {
			setSwipedChatId(null)
			setSwipedProjectId(null)
			hadSwipeOnTouchStartRef.current = false
		}
	}, [open])

	const ensureWorkspacesLoaded = useMemoizedFn(async () => {
		if (workspaceStore.workspaces.length > 0) return workspaceStore.workspaces

		setIsLoadingWorkspaces(true)
		try {
			return await SuperMagicService.workspace.fetchWorkspaces(
				{
					isAutoSelect: false,
					isSelectLast: false,
					page: 1,
				},
				{ enableErrorMessagePrompt: false },
			)
		} finally {
			setIsLoadingWorkspaces(false)
		}
	})

	const {
		projectActionComponents: chatProjectActionComponents,
		openActionsPopup: openChatActionsPopup,
	} = useProjectListActions({
		mode: "chat",
		onProjectChanged: refreshChatProjects,
	})

	const { projectActionComponents, openActionsPopup } = useProjectListActions()

	useEffect(() => {
		if (!open || activeTab !== ChatDrawerTab.Workspaces) return
		if (workspaceStore.workspaces.length > 0) return

		void ensureWorkspacesLoaded()
	}, [open, activeTab, ensureWorkspacesLoaded])

	const handleGlobalSwipeDragStart = useMemoizedFn(() => {
		hadSwipeOnTouchStartRef.current = swipedProjectId !== null || swipedChatId !== null
	})

	const handleContentClickCapture = useMemoizedFn((e: React.MouseEvent) => {
		const hadSwipe =
			swipedChatId !== null || swipedProjectId !== null || hadSwipeOnTouchStartRef.current
		hadSwipeOnTouchStartRef.current = false
		if (!hadSwipe) return

		const target = e.target as HTMLElement
		if (target.closest("[data-swipe-actions]")) return

		setSwipedChatId(null)
		setSwipedProjectId(null)
		e.stopPropagation()
	})

	const closeActionsPopup = useMemoizedFn(() => {
		setWorkspaceActionsPopupVisible(false)
	})

	const closeWorkspaceActionsPopup = useMemoizedFn(() => {
		setWorkspaceActionsPopupVisible(false)
	})

	function handleChatSwipe(id: string, isSwiped: boolean) {
		setSwipedChatId(isSwiped ? id : null)
	}

	function handleChatDragStart(id: string) {
		handleGlobalSwipeDragStart()

		if (swipedProjectId !== null) {
			setSwipedProjectId(null)
		}

		if (swipedChatId !== null && swipedChatId !== id) {
			setSwipedChatId(null)
		}
	}

	const handleOpenChat = useMemoizedFn(async (id: string) => {
		const project = chatProjects.find((item) => item.id === id)
		if (!project) return

		onClose()
		if (chatWorkspace) workspaceStore.setSelectedWorkspace(chatWorkspace)

		await SuperMagicService.switchChatProject(project)
	})

	const handleChatActions = useMemoizedFn((id: string) => {
		const project = chatProjects.find((item) => item.id === id)
		if (!project) return

		openChatActionsPopup(project)
	})

	const handleChatPin = useMemoizedFn(async (id: string) => {
		const project = chatProjects.find((item) => item.id === id)
		if (!project || !chatWorkspace?.id) return

		const isPin = !project.is_pinned

		try {
			await SuperMagicService.project.pinProject(project, isPin)
			await refreshChatProjects()
			magicToast.success(isPin ? t("chat.pinChatSuccess") : t("chat.unpinChatSuccess"))
		} catch {
			magicToast.error(isPin ? t("chat.pinChatFailed") : t("chat.unpinChatFailed"))
		}
	})

	const handleChatDelete = useMemoizedFn((id: string) => {
		const project = chatProjects.find((item) => item.id === id)
		if (!project) return

		setCurrentActionItem({ type: "project", project })
		setSwipedChatId(null)
		setProjectDeleteModalVisible(true)
	})

	const handleNewChat = useMemoizedFn(async () => {
		try {
			const createdProject = await createProjectInChatWorkspace({
				projectMode: currentRole || TopicMode.General,
			})

			if (!createdProject?.project || !createdProject.topic) {
				magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
				return
			}

			if (chatWorkspace?.id) {
				workspaceStore.setSelectedWorkspace(chatWorkspace)
				void refreshChatProjects()
			}

			onClose()
			await SuperMagicService.switchChatProject(createdProject.project, createdProject.topic)
		} catch {
			magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
		}
	})

	const handleSharedWorkspace = useMemoizedFn(() => {
		const sharedWorkspace = getSharedWorkspaceData()
		onClose()

		if (hierarchicalWorkspacePopupRef?.current?.showAndNavigateToWorkspace) {
			hierarchicalWorkspacePopupRef.current.showAndNavigateToWorkspace(sharedWorkspace, {
				hideBackButton: true,
			})
		}
	})

	const handleNewWorkspace = useMemoizedFn(() => {
		if (hierarchicalWorkspacePopupRef?.current?.openCreateWorkspaceModal) {
			hierarchicalWorkspacePopupRef.current.openCreateWorkspaceModal()
		}
	})

	const handleNewProject = useMemoizedFn(async (workspace: Workspace) => {
		try {
			onClose()
			await SuperMagicService.createProjectAndActivateInMobile(workspace.id)
			void projectStore.loadProjectsForWorkspace(workspace.id, true, true)
			magicToast.success(t("hierarchicalWorkspacePopup.createProjectSuccess"))
		} catch {
			magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
		}
	})

	const handleRenameInputChange = useMemoizedFn((val: string) => {
		if (currentActionItem?.type !== "workspace" || !currentActionItem.workspace) return

		setCurrentActionItem((prev) => {
			if (!prev || prev.type !== "workspace" || !prev.workspace) return prev

			return {
				...prev,
				workspace: {
					...prev.workspace,
					name: val,
				},
			}
		})
	})

	const handleRenameWorkspace = useMemoizedFn(async () => {
		if (!currentActionItem?.workspace?.id) return

		const workspace = currentActionItem.workspace

		try {
			await SuperMagicService.workspace.renameWorkspaceWithRefresh(
				workspace.id,
				workspace.name,
			)
			magicToast.success(t("hierarchicalWorkspacePopup.renameSuccess"))
			setRenameModalVisible(false)
		} catch (error) {
			if (error instanceof Error && error.message === "workspaceNameRequired") {
				magicToast.error(t("hierarchicalWorkspacePopup.workspaceNameRequired"))
			}
		}
	})

	const handleDeleteWorkspaceConfirm = useMemoizedFn((workspace?: Workspace) => {
		if (!workspace) return

		closeActionsPopup()
		setWorkspaceDeleteModalVisible(true)
	})

	const handleDeleteWorkspaceSubmit = useMemoizedFn(async () => {
		const workspace = currentActionItem?.workspace
		if (!workspace) return

		await SuperMagicService.deleteWorkspace(workspace.id)
	})

	const handleProjectDelete = useMemoizedFn((project?: ProjectListItem) => {
		if (!project) return

		setCurrentActionItem({ type: "project", project })
		setProjectDeleteModalVisible(true)
	})

	const handleDeleteProjectConfirm = useMemoizedFn(async () => {
		const project = currentActionItem?.project
		if (!project) return

		await SuperMagicService.deleteProject(project)
		await refreshChatProjects()
		magicToast.success(t("chat.deleteChatSuccess"))
		setProjectDeleteModalVisible(false)
	})

	const handleWorkspaceToggle = useMemoizedFn((workspaceId: string) => {
		setExpandedWorkspaceId((prev) => (prev === workspaceId ? null : workspaceId))
	})

	const handleWorkspaceActions = useMemoizedFn((workspace: Workspace) => {
		setCurrentActionItem({ type: "workspace", workspace })
		setWorkspaceActionsPopupVisible(true)
	})

	const handleProjectActions = useMemoizedFn((project: ProjectListItem) => {
		openActionsPopup(project)
	})

	const workspaceActionButtonList: ActionButtonConfig[] = useMemo(
		() => [
			{
				key: "rename",
				label: t("hierarchicalWorkspacePopup.rename"),
				onClick: () => {
					setRenameModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
			},
			{
				key: "delete",
				label: t("hierarchicalWorkspacePopup.deleteWorkspace"),
				onClick: () => {
					handleDeleteWorkspaceConfirm(currentActionItem?.workspace)
				},
				variant: "danger",
			},
		],
		[currentActionItem, t, closeActionsPopup, handleDeleteWorkspaceConfirm],
	)

	return (
		<>
			<Sheet open={open} onOpenChange={onClose}>
				<SheetContent
					side="right"
					className="z-drawer w-80 gap-0 px-0 !pb-safe-bottom pt-safe-top"
					showClose={false}
					overlayClassName="z-drawer backdrop-blur-sm"
					data-testid="chat-drawer-content"
				>
					<SheetHeader className="shrink-0 px-3 pb-2">
						<Tabs
							value={activeTab}
							onValueChange={(value) => setActiveTab(value as ChatDrawerTab)}
							className="w-full"
							data-testid="chat-drawer-tabs"
						>
							<TabsList className="h-9 w-full cursor-pointer gap-0 bg-muted p-[3px]">
								<TabsTrigger
									value={ChatDrawerTab.Chats}
									className="flex-1 text-sm font-medium"
									data-testid="chat-drawer-chats-tab"
								>
									{t("common.chats")}
								</TabsTrigger>
								<TabsTrigger
									value={ChatDrawerTab.Workspaces}
									className="flex-1 text-sm font-medium"
									data-testid="chat-drawer-workspaces-tab"
								>
									{t("workspace.workspaces")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</SheetHeader>

					<div
						className="flex min-h-0 flex-1 flex-col overflow-y-auto"
						onClickCapture={handleContentClickCapture}
					>
						{activeTab === ChatDrawerTab.Chats && (
							<div
								className="flex w-full flex-col"
								data-testid="chat-drawer-chats-list"
							>
								{isChatProjectsLoading ? (
									<div
										className="flex items-center justify-center py-20 text-sm text-muted-foreground"
										data-testid="chat-drawer-chats-loading"
									>
										{t("common.loading")}
									</div>
								) : chatItems.length > 0 ? (
									chatItems.map((item) => (
										<SwipeableChatItem
											key={item.id}
											item={item}
											isSwiped={swipedChatId === item.id}
											onSwipeChange={(isSwiped) =>
												handleChatSwipe(item.id, isSwiped)
											}
											onSwipeStart={handleChatDragStart}
											onClick={handleOpenChat}
											onMore={handleChatActions}
											onPin={handleChatPin}
											onDelete={handleChatDelete}
										/>
									))
								) : (
									<div
										className="flex items-center justify-center py-20 text-sm text-muted-foreground"
										data-testid="chat-drawer-chats-empty"
									>
										{t("chat.noChats")}
									</div>
								)}
							</div>
						)}

						{activeTab === ChatDrawerTab.Workspaces && (
							<div data-testid="chat-drawer-workspaces-list">
								{isLoadingWorkspaces ? (
									<div
										className="flex items-center justify-center py-20 text-sm text-muted-foreground"
										data-testid="chat-drawer-workspaces-loading"
									>
										{t("common.loading")}
									</div>
								) : workspaces.length > 0 ? (
									workspaces.map((workspace) => (
										<WorkspaceItemMobile
											key={workspace.id}
											workspace={workspace}
											isActive={selectedWorkspace?.id === workspace.id}
											isExpanded={expandedWorkspaceId === workspace.id}
											swipedProjectId={swipedProjectId}
											onProjectSwipeChange={setSwipedProjectId}
											onProjectDragStart={handleGlobalSwipeDragStart}
											onToggle={() => handleWorkspaceToggle(workspace.id)}
											onWorkspaceActions={handleWorkspaceActions}
											onProjectActions={handleProjectActions}
											onProjectDelete={handleProjectDelete}
											onNewProject={handleNewProject}
											onDrawerClose={onClose}
										/>
									))
								) : (
									<div
										className="flex items-center justify-center py-20 text-sm text-muted-foreground"
										data-testid="chat-drawer-workspaces-empty"
									>
										{t("workspace.noWorkspaces")}
									</div>
								)}
							</div>
						)}
					</div>

					{/* 底部按钮区域 */}
					<div className="shrink-0 p-3">
						<DrawerFooter
							activeTab={activeTab}
							onNewChat={handleNewChat}
							onSharedWorkspace={handleSharedWorkspace}
							onNewWorkspace={handleNewWorkspace}
						/>
					</div>
				</SheetContent>
			</Sheet>

			<ActionsPopupComponent
				visible={workspaceActionsPopupVisible}
				title={currentActionItem?.workspace?.name || t("workspace.unnamedWorkspace")}
				actions={workspaceActionButtonList}
				onClose={closeWorkspaceActionsPopup}
			/>

			<RenameModal
				visible={renameModalVisible}
				currentActionItem={currentActionItem}
				onCancel={() => setRenameModalVisible(false)}
				onOk={handleRenameWorkspace}
				onInputChange={handleRenameInputChange}
				translations={{
					workspaceRename: t("hierarchicalWorkspacePopup.workspaceRename"),
					projectRename: t("hierarchicalWorkspacePopup.projectRename"),
					topicRename: t("hierarchicalWorkspacePopup.topicRename"),
					inputWorkspaceName: t("hierarchicalWorkspacePopup.inputWorkspaceName"),
					inputProjectName: t("hierarchicalWorkspacePopup.inputProjectName"),
					inputTopicName: t("hierarchicalWorkspacePopup.inputTopicName"),
					newName: t("hierarchicalWorkspacePopup.newName"),
					cancel: t("common.cancel"),
					confirm: t("common.confirm"),
				}}
			/>

			<MagicPopup
				visible={projectDeleteModalVisible}
				onClose={() => setProjectDeleteModalVisible(false)}
				position="bottom"
				headerVariant="actionHeader"
				headerTitle={t("ui.deleteProjectConfirmTitle")}
				headerLeadingAction={{
					icon: <X className="size-[22px] text-foreground" />,
					ariaLabel: t("common.cancel"),
					onClick: () => setProjectDeleteModalVisible(false),
				}}
				headerTrailingAction={{
					icon: <Check className="size-[22px] text-white" />,
					ariaLabel: t("common.confirm"),
					onClick: handleDeleteProjectConfirm,
					tone: "destructive",
				}}
				bodyClassName="max-h-[80dvh] p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
					<p className="mx-auto max-w-[680px] text-left text-[16px] leading-6 text-muted-foreground">
						{t("ui.deleteProjectDescription", {
							name: currentActionItem?.project?.project_name || t("chat.unnamedChat"),
						})}
					</p>
				</div>
			</MagicPopup>

			{workspaceDeleteModalVisible && currentActionItem?.workspace && (
				<DeleteDangerModal
					content={currentActionItem.workspace.name || t("workspace.unnamedWorkspace")}
					needConfirm={true}
					onClose={() => setWorkspaceDeleteModalVisible(false)}
					onSubmit={handleDeleteWorkspaceSubmit}
				/>
			)}

			{chatProjectActionComponents}
			{projectActionComponents}
		</>
	)
}

export default observer(ChatDrawer)
