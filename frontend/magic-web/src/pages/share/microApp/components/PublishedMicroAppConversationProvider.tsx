import {
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	Suspense,
	type ReactNode,
} from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { SuperMagicApi } from "@/apis"
import type { MicroAppRuntimeProject } from "@/apis/modules/superMagic/microApps"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { MessageHeaderTopicHistoryPanel } from "@/pages/superMagic/components/MessageHeader"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import {
	AppStoreProvider,
	useAppStore,
	useOptionalAppStore,
} from "@/pages/superMagic/pages/MicroAppPage/context"
import { COLLAPSED_RAIL_WIDTH_PX } from "@/pages/superMagic/pages/MicroAppPage/layoutConstants"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { ProjectFilesStore } from "@/stores/projectFiles"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { userStore } from "@/models/user"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"

import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createSessionFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { usePublishedRuntimePreview } from "@/pages/share/microApp/hooks/usePublishedRuntimePreview"

import PublishedMicroAppSidebar, { type PublishedMicroAppPanel } from "./PublishedMicroAppSidebar"
import { useMicroAppAuthentication } from "../hooks/useMicroAppAuthentication"
import magicToast from "@/components/base/MagicToaster/utils"
import { useMemoizedFn } from "ahooks"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	normalizeUpdateAttachmentsPayload,
	type SuperMagicUpdateAttachmentsRequest,
} from "@/pages/superMagic/services/attachmentsTopicSync"

const RUNTIME_PROJECT_LOAD_SUPERSEDED = "Runtime project load superseded"

// Keep the mobile composer out of desktop/share-page bundles until the user opens it.
const MicroAppMobileConversation = lazy(
	() => import("@/pages/superMagic/pages/MicroAppPage/components/MicroAppMobileConversation"),
)
const MicroAppConversationFloatingButton = lazy(
	() =>
		import("@/pages/superMagic/pages/MicroAppPage/components/MicroAppMobileConversation/MicroAppConversationFloatingButton"),
)

interface PublishedMicroAppConversationProviderProps {
	appId: string
	appName?: string
	/** Older published mappings may not include the source organization. */
	sourceOrganizationCode?: string
	enabled?: boolean
	children: ReactNode
}

interface PublishedMicroAppConversationSurfaceProps {
	appId: string
	appName?: string
	sourceOrganizationCode?: string
	/** Editor preview already owns a usage conversation; do not hydrate development. */
	preferUsageConversation?: boolean
	children: ReactNode
}

