import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { observer } from "mobx-react-lite"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/utils/cn"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useMessagesWithOptimisticMeta } from "@/pages/superMagic/hooks/useMessagesWithOptimisticMeta"
import { useRetryOptimisticMessage } from "@/pages/superMagic/hooks/useRetryOptimisticMessage"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import {
	createMessageSendService,
	type HandleSendParams,
} from "@/pages/superMagic/services/messageSendFlowService"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import type { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { filterPanelMessageWithoutRevoked } from "@/pages/superMagic/utils/handleMessage"
import { userStore } from "@/models/user"
import { usePersonaResearchStore } from "../context"
import { useResearchEditor } from "../hooks/useResearchEditor"
import { classifyStudyDeliverables } from "../services/researchDeliverables"
import type { ResearchConsoleTab } from "./ResearchConsole"
import ResearchDeliverables from "./ResearchDeliverables"
import {
	interviewChatContent,
	isInterviewChatMessage,
	type InterviewChatSend,
} from "../services/interviewChat"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"

export interface ResearchConversationPanelRef {
	/** Replaces the composer content and focuses it, e.g. "ask this persona"; false until ready. */
	fillComposer: (content: string | JSONContent) => boolean
	sendInterviewFollowUp: InterviewChatSend
}

interface ResearchConversationPanelProps {
	variant: "desktop" | "mobile"
	onFileClick?: (fileItem?: unknown) => void
	/** Tool-result details (search results, browser steps) clicked in the message list. */
	onSelectDetail?: (detail?: unknown) => void
	/** Latest tool step of the conversation, shown live by the preview's playback tab. */
	onAutoDetailChange?: (detail: unknown) => void
	/** Opens an output tab from the deliverables card, e.g. validation or interviews. */
	onShowOutputs?: (tab: ResearchConsoleTab) => void
}

/** Conversation of the selected study: reused message list, ask_user cards and composer. */
const ResearchConversationPanel = forwardRef<
	ResearchConversationPanelRef,
	ResearchConversationPanelProps
>(function ResearchConversationPanel(
	{ variant, onFileClick, onSelectDetail, onAutoDetailChange, onShowOutputs },
	ref,
) {
	const store = usePersonaResearchStore()
	const selectedTopic = store.selectedTopic
	const isMobile = variant === "mobile"

	/** Same selection as the topic page: the last non-revoked tool step that opens in the preview. */
	const reportLatestToolDetail = useMemoizedFn((topicMessages: SuperMagicMessageItem[]) => {
		if (!onAutoDetailChange) return
		// Copy before reversing: the store owns this array.
		const lastDetailMessage = [...topicMessages]
			.reverse()
			.find((message) =>
				filterPanelMessageWithoutRevoked(
					superMagicStore.getMessageNode(message?.super_message_id),
					message,
				),
			)
		const tool = (
			superMagicStore.getMessageNode(lastDetailMessage?.super_message_id) as
				| { tool?: { detail?: Record<string, unknown>; id?: string; name?: string } }
				| undefined
		)?.tool
		// The panel filter only passes tools with a preview detail; keep the last one otherwise.
		if (!tool?.detail || isEmpty(tool.detail)) return
		onAutoDetailChange({ ...tool.detail, id: tool.id, name: tool.name })
	})

	const messageSendService = useMemo(
		() => createMessageSendService({ mentionPanelStore: store.mentionPanelStore }),
		[store.mentionPanelStore],
	)

	const { messages, showLoading } = useTopicConversationLoading<TaskStatus>({
		selectedTopic,
		onConversationGeneratingChange: store.setConversationGenerating,
		onTopicMessagesChange: ({
			lastMessageNode,
			selectedTopic: currentTopic,
			topicMessages,
		}) => {
			if (currentTopic?.id && lastMessageNode?.status) {
				store.updateTopicStatus(currentTopic.id, lastMessageNode.status)
			}
			reportLatestToolDetail(topicMessages)
		},
	})

	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic,
	})

	// The composer registers its send entry here; retrying a failed message re-sends through it.
	const sendRetryMessageRef = useRef<(params: HandleSendParams) => Promise<boolean>>()
	const shouldScrollAfterRetryRef = useRef(false)

	const { editorContext, editorNodes, topicModelStore, fillComposer } = useResearchEditor({
		variant,
		selectedTopic,
		showLoading,
		messagesLength: messages.length,
		isMessagesInitialLoading,
		size: isMobile ? "mobile" : "small",
		onFileClick,
		onMessageSendReady: (sendMessage, prevSendMessage) => {
			// Ignore a stale cleanup so it cannot clear a newly registered send entry.
			if (prevSendMessage === undefined || sendRetryMessageRef.current === prevSendMessage) {
				sendRetryMessageRef.current = sendMessage
			}
		},
	})

	const messagesWithOptimisticMeta = useMessagesWithOptimisticMeta(
		selectedTopic?.chat_topic_id,
		messages,
	)

	const handleRetryOptimisticMessage = useRetryOptimisticMessage({
		chatTopicId: selectedTopic?.chat_topic_id,
		getSendMessage: () => sendRetryMessageRef.current,
		onRetryStarted: () => {
			shouldScrollAfterRetryRef.current = true
		},
	})
	const retryInterviewMessage = useRetryOptimisticMessage({
		chatTopicId: selectedTopic?.chat_topic_id,
		getSendMessage: () => {
			const send = sendRetryMessageRef.current
			return send
				? (params) =>
						send({
							...params,
							shouldClearEditorAfterSend: false,
							shouldFocusEditorAfterSend: false,
						})
				: undefined
		},
	})
	const sendInterviewFollowUp = useMemoizedFn<InterviewChatSend>(async (request) => {
		if (store.isReadOnly || selectedTopic?.id !== request.topicId) return false
		const failed = messages.find((item) => {
			const node = superMagicStore.getMessageNode(item.super_message_id)
			return (
				isInterviewChatMessage(node, request.id) &&
				optimisticMessageStore.getStatus(
					selectedTopic.chat_topic_id,
					item.app_message_id,
				) === "failed"
			)
		})
		if (failed) {
			await retryInterviewMessage(failed)
			return (
				optimisticMessageStore.getStatus(
					selectedTopic.chat_topic_id,
					failed.app_message_id,
				) !== "failed"
			)
		}
		const send = sendRetryMessageRef.current
		if (!send) return false
		return send({
			value: interviewChatContent(
				request,
				store.personaById(request.personaId)?.name ?? request.personaId,
			),
			mentionItems: [],
			selectedModel: topicModelStore.selectedLanguageModel,
			targetTopic: selectedTopic,
			shouldClearEditorAfterSend: false,
			shouldFocusEditorAfterSend: false,
		})
	})

	useLayoutEffect(() => {
		if (!shouldScrollAfterRetryRef.current) return
		shouldScrollAfterRetryRef.current = false
		// Retry swaps the failed node for a sending one, so the count may not change; scroll after this commit.
		pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { behavior: "auto", time: 1000 })
	})

	useImperativeHandle(ref, () => ({ fillComposer, sendInterviewFollowUp }), [
		fillComposer,
		sendInterviewFollowUp,
	])

	// ask_user answers and message re-sends from the list go through the same send flow.
	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			messageSendService.sendContent({
				content,
				options,
				showLoading: messages.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject: store.selectedProject,
					selectedTopic,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedProject: store.setSelectedProject,
					setSelectedTopic: store.topicStore.setSelectedTopic,
					setSelectedWorkspace: store.setSelectedWorkspace,
					topicStore: store.topicStore,
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

	/**
	 * Study files under a message render as research deliverables; anything else keeps the default
	 * list. Called while the message renders, so its observer tracks the study attachments read here.
	 */
	const renderAttachments = useMemoizedFn<
		NonNullable<MessageListContextState["renderAttachments"]>
	>(({ files, className }) => {
		const deliverables = classifyStudyDeliverables(
			files,
			store.studyAttachments,
			store.attachmentById,
		)
		if (!deliverables) return null
		return (
			<ResearchDeliverables
				deliverables={deliverables}
				className={className}
				onOpenFile={onFileClick}
				onShowOutputs={onShowOutputs}
			/>
		)
	})

	const messageListProviderValue = useMemo<MessageListContextState>(
		() => ({
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			// A new study starts from the research home, not from inside the conversation.
			allowCreateNewTopic: false,
			onTopicSwitch: store.setSelectedTopic,
			onRetryOptimisticMessage: handleRetryOptimisticMessage,
			projectFilesStore: store.projectFilesStore,
			renderAttachments,
		}),
		[
			handleRetryOptimisticMessage,
			renderAttachments,
			store.projectFilesStore,
			store.setSelectedTopic,
		],
	)

	if (!selectedTopic) return null

	return (
		<div
			className="flex h-full min-h-0 w-full flex-col"
			data-testid="persona-research-conversation"
		>
			<MessageListProvider value={messageListProviderValue}>
				<MessageList
					className="[--message-list-surface:rgb(var(--background-rgb))]"
					classNames={{ content: "pl-2 pt-[10px]" }}
					data={messagesWithOptimisticMeta as SuperMagicMessageItem[]}
					setSelectedDetail={onSelectDetail ?? onFileClick}
					selectedTopic={selectedTopic}
					handlePullMoreMessage={handlePullMoreMessage}
					showLoading={showLoading}
					currentTopicStatus={selectedTopic.task_status}
					handleSendMsg={handleSendMsg}
					onFileClick={onFileClick}
					isMessagesLoading={isMessagesInitialLoading}
					enableRevokedUserMessageReedit
					topicModelStore={topicModelStore}
				/>
			</MessageListProvider>
			<div
				className={cn(
					"w-full shrink-0 px-3 pb-3",
					// The phone composer is a dock with its own grey band (rgb 250) around the white
					// card; on this white page it reads as a grey strip, so the band takes the page colour.
					isMobile && "[&_[data-testid=mobile-composer]]:!bg-background",
				)}
			>
				{isMobile ? (
					<MobileInputContainer editorContext={editorContext} editorNodes={editorNodes} />
				) : (
					<>
						{/* The shared desktop editor does not draw the queue itself; messages sent while the
						    agent is running wait here, above the input. */}
						{editorNodes.messageQueueNode}
						<DefaultMessageEditorContainer
							editorContext={editorContext}
							editorNodes={editorNodes}
						/>
					</>
				)}
			</div>
		</div>
	)
})

export default observer(ResearchConversationPanel)
