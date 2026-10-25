import { useLayoutEffect, useMemo, useState } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { merge } from "lodash-es"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { History, MessageCirclePlus } from "lucide-react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import MobileComposerModeSelector from "@/pages/superMagicMobile/pages/ChatPage/components/mobile-composer/MobileComposerModeSelector"
import MessageHeader, {
	type MessageHeaderTopicActions,
} from "@/pages/superMagic/components/MessageHeader"
import WidgetMessageHeader from "./WidgetMessageHeader"
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
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	isTopicTaskRunning,
	isTopicWaitingForUser,
	TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import { userStore } from "@/models/user"
import { Button } from "@/components/shadcn-ui/button"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import { MOBILE_LAYOUT_CONFIG } from "@/pages/superMagic/components/MainInputContainer/components/editors/constant"
import { cn } from "@/utils/cn"
import { useCrewConversationStore } from "../context"
import { useMagicWidgetBridge } from "../hooks/useMagicWidgetBridge"
import { useMagicWidgetConfig } from "@/providers/MagicWidgetProvider"
import CrewAvatar from "./CrewAvatar"
import type { MagicWidgetConfig } from "@/providers/MagicWidgetProvider/types"
import {
	resolveCrewWidgetEditorCustomization,
	resolveCrewWidgetSendOverrides,
} from "../utils/editorCustomization"

interface CrewConversationPanelProps {
	widgetContext?: {
		instanceId: string
		hostOrigin: string
		renderMode?: "inline" | "floating"
	} | null
	variant: "desktop" | "mobile"
	detailPanelVisible?: boolean
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
	showTopicHistory?: boolean
	onOpenTopics?: () => void
	topicActions?: MessageHeaderTopicActions
	onFileClick?: (fileItem?: unknown) => void
	widgetConfig?: MagicWidgetConfig
}

