import { cn } from "@/lib/tiptap-utils"
import MessageList, {
	MessageListProvider,
} from "@/pages/superMagic/components/MessageList"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import {
	TopicMode,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { JSONContent } from "@tiptap/react"
import { superMagicStore } from "@/pages/superMagic/stores"
import { observer } from "mobx-react-lite"
import EmptyState from "./components/EmptyState"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { reaction } from "mobx"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { isObject, merge } from "lodash-es"
import { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { messageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import MessageHeader from "./components/MessageHeader"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { userStore } from "@/models/user"
import { useCrewEditStore } from "../../context"

interface CrewTopicPanelProps {
	selectedProject: ProjectListItem | null
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	topicStore: TopicStore
	crewId: string
}

const editorLayoutConfig = {
	topBarLeft: [],
	topBarRight: [],
	bottomLeft: [],
	outsideBottom: [],
	outsideTop: [],
	bottomRight: [
		ToolbarButton.INTERNET_SEARCH,
		ToolbarButton.VOICE_INPUT,
		ToolbarButton.DIVIDER,
		ToolbarButton.SEND_BUTTON,
	],
}

function CrewTopicPanel({
	selectedProject,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	crewId,
	topicStore,
}: CrewTopicPanelProps) {
	const { conversation } = useCrewEditStore()
	const [showLoading, setShowLoading] = useState(false)
	const selectedTopic = topicStore.selectedTopic

	const messages = superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || []

	const handleTopicMessagesChange = useMemoizedFn((topicMessages: SuperMagicMessageItem[]) => {
		if (topicMessages.length > 1) {
			const lastMessageWithRole = topicMessages.findLast((m) => m.role === "assistant")
			const lastMessage = topicMessages?.[topicMessages.length - 1]
			const lastMessageNode = superMagicStore.getMessageNode(
				lastMessageWithRole?.app_message_id,
			)

			// 因新版本结构，所有消息都有 seq_id，所以从 !lastMessage?.seq_id 更改为 lastMessage.type === "rich_text"
			const isLoading =
				lastMessageNode?.status === "running" ||
				lastMessage.type === "rich_text" ||
				isObject(lastMessageNode?.content) ||
				Boolean(lastMessageNode?.rich_text?.content) ||
				Boolean(lastMessageNode?.text?.content)

			setShowLoading(isLoading)
			// 接收到任务消息并监测到状态变化后，需重新拉取工作区、项目、话题，更新其工作状态
			if (selectedTopic?.id) {
				void topicStore.updateTopicStatus(selectedTopic.id, lastMessageNode?.status)
			}
		} else if (topicMessages?.length === 1) {
			setShowLoading(true)
		}
	})

	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessages) => {
				handleTopicMessagesChange(topicMessages as SuperMagicMessageItem[])
			},
		)
	}, [handleTopicMessagesChange, selectedTopic?.chat_topic_id])

	useEffect(() => {
		setShowLoading(false)
		conversation.setConversationGenerating(false)
	}, [conversation, selectedTopic?.chat_topic_id])

	useEffect(() => {
		conversation.setConversationGenerating(showLoading)

		return () => {
			conversation.setConversationGenerating(false)
		}
	}, [conversation, showLoading])

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
			topicMode: TopicMode.General,
			topicStore,
			setSelectedTopic: topicStore.setSelectedTopic,
			layoutConfig: editorLayoutConfig,
			showLoading,
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.AgentManager,
					extra: { agent_code: crewId },
				})
				return mergedParams
			},
			modules: {
				mention: {
					enabled: false,
				},
				upload: {
					enabled: false,
				},
			},
		}
	}, [selectedProject, selectedTopic, topicStore, crewId, showLoading])

	const messageListProviderValue = useMemo(() => {
		return {
			allowRevoke: false,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: topicStore.setSelectedTopic,
		}
	}, [topicStore.setSelectedTopic])

	return (
		<div
			className={cn(
				"relative z-10 flex h-full flex-col items-center overflow-hidden transition-all duration-300",
				!isConversationPanelCollapsed && "rounded-lg",
				isConversationPanelCollapsed ? "px-0 pb-0 pl-2" : "pb-2",
			)}
		>
			<MessageHeader
				isConversationPanelCollapsed={isConversationPanelCollapsed}
				onToggleConversationPanel={onToggleConversationPanel}
				onExpandConversationPanel={onExpandConversationPanel}
				detailPanelVisible={detailPanelVisible}
				selectedProject={selectedProject}
				topicStore={topicStore}
			/>
			<MessageListProvider value={messageListProviderValue}>
				<MessageList
					data={messages as SuperMagicMessageItem[]}
					selectedTopic={selectedTopic}
					handlePullMoreMessage={handlePullMoreMessage}
					showLoading={showLoading}
					currentTopicStatus={selectedTopic?.task_status}
					handleSendMsg={handleSendMsg}
					isMessagesLoading={isMessagesInitialLoading}
					fallbackRender={
						<EmptyState className={cn(isConversationPanelCollapsed && "hidden")} />
					}
					className={cn(isConversationPanelCollapsed && "hidden")}
				/>
			</MessageListProvider>
			<div className="w-full max-w-3xl pl-2">
				<DefaultMessageEditorContainer editorContext={editorContext} />
			</div>
		</div>
	)
}

export default observer(CrewTopicPanel)
