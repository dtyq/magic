import { lazy, memo, useMemo } from "react"
import { JSONContent } from "@tiptap/core"
import MessageList, { MessageListProvider } from "../../../components/MessageList"
import MessageHeader, { type MessageHeaderTopicActions } from "../../../components/MessageHeader"
import { SuperMagicMessageItem } from "../../../components/MessageList/type"
import { ProjectListItem, Topic } from "../../Workspace/types"
import { cn } from "@/lib/utils"
import { topicStore } from "../../../stores/core"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import projectFilesStore from "@/stores/projectFiles"

const ProjectPageInputContainer = lazy(
	() => import("../../../components/ProjectPageInputContainer"),
)

interface TopicMessagePanelProps {
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	messages: SuperMagicMessageItem[]
	showLoading: boolean
	isShowLoadingInit: boolean
	currentTopicStatus: any
	attachments: any[]
	handleSendMsg: (content: JSONContent | string, options?: any) => void
	onSendComplete?: (params: {
		success: boolean
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	handlePullMoreMessage: (topicInfo: any, callback?: () => void) => void
	handleFileClick: (fileId: string, fileData?: any) => void
	setUserSelectDetail: (detail: any) => void
	setSelectedTopic: (topic: any) => void
	topicActions: MessageHeaderTopicActions
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	isMessagesLoading?: boolean
	isDraggingPanel?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
}

function TopicMessagePanel({
	selectedProject,
	selectedTopic,
	messages,
	showLoading,
	isShowLoadingInit,
	currentTopicStatus,
	attachments,
	handleSendMsg,
	onSendComplete,
	handlePullMoreMessage,
	handleFileClick,
	setUserSelectDetail,
	setSelectedTopic,
	topicActions,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	isMessagesLoading,
	isDraggingPanel = false,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
}: TopicMessagePanelProps) {
	/**
	 * 聊天页的话题模式，用于已有话题的模式展示或新话题的模式切换
	 */
	const { topicMode, setTopicMode } = useTopicMode({
		selectedTopic,
		selectedProject,
	})

	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode,
		topicModelStore: sharedTopicModelStore,
	})

	const topicModeConfig = useMemo(() => {
		return superMagicModeService.getModeConfigWithLegacy(
			topicMode,
			undefined,
			false,
			selectedTopic?.agent_code,
		)
	}, [topicMode, selectedTopic?.agent_code])

	const value = useMemo<MessageListContextState>(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: setSelectedTopic,
			projectFilesStore,
			renderAssistantAvatar: topicModeConfig?.mode
				? ({ className } = {}) => (
						<ModeAvatar
							mode={topicModeConfig.mode}
							className={className}
							iconSize={20}
						/>
					)
				: undefined,
		}
	}, [topicModeConfig, setSelectedTopic])

	return (
		<div
			className={cn(
				"relative z-10 flex h-full flex-col items-center overflow-hidden",
				!isDraggingPanel && "transition-all duration-300",
				!isConversationPanelCollapsed && "rounded-lg",
				isConversationPanelCollapsed ? "px-0 pb-0" : "pb-2",
			)}
		>
			<MessageHeader
				isConversationPanelCollapsed={isConversationPanelCollapsed}
				onToggleConversationPanel={onToggleConversationPanel}
				onExpandConversationPanel={onExpandConversationPanel}
				detailPanelVisible={detailPanelVisible}
				selectedProject={selectedProject}
				topicStore={topicStore}
				topicActions={topicActions}
				historyTriggerMode={historyTriggerMode}
				isHistoryPanelOpen={isHistoryPanelOpen}
				onToggleHistoryPanel={onToggleHistoryPanel}
			/>
			{selectedTopic && (
				<div
					className={cn(
						"flex h-full w-full flex-col",
						isConversationPanelCollapsed && "hidden",
					)}
				>
					<MessageListProvider value={value}>
						<MessageList
							data={messages as SuperMagicMessageItem[]}
							setSelectedDetail={setUserSelectDetail}
							selectedTopic={selectedTopic}
							handlePullMoreMessage={handlePullMoreMessage}
							showLoading={showLoading}
							currentTopicStatus={currentTopicStatus}
							handleSendMsg={handleSendMsg}
							onFileClick={handleFileClick}
							isMessagesLoading={isMessagesLoading}
							enableRevokedUserMessageReedit
							topicModelStore={topicModelStore}
						/>
					</MessageListProvider>
					<ProjectPageInputContainer
						className="mx-auto max-w-3xl rounded-2xl"
						classNames={{
							editorInnerWrapper: "border border-border",
							editor: "border-none",
						}}
						messages={messages}
						showLoading={showLoading}
						selectedProject={selectedProject}
						selectedTopic={selectedTopic}
						setSelectedTopic={setSelectedTopic}
						onFileClick={handleFileClick}
						attachments={attachments}
						isShowLoadingInit={isShowLoadingInit}
						topicModeLogic={{
							topicMode,
							setTopicMode,
						}}
						onSendComplete={onSendComplete}
						size={detailPanelVisible ? "small" : "default"}
					/>
				</div>
			)}
		</div>
	)
}

export default memo(TopicMessagePanel)
