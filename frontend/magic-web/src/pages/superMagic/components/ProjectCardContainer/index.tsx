import { lazy, Suspense, useMemo, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import ProjectCard from "../ProjectCard"
import type { ProjectCardContainerProps } from "./types"
import projectFilesStore from "@/stores/projectFiles"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useShareProject } from "../../layouts/MainLayout/hooks/useShareProject"
import { ShareMode, ShareType } from "../Share/types"
import { observer } from "mobx-react-lite"
import { Workspace, WorkspaceStatus } from "../../pages/Workspace/types"
import { isReadOnlyProject } from "../../utils/permission"
import { isOtherCollaborationProject } from "../../constants"
import { generateShareUrl } from "../../components/ShareManagement/utils/shareTypeHelpers"

import WorkspaceProjectsPanel from "../WorkspacesMenu/components/WorkspaceProjectsPanel"

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
	onCollapse,
	isPanelVisible = true,
	className,
	variant,
}: ProjectCardContainerProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	const isReceivedCollaboration = isOtherCollaborationProject(selectedProject)
	const currentWorkspaceId = selectedProject?.workspace_id || selectedWorkspace?.id || ""
	const isSelectedWorkspaceMatched =
		!!selectedWorkspace?.id && selectedWorkspace.id === currentWorkspaceId
	const currentWorkspaceName = isSelectedWorkspaceMatched
		? selectedWorkspace?.name || selectedProject?.workspace_name || ""
		: selectedProject?.workspace_name || selectedWorkspace?.name || ""

	const [projectsOpen, setProjectsOpen] = useState(false)
	useEffect(() => {
		if (!isPanelVisible) setProjectsOpen(false)
	}, [isPanelVisible])

	const workspaceForProjectActions = useMemo<Workspace>(
		() => ({
			id: currentWorkspaceId,
			workspace_type: isSelectedWorkspaceMatched
				? selectedWorkspace?.workspace_type || "default"
				: "default",
			name: currentWorkspaceName,
			is_archived: isSelectedWorkspaceMatched ? (selectedWorkspace?.is_archived ?? 0) : 0,
			current_topic_id:
				selectedProject?.current_topic_id ||
				(isSelectedWorkspaceMatched ? selectedWorkspace?.current_topic_id : "") ||
				"",
			current_project_id: selectedProject?.id ?? null,
			workspace_status: isSelectedWorkspaceMatched
				? (selectedWorkspace?.workspace_status ?? WorkspaceStatus.WAITING)
				: WorkspaceStatus.WAITING,
			project_count: isSelectedWorkspaceMatched ? (selectedWorkspace?.project_count ?? 0) : 0,
		}),
		[
			currentWorkspaceId,
			currentWorkspaceName,
			isSelectedWorkspaceMatched,
			selectedProject,
			selectedWorkspace,
		],
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
				workspaceName={currentWorkspaceName || t("workspace.unnamedWorkspace")}
				collaborators={t("collaborators.empty")}
				onWorkspaceProjectsOpen={() => setProjectsOpen(true)}
				onCollapse={onCollapse}
				isPanelVisible={isPanelVisible}
				onShareClick={shareProject.openShareModal}
				actionWorkspace={workspaceForProjectActions}
				className={className}
				variant={variant}
			/>

			{projectsOpen && (
				<WorkspaceProjectsPanel
					key={currentWorkspaceId}
					open
					initialSource={
						isReceivedCollaboration
							? { type: "collaboration" }
							: { type: "workspace", workspace: workspaceForProjectActions }
					}
					onClose={() => setProjectsOpen(false)}
				/>
			)}

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
								createdAt={shareProject.shareSuccessInfo.shareInfo.created_at}
								updatedAt={shareProject.shareSuccessInfo.shareInfo.updated_at}
								viewCount={shareProject.shareSuccessInfo.shareInfo.view_count}
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
