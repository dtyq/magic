import { lazy, Suspense, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useResponsive } from "ahooks"
import ProjectCard from "../ProjectCard"
import type { ProjectCardContainerProps } from "./types"
import projectFilesStore from "@/stores/projectFiles"
import { useShareProject } from "../../layouts/MainLayout/hooks/useShareProject"
import { ShareMode, ShareType } from "../Share/types"
import projectStore from "../../stores/core/project"
import SuperMagicService from "../../services"
import { observer } from "mobx-react-lite"
import { Workspace, WorkspaceStatus } from "../../pages/Workspace/types"
import { isReadOnlyProject } from "../../utils/permission"
import { isOtherCollaborationProject } from "../../constants"
import { generateShareUrl } from "../../components/ShareManagement/utils/shareTypeHelpers"

const ShareModal = lazy(() => import("@/pages/superMagic/components/Share/Modal"))

const SimilarSharesDialog = lazy(
	() => import("@/pages/superMagic/components/Share/SimilarSharesDialog"),
)

const SimilarSharesDrawer = lazy(
	() => import("@/pages/superMagic/components/Share/SimilarSharesDrawer"),
)

const ShareSuccessModal = lazy(
	() => import("@/pages/superMagic/components/Share/FileShareModal/ShareSuccessModal"),
)

/**
 * ProjectCardContainer (open-source baseline)
 * Manages project card state and user interactions.
 * Collaboration panel and invite logic live in enterprise overlay.
 */
function ProjectCardContainer({
	selectedProject,
	selectedWorkspace,
	onProjectClick,
	onDropdownClick,
	className,
}: ProjectCardContainerProps) {
	const { t } = useTranslation("super")
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	const isReceivedCollaboration = isOtherCollaborationProject(selectedProject)

	const projectOptions = isReceivedCollaboration
		? projectStore.receivedCollaborationProjects
		: projectStore.getProjectsByWorkspace(selectedWorkspace?.id || "")

	const handleProjectMenuOpenChange = (open: boolean) => {
		if (!open) return
		if (isReceivedCollaboration) {
			void projectStore.loadReceivedCollaborationProjects()
			return
		}
		if (selectedWorkspace?.id) {
			void SuperMagicService.project.fetchProjects({
				workspaceId: selectedWorkspace.id,
				clearWhenNoProjects: false,
			})
		}
	}

	const workspaceForProjectActions = useMemo<Workspace>(
		() => ({
			id: selectedWorkspace?.id || selectedProject?.workspace_id || "",
			name: selectedWorkspace?.name || selectedProject?.workspace_name || "",
			is_archived: selectedWorkspace?.is_archived ?? 0,
			current_topic_id:
				selectedWorkspace?.current_topic_id || selectedProject?.current_topic_id || "",
			current_project_id:
				selectedWorkspace?.current_project_id ?? selectedProject?.id ?? null,
			workspace_status: selectedWorkspace?.workspace_status ?? WorkspaceStatus.WAITING,
			project_count: selectedWorkspace?.project_count ?? 0,
		}),
		[selectedWorkspace, selectedProject],
	)

	// 使用分享项目 hook
	const shareProject = useShareProject({
		attachments: projectFilesStore.workspaceFileTree,
		projectName: selectedProject?.project_name,
	})

	if (!selectedProject) {
		return null
	}

	return (
		<>
			<ProjectCard
				project={selectedProject}
				workspaceName={
					selectedWorkspace?.name ||
					selectedProject.workspace_name ||
					t("workspace.unnamedWorkspace")
				}
				collaborators={t("collaborators.empty")}
				onProjectClick={onProjectClick}
				onShareClick={shareProject.openShareModal}
				onDropdownClick={onDropdownClick}
				projectOptions={projectOptions}
				showCreateProject={!isReceivedCollaboration}
				onProjectMenuOpenChange={handleProjectMenuOpenChange}
				actionWorkspace={workspaceForProjectActions}
				className={className}
			/>

			{!isReadOnlyProject(selectedProject?.user_role) && (
				<>
					<Suspense fallback={null}>
						<ShareModal
							open={shareProject.shareModalOpen}
							onCancel={shareProject.closeShareModal}
							shareMode={ShareMode.Project}
							attachments={projectFilesStore.workspaceFileTree}
							attachmentList={projectFilesStore.workspaceFilesList}
							projectName={selectedProject.project_name}
							defaultSelectedFileIds={shareProject.defaultSelectedFileIds}
							resourceId={shareProject.editingResourceId}
							types={[
								ShareType.PasswordProtected,
								ShareType.Public,
								ShareType.Organization,
							]}
						/>
					</Suspense>

					{/* 相似分享Dialog/Drawer */}
					{shareProject.similarSharesInfo && (
						<Suspense fallback={null}>
							{isMobile ? (
								<SimilarSharesDrawer
									open={true}
									onClose={shareProject.closeSimilarSharesDialog}
									shares={shareProject.similarSharesInfo.similarShares}
									onSelectShare={shareProject.handleSelectSimilarShare}
									onCreateNew={shareProject.handleCreateNewShare}
								/>
							) : (
								<SimilarSharesDialog
									open={true}
									onClose={shareProject.closeSimilarSharesDialog}
									shares={shareProject.similarSharesInfo.similarShares}
									onSelectShare={shareProject.handleSelectSimilarShare}
									onCreateNew={shareProject.handleCreateNewShare}
								/>
							)}
						</Suspense>
					)}

					{/* 分享成功弹窗 - 用于显示已存在的分享 */}
					{shareProject.shareSuccessInfo && (
						<Suspense fallback={null}>
							<ShareSuccessModal
								open={true}
								onClose={shareProject.closeSuccessModal}
								onCancelShare={shareProject.handleCancelShare}
								onEditShare={shareProject.handleEditShare}
								shareName={
									shareProject.shareSuccessInfo.shareInfo.resource_name || ""
								}
								fileCount={
									shareProject.shareSuccessInfo.shareInfo?.extend?.file_count || 1
								}
								mainFileName={
									shareProject.shareSuccessInfo.shareInfo.main_file_name ||
									t("share.untitled")
								}
								shareUrl={generateShareUrl(
									shareProject.shareSuccessInfo.shareInfo.resource_id,
									shareProject.shareSuccessInfo.shareInfo.password,
									"files",
								)}
								projectName={shareProject.shareSuccessInfo.shareInfo.project_name}
								shareType={shareProject.shareSuccessInfo.shareInfo.share_type}
							/>
						</Suspense>
					)}
				</>
			)}
		</>
	)
}

export default observer(ProjectCardContainer)
export type { ProjectCardContainerProps }