function CrewConversationPanel({
	variant,
	detailPanelVisible = true,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
	showTopicHistory = true,
	onOpenTopics,
	topicActions,
	onFileClick,
	widgetContext = null,
	widgetConfig = {},
}: CrewConversationPanelProps) {
	const { t } = useTranslation(["crew/market", "super"])
	const store = useCrewConversationStore()
	const { embedContext, requestCustomMentionSearch } = useMagicWidgetConfig()
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	const agentCode = store.agentCode
	const topicStore = store.topicStore
	const isMobile = variant === "mobile"
	const [stopEventLoading, setStopEventLoading] = useState(false)
	const { notifyAgentReady, requestHeaderAction } = useMagicWidgetBridge({
		// Keep the protocol listener alive before a topic exists so early commands receive an explicit response.
		context: widgetContext,
		createNewConversation: store.createAndSelectNewTopic,
	})
	const widgetEditorCustomization = useMemo(
		() => (widgetContext ? resolveCrewWidgetEditorCustomization(widgetConfig) : null),
		[widgetConfig, widgetContext],
	)
	const widgetSendOverrides = useMemo(
		() => (widgetContext ? resolveCrewWidgetSendOverrides(widgetConfig) : {}),
		[widgetConfig, widgetContext],
	)

	useLayoutEffect(() => {
		if (!widgetContext) return
		store.mentionPanelStore.setBuiltinVisibility(widgetConfig.panel)
	}, [store.mentionPanelStore, widgetConfig.panel, widgetContext])

	useLayoutEffect(() => {
		// Host-owned Mention groups are intentionally limited to the desktop inline Widget surface.
		const groups =
			widgetContext?.renderMode === "inline" && !isMobile && widgetConfig.layout === "desktop"
				? (widgetConfig.panel?.customGroups ?? [])
				: []
		store.mentionPanelStore.setCustomMentionGroups(groups)
	}, [
		isMobile,
		store.mentionPanelStore,
		widgetConfig.panel?.customGroups,
		widgetConfig.panel,
		widgetConfig.layout,
		widgetContext,
	])

	useLayoutEffect(() => {
		if (!widgetContext || !embedContext || isMobile || widgetContext.renderMode !== "inline") {
			store.mentionPanelStore.setCustomMentionSearch(undefined)
			return
		}
		store.mentionPanelStore.setCustomMentionSearch((query, scope, signal) =>
			requestCustomMentionSearch(query, scope, signal),
		)
		return () => store.mentionPanelStore.setCustomMentionSearch(undefined)
	}, [embedContext, isMobile, requestCustomMentionSearch, store.mentionPanelStore, widgetContext])

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
				store.updateTopicStatus(currentTopic.id, lastMessageNode.status)
			}
		},
	})
	const isTaskRunning = showLoading || isTopicTaskRunning(selectedTopic)
	const canInterruptTask =
		isTaskRunning || selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER

	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic,
	})

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode,
		isTaskRunning,
		isWaitingForUser: isTopicWaitingForUser(selectedTopic),
		isEmptyStatus: false,
		isShowLoadingInit: isMessagesInitialLoading,
	})

	const { topicModelStore } = useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode: TopicMode.CustomAgent,
		agentCode,
		topicModelStore: store.topicModelStore,
	})

	const { handleInterrupt } = useTaskInterrupt({
		selectedTopic: selectedTopic ?? null,
		userId: userStore.user.userInfo?.user_id,
		isStopping: stopEventLoading,
		setIsStopping: setStopEventLoading,
		canInterrupt: canInterruptTask,
	})

	/** Sends editor or programmatic content, forcing widget internet-search off when configured. */
	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			const sendOptions =
				widgetSendOverrides.enableWebSearch === false
					? merge({}, options, {
							extra: { super_agent: { enable_web_search: false } },
						})
					: options
			scopedMessageSendService.sendContent({
				content,
				options: sendOptions,
				showLoading: messages.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedProject: store.setSelectedProject,
					setSelectedTopic: topicStore.setSelectedTopic,
					setSelectedWorkspace: store.setSelectedWorkspace,
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

	const editorNodes = useMemo<SceneEditorNodes>(() => {
		const messageQueueNode =
			messageQueue.queue.length > 0 ? (
				<div className="mb-2">
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
						variant={isMobile ? "mobile" : "default"}
					/>
				</div>
			) : null

		return { messageQueueNode }
	}, [messageQueue, isMobile])

	const editorContext = useMemo<SceneEditorContext>(() => {
		const layoutConfig =
			widgetEditorCustomization?.layoutConfig ??
			(isMobile ? MOBILE_LAYOUT_CONFIG : DEFAULT_LAYOUT_CONFIG)
		return {
			draftKey: createMessageEditorDraftKey({
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			selectedWorkspace: store.selectedWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: store.setSelectedProject,
			setSelectedWorkspace: store.setSelectedWorkspace,
			topicMode: TopicMode.CustomAgent,
			agentCode,
			topicStore,
			layoutConfig,
			...(widgetEditorCustomization && !isMobile
				? { modules: widgetEditorCustomization.modules }
				: {}),
			placeholder: t("super:messageEditor.placeholderLoading"),
			showLoading,
			isTaskRunning: canInterruptTask,
			stopEventLoading,
			onReady: notifyAgentReady,
			handleInterrupt,
			onFileClick,
			mentionPanelStore: store.mentionPanelStore,
			projectFilesStore: store.projectFilesStore,
			topicModelStore,
			enableMessageSendByContent: true,
			showModeToggle: false,
			allowChangeMode: false,
			containerClassName: isMobile
				? undefined
				: "rounded-xl border border-border bg-background",
			mobileModeSelectorVariant: isMobile ? "claw" : undefined,
			messagesLength: messages.length,
			mergeSendParams: ({ defaultParams }) =>
				merge({}, defaultParams, {
					topicMode: TopicMode.CustomAgent,
					extra: {
						super_agent: {
							topic_pattern: TopicMode.CustomAgent,
							agent_code: agentCode,
							// Spread last in buildSendOptions so this wins over the topic-local search toggle.
							...(widgetSendOverrides.enableWebSearch === false
								? { enable_web_search: false }
								: {}),
						},
					},
				}),
			editorRef: messageQueue.editorRef,
			queueContext: messageQueue,
			size: isMobile ? "mobile" : detailPanelVisible ? "small" : "default",
		}
	}, [
		agentCode,
		detailPanelVisible,
		handleInterrupt,
		isMobile,
		messageQueue,
		messages.length,
		selectedProject,
		selectedTopic,
		showLoading,
		canInterruptTask,
		stopEventLoading,
		onFileClick,
		notifyAgentReady,
		store.mentionPanelStore,
		store.projectFilesStore,
		store.selectedWorkspace,
		store.setSelectedProject,
		store.setSelectedWorkspace,
		t,
		topicModelStore,
		topicStore,
		widgetEditorCustomization,
		widgetSendOverrides,
	])

	const messageListProviderValue = useMemo<MessageListContextState>(
		() => ({
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			allowCreateNewTopic: true,
			onTopicSwitch: topicStore.setSelectedTopic,
			projectFilesStore: store.projectFilesStore,
			renderAssistantAvatar: ({ className } = {}) => (
				<CrewAvatar
					src={store.agent?.icon}
					name={store.agent?.name}
					className={cn("size-7", className)}
				/>
			),
		}),
		[
			store.agent?.icon,
			store.agent?.name,
			store.projectFilesStore,
			topicStore.setSelectedTopic,
		],
	)

	const emptyTitle = store.agent?.name || t("crew/market:crewConversation.unknownCrew")
	const emptySubtitle =
		store.agent?.description || store.agent?.role || t("crew/market:crewConversation.emptyHint")

	if (!isMobile) {
		const messageHeaderProps = {
			isConversationPanelCollapsed,
			onToggleConversationPanel,
			onExpandConversationPanel,
			detailPanelVisible,
			selectedProject,
			topicStore,
			historyTriggerMode,
			isHistoryPanelOpen,
			onToggleHistoryPanel,
			showTopicHistory,
		}
		return (
			<div
				className={cn(
					"relative z-10 flex h-full flex-col items-center overflow-hidden",
					"transition-all duration-300",
					!isConversationPanelCollapsed && "rounded-lg",
					isConversationPanelCollapsed ? "px-0 pb-0" : "pb-2",
				)}
				data-testid="crew-conversation-panel"
			>
				{topicActions ? (
					// Embedded sessions map host header config here. Other pages keep MessageHeader unchanged.
					widgetContext ? (
						<WidgetMessageHeader
							header={widgetConfig.header}
							windowClosable={widgetConfig.window?.closable}
							onHeaderAction={requestHeaderAction}
							{...messageHeaderProps}
							topicActions={topicActions}
						/>
					) : (
						<MessageHeader {...messageHeaderProps} topicActions={topicActions} />
					)
				) : null}
				{/* Keep the scroll viewport in layout so native scroll anchoring preserves the reading position. */}
				{selectedTopic ? (
					<div
						className={cn(
							"flex min-h-0 w-full flex-1 flex-col",
							isConversationPanelCollapsed && "invisible",
						)}
					>
						<MessageListProvider value={messageListProviderValue}>
							<MessageList
								className="[--message-list-surface:rgb(var(--sidebar-rgb))]"
								classNames={{ content: "pl-2 pt-[10px]" }}
								data={messages as SuperMagicMessageItem[]}
								setSelectedDetail={onFileClick}
								selectedTopic={selectedTopic}
								handlePullMoreMessage={handlePullMoreMessage}
								showLoading={showLoading}
								currentTopicStatus={selectedTopic?.task_status}
								handleSendMsg={handleSendMsg}
								onFileClick={onFileClick}
								isMessagesLoading={isMessagesInitialLoading}
								enableRevokedUserMessageReedit
								topicModelStore={topicModelStore}
							/>
						</MessageListProvider>
						<div
							className="mx-auto w-full max-w-3xl rounded-2xl"
							data-testid="crew-conversation-editor"
						>
							<DefaultMessageEditorContainer
								editorContext={editorContext}
								editorNodes={editorNodes}
							/>
						</div>
					</div>
				) : null}
			</div>
		)
	}

	const emptyState = (
		<ConversationEmptyState
			icon={
				<CrewAvatar
					src={store.agent?.icon}
					name={store.agent?.name}
					className={isMobile ? "size-14" : "size-16"}
				/>
			}
			iconSoundEnabled={false}
			title={emptyTitle}
			subtitle={emptySubtitle}
			variant={isMobile ? "compact" : "hero"}
			testId="crew-conversation-empty"
		/>
	)

	const editor = (
		<div className="flex w-full flex-col">
			<div className="mb-2 flex min-h-8 items-center justify-between gap-2">
				<MobileComposerModeSelector
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					topicMode={TopicMode.CustomAgent}
					agentCode={agentCode}
					selectorVariant="claw"
					topicModelStore={topicModelStore}
					messagesLength={messages.length}
					onModeChange={undefined}
				/>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						className="h-8 gap-1.5 rounded-full px-2.5 text-xs"
						aria-label={t("crew/market:crewConversation.newConversation")}
						disabled={store.isCreatingTopic || showLoading}
						onClick={() => void store.createAndSelectNewTopic()}
					>
						<MessageCirclePlus className="size-4" />
						<span>{t("crew/market:crewConversation.newConversation")}</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="h-8 gap-1.5 rounded-full px-2.5 text-xs"
						aria-label={t("crew/market:crewConversation.topics")}
						onClick={onOpenTopics}
					>
						<History className="size-4" />
						<span>{t("crew/market:crewConversation.topics")}</span>
					</Button>
				</div>
			</div>
			<MobileInputContainer editorContext={editorContext} editorNodes={editorNodes} />
		</div>
	)

	return (
		<ConversationPanelScaffold
			scope="crew-conversation"
			rootTestId="crew-conversation-panel"
			editorTestId="crew-conversation-editor"
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			header={null}
			emptyHero={emptyState}
			emptyCompact={emptyState}
			editor={editor}
			editorNodes={editorNodes}
			messageListProviderValue={messageListProviderValue}
			messages={messages as SuperMagicMessageItem[]}
			selectedTopic={selectedTopic}
			handlePullMoreMessage={handlePullMoreMessage}
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
			messageLayoutPaddingBottomPx={156}
			messageListBottomFade
			className="h-full"
		/>
	)
}

export default observer(CrewConversationPanel)
