import { memo, useMemo } from "react"
import { Files, PanelLeftClose, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"
import UserSpacePanel from "../../../components/UserSpace/UserSpacePanel"
import UserSpaceIcon from "../../../components/UserSpace/UserSpaceIcon"
import IconShareCog from "@/enhance/tabler/icons-react/icons/iconShareCog"
import ProjectCardContainer from "../../../components/ProjectCardContainer"
import ProjectSider from "../../../components/ProjectSider"
import ShareManagementPanel from "../../../components/ShareManagement/ShareManagementPanel"
import SiderTask from "../../../components/SiderTask"
import TopicFilesButton from "../../../components/TopicFilesButton"
import { ProjectListItem, Topic, Workspace } from "../../../pages/Workspace/types"
import AudioProjectHeader from "../../../components/AudioProjectHeader"
import { AudioRecordingCopyDialog } from "../../AudioRecordings/components/AudioRecordingCopyDialog"
import { AudioRecordingMoveGroupDialog } from "../../AudioRecordings/components/AudioRecordingGroupDialogs"
import { useAudioProjectSidebarController } from "../hooks/useAudioProjectSidebarController"
import AudioProjectShareDialogs from "./AudioProjectShareDialogs"
import { Button } from "@/components/shadcn-ui/button"
import ShareModal from "../../../components/Share/Modal"
import { ShareMode, ShareType } from "../../../components/Share/types"

interface TopicSidebarProps {
	onCollapse?: () => void
	isCollapsed?: boolean
	selectedProject: ProjectListItem | null
	selectedWorkspace: Workspace | null
	selectedTopic: Topic | null
	isReadOnly: boolean
	topicFilesProps: any
	/** When true, hides the project header card in the sidebar */
	hideProjectCard?: boolean
	/** Chat detail pages only expose files and share tabs in ProjectSider */
	siderVariant?: "default" | "chat"
}

function TopicSidebar({
	selectedProject,
	onCollapse,
	isCollapsed = false,
	selectedWorkspace,
	selectedTopic,
	isReadOnly,
	topicFilesProps,
	hideProjectCard = false,
	siderVariant = "default",
}: TopicSidebarProps) {
	const { t } = useTranslation("super")
	const isChatSider = siderVariant === "chat"
	const audioController = useAudioProjectSidebarController({
		selectedProject,
		attachments: topicFilesProps.attachments ?? [],
		isReadOnly,
	})
	const {
		isAudioProject,
		canManageAudioProject,
		projectItem,
		title,
		actions,
		copyController,
		shareController,
		renameProject,
		moveToGroup,
		copyToProject,
		generateSummary,
		summaryMode,
	} = audioController
	// Chat sidebars use a shorter label to avoid implying the list is project-scoped metadata.
	const topicFilesTitle = isChatSider ? t("topicFiles.fileTitle") : t("topicFiles.title")
	// Chat has no project card, so the collapse control sits to the right of the sider tabs instead.
	const siderCollapseAction =
		isChatSider && onCollapse ? (
			<Button
				variant="ghost"
				size="icon"
				// Square matching the sider tab bar height: 28px tab buttons + 3px padding on each side.
				className="h-[34px] w-[34px] shrink-0 text-muted-foreground"
				onClick={onCollapse}
				aria-label={t("sidebarPanels.collapseFiles")}
				title={t("sidebarPanels.collapseFiles")}
				// Same test id as the project card button so focus restoration in TopicDesktopPanels finds it.
				data-testid="project-card-collapse"
			>
				<PanelLeftClose size={16} />
			</Button>
		) : undefined
	const items = useMemo(
		() => [
			{
				key: "topicFiles",
				title: topicFilesTitle,
				icon: <Files size={16} />,
				// Keep the panel header aligned with the active sidebar label in chat scenes.
				content: (
					<TopicFilesButton
						{...topicFilesProps}
						title={topicFilesTitle}
						showTitle
						showFileManager
					/>
				),
			},
			...(isChatSider || isAudioProject
				? []
				: [
						{
							key: "task",
							title: t("scheduleTask.title"),
							icon: <Timer size={16} />,
							content: (
								<SiderTask
									selectWorkspaceId={selectedWorkspace?.id}
									selectProjectId={selectedProject?.id}
									selectTopicId={selectedTopic?.id}
								/>
							),
							visible: !isReadOnly,
						},
						{
							key: "userSpace",
							title: t("userSpace.title"),
							icon: <UserSpaceIcon size={16} />,
							content: (
								<UserSpacePanel
									projectId={selectedProject?.id}
									projectName={selectedProject?.project_name}
									topicId={selectedTopic?.id}
									activeFileId={topicFilesProps.activeFileId}
									onFileClick={topicFilesProps.onFileClick}
								/>
							),
						},
					]),
			...(isAudioProject
				? []
				: [
						{
							key: "share",
							title: t("shareManagement.title"),
							icon: <IconShareCog size={16} color="currentColor" />,
							content: <ShareManagementPanel projectId={selectedProject?.id} />,
						},
					]),
		],
		[
			isChatSider,
			isAudioProject,
			isReadOnly,
			selectedProject,
			selectedProject?.id,
			selectedWorkspace,
			selectedTopic?.id,
			selectedWorkspace?.id,
			t,
			topicFilesTitle,
			topicFilesProps,
		],
	)

	return (
		<div className="flex h-full flex-col gap-2">
			{isAudioProject ? (
				<AudioProjectHeader
					title={title || selectedProject?.project_name || t("project.unnamedProject")}
					canCopyToProject={canManageAudioProject && Boolean(projectItem)}
					canRename={canManageAudioProject}
					canMoveToGroup={canManageAudioProject}
					canDelete={canManageAudioProject && Boolean(projectItem)}
					canGenerateSummary={canManageAudioProject && actions.canGenerateSummary}
					canShare={canManageAudioProject}
					summaryMode={summaryMode}
					summarySubmitting={actions.summarySubmitting}
					renaming={actions.renaming}
					onBack={audioController.handleBack}
					onRename={renameProject}
					onMoveToGroup={() => audioController.setMoveGroupOpen(true)}
					onCopyToProject={copyToProject}
					onGenerateSummary={generateSummary}
					onShare={shareController.openShareModal}
					onDelete={audioController.handleDelete}
					deleting={actions.deleting}
				/>
			) : hideProjectCard ? null : (
				<ProjectCardContainer
					onCollapse={onCollapse}
					isPanelVisible={!isCollapsed}
					selectedProject={selectedProject}
					selectedWorkspace={selectedWorkspace}
				/>
			)}
			<ProjectSider
				items={items}
				headerTrailingAction={siderCollapseAction}
				className="flex-1 overflow-hidden rounded-lg border border-border bg-background"
			/>
			{isAudioProject && canManageAudioProject ? (
				<>
					<AudioRecordingMoveGroupDialog
						open={audioController.moveGroupOpen}
						onOpenChange={audioController.setMoveGroupOpen}
						groups={audioController.groups.filter(
							(group) => group.id !== audioController.ungroupedGroupId,
						)}
						ungroupedCount={audioController.ungroupedCount}
						selectedGroupId={
							projectItem?.workspace_id ?? audioController.ungroupedGroupId
						}
						onSelect={async (groupId) => {
							await moveToGroup(groupId)
						}}
						isSubmitting={actions.moving}
					/>
					<AudioRecordingCopyDialog controller={copyController} />
					{canManageAudioProject ? (
						<ShareModal
							open={shareController.shareModalOpen}
							onCancel={shareController.closeShareModal}
							shareMode={ShareMode.Project}
							types={[
								ShareType.PasswordProtected,
								ShareType.Public,
								ShareType.Organization,
							]}
							attachments={topicFilesProps.attachments}
							attachmentList={topicFilesProps.attachments}
							projectName={title}
							projectId={selectedProject?.id}
							defaultSelectedFileIds={shareController.defaultSelectedFileIds}
							resourceId={shareController.editingResourceId}
						/>
					) : null}
					<AudioProjectShareDialogs controller={shareController} />
				</>
			) : null}
		</div>
	)
}

export default memo(TopicSidebar)
