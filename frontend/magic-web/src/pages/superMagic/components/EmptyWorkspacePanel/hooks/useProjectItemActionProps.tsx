import { Suspense, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import magicToast from "@/components/base/MagicToaster/utils"
import { openModal } from "@/utils/react"
import DeleteDangerModal from "@/components/business/DeleteDangerModal"
import MoveProjectModal from "../components/MoveProjectModal"
import { workspaceStore } from "../../../stores/core"
import { useTranslation } from "react-i18next"

interface UseProjectItemActionPropsParams {
	selectedWorkspace: Workspace | null
}

/**
 * Open-source baseline: Project action props without collaboration or transfer.
 * Enterprise overlay provides full implementation via enterprise/src/...
 */
function useProjectItemActionProps({ selectedWorkspace }: UseProjectItemActionPropsParams) {
	const { t } = useTranslation("super")

	const [moveProjectId, setMoveProjectId] = useState<string | null>(null)
	const [isMoveProjectLoading, setIsMoveProjectLoading] = useState(false)
	const [deleteProject, setDeleteProject] = useState<ProjectListItem | null>(null)

	const handleMoveProject = useMemoizedFn((projectId: string) => {
		setMoveProjectId(projectId)
	})

	const handleMoveProjectConfirm = useMemoizedFn(async (workspaceId: string) => {
		if (!moveProjectId || isMoveProjectLoading || !selectedWorkspace?.id) return
		setIsMoveProjectLoading(true)
		try {
			await SuperMagicService.project.moveProjectAndRefresh(
				moveProjectId,
				workspaceId,
				selectedWorkspace.id,
			)
			magicToast.success(t("project.moveProjectSuccess"))
			setMoveProjectId(null)
		} catch (error) {
			// Error already handled in service
		} finally {
			setIsMoveProjectLoading(false)
		}
	})

	const handlePinProject = useMemoizedFn(async (project: ProjectListItem, isPin: boolean) => {
		if (!project.id || !selectedWorkspace) return
		try {
			await SuperMagicService.project.pinProject(project, isPin)
			SuperMagicService.project.fetchProjects({
				workspaceId: selectedWorkspace.id,
				clearWhenNoProjects: false,
			})
		} catch (error) {
			// Error already handled in service
		}
	})

	const handleTogglePinProject = useMemoizedFn(async (project: ProjectListItem) => {
		await handlePinProject(project, !project.is_pinned)
	})

	const handleProjectClick = useMemoizedFn((project: ProjectListItem) => {
		SuperMagicService.switchProjectInDesktop(project)
	})

	const handleDeleteProjectConfirm = useMemoizedFn((project: ProjectListItem) => {
		if (!selectedWorkspace) return
		setDeleteProject(project)
	})

	const handleRenameProject = useMemoizedFn(
		async ({ projectId, projectName, showMessage = true }: HandleRenameProjectParams) => {
			if (!selectedWorkspace) return
			try {
				await SuperMagicService.project.renameProject(
					projectId,
					projectName,
					selectedWorkspace.id,
				)
				if (showMessage) {
					magicToast.success(t("project.renameProjectSuccess"))
				}
			} catch (error) {
				// Error already handled in service
			}
		},
	)

	const projectModals = (
		<>
			{moveProjectId && (
				<Suspense fallback={null}>
					<MoveProjectModal
						selectedWorkspace={selectedWorkspace}
						workspaces={workspaceStore.workspaces}
						fetchWorkspaces={(params) =>
							SuperMagicService.workspace.fetchWorkspaces(params)
						}
						open={!!moveProjectId}
						onClose={() => setMoveProjectId(null)}
						onConfirm={handleMoveProjectConfirm}
						isMoveProjectLoading={isMoveProjectLoading}
					/>
				</Suspense>
			)}
			{deleteProject && (
				<DeleteDangerModal
					content={deleteProject.project_name || t("project.unnamedProject")}
					needConfirm={false}
					onSubmit={async () => {
						try {
							await SuperMagicService.deleteProject(deleteProject)
							magicToast.success(t("project.deleteProjectSuccess"))
						} catch (error) {
							console.log("删除项目失败，失败原因：", error)
						}
					}}
					onClose={() => setDeleteProject(null)}
				/>
			)}
		</>
	)

	return {
		moveProjectId,
		setMoveProjectId,
		isMoveProjectLoading,
		handleMoveProjectConfirm,
		handleProjectClick,
		handleDeleteProjectConfirm,
		handleRenameProject,
		handlePinProject,
		handleTogglePinProject,
		handleCancelWorkspaceShortcut: undefined,
		handleCancelWorkspaceShortcutByProject: undefined,
		handleMoveProject,
		// Open-source: no collaboration/transfer; enterprise overlay provides these
		handleTransferProject: undefined,
		onAddCollaborators: undefined,
		handleCopyCollaborationLink: undefined,
		projectModals,
	}
}

export default useProjectItemActionProps
