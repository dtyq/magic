import { useMemoizedFn, useResponsive } from "ahooks"
import { observer } from "mobx-react-lite"
import { lazy, Suspense, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "@/opensource/pages/superMagic/styles"
import { workspaceStore, projectStore } from "../../stores/core"
import projectFilesStore from "@/opensource/stores/projectFiles"
import SuperMagicService from "../../services"
import type { HandleCreateProjectParams } from "../../services/projectService"
import type { CreatedProject, ProjectListItem, Topic } from "../../pages/Workspace/types"
import { WorkspacePage } from "./types"
import useMacTouch from "@/opensource/hooks/useMacTouch"
import { Outlet, useParams } from "react-router"
import routeManageService from "@/opensource/pages/superMagic/services/routeManageService"
import useRegisterShortcuts from "@/opensource/pages/superMagic/hooks/useRegisterShortcuts"
import { useNoPermissionCollaborationProject } from "@/opensource/pages/superMagic/hooks/useNoPermissionCollaborationProject"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { ShareMode, ShareType } from "../../components/Share/types"
import { useShareProject } from "./hooks/useShareProject"
import { generateShareUrl } from "../../components/ShareManagement/utils/shareTypeHelpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const ShortcutKeysList = lazy(
	() => import("@/opensource/pages/superMagic/components/ShortcutKeysList"),
)

const ShareModal = lazy(() => import("@/opensource/pages/superMagic/components/Share/Modal"))

const SimilarSharesDialog = lazy(
	() => import("@/opensource/pages/superMagic/components/Share/SimilarSharesDialog"),
)

const SimilarSharesDrawer = lazy(
	() => import("@/opensource/pages/superMagic/components/Share/SimilarSharesDrawer"),
)

const ShareSuccessModal = lazy(
	() => import("@/opensource/pages/superMagic/components/Share/FileShareModal/ShareSuccessModal"),
)

function MainLayout() {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { projectId, topicId } = useParams()
	const navigate = useNavigate()
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	// Initialize routeManageService with navigate function
	useEffect(() => {
		routeManageService.setNavigate(navigate)
	}, [navigate])

	// Get workspace state from store
	const selectedWorkspace = workspaceStore.selectedWorkspace
	// Get project state from store
	const selectedProject = projectStore.selectedProject

	// 使用分享项目 hook
	const shareProject = useShareProject({
		attachments: projectFilesStore.workspaceFileTree,
		projectName: selectedProject?.project_name,
	})

	/** 工作区的页面状态 */
	const workspacePage = useMemo(() => {
		if (topicId && projectId) {
			return WorkspacePage.Chat
		}
		return WorkspacePage.Home
	}, [projectId, topicId])

	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	const handleStartAddProject = useMemoizedFn(
		async (params: HandleCreateProjectParams): Promise<CreatedProject | null> => {
			const res = await SuperMagicService.handleCreateProject(params)
			if (res) {
				magicToast.success(t("project.createProjectSuccess"))
				// Update workspace state after navigation
				routeManageService.navigateToState({
					projectId: res.project.id,
				})
			}
			return res
		},
	)

	// Create topic handler
	const handleCreateTopic = useMemoizedFn(
		async (targetProject?: ProjectListItem): Promise<Topic | null> => {
			return SuperMagicService.handleCreateTopic({
				selectedProject,
				targetProject,
				onError: handleNoPermissionCollaborationProject,
			})
		},
	)

	useMacTouch()

	/** 注册快捷键 */
	useRegisterShortcuts({
		workspacePage,
		selectedWorkspace,
		handleStartAddProject,
		handleCreateTopic,
	})

	return (
		<div className={styles.container}>
			<Outlet />
			{/* 快捷键列表组件 */}
			<Suspense fallback={null}>
				<ShortcutKeysList />
			</Suspense>

			{/* 分享项目弹窗 */}
			{selectedProject && (
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
							ShareType.Organization,
							ShareType.Public,
						]}
					/>
				</Suspense>
			)}

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
						shareName={shareProject.shareSuccessInfo.shareInfo.resource_name || ""}
						fileCount={shareProject.shareSuccessInfo.shareInfo?.extend?.file_count || 1}
						mainFileName={
							shareProject.shareSuccessInfo.shareInfo.main_file_name ||
							t("share.untitled")
						}
						shareUrl={generateShareUrl(
							shareProject.shareSuccessInfo.shareInfo.resource_id,
							shareProject.shareSuccessInfo.shareInfo.password,
							"files",
						)}
						password={shareProject.shareSuccessInfo.shareInfo.password}
						expire_at={shareProject.shareSuccessInfo.shareInfo.expire_at}
						shareType={shareProject.shareSuccessInfo.shareInfo.share_type}
						shareProject={shareProject.shareSuccessInfo.shareInfo.share_project}
						projectName={shareProject.shareSuccessInfo.shareInfo.project_name}
					/>
				</Suspense>
			)}
		</div>
	)
}

export default observer(MainLayout)
