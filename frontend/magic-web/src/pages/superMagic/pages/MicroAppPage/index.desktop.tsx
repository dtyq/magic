import MicroAppPermissionsProvider from "./components/MicroAppPermissionsProvider"
import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useSize } from "ahooks"

import Detail from "@/pages/superMagic/components/Detail"
import type { HtmlPermissionManagerHandle } from "@/pages/superMagic/components/Detail/contents/HTML/hooks/useHtmlPermissionManagerBridge"
import MagicModal from "@/components/base/MagicModal"
import { getToolDetailSelectionTarget } from "@/pages/superMagic/components/MessageList/components/Nodes/toolDetailSelection"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import { SharePermissionResourceProvider } from "@/pages/superMagic/components/Share/SharePermissionResourceContext"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { cn } from "@/utils/cn"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"

import MicroAppDesktopConversationPanels from "./components/MicroAppDesktopConversationPanels"
import MicroAppPreviewWorkspace from "./components/MicroAppPreviewWorkspace"
import MicroAppHeader from "./components/MicroAppHeader"
import MicroAppDesktopRoute from "./components/MicroAppDesktopRoute"
import MicroAppEntryPreview from "./components/MicroAppEntryPreview"
import MicroAppPreviewPages from "./components/MicroAppPreviewPages"
import MicroAppNoOpenPages from "./components/MicroAppNoOpenPages"
import MicroAppFallbackState from "./components/MicroAppFallbackState"
import MicroAppPageOverlays from "./components/MicroAppPageOverlays"
import MicroAppPageLoadingState from "./components/MicroAppPageLoadingState"
import MicroAppPreviewToolbar from "./components/MicroAppPreviewToolbar"
import MicroAppProjectPanels from "./components/MicroAppProjectPanels"
import MicroAppWorkspaceNav, { type MicroAppWorkspaceView } from "./components/MicroAppWorkspaceNav"
import type { MicroAppPageMode } from "./components/MicroAppModeSwitcher"
import { useUserSpacePreview } from "./hooks/useUserSpacePreview"
import { useMicroAppMessageFileOpen } from "./hooks/useMicroAppMessageFileOpen"
import { useMicroAppPageController } from "./hooks/useMicroAppPageController"
import { useMicroAppPreviewFiles } from "./hooks/useMicroAppPreviewFiles"
import * as layout from "./layoutConstants"
import { shouldOpenMessageFileInFilesWorkspace } from "./utils/microAppPreviewPopup"

