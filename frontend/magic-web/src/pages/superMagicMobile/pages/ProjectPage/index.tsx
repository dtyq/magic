import MobileTopicTypeFilter from "@/pages/superMagicMobile/components/TopicTypeFilter"
import { useTopicTypeFilter } from "@/pages/superMagic/hooks/useTopicTypeFilter"
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
import { useProjectPageComposerContext } from "@/pages/superMagicMobile/pages/ProjectPage/hooks"
import TopicsPopup from "./ProjectPageMain/components/TopicsPopup"
import { Ellipsis, Share2, UserPlus } from "lucide-react"
import TopicFilesButton, {
	type TopicFilesButtonRef,
} from "@/pages/superMagic/components/TopicFilesButton"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/utils/cn"
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
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { resolveProjectDetailHeaderActions } from "@/pages/superMagicMobile/utils/sharedProjectActionPolicy"
import MobileScheduledTasksPanel from "./components/MobileScheduledTasksPanel"
import MobileAiCanvasPanel from "./components/MobileAiCanvasPanel"
import { AI_CANVAS_HIDDEN_ACTION_KEYS } from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"
import { isAiCanvasProject } from "@/pages/superMagic/utils/isAiCanvasProject"
import { useAiCanvasDocument } from "@/pages/superMagic/pages/TopicPage/hooks/useAiCanvasDocument"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	getProjectDetailTabs,
	shouldKeepScheduledTasksPanelMounted,
	type ProjectDetailTab,
} from "./tab-config"

const noopOpenCanvas = () => undefined

/** AI canvas composers always talk to the design employee: the mode cannot be switched. */
const AI_CANVAS_TOPIC_MODE_LOGIC = {
	topicMode: TopicMode.Design,
	setTopicMode: () => undefined,
	recoverTopicMode: () => undefined,
}

function ProjectPage() {
	return <ObservedLegacyProjectPage />
}

/**
 * 项目详情（移动端）：承接 store、附件与话题弹层，壳层视觉与主题 background 对齐壳层与头部。
 */
