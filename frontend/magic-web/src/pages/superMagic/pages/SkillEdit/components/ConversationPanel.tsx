import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { JSONContent } from "@tiptap/react"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
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
import {
	TopicMode,
	type ProjectListItem,
	type TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { userStore } from "@/models/user"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import CrewMessageHeader from "../../CrewEdit/components/CrewTopicPanel/components/MessageHeader"
import { useSkillEditStore } from "../context"
import { merge } from "lodash-es"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import { MentionPanelStore } from "@/components/business/MentionPanel/store"
import type { ProjectFilesStore } from "@/stores/projectFiles"

interface ConversationPanelProps {
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	mentionPanelStore: MentionPanelStore
	projectFilesStore: ProjectFilesStore
}

function ConversationPanel({
	selectedProject,
	topicStore,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	mentionPanelStore,
	projectFilesStore,
}: ConversationPanelProps) {
	const { conversation } = useSkillEditStore()
	const selectedTopic = topicStore.selectedTopic

	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		onConversationGeneratingChange: conversation.setConversationGenerating,
		onTopicMessagesChange: ({ lastMessageNode, selectedTopic: currentTopic }) => {
			const nextStatus = lastMessageNode?.status as TaskStatus | undefined
			if (currentTopic?.id && nextStatus) {
				void topicStore.updateTopicStatus(currentTopic.id, nextStatus)
			}
		},
	})

	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic,
	})

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
					topicMode: TopicMode.SkillCreator,
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
			scope="skill-edit-conversation"
			rootTestId="skill-edit-conversation-panel"
			editorTestId="skill-edit-conversation-editor"
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			header={
				<CrewMessageHeader
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					onToggleConversationPanel={onToggleConversationPanel}
					onExpandConversationPanel={onExpandConversationPanel}
					detailPanelVisible={detailPanelVisible}
					selectedProject={selectedProject}
					topicStore={topicStore}
					hideTopicListModeIcon
				/>
			}
			emptyHero={<SkillConversationEmptyState variant="hero" className="w-full" />}
			emptyCompact={<SkillConversationEmptyState variant="compact" />}
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

function SkillConversationEmptyState({
	className,
	variant,
}: {
	className?: string
	variant: "compact" | "hero"
}) {
	const { t } = useTranslation("crew/market")

	return (
		<ConversationEmptyState
			className={className}
			icon={<SkillConversationEmptyIllustration />}
			title={t("skillEditPage.conversation.title")}
			subtitle={t("skillEditPage.conversation.subtitle")}
			variant={variant}
			testId="skill-edit-conversation-empty"
		/>
	)
}

function SkillConversationEmptyIllustration() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="69"
			height="40"
			viewBox="0 0 69 40"
			fill="none"
		>
			<g clipPath="url(#clip0_8816_11085)">
				<path
					d="M62.4855 17.7864H61.204V12.0388C61.204 9.35922 58.9904 7.14563 56.3108 7.14563H50.6409V5.90291C50.6409 2.71844 48.0778 0.155334 44.8933 0.155334C41.7088 0.155334 39.1457 2.71844 39.1457 5.90291V7.18446H33.4758C31.6894 7.18446 30.0972 8.15534 29.2817 9.59223C28.6215 8.93204 27.7283 8.50485 26.7185 8.50485H19.6894V5.90291C19.6894 3.49514 17.7088 1.55339 15.3011 1.55339C12.8933 1.55339 10.9127 3.49514 10.9127 5.90291V8.54368H3.88359C1.94184 8.54368 0.349609 10.1359 0.349609 12.0777V18.7184H2.99039C5.59233 18.7184 7.72825 20.8544 7.72825 23.4563C7.72825 26.0582 5.59233 28.1942 2.99039 28.1942H0.349609V34.8738C0.349609 36.8155 1.94184 38.4078 3.88359 38.4078H10.5632V35.767C10.5632 33.165 12.6991 31.0291 15.3011 31.0291C17.903 31.0291 20.0389 33.165 20.0389 35.767V38.4078H26.7185C27.7283 38.4078 28.6215 37.9806 29.2428 37.3592C30.0972 38.7961 31.6506 39.767 33.4758 39.767H40.1554C40.8933 39.767 41.5147 39.1456 41.5147 38.4078V35.767C41.5147 33.9029 43.0292 32.3883 44.8933 32.3883C46.7574 32.3883 48.2719 33.9029 48.2719 35.767V38.4078C48.2719 39.1456 48.8933 39.767 49.6312 39.767H56.3108C58.9904 39.767 61.204 37.5922 61.204 34.9126V29.2427H62.4855C65.67 29.2427 68.2331 26.6796 68.2331 23.4951C68.2331 20.3495 65.67 17.7864 62.4855 17.7864ZM62.4855 26.5243H59.8448C59.1069 26.5243 58.4855 27.1456 58.4855 27.8835V34.9515C58.4855 36.1165 57.5147 37.0874 56.3108 37.0874H50.9904V35.8058C50.9904 32.4272 48.2719 29.7087 44.8933 29.7087C41.5147 29.7087 38.7962 32.4272 38.7962 35.8058V37.0874H33.4758C32.2719 37.0874 31.3011 36.1165 31.3011 34.9126V29.5922H32.5826C35.9613 29.5922 38.6797 26.8738 38.6797 23.4951C38.6797 20.1165 35.9613 17.3981 32.5826 17.3981H31.3011V12.0777C31.3011 10.8738 32.2719 9.90291 33.4758 9.90291H40.505C41.2428 9.90291 41.8642 9.28155 41.8642 8.54368V5.90291C41.8642 4.233 43.2234 2.87378 44.8933 2.87378C46.5632 2.87378 47.9224 4.233 47.9224 5.90291V8.54368C47.9224 9.28155 48.5438 9.90291 49.2817 9.90291H56.3108C57.5147 9.90291 58.4855 10.8738 58.4855 12.0777V19.1456C58.4855 19.8835 59.1069 20.5049 59.8448 20.5049H62.4855C64.1554 20.5049 65.5147 21.8641 65.5147 23.534C65.5147 25.2039 64.1554 26.5243 62.4855 26.5243Z"
					fill="currentColor"
				/>
			</g>
			<defs>
				<clipPath id="clip0_8816_11085">
					<rect width="68.3495" height="40" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default observer(ConversationPanel)