const PublishedMicroAppConversationSurface = observer(
	function PublishedMicroAppConversationSurface({
		appId,
		appName,
		sourceOrganizationCode,
		preferUsageConversation = false,
		children,
	}: PublishedMicroAppConversationSurfaceProps) {
		const [panel, setPanel] = useState<PublishedMicroAppPanel>("conversation")
		const [mobileConversationOpen, setMobileConversationOpen] = useState(false)
		const isMobile = useIsMobile()
		const appStore = useAppStore()
		const conversation = preferUsageConversation
			? appStore.usageConversation
			: appStore.conversation
		const requireAuthentication = useMicroAppAuthentication()
		const { t } = useTranslation("super")
		const authorization = userStore.user.authorization?.trim() || ""
		const currentOrganizationCode = userStore.user.organizationCode?.trim() || ""
		const normalizedSourceOrganizationCode = sourceOrganizationCode?.trim() || ""
		const isSameOrganization = Boolean(
			currentOrganizationCode &&
			normalizedSourceOrganizationCode &&
			currentOrganizationCode === normalizedSourceOrganizationCode,
		)
		const [runtimeProject, setRuntimeProject] = useState<ProjectListItem | null>(null)
		const [runtimeProjectState, setRuntimeProjectState] = useState<
			"loading" | "absent" | "ready"
		>("loading")
		// Fail closed while authentication or the runtime binding is unconfirmed.
		const shouldShowRuntimeSidebar = Boolean(
			authorization &&
			isSameOrganization &&
			runtimeProject &&
			runtimeProjectState === "ready",
		)
		const runtimeRequestIdRef = useRef(0)
		const ensurePromiseRef = useRef<Promise<{
			selectedProject: ProjectListItem
			topicStore: typeof conversation.topicStore
		}> | null>(null)
		const ensurePromiseAppIdRef = useRef<string | null>(null)
		const ownProjectFilesStore = useMemo(() => new ProjectFilesStore(), [])
		const projectFilesStore = preferUsageConversation
			? appStore.runtimeProjectFilesStore
			: ownProjectFilesStore
		const ownMentionPanelStore = useMemo(
			() => createMentionPanelStore(ownProjectFilesStore),
			[ownProjectFilesStore],
		)
		const mentionPanelStore = preferUsageConversation
			? appStore.runtimeMentionPanelStore
			: ownMentionPanelStore

		// Synchronize runtime project attachments across realtime WebSocket updates,
		// task completion polling, and pubsub events. This ensures MarkdownLink components
		// in the message list stay enabled when files are generated or modified.
		const handleAttachmentsChange = useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData(
					{ tree, list },
					{ preserveList: true },
				)
				projectFilesStore.setWorkspaceFileTree(processedData.tree, {
					list: processedData.list,
					source: "PublishedMicroApp.attachmentsChange",
				})
			},
			[projectFilesStore],
		)

		const { checkNowDebounced: checkAttachmentsNowDebounced } = useAttachmentsPolling({
			projectId: runtimeProject?.id,
			store: projectFilesStore,
			autoStart: false,
			onAttachmentsChange: handleAttachmentsChange,
			onError: useMemoizedFn((error: unknown) => {
				console.error("Failed to poll published micro-app attachments:", error)
			}),
		})

		useProjectAttachmentsChangeRealtime({
			projectId: runtimeProject?.id,
			store: projectFilesStore,
			onAttachmentsChange: handleAttachmentsChange,
			onFallbackError: useMemoizedFn((error: unknown) => {
				console.error("Failed to refresh realtime published micro-app attachments:", error)
			}),
		})

		useEffect(() => {
			let cancelled = false
			const handleUpdateAttachments = (
				payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
			) => {
				const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)
				const pid = runtimeProject?.id
				if (!pid) {
					payload.callback?.()
					return
				}
				if (payload.projectId && payload.projectId !== pid) {
					// Another subscriber owns this project; do not complete its wait.
					return
				}
				loadProjectAttachments({
					projectId: pid,
					enableErrorMessagePrompt: false,
				})
					.then((attachmentResult) => {
						if (!cancelled) {
							handleAttachmentsChange(attachmentResult)
						}
						payload.callback?.()
					})
					.catch((error) => {
						console.error("Failed to refresh published micro-app attachments:", error)
						payload.callback?.()
					})
			}

			pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
			return () => {
				cancelled = true
				pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
			}
		}, [handleAttachmentsChange, runtimeProject?.id])

		// Runtime attachments belong to the current user, independently of the source share.
		const runtimeFileAccess = useMemo(
			() =>
				createSessionFileAccess({
					projectId: runtimeProject?.id,
					topicId: conversation.topicStore.selectedTopic?.id ?? "",
				}),
			[runtimeProject?.id, conversation.topicStore.selectedTopic?.id],
		)
		const topicActions = useScopedMessageHeaderTopicActions({
			selectedProject: runtimeProject,
			selectedTopic: conversation.topicStore.selectedTopic,
			topicStore: conversation.topicStore,
		})
		const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
			useTopicHistoryLayoutState({
				storageKey: `${TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.microApp}.published`,
				isEnabled: runtimeProjectState === "ready",
				persistOpenState: false,
			})
		const {
			handleSelectDetail,
			handleOpenFile,
			openPreviewDetail,
			previewPopup,
			fileManagerPopup,
		} = usePublishedRuntimePreview({
			enabled: shouldShowRuntimeSidebar,
			selectedProject: runtimeProject,
			selectedTopic: conversation.topicStore.selectedTopic,
			fileTree: projectFilesStore.workspaceFileTree,
			fileList: projectFilesStore.workspaceFilesList,
			attachmentLoadState: projectFilesStore.attachmentLoadState,
		})

		const loadRuntimeProject = useCallback(
			async (project: Pick<MicroAppRuntimeProject, "id">, isCurrent: () => boolean) => {
				await conversation.loadProjectContext(project.id, { isCurrent })
				if (!isCurrent()) return null
				const loadedProject = conversation.selectedProject
				if (!loadedProject) throw new Error("Runtime project could not be loaded")
				projectFilesStore.setSelectedProject(loadedProject)
				projectFilesStore.setAttachmentLoadStatus(loadedProject.id, "loading")
				try {
					const attachmentResult = await loadProjectAttachments({
						projectId: loadedProject.id,
						// Runtime-project files use the authenticated session. The share token
						// belongs to the published origin project and would force the loader
						// to read share resource files instead of this runtime project.
						enableErrorMessagePrompt: false,
					})
					if (!isCurrent()) return null
					handleAttachmentsChange(attachmentResult)
					projectFilesStore.setAttachmentLoadStatus(loadedProject.id, "ready")
				} catch (error) {
					if (!isCurrent()) return null
					// File loading should not hide an otherwise valid runtime conversation.
					console.error("Failed to load published micro-app attachments:", error)
					projectFilesStore.setWorkspaceFileTree([])
					projectFilesStore.setAttachmentLoadStatus(loadedProject.id, "error")
				}
				setRuntimeProject(loadedProject)
				setRuntimeProjectState("ready")
				return loadedProject
			},
			[conversation, handleAttachmentsChange, projectFilesStore],
		)

		useEffect(() => {
			// Every appId gets a version so old responses cannot update the new preview.
			const requestId = ++runtimeRequestIdRef.current
			const isCurrent = () =>
				runtimeRequestIdRef.current === requestId &&
				(userStore.user.authorization?.trim() || "") === authorization &&
				(userStore.user.organizationCode?.trim() || "") === currentOrganizationCode &&
				(sourceOrganizationCode?.trim() || "") === normalizedSourceOrganizationCode
			setRuntimeProject(null)
			setRuntimeProjectState(authorization ? "loading" : "absent")
			// Anonymous browsing must not call session APIs, which can trigger a login redirect.
			if (authorization && isSameOrganization)
				void SuperMagicApi.getMicroAppRuntimeProject(appId, {
					enableErrorMessagePrompt: false,
				})
					.then(async (result) => {
						if (!isCurrent()) return
						if (result.exists && result.project)
							await loadRuntimeProject(result.project, isCurrent)
						else if (isCurrent()) setRuntimeProjectState("absent")
					})
					.catch(() => {
						if (isCurrent()) setRuntimeProjectState("absent")
					})
			return () => {
				runtimeRequestIdRef.current += 1
				ensurePromiseRef.current = null
				ensurePromiseAppIdRef.current = null
				setRuntimeProject(null)
				conversation.reset()
				projectFilesStore.setSelectedProject(null)
			}
		}, [
			appId,
			authorization,
			conversation,
			currentOrganizationCode,
			isSameOrganization,
			loadRuntimeProject,
			projectFilesStore,
			normalizedSourceOrganizationCode,
			sourceOrganizationCode,
		])

		const ensureConversation = async () => {
			const initialRequestId = runtimeRequestIdRef.current
			await requireAuthentication()
			if ((userStore.user.authorization?.trim() || "") !== authorization) {
				throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
			}
			// Published micro-app conversations are intentionally limited to the source organization.
			// Treat missing organization context as unsupported so no runtime request can escape the gate.
			const liveOrganizationCode = userStore.user.organizationCode?.trim() || ""
			if (
				!liveOrganizationCode ||
				!normalizedSourceOrganizationCode ||
				liveOrganizationCode !== normalizedSourceOrganizationCode
			) {
				const message = t("microAppShare.crossOrganizationConversationUnsupported")
				magicToast.error(message)
				throw new Error(message)
			}
			if (ensurePromiseRef.current && ensurePromiseAppIdRef.current === appId) {
				return ensurePromiseRef.current
			}
			// Authentication is async; the preview may have unmounted while awaiting it.
			if (runtimeRequestIdRef.current !== initialRequestId) {
				throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
			}
			if (runtimeProject && conversation.selectedProject?.id === runtimeProject.id) {
				return { selectedProject: runtimeProject, topicStore: conversation.topicStore }
			}
			const requestId = ++runtimeRequestIdRef.current
			const isCurrent = () =>
				runtimeRequestIdRef.current === requestId &&
				(userStore.user.authorization?.trim() || "") === authorization &&
				(userStore.user.organizationCode?.trim() || "") === liveOrganizationCode &&
				(sourceOrganizationCode?.trim() || "") === normalizedSourceOrganizationCode
			setRuntimeProject(null)
			setRuntimeProjectState("loading")
			const promise = (async () => {
				const result = await SuperMagicApi.ensureMicroAppRuntimeProject(appId)
				if (!isCurrent()) throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
				const loadedProject = await loadRuntimeProject(result.project, isCurrent)
				if (!isCurrent() || !loadedProject) throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
				// Return the hydrated project, not the ensure API stub.
				return { selectedProject: loadedProject, topicStore: conversation.topicStore }
			})()
			ensurePromiseRef.current = promise
			ensurePromiseAppIdRef.current = appId
			try {
				return await promise
			} finally {
				if (ensurePromiseRef.current === promise) {
					ensurePromiseRef.current = null
					ensurePromiseAppIdRef.current = null
				}
			}
		}

		if (isMobile) {
			return (
				<HostConversationProvider
					selectedProject={runtimeProject}
					topicStore={conversation.topicStore}
					ensureConversation={ensureConversation}
					requireAuthentication={requireAuthentication}
				>
					{/* Keep the floating entry anchored to the preview while the conversation lives in a drawer. */}
					<div
						className="relative h-full min-h-0 w-full"
						data-testid="published-micro-app-mobile-surface"
					>
						{children}
						{shouldShowRuntimeSidebar ? (
							<Suspense fallback={null}>
								<MicroAppConversationFloatingButton
									onClick={() => setMobileConversationOpen(true)}
								/>
							</Suspense>
						) : null}
						{shouldShowRuntimeSidebar ? (
							<FileAccessProvider value={runtimeFileAccess}>
								{mobileConversationOpen ? (
									<Suspense fallback={null}>
										<MicroAppMobileConversation
											open={mobileConversationOpen}
											selectedProject={runtimeProject}
											topicStore={conversation.topicStore}
											mentionPanelStore={mentionPanelStore}
											projectFilesStore={projectFilesStore}
											attachments={projectFilesStore.workspaceFileTree}
											onSelectDetail={handleSelectDetail}
											onOpenFile={handleOpenFile}
											onOpenChange={setMobileConversationOpen}
											onTerminalTopicStatusChange={
												checkAttachmentsNowDebounced
											}
											lockToMicroAppMode={false}
											microAppId={appId}
											microAppName={appName}
										/>
									</Suspense>
								) : null}
								{previewPopup}
								{fileManagerPopup}
							</FileAccessProvider>
						) : null}
					</div>
				</HostConversationProvider>
			)
		}

		return (
			<HostConversationProvider
				selectedProject={runtimeProject}
				topicStore={conversation.topicStore}
				ensureConversation={ensureConversation}
				requireAuthentication={requireAuthentication}
			>
				<TopicDesktopPanels
					containerClassName="h-full w-full overflow-hidden"
					detailPanelClassName="h-full w-full"
					detailResizeHandleClassName="border-l border-border"
					isDetailPanelFullscreen={false}
					sidebar={null}
					detailPanel={children}
					isReadOnly={!shouldShowRuntimeSidebar}
					showProjectSidebar={false}
					showProjectResizeHandle={false}
					autoExpandConversationWhenDetailVisible={false}
					initialConversationPanelCollapsed
					collapsedConversationPanelWidth={COLLAPSED_RAIL_WIDTH_PX}
					persistConversationPanelState={false}
					historyOverlayScope="container"
					historyLayout={{
						isOpen: isTopicHistoryPanelOpen,
						onClose: closeTopicHistoryPanel,
						onToggle: toggleTopicHistoryPanel,
						renderPanel: ({
							isConversationPanelCollapsed,
							onExpandConversationPanel,
							onClose,
							closeButtonRef,
						}) => (
							<MessageHeaderTopicHistoryPanel
								selectedProject={runtimeProject}
								topicStore={conversation.topicStore}
								topicActions={topicActions}
								isConversationPanelCollapsed={isConversationPanelCollapsed}
								onExpandConversationPanel={() => {
									setPanel("conversation")
									onExpandConversationPanel()
								}}
								onClose={onClose}
								closeButtonRef={closeButtonRef}
							/>
						),
					}}
					shouldShowDetailPanel
					renderMessagePanel={({
						isConversationPanelCollapsed,
						onToggleConversationPanel,
						onExpandConversationPanel,
						historyTriggerMode,
						isHistoryPanelOpen,
						onToggleHistoryPanel,
					}) => (
						<FileAccessProvider value={runtimeFileAccess}>
							<PublishedMicroAppSidebar
								panel={panel}
								onPanelChange={setPanel}
								appId={appId}
								appName={appName}
								ensureProject={ensureConversation}
								onCloseHistory={closeTopicHistoryPanel}
								selectedProject={runtimeProject}
								topicStore={conversation.topicStore}
								mentionPanelStore={mentionPanelStore}
								projectFilesStore={projectFilesStore}
								detailPanelVisible
								isConversationPanelCollapsed={isConversationPanelCollapsed}
								onToggleConversationPanel={onToggleConversationPanel}
								onExpandConversationPanel={onExpandConversationPanel}
								onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
								historyTriggerMode={historyTriggerMode}
								isHistoryPanelOpen={isHistoryPanelOpen}
								onToggleHistoryPanel={onToggleHistoryPanel}
								onSelectDetail={handleSelectDetail}
								onFileClick={handleOpenFile}
								onOpenPreview={openPreviewDetail}
							/>
							{previewPopup}
							{fileManagerPopup}
						</FileAccessProvider>
					)}
				/>
			</HostConversationProvider>
		)
	},
)

function PublishedMicroAppConversationProvider({
	appId,
	appName,
	sourceOrganizationCode,
	enabled = true,
	children,
}: PublishedMicroAppConversationProviderProps) {
	const existingStore = useOptionalAppStore()
	if (!enabled) return <>{children}</>
	const surface = (
		<PublishedMicroAppConversationSurface
			key={appId}
			appId={appId}
			appName={appName}
			sourceOrganizationCode={sourceOrganizationCode}
			preferUsageConversation={Boolean(existingStore)}
		>
			{children}
		</PublishedMicroAppConversationSurface>
	)
	if (existingStore) return surface
	// Share page has no MicroAppPageController; prefetch default models here.
	return (
		<AppStoreProvider>
			<PublishedMicroAppDefaultModelPrefetch />
			{surface}
		</AppStoreProvider>
	)
}

function PublishedMicroAppDefaultModelPrefetch() {
	useDefaultModeModelListRefreshOnMount()
	return null
}

export default PublishedMicroAppConversationProvider
