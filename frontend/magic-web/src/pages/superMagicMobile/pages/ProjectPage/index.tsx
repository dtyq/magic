import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { workspaceStore, projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import PreviewDetailPopup, {
	PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import {
	useTopicListActions,
	useProjectAttachments,
} from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks"
import TopicsPopup from "./ProjectPageMain/components/TopicsPopup"
import { Ellipsis, Share2, UserPlus } from "lucide-react"
import TopicFilesButton, {
	type TopicFilesButtonRef,
} from "@/pages/superMagic/components/TopicFilesButton"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/lib/utils"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode/useCreateTopicListener"
import { PORTAL_IDS } from "@/constants"
import usePortalTarget from "@/hooks/usePortalTarget"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import { Button } from "@/components/shadcn-ui/button"
import { SmoothTabs, type Tab } from "@/components/shadcn-ui/smooth-tabs"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import projectFilesStore from "@/stores/projectFiles"
import ProjectPageMain from "./ProjectPageMain"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { resolveProjectDetailHeaderActions } from "@/pages/superMagicMobile/utils/sharedProjectActionPolicy"

type ProjectDetailTab = "topics" | "topicFiles"

function ProjectPage() {
	return <ObservedLegacyProjectPage />
}

/**
 * 项目详情（移动端）：承接 store、附件与话题弹层，壳层视觉与主题 background 对齐壳层与头部。
 */
function LegacyProjectPage() {
	const { t } = useTranslation("super")
	const navigate = useNavigate()

	// 首页只保留“话题 / 文件”两个 tab，先完成项目详情 UI 收敛。
	const [activeSiderTab, setActiveSiderTab] = useState<ProjectDetailTab>("topics")

	/** 项目详情 tab 配置：复用 SmoothTabs 的滑块测量能力，并保留稳定测试选择器。 */
	const projectDetailTabs = useMemo<Tab<ProjectDetailTab>[]>(
		() => [
			{
				value: "topics",
				label: t("projectDetail.tabTopics"),
				testId: "project-detail-topics-tab",
			},
			{
				value: "topicFiles",
				label: t("projectDetail.tabFiles"),
				testId: "project-detail-files-tab",
			},
		],
		[t],
	)

	// Get state from stores
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedTopic = topicStore.selectedTopic

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const topicFilesButtonRef = useRef<TopicFilesButtonRef>(null)

	const isReadonly = isReadOnlyProject(selectedProject?.user_role)
	const { canManageCollaborators } = useCollaboratorUpdatePanel({ selectedProject })
	const projectDetailHeaderActions = useMemo(
		() => resolveProjectDetailHeaderActions(selectedProject, { canManageCollaborators }),
		[canManageCollaborators, selectedProject],
	)
	// Portal target elements — enabled flags must match header actionSlots from the same resolver.
	const sharePortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON,
		enabled: projectDetailHeaderActions.showShareButton,
	})

	const morePortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON,
		enabled:
			projectDetailHeaderActions.showMoreButton ||
			projectDetailHeaderActions.showCollaboratorsButton,
	})

	const setUserSelectDetail = useMemoizedFn(
		(detail: Parameters<PreviewDetailPopupRef["open"]>[0] | null) => {
			if (detail) {
				previewDetailPopupRef.current?.open(detail, [], [])
			}
		},
	)

	// Project attachments management
	const { updateAttachments, setAttachments } = useProjectAttachments({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		currentTopics: topicStore.topics,
		projects: projectStore.projects,
		workspaces: workspaceStore.workspaces,
		setUserSelectDetail,
	})

	/**
	 * 项目详情文件页统一以 projectFilesStore 中的最新附件树作为渲染源，
	 * 避免在 hook 返回值与 observer 订阅之间再多出一层可能失配的中转状态。
	 */
	const attachmentTree = projectFilesStore.workspaceFileTree
	const attachmentFlatList = projectFilesStore.workspaceFilesList

	const [projectShareSheetOpen, setProjectShareSheetOpen] = useState(false)

	useEffect(() => {
		if (selectedProject?.id) {
			updateAttachments(selectedProject)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedProject?.id])

	/**
	 * 项目详情文件页统一通过服务端最新附件树回写列表，避免在 View 层维护第二份本地树状态。
	 */
	const refreshProjectAttachments = useMemoizedFn(async () => {
		if (!selectedProject) return
		await updateAttachments(selectedProject)
	})

	// Use topic list actions hook
	const {
		handleCreateTopic,
		openActionsPopup,
		deleteTopicDirect,
		toggleTopicPin,
		topicActionComponents,
	} = useTopicListActions()
	const {
		openActionsPopup: openProjectActionsPopup,
		openManageModal,
		ensureCollaboratorPanelInitialized,
		projectActionComponents,
	} = useProjectListActions({
		actionContext: "project-detail",
		visibleActionKeys: projectDetailHeaderActions.visibleActionKeys,
	})

	// Sending is handled by MessagePanel service now.

	const [topicsPopupOpen, setTopicsPopupOpen] = useState(false)

	// Listen for Create_New_Topic event and handle topic creation
	useCreateTopicListener()

	/**
	 * 项目入口页发送成功后固定切到新话题子页，避免继续停留在入口页内混合承载会话。
	 */
	const handleProjectPageSendSuccess = useMemoizedFn(
		({
			currentProject,
			currentTopic,
		}: {
			currentProject: typeof selectedProject
			currentTopic: typeof selectedTopic
		}) => {
			if (!currentProject?.id || !currentTopic?.id) return

			navigate({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: currentProject.id,
					topicId: currentTopic.id,
				},
			})
		},
	)

	// 当前活跃的文件ID，用于同步文件列表和文件查看器的选中状态
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

	// 多选模式状态
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
	const shouldShowComposer = !isReadonly && activeSiderTab === "topics" && !isMultiSelectMode

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
			previewDetailPopupRef.current?.open(detail, attachmentTree, attachmentFlatList)
		},
		attachments: attachmentTree,
	})

	const onFileClick = useMemoizedFn((fileId: string) => {
		const targetFile = attachmentFlatList.find((item) => item.file_id === fileId)
		if (targetFile) {
			handleOpenFile(targetFile)
		}
	})

	/**
	 * Handle file click event
	 * Opens the file in the detail panel and updates active file state
	 */
	const handleFileClick = useMemoizedFn((fileItem?: { file_id?: string | null }) => {
		const fileId = fileItem?.file_id ?? null
		setUserSelectDetail(null)
		setActiveFileId(fileId)

		setTimeout(() => {
			if (fileId) onFileClick(fileId)
		}, 100)
	})

	/** Opens the mobile project share sheet from the header share button. */
	const handleOpenProjectShare = useMemoizedFn(() => {
		setProjectShareSheetOpen(true)
	})

	/** Opens collaborator management directly when it is hoisted to the header MORE slot. */
	const handleOpenProjectCollaborators = useMemoizedFn(() => {
		if (!selectedProject) return
		ensureCollaboratorPanelInitialized()
		openManageModal()
	})

	return (
		<>
			{sharePortalTarget &&
				projectDetailHeaderActions.showShareButton &&
				createPortal(
					<Button
						type="button"
						variant="ghost"
						className="h-12 w-12 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent active:opacity-70"
						onClick={handleOpenProjectShare}
						aria-label={t("share.shareTitle")}
						data-testid="project-detail-header-share-button"
					>
						<Share2 className="size-[22px]" />
					</Button>,
					sharePortalTarget,
				)}
			{morePortalTarget &&
				projectDetailHeaderActions.showCollaboratorsButton &&
				createPortal(
					<Button
						type="button"
						variant="ghost"
						className="h-12 w-12 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent active:opacity-70"
						onClick={handleOpenProjectCollaborators}
						aria-label={t("project.addCollaborators")}
						data-testid="project-detail-header-collaborators-button"
					>
						<UserPlus className="size-[22px]" />
					</Button>,
					morePortalTarget,
				)}
			{morePortalTarget &&
				projectDetailHeaderActions.showMoreButton &&
				createPortal(
					<Button
						type="button"
						variant="ghost"
						className="h-12 w-12 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent active:opacity-70"
						onClick={() => {
							if (!selectedProject) return
							openProjectActionsPopup(selectedProject)
						}}
						aria-label={t("projectDetail.moreAria")}
						data-testid="project-detail-header-more-button"
					>
						<Ellipsis className="size-[22px]" />
					</Button>,
					morePortalTarget,
				)}
			{/* 与 MobileShell 面板、ProjectDetailHeader 及原型一致：整页使用主题 background，避免头部与内容区硬编码暖色分层 */}
			<div className={cn("relative flex h-full min-h-0 flex-auto flex-col overflow-hidden")}>
				{/* 与原型一致：tab 条单独 shrink-0 + px-3 pt-4，主内容区 flex-1 再各自 px-3，避免整块同一列 padding 与原型分层不一致 */}
				<div className="flex shrink-0 justify-start px-3 pt-4">
					<SmoothTabs
						tabs={projectDetailTabs}
						value={activeSiderTab}
						onChange={setActiveSiderTab}
						variant="background"
						showTooltip={false}
						className="h-9 w-max max-w-full rounded-full bg-muted p-[3px]"
						buttonClassName="h-[30px] flex-none rounded-full px-4 text-[14px] leading-5 data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=inactive]:font-normal data-[state=inactive]:text-muted-foreground"
						indicatorClassName="inset-y-[3px] rounded-full border-0 bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						data-testid="project-detail-hero"
					/>
				</div>
				<div className="relative min-h-0 flex-1 overflow-hidden">
					{activeSiderTab === "topicFiles" ? (
						<div
							className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-2"
							data-testid="project-detail-files-panel"
						>
							<TopicFilesButton
								ref={topicFilesButtonRef}
								className="h-full"
								title={t("topicFiles.title")}
								mobileViewVariant="project-detail"
								attachments={attachmentTree}
								setUserSelectDetail={setUserSelectDetail}
								onFileClick={handleFileClick}
								projectId={selectedProject?.id}
								activeFileId={activeFileId}
								selectedTopic={selectedTopic}
								onAttachmentsChange={setAttachments}
								refreshAttachments={refreshProjectAttachments}
								allowEdit={!isReadonly}
								selectedWorkspace={selectedWorkspace}
								selectedProject={selectedProject}
								projects={projectStore.projects}
								workspaces={workspaceStore.workspaces}
								isInProject
								onMultiSelectModeChange={setIsMultiSelectMode}
								showMobileActions
							/>
						</div>
					) : (
						<div
							className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2"
							data-testid="project-detail-topics-panel"
						>
							<ProjectPageMain
								className="h-full min-h-0 flex-1"
								onTopicMore={(topic) => openActionsPopup(topic, selectedProject)}
								onTopicPin={(topic) => {
									void toggleTopicPin(topic)
								}}
								onTopicDelete={(topic) => deleteTopicDirect(topic, selectedProject)}
							/>
						</div>
					)}
				</div>
				<div
					className={cn(
						"flex w-full flex-shrink-0 flex-col gap-2",
						shouldShowComposer ? "pointer-events-auto" : "pointer-events-none hidden",
					)}
					aria-hidden={!shouldShowComposer}
				>
					{/* 保持输入区常驻挂载，避免 tab 切换时销毁内部输入态和上传态。 */}
					<ProjectPageInputContainer
						className="mx-auto max-w-3xl rounded-2xl"
						selectedProject={selectedProject}
						selectedTopic={selectedTopic}
						setSelectedTopic={topicStore.setSelectedTopic}
						onFileClick={onFileClick}
						selectedWorkspace={selectedWorkspace}
						attachments={attachmentTree}
						onSendSuccess={handleProjectPageSendSuccess}
					/>
				</div>
			</div>
			<TopicsPopup
				open={topicsPopupOpen}
				onOpenChange={setTopicsPopupOpen}
				onCreateTopic={handleCreateTopic}
				onOpenActionsPopup={openActionsPopup}
			/>
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
			<ProjectShareSheet
				open={projectShareSheetOpen}
				onClose={() => setProjectShareSheetOpen(false)}
				projectName={selectedProject?.project_name}
				projectId={selectedProject?.id}
				attachments={attachmentTree}
				attachmentList={attachmentFlatList}
			/>
			{!isReadonly && topicActionComponents}
			{projectActionComponents}
		</>
	)
}

const ObservedLegacyProjectPage = observer(LegacyProjectPage)

export default ProjectPage
