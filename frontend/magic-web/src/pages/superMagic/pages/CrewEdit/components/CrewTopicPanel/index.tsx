import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { type ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "../../../Workspace/TopicMode"
import { JSONContent } from "@tiptap/react"
import { observer } from "mobx-react-lite"
import EmptyState from "./components/EmptyState"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useScopedMessageHeaderTopicActions } from "@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { merge } from "lodash-es"
import { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { messageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import MessageQueue from "@/pages/superMagic/components/MessagePanel/components/MessageQueue"
import useMessageQueue from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MessageHeader from "@/pages/superMagic/components/MessageHeader"
import AnimatedEmptyHint from "./components/AnimatedEmptyHint"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { userStore } from "@/models/user"
import { useTranslation } from "react-i18next"
import { useCrewEditStore } from "../../context"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { useRefreshTopicDetailOnTaskComplete } from "@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete"
import { useScopedTopicReadProgress } from "@/pages/superMagic/hooks/useScopedTopicReadProgress"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"

interface CrewTopicPanelProps {
	selectedProject: ProjectListItem | null
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
	topicStore: TopicStore
	crewId: string
	mentionPanelStore: MentionPanelStore
	projectFilesStore: ProjectFilesStore
}

function CrewTopicPanel({
	selectedProject,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
	crewId,
	topicStore,
	mentionPanelStore,
	projectFilesStore,
}: CrewTopicPanelProps) {
	const { t } = useTranslation("crew/create")
	const { conversation } = useCrewEditStore()
	const selectedTopic = topicStore.selectedTopic
	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])

	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: topicStore.updateTopic,
	})

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode: TopicMode.Default,
		topicModelStore: sharedTopicModelStore,
	})
	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
		})
	const { handleTopicMessagesChange } = useScopedTopicReadProgress({
		scopeName: "CrewTopicPanel",
		topicStore,
		selectedTopic,
		isSelectedTopicMessagesReady,
	})
	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		onConversationGeneratingChange: conversation.setConversationGenerating,
		onTopicMessagesChange: handleTopicMessagesChange,
	})

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode: crewId,
		isTaskRunning: showLoading,
		isEmptyStatus: false,
		isShowLoadingInit: isMessagesInitialLoading,
	})

	// 封装消息发送处理函数
	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			messageSendService.sendContent({
				content,
				options,
				showLoading: messages?.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					topicStore,
					setSelectedTopic: topicStore.setSelectedTopic,
				}),
			})

			// 延迟200ms通知MessageList组件滚动到底部
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
			placeholder: t("topic.inputPlaceholder"),
			draftKey: createMessageEditorDraftKey({
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			topicMode: TopicMode.Default,
			topicStore,
			setSelectedTopic: topicStore.setSelectedTopic,
			mentionPanelStore,
			projectFilesStore,
			topicModelStore,
			layoutConfig: DEFAULT_LAYOUT_CONFIG,
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
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.CrewCreator,
					extra: { agent_code: crewId },
				})
				return mergedParams
			},
			queueContext: {
				editingQueueItem: messageQueue.editingQueueItem,
				addToQueue: messageQueue.addToQueue,
				finishEditQueueItem: messageQueue.finishEditQueueItem,
			},
			enableMessageSendByContent: true,
		}
	}, [
		t,
		selectedProject,
		selectedTopic,
		topicStore,
		mentionPanelStore,
		projectFilesStore,
		topicModelStore,
		showLoading,
		crewId,
		messageQueue.editingQueueItem,
		messageQueue.addToQueue,
		messageQueue.finishEditQueueItem,
		detailPanelVisible,
	])

	const messageListProviderValue = useMemo(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: topicStore.setSelectedTopic,
		}
	}, [topicStore.setSelectedTopic])

	return (
		<ConversationPanelScaffold
			scope="crew-topic-panel"
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			header={
				<MessageHeader
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					onToggleConversationPanel={onToggleConversationPanel}
					onExpandConversationPanel={onExpandConversationPanel}
					detailPanelVisible={detailPanelVisible}
					selectedProject={selectedProject}
					topicStore={topicStore}
					topicActions={topicActions}
					hideTopicListModeIcon
					historyTriggerMode={historyTriggerMode}
					isHistoryPanelOpen={isHistoryPanelOpen}
					onToggleHistoryPanel={onToggleHistoryPanel}
				/>
			}
			emptyHero={<EmptyState variant="hero" className="w-full" />}
			emptyCompact={<EmptyState variant="compact" />}
			emptyHint={
				<AnimatedEmptyHint
					primaryText={t("topic.helpText")}
					secondaryText={t("topic.helpAction")}
					className="-translate-x-[10px]"
				/>
			}
			editor={<DefaultMessageEditorContainer editorContext={editorContext} />}
			editorNodes={editorNodes}
			messageListProviderValue={messageListProviderValue}
			messages={messages as SuperMagicMessageItem[]}
			selectedTopic={selectedTopic}
			handlePullMoreMessage={handlePullMoreMessage}
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
		/>
	)
}

export default observer(CrewTopicPanel)
