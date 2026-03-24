import { lazy, memo, useMemo } from "react"
import { JSONContent } from "@tiptap/core"
import MessageList, { MessageListProvider } from "../../../components/MessageList"
import MessageHeader from "../../../components/MessageHeader"
import { SuperMagicMessageItem } from "../../../components/MessageList/type"
import { ProjectListItem, Topic, TopicMode } from "../../Workspace/types"
import { cn } from "@/lib/utils"
import { topicStore } from "../../../stores/core"

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
	handlePullMoreMessage: (topicInfo: any, callback?: () => void) => void
	handleFileClick: (fileId: string, fileData?: any) => void
	setUserSelectDetail: (detail: any) => void
	setSelectedTopic: (topic: any) => void
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	isMessagesLoading?: boolean
	isDraggingPanel?: boolean
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
	handlePullMoreMessage,
	handleFileClick,
	setUserSelectDetail,
	setSelectedTopic,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	isMessagesLoading,
	isDraggingPanel = false,
}: TopicMessagePanelProps) {
	const value = useMemo(() => {
		return {
			allowRevoke: selectedTopic?.topic_mode !== TopicMode.DataAnalysis,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: setSelectedTopic,
		}
	}, [selectedTopic?.topic_mode, setSelectedTopic])

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
					/>
				</div>
			)}
		</div>
	)
}

export default memo(TopicMessagePanel)
