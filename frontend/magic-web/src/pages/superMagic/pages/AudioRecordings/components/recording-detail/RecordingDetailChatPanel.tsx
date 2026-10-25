import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import AiChat from "@/components/business/RecordingSummary/components/AiChat"
import {
	MessageHeaderTopicHistoryPanel,
	type MessageHeaderTopicActions,
} from "@/pages/superMagic/components/MessageHeader"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { RECORDING_CHAT_HISTORY_WIDTH } from "./recording-detail-layout"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode/useCreateTopicListener"
import { useRefreshTopicDetailOnTaskComplete } from "@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete"
import { RecordingDetailChatSkeleton } from "./RecordingDetailEmptyState"

export interface RecordingDetailChatPanelProps {
	isConversationPanelCollapsed: boolean
	historyOpen: boolean
	onToggleConversationPanel: () => void
	onExpandConversationPanel: () => void
	onToggleHistory: () => void
	topicsLoading: boolean
	topicStore: TopicStore
	topicActions: MessageHeaderTopicActions
	selectedTopic: Topic | null
	project: ProjectListItem | null
	workspace: Workspace | null
	setSelectedTopic: (topic: Topic | null) => void
	projectFilesStore: ProjectFilesStore
	mentionPanelStore: MentionPanelStore
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
}

/** Renders the desktop recording conversation rail with the project-detail header and history panel. */
export default function RecordingDetailChatPanel({
	isConversationPanelCollapsed,
	historyOpen,
	onToggleConversationPanel,
	onExpandConversationPanel,
	onToggleHistory,
	topicsLoading,
	topicStore,
	topicActions,
	selectedTopic,
	project,
	workspace,
	setSelectedTopic,
	projectFilesStore,
	mentionPanelStore,
	attachments,
	attachmentList,
}: RecordingDetailChatPanelProps) {
	const { t } = useTranslation("super")
	const projectId = project?.id ?? null

	// Optimistic barrier: assume messages are loading as soon as a project is available.
	const [messagesInitialLoading, setMessagesInitialLoading] = useState(() => Boolean(project))

	// Reset the messages-loading overlay when the project identity changes.
	useEffect(() => {
		setMessagesInitialLoading(Boolean(projectId))
	}, [projectId])

	/** Receives the main-site messages hydration barrier from project-detail AiChat. */
	const handleMessagesInitialLoadingChange = useCallback((loading: boolean) => {
		setMessagesInitialLoading(loading)
	}, [])

	// Register the scoped topic-creation listener so employee switching creates and selects a new topic.
	useCreateTopicListener({
		enabled: Boolean(project),
		selectedProject: project,
		topicStore,
	})

	// Refresh the isolated topic snapshot after a live task completes so the header status follows the server state.
	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: topicStore.updateTopic,
	})

	// Show skeleton while topics bootstrap or messages hydrate; never while the rail is collapsed.
	const showTopicsBootstrapSkeleton = !isConversationPanelCollapsed && !project && topicsLoading
	const showMessagesLoadingOverlay =
		!isConversationPanelCollapsed && Boolean(project) && messagesInitialLoading

	return (
		<div
			className="flex h-full min-h-0 min-w-0 overflow-hidden bg-sidebar"
			data-testid="recording-detail-chat-panel"
			data-collapsed={String(isConversationPanelCollapsed)}
		>
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="relative flex min-h-0 flex-1 flex-col">
					{project ? (
						<AiChat
							projectFilesStore={projectFilesStore}
							attachments={attachments}
							attachmentList={attachmentList}
							checkNowDebounced={() => undefined}
							recordSummaryFileStore={mentionPanelStore}
							selectedProject={project}
							selectedWorkspace={workspace}
							selectedTopic={selectedTopic}
							setSelectedProject={() => undefined}
							setSelectedWorkspace={() => undefined}
							setSelectedTopic={setSelectedTopic}
							useRecordingSync={false}
							projectDetailMode
							allowRecordingMode={false}
							topicStore={topicStore}
							topicActions={topicActions}
							historyTriggerMode="layout"
							isHistoryPanelOpen={historyOpen}
							onToggleHistoryPanel={onToggleHistory}
							isConversationPanelCollapsed={isConversationPanelCollapsed}
							onToggleConversationPanel={onToggleConversationPanel}
							onExpandConversationPanel={onExpandConversationPanel}
							onMessagesInitialLoadingChange={handleMessagesInitialLoadingChange}
						/>
					) : showTopicsBootstrapSkeleton ? (
						<RecordingDetailChatSkeleton />
					) : isConversationPanelCollapsed ? null : ( // Collapsed rail renders nothing until the project resolves; AiChat supplies the expand control once mounted.
						<div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
							{topicsLoading ? t("loading") : t("messageHeader.noTopics")}
						</div>
					)}

					{/* Keep AiChat mounted underneath so messages/queries can start immediately. */}
					{showMessagesLoadingOverlay ? (
						<div
							className="absolute inset-0 z-10 bg-sidebar"
							data-testid="recording-detail-chat-skeleton-overlay"
						>
							<RecordingDetailChatSkeleton />
						</div>
					) : null}
				</div>
			</div>
			{historyOpen ? (
				<aside
					className="h-full shrink-0 border-l border-border bg-background"
					style={{ width: RECORDING_CHAT_HISTORY_WIDTH }}
					data-testid="recording-detail-topic-history"
					role="complementary"
				>
					<MessageHeaderTopicHistoryPanel
						selectedProject={project}
						topicStore={topicStore}
						topicActions={topicActions}
						onClose={onToggleHistory}
						hideTopicTypeFilter
					/>
				</aside>
			) : null}
		</div>
	)
}
