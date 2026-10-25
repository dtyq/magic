import MicroAppPermissionsProvider from "./components/MicroAppPermissionsProvider"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"

import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import MagicModal from "@/components/base/MagicModal"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { useMobileFilePreviewPubSub } from "@/pages/superMagic/hooks/useMobileFilePreviewPubSub"
import { useMobileMicroAppPreview } from "@/pages/superMagic/hooks/useMobileMicroAppPreview"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { SharePermissionResourceProvider } from "@/pages/superMagic/components/Share/SharePermissionResourceContext"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import MicroAppPreviewPopup from "@/pages/superMagic/components/MicroAppPreviewPopup"
import { getToolDetailSelectionTarget } from "@/pages/superMagic/components/MessageList/components/Nodes/toolDetailSelection"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { cn } from "@/utils/cn"

import MicroAppConversationFloatingButton from "./components/MicroAppMobileConversation/MicroAppConversationFloatingButton"
import MicroAppFallbackState from "./components/MicroAppFallbackState"
import MicroAppMobileHeader from "./components/MicroAppMobileHeader"
import MicroAppMobileModeBar from "./components/MicroAppMobileModeBar"
import MicroAppPageOverlays from "./components/MicroAppPageOverlays"
import MicroAppPageLoadingState from "./components/MicroAppPageLoadingState"
import type { MicroAppPageMode } from "./components/MicroAppModeSwitcher"
import { AppStoreProvider } from "./context"
import { useMicroAppPageController } from "./hooks/useMicroAppPageController"
import { useMicroAppProjectResolver } from "./hooks/useMicroAppProjectResolver"

const MicroAppDatabasePanelMobile = lazy(() => import("./components/MicroAppDatabasePanelMobile"))
const MicroAppMobileConversation = lazy(() => import("./components/MicroAppMobileConversation"))
const MicroAppMobileEntryPreview = lazy(() => import("./components/MicroAppMobileEntryPreview"))

type MobileMicroAppPanel = "preview" | "files"

function MobilePanelTab({
	active,
	label,
	onClick,
	testId,
}: {
	active: boolean
	label: string
	onClick: () => void
	testId: string
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={cn(
				"relative flex h-9 items-center justify-center text-sm transition-colors [-webkit-tap-highlight-color:transparent]",
				active ? "font-medium text-primary" : "text-muted-foreground",
			)}
			data-testid={testId}
		>
			{label}
			<span
				className={cn(
					"absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary transition-opacity",
					active ? "opacity-100" : "opacity-0",
				)}
				aria-hidden
			/>
		</button>
	)
}

