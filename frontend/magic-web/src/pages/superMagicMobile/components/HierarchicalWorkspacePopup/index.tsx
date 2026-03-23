import MagicIcon from "@/components/base/MagicIcon"
import { CollaborationProjectType } from "@/pages/superMagic/pages/Workspace/types"
import { IconChevronLeft } from "@tabler/icons-react"
import type { Ref } from "react"
import { forwardRef, useCallback, useState } from "react"
import ActionsPopupComponent from "../ActionsPopup"
import { Flex } from "antd"
import { useHierarchicalWorkspacePopup } from "./hooks"
import { HierarchicalWorkspacePopupProps, HierarchicalWorkspacePopupRef } from "./types"
import { useTheme } from "antd-style"
import CreateWorkspaceModal from "@/pages/superMagic/components/CreateWorkspaceModal"
import { isCollaborationWorkspace, SHARE_WORKSPACE_DATA } from "@/pages/superMagic/constants"
import { userStore } from "@/models/user"
import { observer } from "mobx-react-lite"
import MagicTabs from "@/components/base-mobile/MagicTabs"
import { cn } from "@/lib/utils"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { WorkspaceListItem, ProjectListItem, BottomActionBar } from "./components"
import RenameModal from "./components/ActionModals/RenameModal"
import DeleteModal from "./components/ActionModals/DeleteModal"
import { Box, Folder } from "lucide-react"