function LegacyProjectPage() {
	const { t } = useTranslation("super")
	// AI canvas composers share the AI canvas home's prompt hint.
	const { t: tAiCanvas } = useTranslation("aiCanvas")
	const { createTopicForProjectSend, handleSendComplete, handleSendSuccess } =
		useProjectPageComposerContext()

	// 首页使用“话题 / 文件 / 定时任务”三个 tab，统一承载项目级内容入口。
	const [activeSiderTab, setActiveSiderTab] = useState<ProjectDetailTab>("topics")
	const [hasOpenedScheduledTasks, setHasOpenedScheduledTasks] = useState(false)

	// Get state from stores
	const selectedProject = projectStore.selectedProject
	const [topicType, setTopicType] = useTopicTypeFilter(selectedProject?.id)
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedTopic = topicStore.selectedTopic
	const isReadonly = isReadOnlyProject(selectedProject?.user_role)
	// AI canvas projects keep this page's structure with only "Topics" and "Canvas" tabs.
	const isAiCanvas = isAiCanvasProject(selectedProject)

	/** 项目详情 tab 配置：复用 SmoothTabs 的滑块测量能力，并保留稳定测试选择器。 */
	const projectDetailTabs = useMemo<Tab<ProjectDetailTab>[]>(
		() => getProjectDetailTabs(t, isReadonly, isAiCanvas),
		[isAiCanvas, isReadonly, t],
	)

	/** Falls back to topics when the current tab does not exist for this project. */
	useEffect(() => {
		if (!projectDetailTabs.some((tab) => tab.value === activeSiderTab)) {
			setActiveSiderTab("topics")
		}
	}, [activeSiderTab, projectDetailTabs])

	/** Returns users to the topics tab when the current project no longer permits task access. */
	useEffect(() => {
		if (isReadonly && activeSiderTab === "scheduledTasks") {
			setActiveSiderTab("topics")
		}
	}, [activeSiderTab, isReadonly])

	/** Remembers the first visit so later tab switches can hide the panel instead of unmounting it. */
	useEffect(() => {
		if (activeSiderTab === "scheduledTasks") {
			setHasOpenedScheduledTasks(true)
		}
	}, [activeSiderTab])

	const keepScheduledTasksMounted =
		!isReadonly && shouldKeepScheduledTasksPanelMounted(activeSiderTab, hasOpenedScheduledTasks)

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const topicFilesButtonRef = useRef<TopicFilesButtonRef>(null)

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
				// Read the store at invocation time so content-type folders (including PPT)
				// receive the complete path metadata needed by their preview renderer.
				previewDetailPopupRef.current?.open(
					detail,
					projectFilesStore.workspaceFileTree,
					projectFilesStore.workspaceFilesList,
				)
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

	// Same canvas binding as the desktop page: finds the project's canvas, creates it when missing
	// and keeps its name in step with the project. The canvas tab opens it itself when shown.
	const aiCanvasDocument = useAiCanvasDocument({
		enabled: isAiCanvas,
		projectId: selectedProject?.id,
		projectName: selectedProject?.project_name,
		isReadOnly: isReadonly,
		attachments: attachmentTree,
		attachmentLoadState: projectFilesStore.attachmentLoadState,
		projectFilesStore,
		openCanvas: noopOpenCanvas,
	})
	// Read at send time so a new topic's first message binds the canvas, as on desktop.
	const getAiCanvasMentionItems = useMemoizedFn(() => aiCanvasDocument.canvasMentionItems)

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
		// AI canvas: the same items as the web canvas project card (pin too, no move).
		hiddenActionKeys: isAiCanvas ? AI_CANVAS_HIDDEN_ACTION_KEYS : undefined,
		showPinInProjectDetail: isAiCanvas,
	})

	// Sending is handled by MessagePanel service now.

	const [topicsPopupOpen, setTopicsPopupOpen] = useState(false)

	// Listen for Create_New_Topic event and handle topic creation
	useCreateTopicListener()

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
				<div className="relative z-40 flex shrink-0 items-center justify-between gap-2 px-3 pt-4">
					<SmoothTabs
						tabs={projectDetailTabs}
						value={activeSiderTab}
						onChange={setActiveSiderTab}
						variant="background"
						showTooltip={false}
						className="h-9 w-max min-w-0 max-w-full rounded-full bg-muted p-[3px]"
						buttonClassName="h-[30px] flex-none rounded-full px-4 text-[14px] leading-5 data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=inactive]:font-normal data-[state=inactive]:text-muted-foreground"
						indicatorClassName="inset-y-[3px] rounded-full border-0 bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						data-testid="project-detail-hero"
					/>
					{activeSiderTab === "topics" && (
						<MobileTopicTypeFilter
							key={selectedProject?.id}
							value={topicType}
							onChange={setTopicType}
						/>
					)}
				</div>
				<div className="relative min-h-0 flex-1 overflow-hidden">
					{activeSiderTab === "canvas" ? (
						// Full width canvas below the tabs, with the same bottom gap as the other panels.
						// Swipe guard: dragging the canvas pans it and must not open the shell sidebar.
						<div
							className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-2 pt-3"
							data-testid="project-detail-canvas-panel"
							data-mobile-shell-swipe-guard="true"
						>
							<div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
								<MobileAiCanvasPanel
									canvasFolder={aiCanvasDocument.canvasFolder}
									isCreating={aiCanvasDocument.isCreating}
									creationError={aiCanvasDocument.creationError}
									onRetry={aiCanvasDocument.retry}
									attachmentTree={attachmentTree}
									attachmentList={attachmentFlatList}
									selectedProject={selectedProject}
									selectedTopic={selectedTopic}
									setUserSelectDetail={setUserSelectDetail}
								/>
							</div>
						</div>
					) : null}
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
					) : null}
					{keepScheduledTasksMounted ? (
						<div
							className={cn(
								"flex h-full min-h-0 flex-col overflow-hidden pb-2",
								activeSiderTab !== "scheduledTasks" && "hidden",
							)}
							aria-hidden={activeSiderTab !== "scheduledTasks"}
							data-testid="project-detail-scheduled-tasks-panel"
						>
							<MobileScheduledTasksPanel
								key={selectedProject?.id}
								className="h-full"
								selectWorkspaceId={
									selectedWorkspace?.id ?? selectedProject?.workspace_id
								}
								selectProjectId={selectedProject?.id}
								selectTopicId={selectedTopic?.id}
							/>
						</div>
					) : null}
					{activeSiderTab === "topics" ? (
						<div
							className="flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-2"
							data-testid="project-detail-topics-panel"
						>
							<ProjectPageMain
								topicType={topicType}
								className="h-full min-h-0 flex-1"
								onTopicMore={(topic) => openActionsPopup(topic, selectedProject)}
								onTopicPin={(topic) => {
									void toggleTopicPin(topic)
								}}
								onTopicDelete={(topic) => deleteTopicDirect(topic, selectedProject)}
							/>
						</div>
					) : null}
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
						isEmptyStatus
						getImplicitMentionItems={isAiCanvas ? getAiCanvasMentionItems : undefined}
						// Same locked design mode as the desktop canvas page and the topic page.
						topicModeLogic={isAiCanvas ? AI_CANVAS_TOPIC_MODE_LOGIC : undefined}
						agentCode={isAiCanvas ? null : undefined}
						showModeToggle={isAiCanvas ? false : undefined}
						showModelSelector={isAiCanvas ? true : undefined}
						placeholder={isAiCanvas ? tAiCanvas("home.placeholder") : undefined}
						createTopic={createTopicForProjectSend}
						onSendComplete={handleSendComplete}
						onSendSuccess={handleSendSuccess}
					/>
				</div>
			</div>
			<TopicsPopup
				topicType={topicType}
				onTopicTypeChange={setTopicType}
				open={topicsPopupOpen}
				onOpenChange={setTopicsPopupOpen}
				onCreateTopic={handleCreateTopic}
				onOpenActionsPopup={openActionsPopup}
			/>
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={previewDetailPopupRef}
				allowEdit={!isReadonly}
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
				allowEdit={!isReadonly}
				setUserSelectDetail={setUserSelectDetail}
				onClose={() => {
					// Close link popup without any action
				}}
			/>
			<ProjectShareSheet
				open={projectShareSheetOpen}
				onClose={() => setProjectShareSheetOpen(false)}
				projectName={selectedProject?.project_name?.trim() || t("project.unnamedProject")}
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