function MicroAppPageInner({
	appId,
	projectId,
	isPublished,
	onPublishStatusChange,
}: {
	appId: string
	projectId: string
	isPublished: boolean
	onPublishStatusChange: (published: boolean) => void
}) {
	const { t } = useTranslation("super")
	const [activeView, setActiveView] = useState<MicroAppWorkspaceView>("preview")
	// 首次打开文件后保留 Detail；返回应用预览只隐藏它，避免卸载用户文件草稿。
	const fileDetailVisited = useRef(false)
	if (activeView !== "preview") fileDetailVisited.current = true
	const [previewMode, setPreviewMode] = useState<"desktop" | "phone">("desktop")
	const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)
	const [isAIEditActive, setIsAIEditActive] = useState(false)
	const [isDevConsoleActive, setIsDevConsoleActive] = useState(false)
	const [isDevConsoleAvailable, setIsDevConsoleAvailable] = useState(false)
	const aiEditHandlerRef = useRef<(() => void) | null>(null)
	const devConsoleToggleHandlerRef = useRef<(() => void) | null>(null)
	const workspacePanelsRef = useRef<HTMLDivElement>(null)
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const workspacePanelsSize = useSize(workspacePanelsRef)
	const workspaceWidthPx = workspacePanelsSize?.width || window.innerWidth
	const messagePanelMaxWidthPx = Math.max(
		layout.MESSAGE_PANEL_MIN_PX,
		Math.floor(workspaceWidthPx * layout.MESSAGE_PANEL_MAX_WIDTH_RATIO),
	)
	const controller = useMicroAppPageController(appId, projectId)
	const {
		store,
		conversation,
		ensureUsageProject,
		sourceOrganizationCode,
		canUseDevelopment,
		selectedProject,
		selectedTopic,
		hasRunningTopic,
		isReadOnly,
		canEdit,
		canPublish,
		attachments,
		attachmentList,
		activeFileId,
		userSelectDetail,
		setUserSelectDetail,
		defaultEntryFile,
		detailRef,
		topicFilesProps,
		handleActiveFileChange,
		handleBackToMicroApps,
		handleOpenPublishDialog,
		handleFileTabsCacheLoaded,
		checkAttachmentsNowDebounced,
		publishDialogOpen,
		setPublishDialogOpen,
		setPublishedDefaultOpenFileId,
		editDialogOpen,
		setEditDialogOpen,
		editSubmitting,
		CollaboratorUpdatePanel,
		canManageCollaborators,
		handleManageCollaborators,
		handleProjectNameChange,
		captureCoverReady,
		handleCaptureCover,
		handleEditMicroApp,
	} = controller
	const developmentConversation = store.developmentConversation ?? conversation
	const [pageMode, setPageMode] = useState<MicroAppPageMode>("development")
	const [htmlPermissionManager, setHtmlPermissionManager] =
		useState<HtmlPermissionManagerHandle | null>(null)
	const pageModeRef = useRef<MicroAppPageMode>("development")
	const usageConversationRequestedRef = useRef(false)
	const previewModeRequestRef = useRef<Promise<boolean> | null>(null)
	const panelConversation =
		pageMode === "development"
			? developmentConversation
			: (store.usageConversation ?? developmentConversation)
	const panelSelectedProject = pageMode === "development" ? selectedProject : store.runtimeProject

	useEffect(() => {
		if (selectedProject?.id && canUseDevelopment === false) {
			pageModeRef.current = "preview"
			usageConversationRequestedRef.current = true
			setPageMode("preview")
		}
	}, [canUseDevelopment, selectedProject?.id])

	const previewBrowser = useMicroAppPreviewFiles({
		attachmentList,
		defaultEntryFile,
		scopeKey: projectId,
		allowCloseLastTab: true,
	})
	const { previewEntryFile } = previewBrowser

	const topicActions = useScopedMessageHeaderTopicActions({
		selectedProject: panelSelectedProject,
		selectedTopic: panelConversation.topicStore.selectedTopic,
		topicStore: panelConversation.topicStore,
	})
	const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
		useTopicHistoryLayoutState({
			storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.microApp,
			isEnabled: !isReadOnly,
		})
	const handlePageModeChange = useMemoizedFn((nextMode: MicroAppPageMode) => {
		if (nextMode === "development" && !canUseDevelopment) return
		if (nextMode === "preview") closeTopicHistoryPanel()
		pageModeRef.current = nextMode
		usageConversationRequestedRef.current = nextMode === "preview"
		store.setConversationType(nextMode === "preview" ? "usage" : "development")
		setPageMode(nextMode)
	})
	const requestPreviewMode = useMemoizedFn(async () => {
		if (pageModeRef.current === "preview" || usageConversationRequestedRef.current) return true
		if (previewModeRequestRef.current) return previewModeRequestRef.current

		const request = new Promise<boolean>((resolve) => {
			const modal = MagicModal.confirm({
				title: t("microAppPage.conversation.switchToPreviewTitle"),
				content: t("microAppPage.conversation.switchToPreviewDescription"),
				okText: t("microAppPage.conversation.switchToPreviewConfirm"),
				cancelText: t("microAppPage.conversation.switchToPreviewCancel"),
				closable: false,
				maskClosable: false,
				centered: true,
				onOk: () => {
					pageModeRef.current = "preview"
					usageConversationRequestedRef.current = true
					store.setConversationType("usage")
					closeTopicHistoryPanel()
					setPageMode("preview")
					modal.destroy()
					resolve(true)
				},
				onCancel: () => {
					modal.destroy()
					resolve(false)
				},
			})
		})
		previewModeRequestRef.current = request
		try {
			return await request
		} finally {
			previewModeRequestRef.current = null
		}
	})
	const ensureHostConversation = useMemoizedFn(async () => {
		if (!usageConversationRequestedRef.current && pageModeRef.current === "development") {
			if (!(await requestPreviewMode()))
				throw new Error(t("microAppPage.conversation.switchToPreviewCancelled"))
		}

		if (usageConversationRequestedRef.current) {
			return ensureUsageProject()
		}

		return panelSelectedProject
			? {
					selectedProject: panelSelectedProject,
					topicStore: developmentConversation.topicStore,
				}
			: null
	})

	// 折叠仅用于当前详情页的临时布局，重新进入微应用时始终展示对话上下文。
	const [isMessagePanelCollapsed, setIsMessagePanelCollapsed] = useState(false)
	// 此页面不使用 TopicDesktopPanels，需要自行响应 iframe 消息的展开通知。
	useEffect(() => {
		const expandMessagePanel = () => setIsMessagePanelCollapsed(false)
		pubsub.subscribe(PubSubEvents.Expand_Topic_Conversation_Panel, expandMessagePanel)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Expand_Topic_Conversation_Panel, expandMessagePanel)
		}
	}, [])
	// 数据表格需要更宽的工作区；只恢复系统自动收起的状态，不覆盖用户手动操作。
	const messagePanelCollapsedBeforeDatabaseRef = useRef(false)
	const databaseAutoCollapsedRef = useRef(false)

	const toggleMessagePanelCollapse = useMemoizedFn(() => {
		if (activeView === "database") databaseAutoCollapsedRef.current = false
		setIsMessagePanelCollapsed((previous) => !previous)
	})
	const handleToggleMessagePanelCollapse = useMemoizedFn(() => {
		if (!isMessagePanelCollapsed) closeTopicHistoryPanel()
		toggleMessagePanelCollapse()
	})
	const handleWorkspaceViewChange = useMemoizedFn((nextView: MicroAppWorkspaceView) => {
		if (nextView !== "preview") setIsPreviewFullscreen(false)

		if (activeView === "database" && nextView !== "database") {
			if (databaseAutoCollapsedRef.current) {
				setIsMessagePanelCollapsed(messagePanelCollapsedBeforeDatabaseRef.current)
			}
			databaseAutoCollapsedRef.current = false
		}

		if (activeView !== "database" && nextView === "database") {
			messagePanelCollapsedBeforeDatabaseRef.current = Boolean(isMessagePanelCollapsed)
			if (!isMessagePanelCollapsed) {
				closeTopicHistoryPanel()
				setIsMessagePanelCollapsed(true)
				databaseAutoCollapsedRef.current = true
			}
		}

		setActiveView(nextView)
		if (nextView === "preview" && defaultEntryFile) {
			detailRef.current?.openFileTab(defaultEntryFile)
		}
	})
	const handleRegisterAIEdit = useMemoizedFn((handler: (() => void) | null) => {
		aiEditHandlerRef.current = handler
	})
	const handleRegisterDevConsoleToggle = useMemoizedFn((handler: (() => void) | null) => {
		devConsoleToggleHandlerRef.current = handler
		setIsDevConsoleAvailable(Boolean(handler))
	})
	const handleOpenEditDialog = useMemoizedFn(() => {
		setEditDialogOpen(true)
	})
	const showFilesView = useMemoizedFn(() => {
		setActiveView("files")
	})
	const setPreviewDetail = useMemoizedFn((detail: unknown) => {
		if (!detail || typeof detail !== "object") return
		previewDetailPopupRef.current?.open(detail as PreviewDetail, attachments, attachmentList)
	})
	// File-target cards publish Open_File_Tab; only tool details use the popup.
	const handleConversationSelectDetail = useMemoizedFn((detail: unknown) => {
		if (getToolDetailSelectionTarget(detail) === "file") return
		setPreviewDetail(detail)
	})
	const setLinkPreviewDetail = useMemoizedFn((detail: unknown) => {
		if (!detail || typeof detail !== "object") return
		linkPreviewPopupRef.current?.open(detail as PreviewDetail, attachments, attachmentList)
	})
	const { handleUserFileClick } = useUserSpacePreview({
		detailRef,
		isFilesViewActive: activeView === "files" || activeView === "userSpace",
		showFilesView,
	})

	useMicroAppMessageFileOpen({
		attachmentList,
		detailRef,
		isFilesViewActive: activeView === "files" || activeView === "userSpace",
		showFilesView,
		enabled: shouldOpenMessageFileInFilesWorkspace(pageMode),
	})

	useEffect(() => {
		messagePanelCollapsedBeforeDatabaseRef.current = false
		databaseAutoCollapsedRef.current = false
		setIsMessagePanelCollapsed(false)
		setActiveView("preview")
		pageModeRef.current = "development"
		usageConversationRequestedRef.current = false
		setPageMode("development")
		setPreviewMode("desktop")
		setIsPreviewFullscreen(false)
	}, [projectId, setIsMessagePanelCollapsed])

	useEffect(() => {
		if (previewBrowser.activePreviewTabId) return
		// An empty editor has no document-owned toolbar actions or permission panel.
		aiEditHandlerRef.current = null
		devConsoleToggleHandlerRef.current = null
		setIsAIEditActive(false)
		setIsDevConsoleActive(false)
		setIsDevConsoleAvailable(false)
		setHtmlPermissionManager(null)
	}, [previewBrowser.activePreviewTabId])

	useEffect(() => {
		if (!isPreviewFullscreen) return undefined

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsPreviewFullscreen(false)
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [isPreviewFullscreen])

	useEffect(() => {
		if (activeView === "files" && defaultEntryFile) {
			detailRef.current?.openFileTab(defaultEntryFile)
		}
	}, [activeView, defaultEntryFile, detailRef])

	const {
		width: sidebarWidthPx,
		isDragging: isDraggingSidebar,
		handleResizeStart: onSidebarResizeStart,
	} = useResizablePanel({
		minWidth: layout.SIDEBAR_MIN_PX,
		maxWidth: layout.SIDEBAR_MAX_PX,
		defaultWidth: layout.SIDEBAR_DEFAULT_PX,
		storageKey: layout.MICRO_APP_SIDEBAR_STORAGE_KEY,
		direction: "left",
	})
	const {
		width: messagePanelWidthPx,
		isDragging: isDraggingMessagePanel,
		handleResizeStart: onMessagePanelResizeStart,
	} = useResizablePanel({
		minWidth: layout.MESSAGE_PANEL_MIN_PX,
		maxWidth: messagePanelMaxWidthPx,
		defaultWidth: layout.MESSAGE_PANEL_DEFAULT_PX,
		storageKey: layout.MICRO_APP_MESSAGE_PANEL_STORAGE_KEY,
		direction: "right",
	})

	if (store.initLoading) {
		return <MicroAppPageLoadingState testId="micro-app-project-loading" />
	}

	if (store.initError) {
		return <MicroAppFallbackState variant="load" onBack={handleBackToMicroApps} />
	}

	return (
		<HostConversationProvider
			selectedProject={panelSelectedProject}
			topicStore={panelConversation.topicStore}
			ensureConversation={ensureHostConversation}
			requestPreviewMode={requestPreviewMode}
		>
			<MicroAppPermissionsProvider
				appId={appId}
				projectId={projectId}
				attachmentList={attachmentList}
			>
				<FileAccessProvider>
					<div
						className={cn(
							"flex h-full w-full flex-col rounded-lg border border-border bg-background",
							isPreviewFullscreen ? "overflow-visible" : "overflow-hidden",
						)}
						data-testid="micro-app-page"
					>
						<MicroAppHeader
							selectedProject={selectedProject}
							hasEntries={Boolean(defaultEntryFile)}
							canPublish={canPublish}
							isPublished={isPublished}
							onBack={handleBackToMicroApps}
							onPublish={handleOpenPublishDialog}
							canEdit={canEdit}
							onEdit={handleOpenEditDialog}
							canManageCollaborators={canManageCollaborators}
							onManageCollaborators={handleManageCollaborators}
							canManageHtmlPermissions={Boolean(htmlPermissionManager)}
							onManageHtmlPermissions={() => htmlPermissionManager?.open()}
							canUseDevelopment={canUseDevelopment}
							pageMode={pageMode}
							onPageModeChange={handlePageModeChange}
						/>

						<div
							ref={workspacePanelsRef}
							className={cn(
								"flex min-h-0 flex-1",
								isPreviewFullscreen ? "overflow-visible" : "overflow-hidden",
							)}
						>
							{pageMode === "preview" ? (
								<MicroAppPreviewWorkspace
									appId={appId}
									entryFile={defaultEntryFile}
									attachments={attachments}
									attachmentList={attachmentList}
									projectId={projectId}
									selectedProject={selectedProject}
									sourceOrganizationCode={sourceOrganizationCode}
									storageMarkerId={defaultEntryFile?.file_id}
									onHtmlPermissionManagerChange={setHtmlPermissionManager}
								/>
							) : (
								<>
									<MicroAppWorkspaceNav
										activeView={activeView}
										databaseDisabled={!selectedProject?.id}
										projectPanelDisabled={!selectedProject?.id}
										hideScheduledTasks={isReadOnly}
										onViewChange={handleWorkspaceViewChange}
									/>

									<main
										className={cn(
											"relative h-full min-w-0 flex-1",
											isPreviewFullscreen
												? "overflow-visible"
												: "overflow-hidden",
										)}
									>
										{/* Use display:none for the inactive view: FilesViewer can set visibility on descendants. */}
										<div
											className={cn(
												"inset-0 min-w-0 overflow-hidden",
												isPreviewFullscreen
													? "fixed z-detail-fullscreen h-dvh w-screen bg-background"
													: "absolute",
												activeView === "preview" ||
													activeView === "files" ||
													activeView === "userSpace"
													? "flex"
													: "hidden",
											)}
											aria-hidden={
												activeView !== "preview" &&
												activeView !== "files" &&
												activeView !== "userSpace"
											}
											data-fullscreen={isPreviewFullscreen ? "true" : "false"}
											data-testid="micro-app-preview-workspace"
										>
											{activeView === "files" ||
											activeView === "userSpace" ? (
												<>
													<aside
														className="flex h-full shrink-0 flex-col overflow-hidden bg-background"
														style={{ width: sidebarWidthPx }}
														data-testid="micro-app-file-sidebar"
													>
														<div className="min-h-0 flex-1 overflow-hidden py-1">
															{activeView === "userSpace" ? (
																<MicroAppProjectPanels
																	placement="sidebar"
																	activeView={activeView}
																	projectId={selectedProject?.id}
																	projectName={
																		selectedProject?.project_name
																	}
																	topicId={selectedTopic?.id}
																	activeUserFileId={activeFileId}
																	onUserFileClick={
																		handleUserFileClick
																	}
																/>
															) : (
																<TopicFilesButton
																	{...topicFilesProps}
																	showFileManager
																	title={t(
																		"microAppPage.header.codeFiles",
																	)}
																/>
															)}
														</div>
													</aside>
													<TopicResizeHandle
														withDivider
														onResizeStart={onSidebarResizeStart}
														className={
															isDraggingSidebar
																? "before:opacity-100"
																: undefined
														}
													/>
												</>
											) : null}

											<div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
												{/* Keep preview documents alive when visiting files, skills, or database panels. */}
												<div
													className={cn(
														"flex h-full min-h-0 flex-col",
														activeView !== "preview" && "hidden",
													)}
												>
													<MicroAppPreviewToolbar
														viewMode={previewMode}
														browser={previewBrowser}
														allowEdit={
															!isReadOnly && Boolean(previewEntryFile)
														}
														aiEditActive={isAIEditActive}
														devConsoleActive={isDevConsoleActive}
														devConsoleAvailable={isDevConsoleAvailable}
														isFullscreen={isPreviewFullscreen}
														onViewModeChange={setPreviewMode}
														onRefresh={
															previewBrowser.handlePreviewRefresh
														}
														onAIEdit={() =>
															aiEditHandlerRef.current?.()
														}
														onDevConsoleToggle={() =>
															devConsoleToggleHandlerRef.current?.()
														}
														onFullscreenToggle={() =>
															setIsPreviewFullscreen(
																(previous) => !previous,
															)
														}
													/>
													<div className="min-h-0 flex-1 overflow-hidden">
														<MicroAppPreviewPages
															browser={previewBrowser}
														>
															{({ tab, active, onOpenFile }) => (
																<MicroAppEntryPreview
																	entryFile={tab.file}
																	onOpenFile={onOpenFile}
																	attachments={attachments}
																	attachmentList={attachmentList}
																	projectId={projectId}
																	selectedProject={
																		selectedProject
																	}
																	allowEdit={!isReadOnly}
																	viewMode={previewMode}
																	refreshKey={tab.revision}
																	storageMarkerId={
																		defaultEntryFile?.file_id
																	}
																	onRegisterAIEdit={
																		active
																			? handleRegisterAIEdit
																			: undefined
																	}
																	onAIEditActiveChange={
																		active
																			? setIsAIEditActive
																			: undefined
																	}
																	onRegisterDevConsoleToggle={
																		active
																			? handleRegisterDevConsoleToggle
																			: undefined
																	}
																	onDevConsoleActiveChange={
																		active
																			? setIsDevConsoleActive
																			: undefined
																	}
																	onHtmlPermissionManagerChange={
																		active
																			? setHtmlPermissionManager
																			: undefined
																	}
																	isBuilding={hasRunningTopic}
																/>
															)}
														</MicroAppPreviewPages>
														{!previewBrowser.previewTabs.length &&
															defaultEntryFile && (
																<MicroAppNoOpenPages />
															)}
														{!previewBrowser.previewTabs.length &&
															!defaultEntryFile && (
																<MicroAppEntryPreview
																	entryFile={null}
																	attachments={attachments}
																	attachmentList={attachmentList}
																	selectedProject={
																		selectedProject
																	}
																	allowEdit={!isReadOnly}
																	isBuilding={hasRunningTopic}
																/>
															)}
													</div>
												</div>
												{fileDetailVisited.current && (
													<div
														className={cn(
															"h-full min-h-0 flex-1",
															activeView === "preview" && "hidden",
														)}
													>
														<Detail
															className="my-2"
															ref={detailRef}
															disPlayDetail={userSelectDetail}
															userSelectDetail={userSelectDetail}
															setUserSelectDetail={
																setUserSelectDetail
															}
															attachments={attachments}
															attachmentList={attachmentList}
															topicId={selectedTopic?.id}
															baseShareUrl={`${window.location.origin}/share`}
															currentTopicStatus={
																selectedTopic?.task_status
															}
															messages={[]}
															allowEdit={!isReadOnly}
															selectedTopic={selectedTopic}
															selectedProject={selectedProject}
															activeFileId={activeFileId}
															onActiveFileChange={
																handleActiveFileChange
															}
															projectId={selectedProject?.id}
															showFileHeader
															showFileFooter={false}
															showFallbackWhenEmpty
															onFileTabsCacheLoaded={
																handleFileTabsCacheLoaded
															}
														/>
													</div>
												)}
											</div>
										</div>

										<MicroAppProjectPanels
											activeView={activeView}
											attachmentList={attachmentList}
											canEdit={canEdit}
											projectId={selectedProject?.id}
											projectRole={selectedProject?.user_role}
											workspaceId={selectedProject?.workspace_id}
											workspaceName={selectedProject?.workspace_name}
											projectName={selectedProject?.project_name}
											topicId={selectedTopic?.id}
										/>
									</main>

									{canUseDevelopment !== false ? (
										<MicroAppDesktopConversationPanels
											selectedProject={panelSelectedProject}
											topicStore={panelConversation.topicStore}
											mentionPanelStore={store.mentionPanelStore}
											projectFilesStore={store.projectFilesStore}
											topicActions={topicActions}
											isMessagePanelCollapsed={isMessagePanelCollapsed}
											isMessagePanelDragging={isDraggingMessagePanel}
											messagePanelWidthPx={messagePanelWidthPx}
											isTopicHistoryPanelOpen={isTopicHistoryPanelOpen}
											onMessagePanelResizeStart={onMessagePanelResizeStart}
											onTerminalTopicStatusChange={
												checkAttachmentsNowDebounced
											}
											onToggleConversationPanel={
												handleToggleMessagePanelCollapse
											}
											onExpandConversationPanel={() =>
												setIsMessagePanelCollapsed(false)
											}
											onToggleHistoryPanel={toggleTopicHistoryPanel}
											onCloseHistoryPanel={closeTopicHistoryPanel}
											onSelectDetail={handleConversationSelectDetail}
											onExpandCollapsedPanel={toggleMessagePanelCollapse}
											showConversationLabel={t(
												"microAppPage.header.showConversation",
											)}
											lockToMicroAppMode={pageMode === "development"}
										/>
									) : null}
								</>
							)}
						</div>
					</div>

					<MicroAppPageOverlays
						appId={appId}
						projectName={selectedProject?.project_name}
						attachmentList={attachmentList}
						publishDialogOpen={publishDialogOpen}
						onPublishDialogOpenChange={setPublishDialogOpen}
						onPublishStatusChange={onPublishStatusChange}
						onDefaultOpenFileChange={setPublishedDefaultOpenFileId}
						onProjectNameChange={handleProjectNameChange}
						editDialogOpen={editDialogOpen}
						editSubmitting={editSubmitting}
						onEditDialogOpenChange={setEditDialogOpen}
						onEditMicroApp={handleEditMicroApp}
						onCaptureCover={captureCoverReady ? handleCaptureCover : undefined}
						collaboratorPanel={CollaboratorUpdatePanel}
					/>
					<PreviewDetailPopup
						ref={previewDetailPopupRef}
						setUserSelectDetail={setPreviewDetail}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						allowEdit={!isReadOnly}
						onOpenNewPopup={(detail, attachmentTree, nextAttachmentList) => {
							linkPreviewPopupRef.current?.open(
								detail,
								attachmentTree,
								nextAttachmentList,
							)
						}}
					/>
					<PreviewDetailPopup
						ref={linkPreviewPopupRef}
						setUserSelectDetail={setLinkPreviewDetail}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						allowEdit={!isReadOnly}
					/>
				</FileAccessProvider>
			</MicroAppPermissionsProvider>
		</HostConversationProvider>
	)
}

const MicroAppPageInnerObserver = observer(MicroAppPageInner)

function MicroAppPageDesktop() {
	return <MicroAppDesktopRoute Content={MicroAppPageInnerObserver} />
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<SharePermissionResourceProvider value="microApp">
				<MicroAppPageDesktop />
			</SharePermissionResourceProvider>
		</FileAccessProvider>
	)
}
