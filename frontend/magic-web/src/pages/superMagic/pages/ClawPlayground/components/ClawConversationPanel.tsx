import { useMemo } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { merge } from "lodash-es"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import MessageQueue from "@/pages/superMagic/components/MessagePanel/components/MessageQueue"
import useMessageQueue from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { shouldCheckAttachmentsOnTaskStatus } from "@/pages/superMagic/services/topicStatusSyncService"
import {
	isTopicTaskRunning,
	isTopicWaitingForUser,
	TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "../../Workspace/TopicMode"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { userStore } from "@/models/user"
import { DEFAULT_LAYOUT_CONFIG } from "../../../components/MessageEditor/constants/constant"
import { ClawConversationPanelHeader } from "./ClawConversationPanelHeader"
import { ClawHeroIcon } from "./ClawHeroIcon"
import { useClawPlaygroundStore } from "../context"
import {
	type AutoSendInitialClawMessagePayload,
	useAutoSendInitialClawMessage,
} from "../hooks/useAutoSendInitialClawMessage"
import { useClawPlaygroundMessageListContextValue } from "../hooks/useClawPlaygroundMessageListContextValue"
import { ClawPlaygroundInputToolbar } from "./ClawPlaygroundInputToolbar"
import { dispatchClawNewChatSlash } from "../utils/dispatchClawNewChatSlash"
import { useClawConversationAnalytics } from "../hooks/useClawConversationAnalytics"

export interface ClawConversationPanelProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	detailPanelVisible?: boolean
	clawCode?: string
	onOpenSkillsPanel?: () => void
	onTerminalTopicStatusChange?: () => void
}

