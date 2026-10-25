import { useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import TopicSidebar from "@/pages/superMagic/pages/TopicPage/components/TopicSidebar"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import { useTopicDetailPanelController } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicDetailPanelController"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "@/pages/superMagic/pages/TopicPage/hooks/useTopicHistoryLayoutState"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import useStyles from "@/pages/superMagic/pages/Workspace/style"
import { MessageHeaderTopicHistoryPanel } from "@/pages/superMagic/components/MessageHeader"
import type { MessageHeaderTopicActions } from "@/pages/superMagic/components/MessageHeader"
import { SuperMagicApi } from "@/apis"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"
import { useCrewConversationStore } from "./context"
import CrewConversationPanel from "./components/CrewConversationPanel"
import CrewStateView from "./components/CrewStateView"
import type { MagicWidgetConfig } from "@/providers/MagicWidgetProvider/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMagicWidgetPreviewFullscreen } from "./hooks/useMagicWidgetPreviewFullscreen"
import { resolvePreviewConversationTransition } from "./utils/previewLayout"

interface CrewConversationDesktopProps {
	widgetContext?: {
		instanceId: string
		hostOrigin: string
		renderMode?: "inline" | "floating"
	} | null
	widgetConfig?: MagicWidgetConfig
}

/** Renders the desktop Crew layout and forwards optional widget bridge metadata. */
function CrewConversationDesktop({
	widgetContext = null,
	widgetConfig = {},
}: CrewConversationDesktopProps) {
	const { t } = useTranslation("crew/market")
	const { styles } = useStyles()
	const store = useCrewConversationStore()
	const detailRef = useRef<DetailRef>(null)
	const previewSessionActiveRef = useRef(false)
	const [previewSessionKey, setPreviewSessionKey] = useState(0)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	const selectedWorkspace = store.selectedWorkspace
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)
	const isWidgetEmbed = Boolean(widgetContext)
	const showProjectSidebar = !isWidgetEmbed || widgetConfig.conversation?.projectFiles !== false
	const showTopicHistory =
		!isReadOnly && (!isWidgetEmbed || widgetConfig.conversation?.topicHistory !== false)
	const previewMode = isWidgetEmbed
		? (widgetConfig.conversation?.previewMode ?? "switchable")
		: "split"
	const publishPreviewFullscreen = useMagicWidgetPreviewFullscreen(widgetContext)
	const handlePreviewFullscreenChange = useMemoizedFn((isFullscreen: boolean) => {
		// Keep the iframe layout and host shell synchronized from one final state callback.
		setIsDetailPanelFullscreen(isFullscreen)
		publishPreviewFullscreen(isFullscreen)
	})

	useNamedPageTitle({
		entityName: store.agent?.name,
		fallbackName: t("crew/market:crewConversation.unknownCrew"),
		isReady: store.status === "ready" && !!selectedProject,
	})

	const setAttachments = useMemoizedFn((attachments) => {
		store.setAttachments(attachments, store.attachmentList)
	})

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		projects: selectedProject ? [selectedProject] : [],
		workspaces: selectedWorkspace ? [selectedWorkspace] : [],
		attachments: store.attachments,
		setAttachments,
		setUserSelectDetail,
		detailRef,
		isReadOnly,
	})

	const {
		shouldShowDetailPanel,
		isDetailPanelCollapsed,
		collapseDetailPanel,
		expandDetailPanel,
		handleFileClickWithPanel,
		topicFilesPropsWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	} = useTopicDetailPanelController({
		detailRef,
		isReadOnly,
		activeFileId,
		setActiveFileId,
		handleFileClick,
		topicFilesProps,
		attachmentList: store.attachmentList,
	})
	const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
		useTopicHistoryLayoutState({
			storageKey: `${TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.topicPage}.crew-conversation`,
			isEnabled: showTopicHistory,
			persistOpenState: !isWidgetEmbed,
		})

	/** Applies the configured conversation layout only when a new preview session starts. */
	const handlePreviewSessionTabChange = useMemoizedFn(
		(tabType: Parameters<typeof handleActiveDetailTabChange>[0]) => {
			handleActiveDetailTabChange(tabType)
			const transition = resolvePreviewConversationTransition(
				previewMode,
				tabType,
				previewSessionActiveRef.current,
			)
			previewSessionActiveRef.current = transition.isSessionActive
			if (transition.action === "collapse") {
				pubsub.publish(PubSubEvents.Collapse_Topic_Conversation_Panel)
			}
			if (transition.shouldCloseHistoryPanel) {
				closeTopicHistoryPanel()
			}
			if (transition.action === "expand") {
				pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel)
			}
		},
	)

	/** Dismisses the visible preview while retaining FilesViewer tabs and cached renderers. */
	const handlePreviewDismiss = useMemoizedFn(() => {
		detailRef.current?.exitPreviewFullscreen()
		previewSessionActiveRef.current = false
		setPreviewSessionKey((current) => current + 1)
		pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel)
		setActiveFileId(null)
		clearActiveDetailTabType()
		setUserSelectDetail(undefined)
	})

	const mergeCrewTopic = useMemoizedFn((topicId: string, topic: Partial<Topic>) => {
		store.topicStore.mergeTopic(topicId, {
			...topic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: store.agentCode,
		})
	})

	const topicActions = useMemo<MessageHeaderTopicActions>(
		() => ({
			createTopic: async () => {
				await store.createAndSelectNewTopic()
			},
			selectTopic: (topic) => {
				store.setSelectedTopic(topic)
				setUserSelectDetail(undefined)
				clearActiveDetailTabType()
				// Embedded history behaves like a temporary picker; ordinary pages keep existing behavior.
				if (isWidgetEmbed) closeTopicHistoryPanel()
			},
			renameTopic: async ({ topicId, topicName }) => {
				if (!selectedProject?.id) return
				await SuperMagicApi.editTopic({
					id: topicId,
					topic_name: topicName,
					project_id: selectedProject.id,
				})
				store.topicStore.updateTopicName(topicId, topicName)
			},
			deleteTopic: async (topicId) => {
				await SuperMagicApi.deleteTopic({ id: topicId })
				const nextTopics = store.topicList.filter((topic) => topic.id !== topicId)
				store.topicStore.removeTopic(topicId)
				if (store.selectedTopic == null) {
					store.setSelectedTopic(nextTopics[0] ?? null)
				}
			},
			updateTopicName: async (topicId, topicName) => {
				store.topicStore.updateTopicName(topicId, topicName)
			},
			pinTopic: async (topicId) => {
				const response = await SuperMagicApi.pinTopic(topicId)
				mergeCrewTopic(topicId, normalizeTopicHistoryItem(response.topic))
			},
			unpinTopic: async (topicId) => {
				const response = await SuperMagicApi.unpinTopic(topicId)
				mergeCrewTopic(topicId, normalizeTopicHistoryItem(response.topic))
			},
			archiveTopic: async (topicId) => {
				const response = await SuperMagicApi.archiveTopic(topicId)
				mergeCrewTopic(topicId, normalizeTopicHistoryItem(response.topic))
			},
			unarchiveTopic: async (topicId) => {
				const response = await SuperMagicApi.unarchiveTopic(topicId)
				mergeCrewTopic(topicId, normalizeTopicHistoryItem(response.topic))
			},
		}),
		[
			clearActiveDetailTabType,
			closeTopicHistoryPanel,
			isWidgetEmbed,
			mergeCrewTopic,
			selectedProject?.id,
			store,
			store.selectedTopic,
			store.topicList,
		],
	)

	if (store.status !== "ready" || !selectedProject) {
		return <CrewStateView status={store.status} onRetry={() => void store.retryBootstrap()} />
	}

	return (
		<HostConversationProvider selectedProject={selectedProject} topicStore={store.topicStore}>
			<TopicDesktopPanels
				containerClassName={styles.container}
				detailPanelClassName={styles.detailPanel}
				isDetailPanelFullscreen={isDetailPanelFullscreen}
				showProjectSidebar={showProjectSidebar}
				sidebar={
					<TopicSidebar
						selectedProject={selectedProject}
						selectedWorkspace={selectedWorkspace}
						selectedTopic={selectedTopic}
						isReadOnly={isReadOnly}
						topicFilesProps={topicFilesPropsWithPanel}
						hideProjectCard
					/>
				}
				detailPanel={
					<Detail
						ref={detailRef}
						disPlayDetail={userSelectDetail}
						userSelectDetail={userSelectDetail}
						setUserSelectDetail={setUserSelectDetail}
						attachments={store.attachments}
						attachmentList={store.attachmentList}
						topicId={selectedTopic?.id}
						baseShareUrl={`${window.location.origin}/share`}
						currentTopicStatus={selectedTopic?.task_status}
						messages={[]}
						allowEdit={!isReadOnly}
						selectedTopic={selectedTopic}
						selectedProject={selectedProject}
						activeFileId={activeFileId}
						onActiveFileChange={setActiveFileId}
						onActiveTabChange={handlePreviewSessionTabChange}
						onFullscreenChange={handlePreviewFullscreenChange}
						previewMode={previewMode}
						previewSessionKey={previewSessionKey}
						onPreviewDismiss={handlePreviewDismiss}
						onPreviewCollapse={
							isWidgetEmbed || isReadOnly ? undefined : collapseDetailPanel
						}
						onPreviewOpen={isWidgetEmbed ? undefined : expandDetailPanel}
						isPreviewCollapsed={isDetailPanelCollapsed}
						canLocateFile={showProjectSidebar && !isReadOnly}
						persistFileTabs={!isWidgetEmbed}
						projectId={selectedProject.id}
						showFallbackWhenEmpty
						allowDownload
					/>
				}
				isReadOnly={isReadOnly}
				keepDetailMountedWhenHidden
				autoExpandConversationWhenDetailVisible={previewMode !== "switchable"}
				persistConversationPanelState={!isWidgetEmbed}
				historyLayout={
					showTopicHistory
						? {
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
										selectedProject={selectedProject}
										topicStore={store.topicStore}
										topicActions={topicActions}
										isConversationPanelCollapsed={isConversationPanelCollapsed}
										onExpandConversationPanel={onExpandConversationPanel}
										onClose={onClose}
										closeButtonRef={closeButtonRef}
									/>
								),
							}
						: undefined
				}
				shouldShowDetailPanel={shouldShowDetailPanel}
				isDetailPanelCollapsed={isDetailPanelCollapsed}
				onExpandDetailPanel={isWidgetEmbed ? undefined : expandDetailPanel}
				renderMessagePanel={({
					isConversationPanelCollapsed,
					onToggleConversationPanel,
					onExpandConversationPanel,
					historyTriggerMode,
					isHistoryPanelOpen,
					onToggleHistoryPanel,
				}) => (
					<CrewConversationPanel
						widgetContext={widgetContext}
						widgetConfig={widgetConfig}
						variant="desktop"
						isConversationPanelCollapsed={isConversationPanelCollapsed}
						onToggleConversationPanel={onToggleConversationPanel}
						onExpandConversationPanel={onExpandConversationPanel}
						detailPanelVisible={shouldShowDetailPanel}
						showTopicHistory={showTopicHistory}
						historyTriggerMode={isWidgetEmbed ? "layout" : historyTriggerMode}
						isHistoryPanelOpen={
							isWidgetEmbed ? isTopicHistoryPanelOpen : isHistoryPanelOpen
						}
						onToggleHistoryPanel={
							isWidgetEmbed ? toggleTopicHistoryPanel : onToggleHistoryPanel
						}
						topicActions={topicActions}
						onFileClick={handleFileClickWithPanel}
					/>
				)}
			/>
		</HostConversationProvider>
	)
}

export default observer(CrewConversationDesktop)