function MicroAppPageMobileInner({
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
	const [activePanel, setActivePanel] = useState<MobileMicroAppPanel>("preview")
	const [conversationOpen, setConversationOpen] = useState(false)
	const [previewFileId, setPreviewFileId] = useState<string | null>(null)
	const [pageMode, setPageMode] = useState<MicroAppPageMode>("development")
	const pageModeRef = useRef<MicroAppPageMode>("development")
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const controller = useMicroAppPageController(appId, projectId)
	const {
		store,
		conversation,
		conversationType,
		canUseDevelopment,
		ensureUsageProject,
		handleConversationTypeChange,
		selectedProject,
		selectedTopic,
		hasRunningTopic,
		isReadOnly,
		canEdit,
		canPublish,
		attachments,
		attachmentList,
		defaultEntryFile,
		topicFilesProps,
		handleBackToMicroApps,
		handleOpenPublishDialog,
		handleToggleDatabasePanel,
		checkAttachmentsNowDebounced,
		publishDialogOpen,
		setPublishDialogOpen,
		setPublishedDefaultOpenFileId,
		editDialogOpen,
		setEditDialogOpen,
		editSubmitting,
		isDatabasePanelOpen,
		setIsDatabasePanelOpen,
		CollaboratorUpdatePanel,
		canManageCollaborators,
		handleManageCollaborators,
		handleProjectNameChange,
		captureCoverReady,
		handleCaptureCover,
		handleEditMicroApp,
	} = controller
	const panelSelectedProject = conversation.selectedProject
	const previewModeRequestRef = useRef<Promise<boolean> | null>(null)

	useEffect(() => {
		if (selectedProject?.id && !canUseDevelopment) {
			pageModeRef.current = "preview"
			setPageMode("preview")
		}
	}, [canUseDevelopment, selectedProject?.id])

	const handlePageModeChange = useMemoizedFn((nextMode: MicroAppPageMode) => {
		if (nextMode === "development" && !canUseDevelopment) return
		pageModeRef.current = nextMode
		setPageMode(nextMode)
		setConversationOpen(false)
		if (nextMode === "preview") {
			setActivePanel("preview")
			handleConversationTypeChange("usage")
		} else {
			handleConversationTypeChange("development")
		}
	})

	const requestPreviewMode = useMemoizedFn(async () => {
		if (pageModeRef.current === "preview" || conversationType === "usage") return true
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
					setPageMode("preview")
					setConversationOpen(false)
					setActivePanel("preview")
					handleConversationTypeChange("usage")
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
	const ensureMobileHostConversation = useMemoizedFn(async () => {
		if (conversationType !== "usage" && !(await requestPreviewMode())) {
			throw new Error(t("microAppPage.conversation.switchToPreviewCancelled"))
		}
		return ensureUsageProject()
	})

	const setPreviewDetail = useMemoizedFn((detail: unknown) => {
		if (!detail || typeof detail !== "object") return
		previewDetailPopupRef.current?.open(detail as PreviewDetail, attachments, attachmentList)
	})
	const setLinkPreviewDetail = useMemoizedFn((detail: unknown) => {
		if (!detail || typeof detail !== "object") return
		linkPreviewPopupRef.current?.open(detail as PreviewDetail, attachments, attachmentList)
	})
	const handleSelectDetail = useMemoizedFn((detail: unknown) => {
		if (getToolDetailSelectionTarget(detail) === "file") return
		setPreviewDetail(detail)
	})
	const { handleOpenFile: openFilePreview } = useFileOpen({
		attachments,
		setUserSelectDetail: setPreviewDetail,
	})
	const handlePreviewFile = useMemoizedFn((value?: unknown) => {
		const fileItem = value as AttachmentItem | undefined
		const fileId = fileItem?.file_id
		if (!fileId || fileItem.is_directory) return

		const targetFile = attachmentList.find((item) => item.file_id === fileId) || fileItem
		if (pageModeRef.current === "development") setActivePanel("files")
		setPreviewFileId(fileId)
		openFilePreview(targetFile)
	})

	useMobileFilePreviewPubSub({
		attachmentList,
		setUserSelectDetail: (detail) => {
			if (pageModeRef.current === "development") setActivePanel("files")
			setPreviewDetail(detail)
		},
		onFileClick: handlePreviewFile,
		onPlaybackOpen: setPreviewDetail,
	})
	const microAppPreviewState = useMobileMicroAppPreview()

	useEffect(() => {
		setActivePanel("preview")
		setConversationOpen(false)
		setPreviewFileId(null)
		pageModeRef.current = "development"
		setPageMode("development")
	}, [projectId])

	if (store.initLoading) {
		return <MicroAppPageLoadingState mobile testId="micro-app-mobile-project-loading" />
	}

	if (store.initError) {
		return <MicroAppFallbackState variant="load" mobile onBack={handleBackToMicroApps} />
	}

	return (
		<HostConversationProvider
			selectedProject={panelSelectedProject}
			topicStore={conversation.topicStore}
			ensureConversation={ensureMobileHostConversation}
			requestPreviewMode={requestPreviewMode}
		>
			<MicroAppPermissionsProvider
				appId={appId}
				projectId={projectId}
				attachmentList={attachmentList}
			>
				<FileAccessProvider>
					<div
						className="absolute inset-0 flex h-full min-h-0 w-full flex-col overflow-hidden bg-mobile-background"
						data-testid="micro-app-page-mobile"
					>
						<MicroAppMobileHeader
							selectedProject={selectedProject}
							hasEntries={Boolean(defaultEntryFile)}
							canPublish={canPublish}
							isPublished={isPublished}
							isDatabasePanelOpen={isDatabasePanelOpen}
							onBack={handleBackToMicroApps}
							onToggleDatabasePanel={handleToggleDatabasePanel}
							onPublish={handleOpenPublishDialog}
							canEdit={canEdit}
							onEdit={() => setEditDialogOpen(true)}
							canManageCollaborators={canManageCollaborators}
							onManageCollaborators={handleManageCollaborators}
						/>

						{canUseDevelopment ? (
							<MicroAppMobileModeBar
								value={pageMode}
								onChange={handlePageModeChange}
							/>
						) : null}

						{pageMode === "preview" ? (
							<div
								className="relative min-h-0 flex-1 overflow-hidden bg-background"
								data-testid="micro-app-mobile-runtime-preview-workspace"
							>
								<Suspense fallback={null}>
									<MicroAppMobileEntryPreview
										microAppId={appId}
										microAppName={selectedProject?.project_name}
										entryFile={defaultEntryFile}
										attachments={attachments}
										attachmentList={attachmentList}
										projectId={projectId}
										selectedProject={selectedProject}
										allowEdit={false}
										isBuilding={false}
									/>
								</Suspense>
							</div>
						) : (
							<>
								<div
									className="grid shrink-0 grid-cols-2 border-b border-border bg-background px-3"
									role="tablist"
									aria-label={t("microAppPage.mobileTabs.ariaLabel")}
								>
									<MobilePanelTab
										active={activePanel === "preview"}
										label={t("microAppPage.mobileTabs.preview")}
										onClick={() => setActivePanel("preview")}
										testId="micro-app-mobile-tab-preview"
									/>
									<MobilePanelTab
										active={activePanel === "files"}
										label={t("microAppPage.mobileTabs.files")}
										onClick={() => setActivePanel("files")}
										testId="micro-app-mobile-tab-files"
									/>
								</div>

								<div className="relative min-h-0 flex-1 overflow-hidden bg-background">
									<div
										className={cn(
											"absolute inset-0",
											activePanel !== "preview" && "hidden",
										)}
										data-testid="micro-app-mobile-preview-panel"
									>
										<Suspense fallback={null}>
											<MicroAppMobileEntryPreview
												showOpenPageMenu
												microAppId={appId}
												microAppName={selectedProject?.project_name}
												entryFile={defaultEntryFile}
												attachments={attachments}
												attachmentList={attachmentList}
												projectId={projectId}
												selectedProject={selectedProject}
												allowEdit={!isReadOnly}
												isBuilding={hasRunningTopic}
											/>
										</Suspense>
									</div>

									{activePanel === "files" ? (
										<div
											className="absolute inset-0 overflow-hidden py-1"
											data-testid="micro-app-mobile-files-panel"
										>
											<TopicFilesButton
												{...topicFilesProps}
												title={t("microAppPage.header.codeFiles")}
												activeFileId={previewFileId}
												onFileClick={handlePreviewFile}
											/>
										</div>
									) : null}
								</div>
							</>
						)}

						{!isReadOnly || conversationType === "usage" ? (
							<MicroAppConversationFloatingButton
								onClick={() => setConversationOpen(true)}
							/>
						) : null}
					</div>

					<MicroAppPageOverlays
						appId={appId}
						projectName={selectedProject?.project_name}
						attachmentList={attachmentList}
						mobile
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
					{isDatabasePanelOpen ? (
						<Suspense fallback={null}>
							<MicroAppDatabasePanelMobile
								open={isDatabasePanelOpen}
								projectId={selectedProject?.id}
								projectName={selectedProject?.project_name}
								onOpenChange={setIsDatabasePanelOpen}
							/>
						</Suspense>
					) : null}
					{conversationOpen && (!isReadOnly || conversationType === "usage") ? (
						<Suspense fallback={null}>
							<MicroAppMobileConversation
								open={conversationOpen}
								selectedProject={panelSelectedProject}
								topicStore={conversation.topicStore}
								mentionPanelStore={
									conversationType === "usage"
										? store.runtimeMentionPanelStore
										: store.mentionPanelStore
								}
								projectFilesStore={
									conversationType === "usage"
										? store.runtimeProjectFilesStore
										: store.projectFilesStore
								}
								attachments={
									conversationType === "usage"
										? store.runtimeProjectFilesStore.workspaceFileTree
										: attachments
								}
								onSelectDetail={handleSelectDetail}
								onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
								onOpenFile={handlePreviewFile}
								onOpenChange={setConversationOpen}
								lockToMicroAppMode={pageMode === "development"}
								microAppId={appId}
								microAppName={selectedProject?.project_name}
							/>
						</Suspense>
					) : null}
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
						zIndex={1100}
					/>
					<PreviewDetailPopup
						ref={linkPreviewPopupRef}
						setUserSelectDetail={setLinkPreviewDetail}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						allowEdit={!isReadOnly}
						zIndex={1100}
					/>
					<MicroAppPreviewPopup state={microAppPreviewState} />
				</FileAccessProvider>
			</MicroAppPermissionsProvider>
		</HostConversationProvider>
	)
}

const MicroAppPageMobileInnerObserver = observer(MicroAppPageMobileInner)

function MicroAppPageMobile() {
	const { appId = "" } = useParams<{ appId: string }>()
	const navigate = useNavigate()
	const { projectId, isPublished, setIsPublished, loading, error } =
		useMicroAppProjectResolver(appId)

	useEffect(() => {
		if (!appId) {
			navigate({ name: RouteName.MicroApps, replace: true })
		}
	}, [appId, navigate])

	if (!appId || loading) {
		return <MicroAppPageLoadingState mobile testId="micro-app-mobile-resolver-loading" />
	}

	if (error || !projectId) {
		return (
			<MicroAppFallbackState
				variant={error?.kind === "permission" ? "permission" : "load"}
				mobile
				onBack={() => navigate({ name: RouteName.MicroApps })}
			/>
		)
	}

	return (
		<AppStoreProvider>
			<MicroAppPageMobileInnerObserver
				appId={appId}
				projectId={projectId}
				isPublished={isPublished}
				onPublishStatusChange={setIsPublished}
			/>
		</AppStoreProvider>
	)
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<SharePermissionResourceProvider value="microApp">
				<MicroAppPageMobile />
			</SharePermissionResourceProvider>
		</FileAccessProvider>
	)
}
