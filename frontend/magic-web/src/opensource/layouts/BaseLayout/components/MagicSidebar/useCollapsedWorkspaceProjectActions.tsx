import { useCallback, useState } from "react"
import type { TFunction } from "i18next"
import type {
	ProjectListItem,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import projectStore from "@/opensource/pages/superMagic/stores/core/project"
import superMagicService from "@/opensource/pages/superMagic/services"
import DeleteDangerModal from "@/opensource/components/business/DeleteDangerModal"
import { openModal } from "@/opensource/utils/react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { openProjectInNewTab } from "@/opensource/pages/superMagic/utils/project"

interface UseCollapsedWorkspaceProjectActionsParams {
	workspace: Workspace
	t: TFunction
}

function useCollapsedWorkspaceProjectActions({
	workspace,
	t,
}: UseCollapsedWorkspaceProjectActionsParams) {
	const [transferModalOpen, setTransferModalOpen] = useState(false)
	const [transferProject, setTransferProject] = useState<ProjectListItem | null>(null)

	const handleTogglePin = useCallback(
		async (targetProject: ProjectListItem) => {
			const nextPinnedState = !targetProject.is_pinned

			const updatePinnedStateInCurrentList = (isPinned: boolean) => {
				const currentProjects = projectStore.getProjectsByWorkspace(workspace.id)
				if (!currentProjects.length) return
				projectStore.setProjectsForWorkspace(
					workspace.id,
					currentProjects.map((item) =>
						item.id === targetProject.id ? { ...item, is_pinned: isPinned } : item,
					),
				)
			}

			try {
				updatePinnedStateInCurrentList(nextPinnedState)
				projectStore.updateProject({ ...targetProject, is_pinned: nextPinnedState })

				await superMagicService.project.pinProject(targetProject, nextPinnedState)
				await projectStore.loadProjectsForWorkspace(workspace.id, true, true)
				if (targetProject.workspace_id !== workspace.id) {
					await projectStore.loadProjectsForWorkspace(
						targetProject.workspace_id,
						true,
						true,
					)
				}
			} catch (error) {
				updatePinnedStateInCurrentList(Boolean(targetProject.is_pinned))
				projectStore.updateProject(targetProject)
			}
		},
		[workspace.id],
	)

	const handleDeleteProject = useCallback(
		(targetProject: ProjectListItem) => {
			openModal(DeleteDangerModal, {
				content: targetProject.project_name || t("super:project.unnamedProject"),
				needConfirm: false,
				onSubmit: async () => {
					try {
						await superMagicService.deleteProject(targetProject)
						magicToast.success(t("super:project.deleteProjectSuccess"))
					} catch (error) {
						console.log("删除项目失败，失败原因：", error)
					}
				},
			})
		},
		[t],
	)

	const handleTransferProject = useCallback((targetProject: ProjectListItem) => {
		setTransferProject(targetProject)
		setTransferModalOpen(true)
	}, [])

	const handleCopyCollaborationLink = useCallback(
		async (targetProject: ProjectListItem) => {
			const success = await superMagicService.project.copyCollaborationLink(targetProject)
			if (success) {
				magicToast.success(t("super:collaborators.copySuccess"))
			}
		},
		[t],
	)

	const handleOpenInNewWindow = useCallback((project: ProjectListItem) => {
		openProjectInNewTab(project)
	}, [])

	const handleCancelWorkspaceShortcut = useCallback(
		async (targetProject: ProjectListItem) => {
			try {
				await superMagicService.project.cancelWorkspaceShortcut(
					targetProject.id,
					workspace.id,
				)
				magicToast.success(t("super:project.cancelWorkspaceShortcutSuccess"))
			} catch (error) {
				// Error already handled in service
			}
		},
		[t, workspace.id],
	)

	const handleTransferModalCancel = useCallback(() => {
		setTransferModalOpen(false)
		setTransferProject(null)
	}, [])

	const handleTransferModalSuccess = useCallback(async () => {
		await projectStore.loadProjectsForWorkspace(workspace.id, true)
	}, [workspace.id])

	return {
		transferModalOpen,
		transferProject,
		handleOpenInNewWindow,
		handleTogglePin,
		handleCopyCollaborationLink,
		handleTransferProject,
		handleCancelWorkspaceShortcut,
		handleDeleteProject,
		handleTransferModalCancel,
		handleTransferModalSuccess,
	}
}

export default useCollapsedWorkspaceProjectActions
