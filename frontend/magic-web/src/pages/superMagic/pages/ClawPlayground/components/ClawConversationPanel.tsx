import { useMemo } from "react"
import type { JSONContent } from "@tiptap/react"
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
import { type TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
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

export interface ClawConversationPanelProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	detailPanelVisible?: boolean
	clawCode?: string
	onOpenSkillsPanel?: () => void
}

export const ClawConversationPanel = observer(function ClawConversationPanel({
	isConversationPanelCollapsed = false,
	detailPanelVisible = true,
	clawCode,
	onToggleConversationPanel,
	onOpenSkillsPanel,
}: ClawConversationPanelProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const store = useClawPlaygroundStore()
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	const topicStore = store.topicStore
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
			if (currentTopic?.id && lastMessageNode?.status) {
				store.updateTopicStatus(currentTopic.id, lastMessageNode?.status)
			}
		},
	})

	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
		})

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode: clawCode,
		isTaskRunning: showLoading,
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
				<div className="mb-2">
					<MessageQueue
						queue={messageQueue.queue}
						queueStats={messageQueue.queueStats}
						editingQueueItem={messageQueue.editingQueueItem}
						onRemoveMessage={messageQueue.removeFromQueue}
						onSendMessage={messageQueue.sendQueuedMessage}
						onStartEdit={messageQueue.startEditQueueItem}
						onCancelEdit={messageQueue.cancelEditQueueItem}
					/>
				</div>
			) : null

		return { messageQueueNode }
	}, [
		messageQueue.queue,
		messageQueue.queueStats,
		messageQueue.editingQueueItem,
		messageQueue.removeFromQueue,
		messageQueue.sendQueuedMessage,
		messageQueue.startEditQueueItem,
		messageQueue.cancelEditQueueItem,
	])

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
			topicModelStore,
			enableMessageSendByContent: true,
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.MagiClaw,
					extra: { agent_code: clawCode },
				})
				return mergedParams
			},
			queueContext: {
				editingQueueItem: messageQueue.editingQueueItem,
				addToQueue: messageQueue.addToQueue,
				finishEditQueueItem: messageQueue.finishEditQueueItem,
			},
			size: detailPanelVisible ? "small" : "default",
		}
	}, [
		clawCode,
		selectedProject,
		selectedTopic,
		showLoading,
		store.mentionPanelStore,
		store.projectFilesStore,
		store.projectStore.setSelectedProject,
		store.selectedWorkspace,
		store.workspaceStore.setSelectedWorkspace,
		topicModelStore,
		topicStore,
		messageQueue.editingQueueItem,
		messageQueue.addToQueue,
		messageQueue.finishEditQueueItem,
		detailPanelVisible,
	])

	const messageListProviderValue = useClawPlaygroundMessageListContextValue({
		setSelectedTopic: topicStore.setSelectedTopic,
		magicClaw: store.magicClaw,
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
				<div className="flex w-full flex-col gap-2">
					<ClawPlaygroundInputToolbar
						variant="desktop"
						isTaskRunning={showLoading}
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
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
			// stickyMessageClassName="top-0"
		/>
	)
})
