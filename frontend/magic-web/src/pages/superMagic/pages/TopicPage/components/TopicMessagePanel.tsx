import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import type {
	ActiveDetailTabType,
	FileSidebarControl,
} from "../../../components/Detail/components/FilesViewer/types"
import { lazy, memo, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react"
import { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { observer } from "mobx-react-lite"
import MessageList, { MessageListProvider } from "../../../components/MessageList"
import MessageHeader, { type MessageHeaderTopicActions } from "../../../components/MessageHeader"
import { SuperMagicMessageItem } from "../../../components/MessageList/type"
import { ProjectListItem, TaskStatus, Topic, TopicMode, Workspace } from "../../Workspace/types"
import { cn } from "@/utils/cn"
import { topicStore } from "../../../stores/core"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { useModelErrorRecovery } from "@/pages/superMagic/hooks/useModelErrorRecovery"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useRetryOptimisticMessage } from "@/pages/superMagic/hooks/useRetryOptimisticMessage"
import { useMessagesWithOptimisticMeta } from "@/pages/superMagic/hooks/useMessagesWithOptimisticMeta"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import projectFilesStore from "@/stores/projectFiles"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import ChatProjectMessageLayout from "@/pages/superMagic/pages/ChatProjectPage/components/ChatProjectMessageLayout"
import { resolveComposerMinInputHeight } from "@/pages/superMagic/components/ConversationInputResize/constants"
import { isSelfMediaComposerContext } from "@/pages/superMagic/components/MainInputContainer/utils/selfMediaComposerConfig"
import { isVideoProductionContext } from "@/pages/superMagic/components/MainInputContainer/utils/videoProductionConfig"
import { resolveDefaultAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import type { ProjectPageInputContainerProps } from "@/pages/superMagic/components/ProjectPageInputContainer/types"

const ProjectPageInputContainer = lazy(
	() => import("../../../components/ProjectPageInputContainer"),
)

const noopTopicModeChange = () => undefined

interface TopicMessagePanelProps {
	selectedProject: ProjectListItem | null
	selectedWorkspace?: Workspace | null
	selectedTopic: Topic | null
	messages: SuperMagicMessageItem[]
	showLoading: boolean
	isShowLoadingInit: boolean
	currentTopicStatus: any
	attachments: any[]
	handleSendMsg: (content: JSONContent | string, options?: SendMessageOptions) => void
	handlePullMoreMessage: (topicInfo: any, callback?: () => void) => void
	handleFileClick: (fileId: string, fileData?: any) => void
	setUserSelectDetail: (detail: any) => void
	setSelectedTopic: (topic: any) => void
	topicActions: MessageHeaderTopicActions
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	activeFileId?: string | null
	activeDetailTabType?: ActiveDetailTabType
	isMessagesLoading?: boolean
	isDraggingPanel?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
	historyTriggerRef?: RefObject<HTMLButtonElement>
	fileSidebarControl?: FileSidebarControl
	/** Injected by singleTopicChat variant for conversation-level overflow actions. */
	trailingActions?: ReactNode
	/** Optional scoped stores used by recording detail; normal project pages keep global defaults. */
	topicStore?: typeof topicStore
	projectFilesStore?: typeof projectFilesStore
	mentionPanelStore?: MentionPanelStore
	/** Controls whether the recording-summary editor can expose recording controls. */
	allowRecordingMode?: boolean
	/** Chat detail composers use the featured default employee and hide employee switching. */
	isChatDetail?: boolean
	/**
	 * Locks the composer to one built-in topic mode and hides mode switching.
	 * AI canvas projects pass Design so every topic talks to the design digital employee.
	 */
	lockedTopicMode?: TopicMode
	/** Mentions bound to every sent message, e.g. the AI canvas folder. */
	getImplicitMentionItems?: ProjectPageInputContainerProps["getImplicitMentionItems"]
	/** Overrides the mode placeholder, e.g. the AI canvas home's prompt hint. */
	placeholder?: string
}

function TopicMessagePanel({
	historyTriggerRef,
	fileSidebarControl,
	selectedProject,
	selectedWorkspace,
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
	topicActions,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	activeFileId,
	activeDetailTabType,
	isMessagesLoading,
	isDraggingPanel = false,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
	trailingActions,
	topicStore: topicStoreProp,
	projectFilesStore: projectFilesStoreProp,
	mentionPanelStore,
	allowRecordingMode,
	isChatDetail = false,
	lockedTopicMode,
	getImplicitMentionItems,
	placeholder,
}: TopicMessagePanelProps) {
	const scopedTopicStore = topicStoreProp ?? topicStore
	const scopedProjectFilesStore = projectFilesStoreProp ?? projectFilesStore
	// Chat detail route hides branch-topic actions via FileAccessProvider.
	const {
		options: { createNewTopic },
	} = useFileAccess()
	const allowTopicBranchActions = createNewTopic

	/**
	 * 聊天页的话题模式，用于已有话题的模式展示或新话题的模式切换
	 */
	const { topicMode, setTopicMode, recoverTopicMode } = useTopicMode({
		selectedTopic,
		selectedProject,
	})
	const defaultAgentSelection = isChatDetail ? resolveDefaultAgentSelection() : undefined
	// Chat details intentionally ignore the historical topic employee: their composer is locked to
	// the currently featured default employee, while task details retain their topic configuration.
	const composerTopicMode = lockedTopicMode ?? defaultAgentSelection?.topicPattern ?? topicMode
	// A locked built-in mode needs no employee code; stale topic agent codes must not override it.
	const isComposerModeLocked = isChatDetail || Boolean(lockedTopicMode)
	const composerAgentCode = lockedTopicMode
		? undefined
		: (defaultAgentSelection?.agentCode ??
			(!isChatDetail ? selectedTopic?.agent_code : undefined))

	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode: composerTopicMode,
		agentCode: composerAgentCode,
		topicModelStore: sharedTopicModelStore,
	})
	const shouldScrollAfterRetryRef = useRef(false)
	const sendRetryMessageRef = useRef<(params: HandleSendParams) => Promise<boolean>>()
	const modelErrorRecovery = useModelErrorRecovery({
		selectedProject,
		selectedTopic,
		topicModelStore,
		sendMessageRef: sendRetryMessageRef,
		showLoading,
		isMessagesLoading,
	})

	const topicModeConfig = useMemo(() => {
		return superMagicModeService.getModeConfigWithLegacy(
			topicMode,
			undefined,
			false,
			selectedTopic?.agent_code,
		)
	}, [topicMode, selectedTopic?.agent_code])

	const handleRetryOptimisticMessage = useRetryOptimisticMessage({
		chatTopicId: selectedTopic?.chat_topic_id,
		getSendMessage: () => sendRetryMessageRef.current,
		onRetryStarted: () => {
			shouldScrollAfterRetryRef.current =
				!showLoading && currentTopicStatus !== TaskStatus.RUNNING
		},
	})

	const value = useMemo<MessageListContextState>(() => {
		return {
			modelErrorRecovery,
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			// "从此处创建新话题" and timeout "新建话题" both respect chat visibility flags.
			allowConversationCopy: allowTopicBranchActions,
			allowCreateNewTopic: allowTopicBranchActions,
			onTopicSwitch: setSelectedTopic,
			onRetryOptimisticMessage: handleRetryOptimisticMessage,
			projectFilesStore: scopedProjectFilesStore,
			onOpenProjectFiles: fileSidebarControl?.isCollapsed
				? fileSidebarControl.onToggle
				: undefined,
			activeFileId,
			activeDetailTabType,
			detailPanelVisible,
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
	}, [
		modelErrorRecovery,
		allowTopicBranchActions,
		activeDetailTabType,
		activeFileId,
		detailPanelVisible,
		topicModeConfig,
		setSelectedTopic,
		handleRetryOptimisticMessage,
		scopedProjectFilesStore,
		fileSidebarControl,
	])

	const currentTopicId = selectedTopic?.chat_topic_id
	const messagesWithOptimisticMeta = useMessagesWithOptimisticMeta(currentTopicId, messages)

	useLayoutEffect(() => {
		if (!shouldScrollAfterRetryRef.current) return
		shouldScrollAfterRetryRef.current = false
		// Retry deletes the old failed node and inserts a new sending node; count may stay the same — scroll after this DOM commit.
		pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, {
			behavior: "auto",
			time: 1000,
		})
	})

	const messageListNode = (
		<MessageListProvider value={value}>
			<MessageList
				enableSimpleMode={!isChatDetail && !isReadOnlyProject(selectedProject?.user_role)}
				className="[--message-list-surface:rgb(var(--sidebar-rgb))]"
				classNames={{ content: "pl-2 pt-[10px]" }}
				data={messagesWithOptimisticMeta as SuperMagicMessageItem[]}
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
				enableExport
				exportTitle={selectedTopic?.topic_name}
			/>
		</MessageListProvider>
	)

	// The composer shrinks beside an open detail panel; its minimum height follows the same size.
	const composerSize = detailPanelVisible ? "small" : "default"
	const inputNode = (
		<ProjectPageInputContainer
			className="mx-auto max-w-3xl rounded-2xl"
			classNames={{
				editorInnerWrapper: "border border-border",
				editor: "border-none",
				editorWrapper: "flex flex-col",
			}}
			messages={messagesWithOptimisticMeta}
			showLoading={showLoading}
			selectedProject={selectedProject}
			selectedWorkspace={selectedWorkspace}
			selectedTopic={selectedTopic}
			setSelectedTopic={setSelectedTopic}
			onFileClick={handleFileClick}
			onMessageSendReady={modelErrorRecovery.onMessageSendReady}
			attachments={attachments}
			mentionPanelStore={mentionPanelStore}
			topicStore={scopedTopicStore}
			allowRecordingMode={allowRecordingMode}
			agentCode={isComposerModeLocked ? (composerAgentCode ?? null) : composerAgentCode}
			isShowLoadingInit={isShowLoadingInit}
			topicModeLogic={{
				topicMode: composerTopicMode,
				setTopicMode: isComposerModeLocked ? noopTopicModeChange : setTopicMode,
				recoverTopicMode: isComposerModeLocked ? noopTopicModeChange : recoverTopicMode,
			}}
			showModeToggle={isComposerModeLocked ? false : undefined}
			getImplicitMentionItems={getImplicitMentionItems}
			placeholder={placeholder}
			size={composerSize}
		/>
	)
	// Keep extra-UI capability checks explicit so specialized composers cannot silently use a floor
	// that is smaller than the controls rendered below their editor.
	const inputMinHeight = resolveComposerMinInputHeight({
		isPptMode: composerTopicMode === TopicMode.PPT,
		isVideoProductionMode: isVideoProductionContext({
			topicMode: composerTopicMode,
			agentCode: composerAgentCode,
			selectedTopic,
		}),
		isSpecializedMode:
			composerTopicMode === TopicMode.RecordSummary ||
			isSelfMediaComposerContext({
				topicMode: composerTopicMode,
				agentCode: composerAgentCode,
			}),
		// A locked mode hides the mode switcher row (showModeToggle is false above).
		isLockedMode: Boolean(lockedTopicMode),
		editorSize: composerSize,
	})

	return (
		<div
			className={cn(
				"relative z-10 flex h-full min-h-0 flex-col items-center overflow-hidden",
				!isDraggingPanel && "transition-all duration-300",
				!isConversationPanelCollapsed && "rounded-lg",
				isConversationPanelCollapsed ? "px-0 pb-0" : "pb-2",
			)}
		>
			<MessageHeader
				enableSimpleMode={!isChatDetail && !isReadOnlyProject(selectedProject?.user_role)}
				historyTriggerRef={historyTriggerRef}
				fileSidebarControl={fileSidebarControl}
				alignWithContent={
					Boolean(fileSidebarControl) &&
					!detailPanelVisible &&
					!isConversationPanelCollapsed
				}
				isConversationPanelCollapsed={isConversationPanelCollapsed}
				onToggleConversationPanel={onToggleConversationPanel}
				onExpandConversationPanel={onExpandConversationPanel}
				detailPanelVisible={detailPanelVisible}
				selectedProject={selectedProject}
				topicStore={scopedTopicStore}
				topicActions={topicActions}
				historyTriggerMode={historyTriggerMode}
				isHistoryPanelOpen={isHistoryPanelOpen}
				onToggleHistoryPanel={onToggleHistoryPanel}
				trailingActions={trailingActions}
			/>
			{/* Keep the scroll viewport in layout so native scroll anchoring preserves the reading position. */}
			{selectedTopic && (
				<ChatProjectMessageLayout
					messageList={messageListNode}
					input={inputNode}
					isConversationPanelCollapsed={isConversationPanelCollapsed}
					inputMinHeight={inputMinHeight}
					layoutKey={`${String(composerTopicMode)}:${composerAgentCode ?? ""}`}
				/>
			)}
		</div>
	)
}

export default memo(observer(TopicMessagePanel))