export const ClawConversationPanel = observer(function ClawConversationPanel({
	isConversationPanelCollapsed = false,
	detailPanelVisible = true,
	clawCode,
	onToggleConversationPanel,
	onOpenSkillsPanel,
	onTerminalTopicStatusChange,
}: ClawConversationPanelProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const store = useClawPlaygroundStore()
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	useClawConversationAnalytics(selectedTopic?.id)
	const topicStore = store.topicStore
	const attachments = store.projectFilesStore.workspaceFileTree
	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])
	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore: store.mentionPanelStore,
			}),
		[store.mentionPanelStore],
	)

	const { messages, showLoading } = useTopicConversationLoading<TaskStatus>({
		selectedTopic,
		onConversationGeneratingChange: store.setConversationGenerating,
		onTopicMessagesChange: ({ lastMessageNode, selectedTopic: currentTopic }) => {
			const nextStatus = lastMessageNode?.status as TaskStatus | undefined
			if (currentTopic?.id && nextStatus) {
				const hasStatusChanged = nextStatus !== currentTopic.task_status
				store.updateTopicStatus(currentTopic.id, nextStatus)
				if (hasStatusChanged && shouldCheckAttachmentsOnTaskStatus(nextStatus)) {
					onTerminalTopicStatusChange?.()
				}
			}
		},
	})
	const isTaskRunning = showLoading || isTopicTaskRunning(selectedTopic)

	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
		})

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode: clawCode,
		isTaskRunning,
		isWaitingForUser: isTopicWaitingForUser(selectedTopic),
		isEmptyStatus: false,
		isShowLoadingInit: isMessagesInitialLoading,
	})

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode: TopicMode.Default,
		topicModelStore: sharedTopicModelStore,
	})

	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			scopedMessageSendService.sendContent({
				content,
				options,
				showLoading: messages.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedProject: store.projectStore.setSelectedProject,
					setSelectedTopic: topicStore.setSelectedTopic,
					setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
					topicStore,
				}),
			})

			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		},
	)

	const handleClawNewChatSlash = useMemoizedFn(() => {
		dispatchClawNewChatSlash({
			scopedMessageSendService,
			store,
			topicStore,
			topicModelStore,
			selectedProject,
			selectedTopic,
			messagesLength: messages.length,
			showLoading,
			clawCode,
		})
	})

	const handleAutoSendInitialClawMessage = useMemoizedFn(
		({ jsonContent, options }: AutoSendInitialClawMessagePayload) => {
			if (!selectedProject || !selectedTopic) return

			scopedMessageSendService.dispatchMessage({
				jsonContent,
				options,
				showLoading: messages.length > 1 && showLoading,
				selectedProject,
				selectedTopic,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedProject: store.projectStore.setSelectedProject,
					setSelectedTopic: topicStore.setSelectedTopic,
					setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
					topicStore,
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

	useAutoSendInitialClawMessage({
		selectedTopicId: selectedTopic?.id,
		agentCode: clawCode,
		isMessagesReady: isSelectedTopicMessagesReady,
		isModelLoading: topicModelStore.isLoading,
		messageCount: messages.length,
		selectedModel: topicModelStore.selectedLanguageModel,
		onAutoSend: handleAutoSendInitialClawMessage,
	})

	const editorNodes = useMemo<SceneEditorNodes>(() => {
		const messageQueueNode =
			messageQueue.queue.length > 0 ? (
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
			selectedWorkspace: store.selectedWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: store.projectStore.setSelectedProject,
			setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
			topicMode: TopicMode.Default,
			topicStore,
			layoutConfig: DEFAULT_LAYOUT_CONFIG,
			showLoading,
			mentionPanelStore: store.mentionPanelStore,
			projectFilesStore: store.projectFilesStore,
			attachments,
			topicModelStore,
			enableMessageSendByContent: true,
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.MagiClaw,
					extra: { agent_code: clawCode },
				})
				return mergedParams
			},
			editorRef: messageQueue.editorRef,
			queueContext: messageQueue,
			size: detailPanelVisible ? "small" : "default",
		}
	}, [
		clawCode,
		selectedProject,
		selectedTopic,
		showLoading,
		store.mentionPanelStore,
		store.projectFilesStore,
		attachments,
		store.projectStore.setSelectedProject,
		store.selectedWorkspace,
		store.workspaceStore.setSelectedWorkspace,
		topicModelStore,
		topicStore,
		messageQueue,
		detailPanelVisible,
	])

	const messageListProviderValue = useClawPlaygroundMessageListContextValue({
		setSelectedTopic: topicStore.setSelectedTopic,
		magicClaw: store.magicClaw,
		projectFilesStore: store.projectFilesStore,
	})
	const emptyStateSubtitle = t("superLobster.workspace.emptyHeroSubtitle", clawBrandValues)

	function renderEmptyStateTitle() {
		return (
			<div className="flex items-center justify-center gap-[2px] leading-none tracking-[-0.02em]">
				<span className="font-semibold text-foreground">
					{t("superLobster.workspace.emptyHeroLead", clawBrandValues)}
				</span>
				<span className="font-black text-red-500">
					{t("superLobster.workspace.emptyHeroAccent", clawBrandValues)}
				</span>
			</div>
		)
	}

	return (
		<ConversationPanelScaffold
			scope="claw-playground-conversation"
			rootTestId="claw-playground-conversation-panel"
			editorTestId="claw-playground-conversation-editor"
			desktopComposerShell
			header={
				<ClawConversationPanelHeader
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					onToggleConversationPanel={onToggleConversationPanel}
					detailPanelVisible={detailPanelVisible}
					taskStatus={selectedTopic?.task_status}
				/>
			}
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			emptyHero={
				<ConversationEmptyState
					className="w-full"
					icon={<ClawHeroIcon testId="claw-playground-conversation-empty-hero-icon" />}
					iconSoundEnabled={false}
					title={renderEmptyStateTitle()}
					subtitle={emptyStateSubtitle}
					variant="hero"
					testId="claw-playground-conversation-empty"
				/>
			}
			emptyCompact={
				<ConversationEmptyState
					icon={
						<ClawHeroIcon
							className="scale-75"
							testId="claw-playground-conversation-empty-compact-icon"
						/>
					}
					iconSoundEnabled={false}
					title={renderEmptyStateTitle()}
					subtitle={emptyStateSubtitle}
					variant="compact"
					testId="claw-playground-conversation-empty-compact"
				/>
			}
			editor={
				<div className="flex h-full min-h-0 w-full flex-col gap-1.5">
					{/* Preserve resized height while keeping the toolbar close to the editor. */}
					<ClawPlaygroundInputToolbar
						variant="desktop"
						isTaskRunning={isTaskRunning}
						onNewChat={handleClawNewChatSlash}
						onOpenSkills={() => onOpenSkillsPanel?.()}
					/>
					<DefaultMessageEditorContainer editorContext={editorContext} />
				</div>
			}
			editorNodes={editorNodes}
			messageListProviderValue={messageListProviderValue}
			messages={messages as SuperMagicMessageItem[]}
			selectedTopic={selectedTopic}
			handlePullMoreMessage={handlePullMoreMessage}
			historyLoadThresholdPx={30}
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
			resizeHandlePositionClassName="-top-2.5"
		/>
	)
})
