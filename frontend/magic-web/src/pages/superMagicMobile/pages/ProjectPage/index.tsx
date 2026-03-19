import { observer } from "mobx-react-lite"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { isReadOnlyProject, canManageProject } from "@/pages/superMagic/utils/permission"
import { workspaceStore, projectStore, topicStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import ChatActions from "./ProjectPageMain/components/ChatActions"
import PreviewDetailPopup, {
	PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import {
	useTopicListActions,
	useProjectAttachments,
} from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks"
import { useFileOperations } from "./hooks"
import TopicsPopup from "./ProjectPageMain/components/TopicsPopup"
import TopicPopup from "@/pages/superMagicMobile/components/TopicPopup"
import ProjectSider from "@/pages/superMagic/components/ProjectSider"
import { Files, Timer, CirclePlus } from "lucide-react"
import TopicFilesButton, {
	type TopicFilesButtonRef,
} from "@/pages/superMagic/components/TopicFilesButton"
import SiderTask from "@/pages/superMagic/components/SiderTask"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/lib/utils"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode/useCreateTopicListener"
import { PORTAL_IDS } from "@/constants"
import usePortalTarget from "@/hooks/usePortalTarget"
import MobileFileMenuDropdown from "@/pages/superMagic/components/TopicFilesButton/components/MobileFileMenuDropdown"
import { useIsMobile } from "@/hooks/use-mobile"
import IconShareCog from "@/enhance/tabler/icons-react/icons/iconShareCog"
import ShareManagementPanel from "@/pages/superMagic/components/ShareManagement/ShareManagementPanel"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import MobileInputContainer from "../ChatPage/components/MobileInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MainInputContainer/components/editors/constant"

const WithCollaborators = lazy(
	() => import("@/pages/superMagic/components/WithCollaborators"),
)

function ProjectPage() {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	// Get state from stores
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedTopic = topicStore.selectedTopic

	const messagePanelContainerRef = useRef<HTMLDivElement>(null)
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const topicFilesButtonRef = useRef<TopicFilesButtonRef>(null)

	const isReadonly = isReadOnlyProject(selectedProject?.user_role)
	const canManageProjectPermission = canManageProject(selectedProject?.user_role)

	// Portal target elements
	const collaborationPortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON,
	})

	const createButtonPortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_CREATE_BUTTON,
		enabled: isMobile,
	})

	// Active tab state for ProjectSider
	const [activeSiderTab, setActiveSiderTab] = useState("topicFiles")

	const setUserSelectDetail = useMemoizedFn(
		(detail: Parameters<PreviewDetailPopupRef["open"]>[0] | null) => {
			if (detail) {
				previewDetailPopupRef.current?.open(detail, [], [])
			}
		},
	)

	// Project attachments management
	const { updateAttachments, setAttachments, attachments, attachmentList } =
		useProjectAttachments({
			selectedProject,
			selectedWorkspace,
			selectedTopic,
			currentTopics: topicStore.topics,
			projects: projectStore.projects,
			workspaces: workspaceStore.workspaces,
			setUserSelectDetail,
		})

	useEffect(() => {
		if (selectedProject?.id) {
			updateAttachments(selectedProject)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedProject?.id])

	// Use topic list actions hook
	const { handleCreateTopic, openActionsPopup, topicActionComponents } = useTopicListActions()

	// Sending is handled by MessagePanel service now.

	const [topicsPopupOpen, setTopicsPopupOpen] = useState(false)
	const [topicPopupOpen, setTopicPopupOpen] = useState(false)

	/**
	 * Fetch topics list for current project (non-blocking)
	 * Runs in background without blocking UI
	 */
	const fetchTopicsForCurrentProject = useMemoizedFn(() => {
		if (!selectedProject?.id) return

		SuperMagicService.topic
			.fetchTopics({
				projectId: selectedProject.id,
				isAutoSelect: false,
				page: 1,
			})
			.catch((error) => {
				console.error("Failed to fetch topics:", error)
			})
	})

	const showTopicsPopup = useMemoizedFn(() => {
		// Fetch latest data in background
		fetchTopicsForCurrentProject()
		// Open popup immediately (non-blocking)
		setTopicsPopupOpen(true)
	})

	// Monitor selectedTopic changes and auto-open topic popup
	useEffect(() => {
		if (selectedTopic?.id) {
			setTopicPopupOpen(true)
		}
	}, [selectedTopic?.id])

	// Close topic popup and clear selected topic
	const handleTopicPopupClose = useMemoizedFn(() => {
		setTopicPopupOpen(false)
		topicStore.setSelectedTopic(null)
	})

	// Handle history click from topic popup: close topic popup and open topics popup
	const handleHistoryClickFromTopicPopup = useMemoizedFn(() => {
		topicStore.setSelectedTopic(null)
		setTopicPopupOpen(false)
		// Fetch latest data in background
		fetchTopicsForCurrentProject()
		// Open popup immediately (non-blocking)
		setTopicsPopupOpen(true)
	})

	// Listen for Create_New_Topic event and handle topic creation
	useCreateTopicListener()

	// Handle file operations with automatic tab switching
	const { handleAddFile, handleAddFolder, handleUploadFile } = useFileOperations({
		topicFilesButtonRef,
		setActiveSiderTab,
	})

	// 当前活跃的文件ID，用于同步文件列表和文件查看器的选中状态
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

	// 多选模式状态
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

	// 订阅 activeFileId 更新事件
	useEffect(() => {
		const handleActiveFileIdUpdate = (fileId: string | null) => {
			console.log("🟢 Received activeFileId update via PubSub:", fileId)
			setActiveFileId(fileId)
		}

		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
		}
	}, [])

	const { handleOpenFile } = useFileOpen({
		setUserSelectDetail: (detail) => {
			previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
		},
		attachments,
	})

	const onFileClick = useMemoizedFn((fileId: string) => {
		const targetFile = attachmentList.find((item) => item.file_id === fileId)
		if (targetFile) {
			handleOpenFile(targetFile)
		}
	})

	/**
	 * Handle file click event
	 * Opens the file in the detail panel and updates active file state
	 */
	const handleFileClick = useMemoizedFn((fileItem?: any) => {
		const fileId = fileItem?.file_id
		setUserSelectDetail(null)
		setActiveFileId(fileId)

		setTimeout(() => {
			onFileClick(fileId)
		}, 100)
	})

	return (
		<>
			{/* Render header actions via portal */}
			{canManageProjectPermission &&
				collaborationPortalTarget &&
				createPortal(
					<Suspense fallback={null}>
						<WithCollaborators selectedProject={selectedProject} />
					</Suspense>,
					collaborationPortalTarget,
				)}
			{/* Render file creation button via portal - always visible regardless of active tab */}
			{!isReadonly &&
				isMobile &&
				createButtonPortalTarget &&
				createPortal(
					<MobileFileMenuDropdown
						onAddFile={handleAddFile}
						onUploadFile={handleUploadFile}
						onAddFolder={handleAddFolder}
						enabled={isMobile}
					>
						<button className="rounded-lg p-1.5 text-foreground hover:bg-accent hover:opacity-90 active:opacity-80">
							<CirclePlus size={20} />
						</button>
					</MobileFileMenuDropdown>,
					createButtonPortalTarget,
				)}
			<div className={cn("relative flex h-full flex-auto flex-col items-center")}>
				<ProjectSider
					width="100%"
					value={activeSiderTab}
					onValueChange={setActiveSiderTab}
					items={[
						{
							key: "topicFiles",
							title: t("topicFiles.title"),
							icon: <Files size={16} />,
							content: (
								<TopicFilesButton
									ref={topicFilesButtonRef}
									attachments={attachments}
									setUserSelectDetail={setUserSelectDetail}
									onFileClick={handleFileClick}
									projectId={selectedProject?.id}
									activeFileId={activeFileId}
									selectedTopic={selectedTopic}
									onAttachmentsChange={setAttachments}
									allowEdit={!isReadonly}
									selectedWorkspace={selectedWorkspace}
									selectedProject={selectedProject}
									projects={projectStore.projects}
									workspaces={workspaceStore.workspaces}
									isInProject
									onMultiSelectModeChange={setIsMultiSelectMode}
								/>
							),
						},
						// {
						// 	title: "数据看板",
						// 	content: <SiderDashboard />,
						// },
						// {
						// 	title: "数据源",
						// 	content: <SiderDataSource />,
						// },
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
							visible: !isReadonly,
						},
						{
							key: "share",
							title: t("shareManagement.title"),
							icon: <IconShareCog size={16} />,
							content: <ShareManagementPanel projectId={selectedProject?.id} />,
						},
					]}
					className="w-full flex-1 overflow-y-auto"
				/>
				{/* Hide bottom actions when in multi-select mode */}
				{!isReadonly && (
					<div
						style={{
							transition:
								"max-height 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 350ms cubic-bezier(0.4, 0, 0.2, 1), padding 400ms cubic-bezier(0.4, 0, 0.2, 1)",
						}}
						className={cn(
							"flex w-full flex-shrink-0 flex-col gap-2 overflow-hidden",
							isMultiSelectMode
								? "pointer-events-none max-h-0 opacity-0"
								: "pointer-events-auto max-h-[500px] pt-1.5 opacity-100",
							"pb-[max(var(--safe-area-inset-bottom),10px)]",
						)}
					>
						<ChatActions
							onNewTopicClick={handleCreateTopic}
							onHistoryTopicsClick={showTopicsPopup}
						/>
						{/* Show message panel if project is not readonly */}
						<ProjectPageInputContainer
							className="mx-auto max-w-3xl rounded-2xl"
							selectedProject={selectedProject}
							selectedTopic={selectedTopic}
							setSelectedTopic={topicStore.setSelectedTopic}
							onFileClick={onFileClick}
							selectedWorkspace={selectedWorkspace}
							attachments={attachments}
						/>
						<TopicsPopup
							open={topicsPopupOpen}
							onOpenChange={setTopicsPopupOpen}
							onCreateTopic={handleCreateTopic}
							onOpenActionsPopup={openActionsPopup}
						/>
						<TopicPopup
							open={topicPopupOpen}
							onClose={handleTopicPopupClose}
							onHistoryClick={handleHistoryClickFromTopicPopup}
						/>
					</div>
				)}
			</div>
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={previewDetailPopupRef}
				setUserSelectDetail={setUserSelectDetail}
				onClose={() => {
					// FIXME
					setUserSelectDetail(null)
				}}
				onOpenNewPopup={(detail, attachmentTree, attachmentList) => {
					linkPreviewPopupRef.current?.open(detail, attachmentTree, attachmentList)
				}}
			/>
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={linkPreviewPopupRef}
				setUserSelectDetail={setUserSelectDetail}
				onClose={() => {
					// Close link popup without any action
				}}
			/>
			{!isReadonly && topicActionComponents}
		</>
	)
}

export default observer(ProjectPage)