function HierarchicalWorkspacePopup(
	props: HierarchicalWorkspacePopupProps,
	ref: Ref<HierarchicalWorkspacePopupRef>,
) {
	const { safeAreaInsetBottom } = useTheme()
	const { userInfo } = userStore.user

	const {
		// 状态
		visible,
		navState,
		currentActionItem,
		workspaces,
		projects,
		actionsPopupVisible,
		renameModalVisible,
		deleteModalVisible,
		selectedWorkspace,
		selectedProject,

		// 配置
		actionButtonList,
		getTitle,

		// 事件处理
		handleWorkspaceSelect,
		handleWorkspaceClick,
		handleProjectClick,
		handleBackClick,
		handleWorkspaceActionClick,
		handleProjectActionClick,
		handleDeleteConfirm,
		handleRename,
		onAddWorkspaceClick,
		onAddProjectClick,
		closePopup,
		closeActionsPopup,

		// 模态框状态控制
		setRenameModalVisible,
		setDeleteModalVisible,
		updateCurrentActionItem,

		// 创建工作区弹窗
		createWorkspaceModalOpen,
		setCreateWorkspaceModalOpen,

		// 协作工作区tab
		collaborationTabKey,
		setCollaborationTabKey,
		CollaboratorUpdatePanel,

		// 翻译
		t,

		// 添加工作区快捷方式
		AddCollaborationToWorkspacePopup,
	} = useHierarchicalWorkspacePopup(props, ref)

	const handleCreateWorkspaceBtnClick = useCallback(() => {
		closePopup()
		setCreateWorkspaceModalOpen(true)
	}, [closePopup, setCreateWorkspaceModalOpen])

	const handleRenameInputChange = useCallback(
		(val: string) => {
			if (currentActionItem?.type === "workspace") {
				updateCurrentActionItem((pre) => {
					if (!pre || pre.type !== "workspace" || !pre.workspace) return pre
					return {
						...pre,
						workspace: {
							...pre.workspace,
							name: val,
						},
					} as typeof pre
				})
			} else if (currentActionItem?.type === "project") {
				updateCurrentActionItem((pre) => {
					if (!pre || pre.type !== "project" || !pre.project) return pre
					return {
						...pre,
						project: {
							...pre.project,
							project_name: val,
						},
					} as typeof pre
				})
			} else if (currentActionItem?.type === "topic") {
				updateCurrentActionItem((pre) => {
					if (!pre || pre.type !== "topic" || !pre.topic) return pre
					return {
						...pre,
						topic: {
							...pre.topic,
							topic_name: val,
						},
					} as typeof pre
				})
			}
		},
		[currentActionItem?.type, updateCurrentActionItem],
	)

	return (
		<>
			<MagicPopup
				visible={visible}
				onClose={closePopup}
				position="bottom"
				bodyStyle={{ height: `calc(90vh - ${safeAreaInsetBottom})` }}
				bodyClassName="bg-background overflow-hidden rounded-t-2xl [--adm-color-background:theme(colors.background)] flex flex-col"
			>
				<div className="sticky top-0 z-10 flex h-11 items-center justify-between border-border bg-background px-4 py-2.5">
					<div className="flex flex-1 items-center">
						{(navState.level === "topic" || navState.level === "project") &&
							!navState.hideBackButton && (
								<MagicIcon
									size={24}
									component={IconChevronLeft}
									onClick={handleBackClick}
									className="mr-2.5"
									stroke={2}
								/>
							)}
						<div className="m-0 text-base font-semibold leading-[22px] text-foreground">
							{getTitle}
						</div>
					</div>
				</div>

				<Flex className="flex min-h-0 flex-1 flex-col">
					<div className="relative flex min-h-0 flex-1 flex-shrink flex-col overflow-hidden">
						{isCollaborationWorkspace(navState.currentWorkspace) && (
							<MagicTabs
								activeKey={collaborationTabKey}
								onChange={(key) =>
									setCollaborationTabKey(key as CollaborationProjectType)
								}
							>
								<MagicTabs.Tab
									title={t("hierarchicalWorkspacePopup.fromOther")}
									key={CollaborationProjectType.Received}
								/>
								<MagicTabs.Tab
									title={t("hierarchicalWorkspacePopup.toOther")}
									key={CollaborationProjectType.Shared}
								/>
							</MagicTabs>
						)}
						<div
							className={cn(
								"flex-1 overflow-y-auto scroll-smooth pb-10 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb:hover]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1",
								"[&>div:first-child]:mt-1",
								"[&>div:last-child]:mb-3",
							)}
						>
							{navState.level === "workspace" && workspaces.length === 0 && (
								<div className="flex h-full items-center justify-center text-muted-foreground">
									{t("hierarchicalWorkspacePopup.noWorkspaceData")}
								</div>
							)}
							{navState.level === "project" && projects?.length === 0 && (
								<div className="flex h-full items-center justify-center text-muted-foreground">
									{t("hierarchicalWorkspacePopup.noProjectData")}
								</div>
							)}
							{navState.level === "workspace" &&
								workspaces.length > 0 &&
								workspaces.map((workspace) => (
									<WorkspaceListItem
										key={workspace.id}
										workspace={workspace}
										isSelected={selectedWorkspace?.id === workspace.id}
										onSelect={handleWorkspaceClick}
										onActionClick={handleWorkspaceActionClick}
										onNavigate={handleWorkspaceClick}
										emptyText={t("workspace.unnamedWorkspace")}
									/>
								))}
							{navState.level === "project" &&
								(projects?.length || 0) > 0 &&
								projects?.map((project) => (
									<ProjectListItem
										key={project.id}
										project={project}
										workspace={navState.currentWorkspace || null}
										userInfo={userInfo}
										isSelected={selectedProject?.id === project.id}
										onSelect={handleProjectClick}
										onActionClick={handleProjectActionClick}
										emptyText={t("project.unnamedProject")}
									/>
								))}
						</div>
					</div>

					{navState.level === "workspace" && (
						<BottomActionBar
							level="workspace"
							primaryText={t("hierarchicalWorkspacePopup.addWorkspace")}
							primaryIcon={<Box size={16} />}
							secondaryText={t("hierarchicalWorkspacePopup.shareWorkspace")}
							onPrimaryClick={handleCreateWorkspaceBtnClick}
							onSecondaryClick={() =>
								handleWorkspaceClick({
									...SHARE_WORKSPACE_DATA(t),
								})
							}
						/>
					)}
					{navState.level === "project" &&
						navState.currentWorkspace &&
						!isCollaborationWorkspace(navState.currentWorkspace) && (
							<BottomActionBar
								level="project"
								primaryText={t("hierarchicalWorkspacePopup.addProject")}
								primaryIcon={<Folder size={16} />}
								// secondaryText={t("hierarchicalWorkspacePopup.allWorkspaces")}
								onPrimaryClick={onAddProjectClick}
								// onSecondaryClick={handleBackClick}
							/>
						)}
				</Flex>
			</MagicPopup>

			{CollaboratorUpdatePanel}

			{AddCollaborationToWorkspacePopup}

			<ActionsPopupComponent
				visible={actionsPopupVisible}
				title={
					currentActionItem?.type === "workspace"
						? currentActionItem.workspace?.name || t("workspace.unnamedWorkspace")
						: currentActionItem?.type === "project"
							? currentActionItem.project?.project_name || t("project.unnamedProject")
							: currentActionItem?.topic?.topic_name || t("topic.unnamedTopic")
				}
				actions={actionButtonList}
				onClose={closeActionsPopup}
			/>

			<RenameModal
				visible={renameModalVisible}
				currentActionItem={currentActionItem}
				onCancel={() => setRenameModalVisible(false)}
				onOk={handleRename}
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

			<DeleteModal
				visible={deleteModalVisible}
				currentActionItem={currentActionItem}
				onCancel={() => setDeleteModalVisible(false)}
				onOk={handleDeleteConfirm}
				translations={{
					deleteWorkspace: t("hierarchicalWorkspacePopup.deleteWorkspace"),
					deleteProject: t("hierarchicalWorkspacePopup.deleteProject"),
					deleteTopic: t("hierarchicalWorkspacePopup.deleteTopic"),
					deleteWorkspaceConfirm: (name: string) =>
						t("ui.deleteWorkspaceConfirm", { name }),
					deleteProjectConfirm: (name: string) => t("ui.deleteProjectConfirm", { name }),
					deleteTopicConfirm: (name: string) => t("ui.deleteTopicConfirm", { name }),
					unnamedWorkspace: t("workspace.unnamedWorkspace"),
					unnamedProject: t("project.unnamedProject"),
					unnamedTopic: t("topic.unnamedTopic"),
					cancel: t("common.cancel"),
					confirm: t("common.confirm"),
				}}
			/>

			<CreateWorkspaceModal
				open={createWorkspaceModalOpen}
				onOpenChange={setCreateWorkspaceModalOpen}
				onCreate={onAddWorkspaceClick}
			/>
		</>
	)
}

export default observer(forwardRef(HierarchicalWorkspacePopup))
export type { HierarchicalWorkspacePopupRef }
