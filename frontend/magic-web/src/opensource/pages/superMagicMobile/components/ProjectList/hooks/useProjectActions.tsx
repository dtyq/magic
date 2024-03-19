import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { ActionsPopup } from "../../ActionsPopup/types"
import { useTranslation } from "react-i18next"
import { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import ActionsPopupComponent from "../../ActionsPopup"
import type { HandleRenameProjectParams } from "@/opensource/pages/superMagic/hooks/useProjects"
import ProjectMovePopup from "../components/ProjectMovePopup"
import {
	isCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/opensource/pages/superMagic/constants"
import useCollaboratorUpdatePanel from "@/opensource/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { canManageProject, isOwner } from "@/opensource/pages/superMagic/utils/permission"
import { workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { ActionDrawer } from "@/opensource/components/shadcn-composed/action-drawer"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"

export function useProjectListActions() {
	const { t } = useTranslation("super")
	const selectedWorkspace = workspaceStore.selectedWorkspace

	const [currentActionItem, updateCurrentActionItem] = useState<ProjectListItem | null>(null)

	const [actionsPopupVisible, { setTrue: _openActionsPopup, setFalse: closeActionsPopup }] =
		useBoolean(false)

	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	/** 是否打开移动项目弹窗 */
	const [moveProjectModalVisible, setMoveProjectModalVisible] = useState(false)
	/** 是否移动项目中 */
	const [isMoveProjectLoading, setIsMoveProjectLoading] = useState(false)

	const { openManageModal, CollaboratorUpdatePanel } = useCollaboratorUpdatePanel({
		selectedProject: currentActionItem,
	})

	const openActionsPopup = useMemoizedFn((project: ProjectListItem) => {
		updateCurrentActionItem(project)
		_openActionsPopup()
	})

	const handleMoveProject = useMemoizedFn(async (workspaceId: string) => {
		if (!currentActionItem?.id || isMoveProjectLoading || !selectedWorkspace?.id) return
		setIsMoveProjectLoading(true)
		try {
			await SuperMagicService.project.moveProject(
				currentActionItem.id,
				workspaceId,
				selectedWorkspace.id,
			)
			magicToast.success(t("project.moveProjectSuccess"))
		} catch (error) {
			// Error already handled in service
		} finally {
			setIsMoveProjectLoading(false)
			setMoveProjectModalVisible(false)
		}
	})

	const cancelWorkspaceShortcut = useMemoizedFn(async (project: ProjectListItem | null) => {
		if (!project || !selectedWorkspace?.id) return
		try {
			await SuperMagicService.project.cancelWorkspaceShortcut(
				project.id,
				selectedWorkspace.id,
			)
		} catch (error) {
			// Error already handled in service
		}
	})

	const handleCopyCollaborationLink = useMemoizedFn(async (project?: ProjectListItem | null) => {
		if (!project) return
		const success = await SuperMagicService.project.copyCollaborationLink(project)
		if (success) {
			magicToast.success(t("collaborators.copySuccess"))
		}
	})

	const handlePinProject = useMemoizedFn(async (project?: ProjectListItem | null) => {
		if (!project) return
		try {
			await SuperMagicService.project.pinProject(project, !project.is_pinned)

			SuperMagicService.project.fetchProjects({
				workspaceId: project.workspace_id,
				clearWhenNoProjects: false,
			})

			magicToast.success(
				project.is_pinned
					? t("hierarchicalWorkspacePopup.unpinProjectSuccess")
					: t("hierarchicalWorkspacePopup.pinProjectSuccess"),
			)

			closeActionsPopup()
		} catch (error) {
			// Error already handled in service
		}
	})

	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(currentActionItem)
	const isCollaborationProjectStatus = isCollaborationProject(currentActionItem)

	const projectActions = useMemo(() => {
		const actions = [
			{
				key: "pinProject",
				label: currentActionItem?.is_pinned
					? t("hierarchicalWorkspacePopup.unpinProject")
					: t("hierarchicalWorkspacePopup.pinProject"),
				onClick: () => {
					handlePinProject(currentActionItem)
					closeActionsPopup()
				},
				variant: "default",
				visible: true,
			},
			{
				key: "rename",
				label: t("hierarchicalWorkspacePopup.rename"),
				onClick: () => {
					setRenameModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
				visible: !isWorkspaceShortcutProjectStatus,
			},
			{
				key: "move",
				label: t("hierarchicalWorkspacePopup.moveProjectTo"),
				onClick: () => {
					setMoveProjectModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
				visible: !isWorkspaceShortcutProjectStatus,
			},
			{
				key: "copyCollaborationLink",
				label: t("hierarchicalWorkspacePopup.copyCollaborationLink"),
				onClick: () => {
					handleCopyCollaborationLink(currentActionItem)
					closeActionsPopup()
				},
				variant: "default",
				visible: isCollaborationProjectStatus || isWorkspaceShortcutProjectStatus,
			},
			{
				key: "setCollaborators",
				label: t("hierarchicalWorkspacePopup.setCollaborators"),
				onClick: () => {
					openManageModal()
					closeActionsPopup()
				},
				variant: "default",
				visible:
					(isCollaborationProjectStatus &&
						canManageProject(currentActionItem?.user_role)) ||
					isOwner(currentActionItem?.user_role),
			},
			{
				key: "cancelWorkspaceShortcut",
				label: t("project.cancelWorkspaceShortcut"),
				onClick: () => {
					cancelWorkspaceShortcut(currentActionItem)
					closeActionsPopup()
				},
				variant: "danger",
				visible: isWorkspaceShortcutProjectStatus,
			},
			{
				key: "delete",
				label: t("hierarchicalWorkspacePopup.deleteProject"),
				onClick: () => {
					setDeleteModalVisible(true)
					closeActionsPopup()
				},
				variant: "danger",
				visible: !isWorkspaceShortcutProjectStatus,
			},
		] as (ActionsPopup.ActionButtonConfig & { visible: boolean })[]
		return actions.filter((action) => action.visible)
	}, [
		currentActionItem,
		t,
		isWorkspaceShortcutProjectStatus,
		isCollaborationProjectStatus,
		handlePinProject,
		closeActionsPopup,
		handleCopyCollaborationLink,
		openManageModal,
		cancelWorkspaceShortcut,
	])

	const handleDeleteProject = useMemoizedFn(async () => {
		if (!currentActionItem?.id) return
		await SuperMagicService.deleteProject(currentActionItem)
		setDeleteModalVisible(false)
	})

	const handleRenameProject = useMemoizedFn(
		async (params: HandleRenameProjectParams): Promise<void> => {
			if (!selectedWorkspace) return
			try {
				await SuperMagicService.project.renameProject(
					params.projectId,
					params.projectName,
					selectedWorkspace.id,
				)
				magicToast.success(t("project.renameProjectSuccess"))
			} catch (error) {
				// Error already handled in service
			}
		},
	)

	const projectActionComponents = (
		<>
			<ActionsPopupComponent
				title={currentActionItem?.project_name || t("project.unnamedProject")}
				visible={actionsPopupVisible}
				onClose={closeActionsPopup}
				actions={projectActions}
			/>

			<ActionDrawer
				open={renameModalVisible}
				onOpenChange={(open) => !open && setRenameModalVisible(false)}
				title={t("hierarchicalWorkspacePopup.projectRename")}
				showCancel={false}
			>
				<div className="flex flex-col gap-2.5">
					<div className="text-xs font-normal leading-4 text-foreground">
						{t("hierarchicalWorkspacePopup.newName")}
					</div>
					<Input
						className="bg-white"
						placeholder={t("hierarchicalWorkspacePopup.inputProjectName")}
						value={currentActionItem?.project_name}
						onChange={(e) => {
							if (!currentActionItem) return
							updateCurrentActionItem({
								...currentActionItem,
								project_name: e.target.value,
							})
						}}
						autoFocus
					/>
				</div>
				<div className="flex gap-1.5 pt-1">
					<Button
						variant="outline"
						className="h-9 shrink-0 rounded-lg px-8"
						onClick={() => setRenameModalVisible(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						className="h-9 flex-1 rounded-lg"
						onClick={() => {
							handleRenameProject({
								projectId: currentActionItem?.id || "",
								projectName: currentActionItem?.project_name || "",
							})
							setRenameModalVisible(false)
						}}
						disabled={!currentActionItem?.project_name?.trim()}
					>
						{t("common.confirm")}
					</Button>
				</div>
			</ActionDrawer>

			<ActionDrawer
				open={deleteModalVisible}
				onOpenChange={(open) => !open && setDeleteModalVisible(false)}
				title={t("hierarchicalWorkspacePopup.deleteProject")}
				showCancel={false}
			>
				<div className="text-sm text-foreground">
					{t("ui.deleteProjectConfirm", {
						name: currentActionItem?.project_name || t("project.unnamedProject"),
					})}
				</div>
				<div className="flex gap-1.5 pt-1">
					<Button
						variant="outline"
						className="h-9 shrink-0 rounded-lg px-8"
						onClick={() => setDeleteModalVisible(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						variant="destructive"
						className="h-9 flex-1 rounded-lg"
						onClick={handleDeleteProject}
					>
						{t("common.confirm")}
					</Button>
				</div>
			</ActionDrawer>

			<ProjectMovePopup
				open={moveProjectModalVisible}
				onClose={() => setMoveProjectModalVisible(false)}
				onConfirm={handleMoveProject}
			/>

			{CollaboratorUpdatePanel}
		</>
	)

	return {
		currentActionItem,
		updateCurrentActionItem,
		actionsPopupVisible,
		openActionsPopup,
		closeActionsPopup,
		renameModalVisible,
		setRenameModalVisible,
		// 操作组件
		projectActionComponents,
	}
}
