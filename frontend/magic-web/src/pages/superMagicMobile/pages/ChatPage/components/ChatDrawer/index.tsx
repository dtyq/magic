import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Sheet, SheetContent, SheetHeader } from "@/components/shadcn-ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import { useTranslation } from "react-i18next"
import type { ChatDrawerProps } from "./types"
import { MOCK_CHATS } from "./constants"
import SwipeableChatItem from "./SwipeableChatItem"
import WorkspaceItemMobile from "./WorkspaceItemMobile"
import DrawerFooter from "./DrawerFooter"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import { useMemoizedFn } from "ahooks"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import RenameModal from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ActionModals/RenameModal"
import type {
	Workspace,
	ProjectListItem,
	Topic,
} from "@/pages/superMagic/pages/Workspace/types"
import { openModal } from "@/utils/react"
import DeleteDangerModal from "@/components/business/DeleteDangerModal"
import SuperMagicService from "@/pages/superMagic/services"
import magicToast from "@/components/base/MagicToaster/utils"
import type { ActionButtonConfig } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { Button } from "@/components/shadcn-ui/button"
import { useSharedWorkspace } from "@/pages/superMagic/hooks/useSharedWorkspace"
import projectStore from "@/pages/superMagic/stores/core/project"

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

const ChatDrawer = observer(({ open, onClose, hierarchicalWorkspacePopupRef }: ChatDrawerProps) => {
	const { t } = useTranslation("super")

	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace

	const { projectActionComponents, openActionsPopup } = useProjectListActions()
	const { getSharedWorkspaceData } = useSharedWorkspace()

	const [activeTab, setActiveTab] = useState(ChatDrawerTab.Workspaces)
	const [activeItemId, setActiveItemId] = useState<string | null>(null)
	const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
	/** 全局唯一左滑展开的项目 ID，统一在此层管理以支持跨组件互斥收起 */
	const [swipedProjectId, setSwipedProjectId] = useState<string | null>(null)

	/**
	 * 记录"touchStart 触发时是否存在左滑项"。
	 *
	 * 问题根源：handleProjectDragStart 在 touchStart 时就调用 setSwipedProjectId(null)，
	 * 导致 click 事件到达时 swipedProjectId 已经是 null，onClickCapture 拦截条件失效。
	 * 通过 ref 在 touchStart 时同步保存快照，使 click 阶段仍能感知到"曾有左滑项"。
	 */
	const hadSwipeOnTouchStartRef = useRef(false)

	// 抽屉关闭时重置所有左滑状态
	useEffect(() => {
		if (!open) {
			setSwipedProjectId(null)
			hadSwipeOnTouchStartRef.current = false
		}
	}, [open])

	/**
	 * 由 WorkspaceItemMobile 在某个项目 touchStart 时同步调用（在 setSwipedProjectId 之前）。
	 * 此时 swipedProjectId 闭包值仍为旧的非 null 值，可以正确设置快照。
	 */
	const handleGlobalProjectDragStart = useMemoizedFn(() => {
		hadSwipeOnTouchStartRef.current = swipedProjectId !== null
	})

	/**
	 * 捕获阶段拦截点击事件：检查 swipedProjectId 状态或 hadSwipeOnTouchStartRef 快照，
	 * 首次点击仅收起操作按钮并消费该点击，不执行任何子元素的 onClick。
	 */
	const handleContentClickCapture = useMemoizedFn((e: React.MouseEvent) => {
		const hadSwipe = swipedProjectId !== null || hadSwipeOnTouchStartRef.current
		hadSwipeOnTouchStartRef.current = false
		if (hadSwipe) {
			// 操作按钮本身的点击不拦截，允许正常执行
			const target = e.target as HTMLElement
			if (target.closest("[data-swipe-actions]")) return
			setSwipedProjectId(null)
			e.stopPropagation()
		}
	})
	const [workspaceActionsPopupVisible, setWorkspaceActionsPopupVisible] = useState(false)
	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [currentActionItem, setCurrentActionItem] = useState<ActionItem | null>(null)
	const [projectDeleteModalVisible, setProjectDeleteModalVisible] = useState(false)

	const closeActionsPopup = useMemoizedFn(() => {
		setWorkspaceActionsPopupVisible(false)
	})

	const closeWorkspaceActionsPopup = useMemoizedFn(() => {
		setWorkspaceActionsPopupVisible(false)
	})

	function handleSwipeStart(id: string) {
		setActiveItemId(id)
	}

	const handleChatActions = useMemoizedFn((id: string) => {
		console.log("More:", id)
	})

	const handleChatPin = useMemoizedFn((id: string) => {
		console.log("Pin:", id)
	})

	const handleChatDelete = useMemoizedFn((id: string) => {
		console.log("Delete:", id)
	})

	const handleNewChat = useMemoizedFn(() => {
		console.log("New Chat clicked")
		// TODO: 实现新建对话逻辑
	})

	const handleSharedWorkspace = useMemoizedFn(() => {
		// 获取共享工作区数据
		const sharedWorkspace = getSharedWorkspaceData()

		// 关闭当前抽屉
		onClose()

		// 打开 HierarchicalWorkspacePopup 并导航到共享工作区（隐藏返回按钮）
		if (hierarchicalWorkspacePopupRef?.current?.showAndNavigateToWorkspace) {
			hierarchicalWorkspacePopupRef.current.showAndNavigateToWorkspace(sharedWorkspace, {
				hideBackButton: true,
			})
		}
	})

	const handleNewWorkspace = useMemoizedFn(() => {
		// 打开创建工作区弹窗
		if (hierarchicalWorkspacePopupRef?.current?.openCreateWorkspaceModal) {
			hierarchicalWorkspacePopupRef.current.openCreateWorkspaceModal()
		}
	})

	const handleNewProject = useMemoizedFn(async (workspace: Workspace) => {
		try {
			onClose()

			await SuperMagicService.createProjectAndActivateInMobile(workspace.id)

			projectStore.loadProjectsForWorkspace(workspace.id, true, true)

			magicToast.success(t("hierarchicalWorkspacePopup.createProjectSuccess"))
		} catch (error) {
			magicToast.error(t("hierarchicalWorkspacePopup.createProjectFailed"))
		}
	})

	const handleRenameInputChange = useMemoizedFn((val: string) => {
		if (currentActionItem?.type === "workspace") {
			setCurrentActionItem((pre) => {
				if (!pre || pre.type !== "workspace" || !pre.workspace) return pre
				return {
					...pre,
					workspace: {
						...pre.workspace,
						name: val,
					},
				} as typeof pre
			})
		}
	})

	// 处理工作区重命名
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

	// 处理工作区删除
	const handleDeleteWorkspaceConfirm = useMemoizedFn((workspace?: Workspace) => {
		if (!workspace) return
		openModal(DeleteDangerModal, {
			content: workspace.name || t("workspace.unnamedWorkspace"),
			needConfirm: true,
			onSubmit: async () => {
				await SuperMagicService.deleteWorkspace(workspace.id)
			},
		})
	})

	// 处理项目删除
	const handleProjectDelete = useMemoizedFn((project?: ProjectListItem) => {
		if (!project) return
		setCurrentActionItem({ type: "project", project })
		setProjectDeleteModalVisible(true)
	})

	// 处理项目删除
	const handleDeleteProjectConfirm = useMemoizedFn(async () => {
		const project = currentActionItem?.project
		if (!project) return
		await SuperMagicService.deleteProject(project)
		magicToast.success(t("hierarchicalWorkspacePopup.deleteProjectSuccess"))
		setProjectDeleteModalVisible(false)
	})

	// 处理工作区展开/折叠
	const handleWorkspaceToggle = useMemoizedFn((workspaceId: string) => {
		setExpandedWorkspaceId((prev) => (prev === workspaceId ? null : workspaceId))
	})

	// 处理工作区操作
	const handleWorkspaceActions = useMemoizedFn((workspace: Workspace) => {
		setCurrentActionItem({ type: "workspace", workspace })
		setWorkspaceActionsPopupVisible(true)
	})

	// 处理项目操作
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
					closeActionsPopup()
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
					className="z-drawer w-80 gap-0 p-0 pt-safe-top"
					showClose={false}
					overlayClassName="z-drawer backdrop-blur-sm"
				>
					<SheetHeader className="shrink-0 px-3 pb-2">
						<Tabs
							value={activeTab}
							onValueChange={(value) => setActiveTab(value as ChatDrawerTab)}
							className="w-full"
						>
							<TabsList className="h-9 w-full cursor-pointer gap-0 bg-muted p-[3px]">
								{/* <TabsTrigger
									value={ChatDrawerTab.Chats}
									className="flex-1 text-sm font-medium"
								>
									{t("common.chats")}
								</TabsTrigger> */}
								<TabsTrigger
									value={ChatDrawerTab.Workspaces}
									className="flex-1 text-sm font-medium"
								>
									{t("workspace.workspaces")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</SheetHeader>

					{/* 主内容区域：onClickCapture 在捕获阶段拦截点击，收起左滑操作按钮 */}
					<div
						className="flex min-h-0 flex-1 flex-col overflow-y-auto"
						onClickCapture={handleContentClickCapture}
					>
						{activeTab === ChatDrawerTab.Chats &&
							MOCK_CHATS.map((item) => (
								<SwipeableChatItem
									key={item.id}
									item={item}
									isActive={activeItemId === item.id}
									onSwipeStart={handleSwipeStart}
									onMore={handleChatActions}
									onPin={handleChatPin}
									onDelete={handleChatDelete}
								/>
							))}

						{activeTab === ChatDrawerTab.Workspaces && (
							<>
								{workspaces.length > 0 ? (
									<>
										{workspaces.map((workspace) => (
											<WorkspaceItemMobile
												key={workspace.id}
												workspace={workspace}
												isActive={selectedWorkspace?.id === workspace.id}
												isExpanded={expandedWorkspaceId === workspace.id}
												swipedProjectId={swipedProjectId}
												onProjectSwipeChange={setSwipedProjectId}
												onProjectDragStart={handleGlobalProjectDragStart}
												onToggle={() => handleWorkspaceToggle(workspace.id)}
												onWorkspaceActions={handleWorkspaceActions}
												onProjectActions={handleProjectActions}
												onProjectDelete={handleProjectDelete}
												onNewProject={handleNewProject}
												onDrawerClose={onClose}
											/>
										))}
									</>
								) : (
									<div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
										{t("workspace.noWorkspaces")}
									</div>
								)}
							</>
						)}
					</div>

					{/* 底部按钮区域 */}
					<div className="shrink-0 p-3 pb-safe-bottom">
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

			<ActionDrawer
				open={projectDeleteModalVisible}
				onOpenChange={(open) => setProjectDeleteModalVisible(open)}
				title={t("hierarchicalWorkspacePopup.deleteProject")}
				showCancel={false}
			>
				<div className="text-sm text-foreground">
					{t("ui.deleteProjectConfirm", {
						name:
							currentActionItem?.project?.project_name || t("project.unnamedProject"),
					})}
				</div>
				<div className="flex gap-1.5 pt-1">
					<Button
						variant="outline"
						className="h-9 shrink-0 rounded-lg px-8"
						onClick={() => setProjectDeleteModalVisible(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						variant="destructive"
						className="h-9 flex-1 rounded-lg"
						onClick={handleDeleteProjectConfirm}
					>
						{t("common.confirm")}
					</Button>
				</div>
			</ActionDrawer>

			{projectActionComponents}
		</>
	)
})

export default ChatDrawer
