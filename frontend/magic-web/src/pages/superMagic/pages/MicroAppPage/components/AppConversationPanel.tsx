import { useMemo, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useTranslation } from "react-i18next"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import { MicroAppConversationEmptyIllustration } from "@/pages/superMagic/components/MicroAppStateIllustration"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { messageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import {
	isTopicTaskRunning,
	isTopicWaitingForUser,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "../../Workspace/TopicMode"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { userStore } from "@/models/user"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import MessageQueue from "@/pages/superMagic/components/MessagePanel/components/MessageQueue"
import useMessageQueue from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import MessageHeader from "@/pages/superMagic/components/MessageHeader"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { useRefreshTopicDetailOnTaskComplete } from "@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete"
import { useScopedTopicReadProgress } from "@/pages/superMagic/hooks/useScopedTopicReadProgress"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import { useAppStore } from "../context"
import {
	resolveMicroAppModelSelectionMode,
	resolveMicroAppRuntimeModelSelectionMode,
} from "../utils/microAppModelMode"
import type { RevokedMessageEditorContext } from "@/pages/superMagic/components/MessageList/revoked-editor-context"
import MessageListFallback from "@/pages/superMagic/components/MessageList/components/MessageListFallback"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import { ModeToggle, useCreateTopicListener } from "@/pages/superMagic/components/TopicMode"
import MicroAppRuntimeMentionHint from "./MicroAppRuntimeMentionHint"
import { usePinnedCurrentMicroAppMention } from "../hooks/usePinnedCurrentMicroAppMention"
import { insertCurrentMicroAppMention } from "../utils/insertCurrentMicroAppMention"

interface AppConversationPanelProps {
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
	mentionPanelStore: MentionPanelStore
	projectFilesStore: ProjectFilesStore
	onTerminalTopicStatusChange?: () => void
	onSelectDetail?: (detail: unknown) => void
	onFileClick?: (fileItem: unknown) => void
	hideConversationPanelToggle?: boolean
	trailingActions?: ReactNode
	/** Only the micro-app editor's development conversation is locked to the internal mode. */
	lockToMicroAppMode?: boolean
	microAppId?: string
	microAppName?: string
}

function AppConversationPanel({
	selectedProject,
	topicStore,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
	mentionPanelStore,
	projectFilesStore,
	onTerminalTopicStatusChange,
	onSelectDetail,
	onFileClick,
	hideConversationPanelToggle = false,
	trailingActions,
	lockToMicroAppMode = true,
	microAppId,
	microAppName,
}: AppConversationPanelProps) {
	const { conversation } = useAppStore()
	// Runtime chats pin this app at the @ panel root so users can mention it.
	usePinnedCurrentMicroAppMention({
		mentionPanelStore,
		enabled: !lockToMicroAppMode,
		appId: microAppId,
		appName: microAppName,
	})
	const selectedTopic = topicStore.selectedTopic
	const selectableTopicMode = useTopicMode({ selectedTopic, selectedProject })
	const topicMode = lockToMicroAppMode ? TopicMode.MicroApp : selectableTopicMode.topicMode
	const agentCode = lockToMicroAppMode
		? undefined
		: resolveAgentSelection(topicMode, selectedTopic?.agent_code).agentCode
	const modelTopicMode = lockToMicroAppMode
		? resolveMicroAppModelSelectionMode()
		: resolveMicroAppRuntimeModelSelectionMode(topicMode, agentCode)
	// Development conversations are always handled by the micro-app agent. Keep shared editor
	// callbacks scoped so project-level employee preferences cannot change this runtime.
	const keepMicroAppMode = useMemoizedFn((mode: TopicMode) => void mode)
	const setTopicMode = lockToMicroAppMode ? keepMicroAppMode : selectableTopicMode.setTopicMode
	const recoverTopicMode = lockToMicroAppMode
		? keepMicroAppMode
		: selectableTopicMode.recoverTopicMode

	// Create-topic events must select on this panel's store.
	useCreateTopicListener({
		selectedProject,
		topicStore,
	})
	const handleCreateTopicForMode = useMemoizedFn((mode: TopicMode) => {
		pubsub.publish(PubSubEvents.Create_New_Topic, { topicMode: mode })
	})

	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])

	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: topicStore.updateTopic,
	})

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode: modelTopicMode,
		agentCode,
		topicModelStore: sharedTopicModelStore,
	})

	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
		})

	const { handleTopicMessagesChange } = useScopedTopicReadProgress({
		scopeName: "AppConversationPanel",
		topicStore,
		selectedTopic,
		isSelectedTopicMessagesReady,
		onTerminalTopicStatusChange,
	})

	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		onConversationGeneratingChange: conversation.setConversationGenerating,
		onTopicMessagesChange: handleTopicMessagesChange,
	})
	const isTaskRunning = showLoading || isTopicTaskRunning(selectedTopic)

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode,
		isTaskRunning,
		isWaitingForUser: isTopicWaitingForUser(selectedTopic),
		isEmptyStatus: false,
		isShowLoadingInit: isMessagesInitialLoading,
	})
	const handleMentionHintClick = useMemoizedFn(() => {
		insertCurrentMicroAppMention(messageQueue.editorRef.current?.editor, {
			appId: microAppId,
			appName: microAppName,
		})
	})

	const mergeMicroAppSendParams = useMemoizedFn(
		({ defaultParams }: { defaultParams: HandleSendParams }) => {
			const extra = { ...(defaultParams.extra ?? {}) }
			delete extra.agent_code

			return {
				...defaultParams,
				topicMode: TopicMode.MicroApp,
				extra: Object.keys(extra).length > 0 ? extra : undefined,
			}
		},
	)

	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			messageSendService.sendContent({
				content,
				options,
				showLoading: messages.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					topicStore,
					setSelectedTopic: topicStore.setSelectedTopic,
				}),
			})

			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		},
	)

	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo: userStore.user.userInfo,
	})

	const topicActions = useScopedMessageHeaderTopicActions({
		selectedProject,
		selectedTopic,
		topicStore,
	})

	const editorNodes = useMemo<SceneEditorNodes>(() => {
		const messageQueueNode =
			messageQueue.queue.length > 0 ? (
				<div className="mb-2">
					<MessageQueue
						queue={messageQueue.queue}
						editorRef={messageQueue.editorRef}
						queueStats={messageQueue.queueStats}
						onRemoveMessage={messageQueue.removeFromQueue}
						onSendMessage={messageQueue.sendQueuedMessage}
						onStartEdit={messageQueue.startEditQueueItem}
						onWithdraw={messageQueue.withdrawQueueItem}
						onMove={messageQueue.moveQueueItem}
						isOperationPending={messageQueue.isQueueOperationPending}
					/>
				</div>
			) : null

		return { messageQueueNode }
	}, [messageQueue])

	const editorContext = useMemo<SceneEditorContext>(() => {
		return {
			draftKey: createMessageEditorDraftKey({
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			topicMode,
			modelTopicMode,
			agentCode,
			setTopicMode,
			recoverTopicMode,
			topicStore,
			setSelectedTopic: topicStore.setSelectedTopic,
			mentionPanelStore,
			projectFilesStore,
			attachments: projectFilesStore.workspaceFileTree,
			topicModelStore,
			layoutConfig: DEFAULT_LAYOUT_CONFIG,
			// Panel owns ModeToggle so the composer does not patch the old topic.
			showModeToggle: false,
			showTopicExamplesPortal: !lockToMicroAppMode,
			showLoading,
			size: detailPanelVisible ? "small" : "default",
			onSendComplete: ({ success, currentProject, currentTopic }) => {
				if (!success) return

				applyOptimisticTopicRunningState({
					topicStore,
					topic: currentTopic ?? topicStore.selectedTopic,
					project: currentProject ?? selectedProject,
				})
			},
			mergeSendParams: lockToMicroAppMode ? mergeMicroAppSendParams : undefined,
			editorRef: messageQueue.editorRef,
			queueContext: messageQueue,
			enableMessageSendByContent: true,
		}
	}, [
		selectedProject,
		selectedTopic,
		topicMode,
		modelTopicMode,
		agentCode,
		setTopicMode,
		recoverTopicMode,
		topicStore,
		mentionPanelStore,
		projectFilesStore,
		topicModelStore,
		showLoading,
		messageQueue,
		mergeMicroAppSendParams,
		lockToMicroAppMode,
		detailPanelVisible,
	])

	const revokedEditorContext = useMemo<RevokedMessageEditorContext>(() => {
		return {
			selectedProject,
			setSelectedTopic: topicStore.setSelectedTopic,
			topicMode,
			modelTopicMode,
			agentCode,
			setTopicMode,
			recoverTopicMode,
			topicStore,
			mentionPanelStore,
			projectFilesStore,
			topicModelStore,
			mergeSendParams: lockToMicroAppMode ? mergeMicroAppSendParams : undefined,
		}
	}, [
		selectedProject,
		topicStore,
		topicMode,
		modelTopicMode,
		agentCode,
		setTopicMode,
		recoverTopicMode,
		mentionPanelStore,
		projectFilesStore,
		topicModelStore,
		mergeMicroAppSendParams,
		lockToMicroAppMode,
	])

	const messageListProviderValue = useMemo(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: topicStore.setSelectedTopic,
			projectFilesStore,
		}
	}, [projectFilesStore, topicStore.setSelectedTopic])

	// Keep the composer inset symmetric inside the narrow conversation rail.
	return (
		<ConversationPanelScaffold
			scope="app-conversation-panel"
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			header={
				<MessageHeader
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					onToggleConversationPanel={onToggleConversationPanel}
					onExpandConversationPanel={onExpandConversationPanel}
					detailPanelVisible={detailPanelVisible}
					hideConversationPanelToggle={hideConversationPanelToggle}
					selectedProject={selectedProject}
					topicStore={topicStore}
					topicActions={topicActions}
					// Preview/published topics can be employees; hide icons in development.
					hideTopicListModeIcon={lockToMicroAppMode}
					historyTriggerMode={historyTriggerMode}
					isHistoryPanelOpen={isHistoryPanelOpen}
					onToggleHistoryPanel={onToggleHistoryPanel}
					trailingActions={trailingActions}
				/>
			}
			emptyHero={
				lockToMicroAppMode ? (
					<AppConversationEmptyState variant="hero" className="w-full" />
				) : (
					// Runtime chats reuse the workspace greeting, not the development empty.
					<MessageListFallback className="h-full" />
				)
			}
			emptyCompact={
				lockToMicroAppMode ? (
					<AppConversationEmptyState variant="compact" />
				) : (
					<MessageListFallback className="h-full" />
				)
			}
			editor={
				<div className="flex h-full min-h-0 w-full flex-none flex-col items-stretch gap-2 self-stretch pt-3">
					{/* Preserve the scaffold height so the editor can fill the manually resized panel. */}
					{/* <div className="flex px-1">
						<MicroAppIssuePromptPanel variant="desktop" />
					</div> */}
					{/* Runtime chats can pick an employee; development stays locked. */}
					{lockToMicroAppMode ? null : (
						<div className="flex w-full shrink-0 items-center overflow-hidden px-1">
							<ModeToggle
								size={detailPanelVisible ? "small" : "default"}
								topicMode={topicMode}
								agentCode={agentCode ?? selectedTopic?.agent_code}
								allowChangeMode={messages.length === 0}
								onModeChange={setTopicMode}
								onCreateTopic={handleCreateTopicForMode}
							/>
						</div>
					)}
					<DefaultMessageEditorContainer editorContext={editorContext} />
					{lockToMicroAppMode ? null : (
						<MicroAppRuntimeMentionHint
							className="px-1"
							onClick={handleMentionHintClick}
						/>
					)}
				</div>
			}
			editorNodes={editorNodes}
			messageListProviderValue={messageListProviderValue}
			messages={messages as SuperMagicMessageItem[]}
			selectedTopic={selectedTopic}
			setSelectedDetail={onSelectDetail}
			onFileClick={onFileClick}
			enableRevokedUserMessageReedit
			revokedEditorContext={revokedEditorContext}
			handlePullMoreMessage={handlePullMoreMessage}
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
			className="rounded-none bg-sidebar pb-2 pr-2"
		/>
	)
}

function AppConversationEmptyState({
	className,
	variant,
}: {
	className?: string
	variant: "compact" | "hero"
}) {
	const { t } = useTranslation("super")

	return (
		<ConversationEmptyState
			className={className}
			icon={<AppConversationEmptyIcon variant={variant} />}
			title={t("microAppPage.conversation.emptyTitle")}
			subtitle={t("microAppPage.conversation.emptyDescription")}
			variant={variant}
			testId={`micro-app-conversation-empty-${variant}`}
		/>
	)
}

function AppConversationEmptyIcon({ variant }: { variant: "compact" | "hero" }) {
	return (
		<MicroAppConversationEmptyIllustration
			size={variant === "hero" ? "md" : "sm"}
			testId={`micro-app-conversation-empty-${variant}-illustration`}
		/>
	)
}

export default observer(AppConversationPanel)
