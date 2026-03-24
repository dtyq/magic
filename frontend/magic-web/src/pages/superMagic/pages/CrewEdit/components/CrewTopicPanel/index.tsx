import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { TopicMode, type ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { JSONContent } from "@tiptap/react"
import { observer } from "mobx-react-lite"
import EmptyState from "./components/EmptyState"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { merge } from "lodash-es"
import { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { messageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MessageHeader from "./components/MessageHeader"
import AnimatedEmptyHint from "./components/AnimatedEmptyHint"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { userStore } from "@/models/user"
import { useTranslation } from "react-i18next"
import { useCrewEditStore } from "../../context"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import { MentionPanelStore } from "@/components/business/MentionPanel"
import type { ProjectFilesStore } from "@/stores/projectFiles"

interface CrewTopicPanelProps {
	selectedProject: ProjectListItem | null
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
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
	crewId,
	topicStore,
	mentionPanelStore,
	projectFilesStore,
}: CrewTopicPanelProps) {
	const { t } = useTranslation("crew/create")
	const { conversation } = useCrewEditStore()
	const selectedTopic = topicStore.selectedTopic
	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		onConversationGeneratingChange: conversation.setConversationGenerating,
		onTopicMessagesChange: ({ lastMessageNode, selectedTopic: currentTopic }) => {
			if (currentTopic?.id) {
				void topicStore.updateTopicStatus(currentTopic.id, lastMessageNode?.status)
			}
		},
	})

	// Use unified topic messages hook
	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic: selectedTopic,
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

	const editorContext = useMemo<SceneEditorContext>(() => {
		return {
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
			layoutConfig: DEFAULT_LAYOUT_CONFIG,
			showLoading,
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.CrewCreator,
					extra: { agent_code: crewId },
				})
				return mergedParams
			},
		}
	}, [
		selectedProject,
		selectedTopic,
		topicStore,
		mentionPanelStore,
		projectFilesStore,
		showLoading,
		crewId,
	])

	const messageListProviderValue = useMemo(() => {
		return {
			allowRevoke: false,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: false,
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
					hideTopicListModeIcon
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
