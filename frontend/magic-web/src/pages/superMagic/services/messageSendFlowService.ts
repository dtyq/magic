import { isObject, merge } from "lodash-es"
import { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { serializeWechatChatContent } from "../components/MessageEditor/extensions/wechat-chat-history/transform"
import { ChatApi, SuperMagicApi } from "@/apis"
import { EventType } from "@/types/chat"
import {
	ConversationMessageType,
	type ConversationQueryMessage,
	type ConversationMessageSend,
} from "@/types/chat/conversation_message"
import type { SeqResponse } from "@/types/request"
import { logger as Logger } from "@/infrastructure/logger"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import GlobalMentionPanelStore, {
	type MentionPanelStore,
} from "@/components/business/MentionPanel/builtin-store"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { userStore } from "@/models/user"
import {
	DEFAULT_KEY,
	internetSearchManager,
} from "../components/MessageEditor/services/InternetSearchManager"
import type { MessageEditorRef } from "../components/MessageEditor/MessageEditor"
import {
	buildPlainTextJSONContent,
	generateTextFromJSONContent,
	isEmptyJSONContent,
} from "../components/MessageEditor/utils"
import { transformMentions } from "../components/MessageEditor/utils/mention"
import type { ModelItem } from "../components/MessageEditor/types"
import type { SendMessageOptions } from "../components/MessagePanel/types"
import {
	MessageStatus,
	TaskStatus,
	type Workspace,
	type ProjectListItem,
	type Topic,
} from "../pages/Workspace/types"
import { TopicMode } from "../pages/Workspace/TopicMode"
import { hasAiCanvasDefaultName } from "../utils/isAiCanvasProject"
import { superMagicStore } from "../stores"
import type { TopicStore } from "../stores/core/topic"
import { optimisticMessageStore } from "../stores/optimisticMessageStore"
import { getNetworkMonitor } from "@/services/recordSummary/NetworkMonitor"
import { smartRenameTopicIfUnnamed } from "./topicRename"
import { shouldSyncChatConversationName, syncChatProjectNameOnly } from "./chatConversationNameSync"
import { shouldClearEditorAfterSend } from "./messageSendEditorPolicy"
import { startMessageSendRenameTask, trackProjectRenameTask } from "./messageSendRenameTask"
import { projectVisibleMessagesByRevokedTail } from "../utils/project-visible-messages-by-revoked-tail"
import { analyticsService } from "@/services/analytics"
import i18next from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { getConversationTopicModeOverride } from "./conversationTopicModeOverride"

const logger = Logger.createLogger("messageSendService")

/**
 * Mirrors text Mention semantics into the legacy label field consumed by the backend text parser.
 * The original data payload remains intact so editor rendering and history restoration keep using it.
 */
function normalizeTextMentionLabelsForBackend(content: JSONContent): JSONContent {
	const normalizedContent = content.content?.map(normalizeTextMentionLabelsForBackend)
	const attrs = content.attrs

	if (content.type !== "mention" || attrs?.type !== MentionItemType.TEXT) {
		return normalizedContent ? { ...content, content: normalizedContent } : content
	}

	const data = attrs.data
	const text = isObject(data) && typeof data.text === "string" ? data.text.trim() : ""

	return {
		...content,
		attrs: text ? { ...attrs, label: text } : attrs,
		...(normalizedContent && { content: normalizedContent }),
	}
}

export interface HandleSendParams {
	origin?: "composer" | "model_recovery"
	/** 异步准备结束、实际发送前重新检查来源是否仍有效，仅用于本地发送流程。 */
	canSend?: () => boolean
	value: JSONContent | undefined
	mentionItems: MentionListItem[]
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
	topicMode?: TopicMode
	isFromQueue?: boolean
	queueId?: string
	shouldClearEditorAfterSend?: boolean
	/** Programmatic surfaces keep focus in their own input after sending. */
	shouldFocusEditorAfterSend?: boolean
	throwOnError?: boolean
	extra?: Record<string, unknown>
	targetTopic?: Topic | null
}

export interface SendContentParams {
	content: JSONContent | string
	options?: SendMessageOptions
	showLoading?: boolean
	context?: SendRuntimeContext
}

export interface DispatchMessageParams {
	canSend?: () => boolean
	content?: string
	jsonContent?: JSONContent
	options?: SendMessageOptions
	/** Editor surface classification used only by analytics, never serialized to chat payloads. */
	analyticsTopicMode?: TopicMode
	/** Queue replay was already counted when the user enqueued the message. */
	shouldTrackAttempt?: boolean
	showLoading: boolean
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	context?: SendRuntimeContext
}

export interface PanelSendInput {
	params: HandleSendParams
	context?: SendRuntimeContext
	currentProject: ProjectListItem | null
	currentTopic: Topic | null
	isSending: boolean
	setIsSending: (isSending: boolean) => void
	showLoading: boolean
	isMobile: boolean
	isEmptyStatus: boolean
	tabPattern: TopicMode
	editorRef?: MessageEditorRef | null
	setFocused: (isFocused: boolean) => void
	messagesLength: number
}

export interface SendPanelMessageResult {
	currentProject: ProjectListItem | null
	currentTopic: Topic | null
}

export interface SendRuntimeContext {
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	selectedWorkspace?: Workspace | null
	topicStore?: TopicStore
	workspaceId?: string
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
	refreshProjectAfterTopicRename?: boolean
	renameProject?: (
		projectId: string,
		projectName: string,
		workspaceId: string,
	) => void | Promise<void>
}

interface MessageSendServiceDeps {
	chatApi: typeof ChatApi
	superMagicApi: typeof SuperMagicApi
	pubsub: typeof pubsub
	mentionPanelStore: MentionPanelStore
	userStore: typeof userStore
	superMagicStore: typeof superMagicStore
	logger: ReturnType<typeof Logger.createLogger>
}

class MessageSendService {
	private deps: MessageSendServiceDeps = {
		chatApi: ChatApi,
		superMagicApi: SuperMagicApi,
		pubsub,
		mentionPanelStore: GlobalMentionPanelStore,
		userStore,
		superMagicStore,
		logger,
	}

	configure(deps: Partial<MessageSendServiceDeps>) {
		this.deps = {
			...this.deps,
			...deps,
		}
	}

	sendContent({ content, options, showLoading = false, context }: SendContentParams) {
		// 发送前统一处理内容格式
		if (typeof content === "string") {
			void this.dispatchMessage({ content, showLoading, options, context })
			return
		}

		if (!isEmptyJSONContent(content)) {
			void this.dispatchMessage({ jsonContent: content, showLoading, options, context })
		}
	}

	async dispatchMessage({
		canSend,
		content: textContent,
		jsonContent,
		showLoading,
		options,
		analyticsTopicMode,
		shouldTrackAttempt = true,
		selectedProject,
		selectedTopic,
		context,
	}: DispatchMessageParams): Promise<boolean> {
		if (canSend && !canSend()) return false
		// 发送前必须有有效话题
		const currentProject =
			selectedProject ?? context?.selectedProject ?? options?._tempProject ?? null
		const currentTopic = selectedTopic ?? context?.selectedTopic ?? options?._tempTopic ?? null

		if (!currentTopic?.id) {
			this.deps.logger.error({
				eventKey: "send_message_failed",
				errorKind: "unknown",
				message: "发送消息 - 未找到选中的话题",
			})
			return false
		}

		const trimmedText = textContent?.trim()
		let resolvedJson: JSONContent | undefined
		if (isObject(jsonContent)) {
			// Preserve structured mention nodes in the rich-text payload so refreshes can restore them.
			resolvedJson = normalizeTextMentionLabelsForBackend(
				serializeWechatChatContent(jsonContent),
			)
		} else if (trimmedText) {
			resolvedJson = buildPlainTextJSONContent(trimmedText)
		} else {
			return false
		}

		if (isEmptyJSONContent(resolvedJson)) return false

		const content = JSON.stringify(resolvedJson)
		const messageType = ConversationMessageType.RichText
		const messageId = generateUniqueId()
		const { chat_topic_id, chat_conversation_id } = currentTopic
		const date = new Date().getTime()

		const sendOptions = stripTempOptions(options)

		// 话题名为空时根据内容自动命名，消息发送不等待该任务。
		// 首页创建场景会登记任务，详情页在任务完成后按需刷新一次项目详情。
		const renameTask =
			currentProject && currentTopic
				? startMessageSendRenameTask({
						topicId: currentTopic.id,
						renameTopic: () =>
							smartRenameTopicIfUnnamed({
								topic: currentTopic,
								userQuestion: generateTextFromJSONContent(resolvedJson),
								updateTopicName: context?.updateTopicName,
							}),
						syncProjectName: (topicName) =>
							this.handleSmartProjectRename({
								project: currentProject,
								topicName,
								context,
							}),
						onError: (error) => {
							this.deps.logger.error({
								eventKey: "smart_topic_rename_failed",
								errorKind: "unknown",
								error,
								message: "Smart topic rename failed",
							})
						},
					})
				: undefined

		const mergedSendOptions = merge({}, sendOptions, {
			extra: {
				super_agent: {
					dynamic_params: {
						message_version: "v2",
					},
				},
			},
		})

		if (currentTopic?.id && sendOptions?.extra?.super_agent?.mentions) {
			const mentions = sendOptions.extra.super_agent.mentions.filter(
				(item) => item.attrs.type !== MentionItemType.TEXT,
			)
			this.deps.mentionPanelStore.addMentionListItemsToHistory(mentions)
		}

		/** Builds the single pending message envelope shared by optimistic UI, recovery, and transport. */
		const createPendingUserMessage = (messageContent: string) => ({
			message: {
				type: messageType,
				[messageType]: {
					content: messageContent,
					/**
					 * @deprecated follow_up 和 normal 后期将废弃，follow_up 追加对话，normal 正常新对话
					 */
					instructs: [{ value: showLoading ? "follow_up" : "normal" }],
					...mergedSendOptions,
				},
				send_timestamp: date,
				send_time: date,
				sender_id: this.deps.userStore.user.userInfo?.user_id,
				app_message_id: messageId,
				message_id: messageId,
				topic_id: chat_topic_id,
			} as unknown as ConversationMessageSend["message"],
			conversation_id: chat_conversation_id,
		})

		const pendingUserMessage = createPendingUserMessage(content)
		const previousTopicStatus = currentTopic.task_status || currentTopic.status
		const markLocalExecutionStarted = () => {
			this.deps.superMagicStore.beginTopicExecution?.(chat_topic_id)
			context?.topicStore?.mergeTopic(currentTopic.id, {
				task_status: TaskStatus.RUNNING,
				status: TaskStatus.RUNNING,
			})
		}
		const markLocalExecutionFailed = () => {
			this.deps.superMagicStore.failPendingTopicExecution?.(chat_topic_id)
			if (previousTopicStatus) {
				context?.topicStore?.mergeTopic(currentTopic.id, {
					task_status: previousTopicStatus,
					status: previousTopicStatus,
				})
			}
		}

		// 调用聊天接口发送消息
		const sendMessage = () => {
			const optimisticAnchor = this.deps.superMagicStore.getLatestMessageAnchor(chat_topic_id)
			// The same rich-text snapshot drives immediate rendering and the outbound request.
			this.deps.superMagicStore.addUserMessage(chat_topic_id, pendingUserMessage)
			optimisticMessageStore.markSending({
				chat_topic_id,
				app_message_id: messageId,
				created_at: date,
				last_attempt_at: date,
				...optimisticAnchor,
				pending_message: pendingUserMessage,
			})
			if (getNetworkMonitor().isNetworkOffline()) {
				markLocalExecutionFailed()
				optimisticMessageStore.markFailed({ chat_topic_id, app_message_id: messageId })
				this.reportSendFailure("network_offline", chat_topic_id)
				return
			}
			this.deps.chatApi
				.chat(EventType.Chat, pendingUserMessage)
				.then((res) => {
					const responseSeq =
						(res as { data?: { seq?: SeqResponse<ConversationQueryMessage> } })?.data
							?.seq ?? (res as { seq?: SeqResponse<ConversationQueryMessage> })?.seq
					if (!responseSeq?.message) {
						markLocalExecutionFailed()
						// Keep the sidecar consistent with the rolled-back topic status instead of waiting for the ACK timer.
						optimisticMessageStore.markFailed({
							chat_topic_id,
							app_message_id: messageId,
						})
						this.reportSendFailure("ack_without_seq", chat_topic_id)
						return
					}
					// 响应成功后替换 superMagicStore 中对应数据
					this.deps.superMagicStore.replaceUserMessage(chat_topic_id, responseSeq)
					optimisticMessageStore.confirm({ chat_topic_id, app_message_id: messageId })
				})
				.catch((error) => {
					markLocalExecutionFailed()
					optimisticMessageStore.markFailed({ chat_topic_id, app_message_id: messageId })
					this.reportSendFailure("chat_request_rejected", chat_topic_id, error)
				})
		}

		// 仅当前可见分支仍以 revoked 尾段结束时确认撤回；历史撤回事实不应阻塞新消息。
		const hasRevokedMessages = projectVisibleMessagesByRevokedTail(
			this.getMessageList(currentTopic),
		).some((message) => (message?.imStatus ?? message?.status) === MessageStatus.REVOKED)
		if (hasRevokedMessages) {
			const isConfirmed = await this.confirmRevokedMessagesBeforeSend(currentTopic)
			if (!isConfirmed) return false
		}

		if (canSend && !canSend()) return false

		if (shouldTrackAttempt) {
			try {
				analyticsService.report("conversation_message_send_attempted", {
					topicId: currentTopic.id,
					projectId: currentProject?.id,
					workspaceId:
						context?.selectedWorkspace?.id ??
						context?.workspaceId ??
						currentProject?.workspace_id,
					topicMode:
						getConversationTopicModeOverride(currentTopic.id) ??
						analyticsTopicMode ??
						readTopicPattern(sendOptions) ??
						currentTopic.topic_mode,
					workspaceType: context?.selectedWorkspace?.workspace_type,
				})
			} catch {
				// Analytics must never fail the send path.
			}
		}
		markLocalExecutionStarted()
		sendMessage()
		if (context?.refreshProjectAfterTopicRename && currentProject && renameTask) {
			trackProjectRenameTask(currentProject.id, renameTask.completion)
		}
		if (hasRevokedMessages) {
			this.deps.pubsub.publish(PubSubEvents.Refresh_Topic_Messages)
		}
		return true
	}

	async sendPanelMessage({
		params,
		context,
		currentProject,
		currentTopic,
		isSending,
		setIsSending,
		showLoading,
		isMobile,
		isEmptyStatus,
		tabPattern,
		editorRef,
		setFocused,
		messagesLength,
	}: PanelSendInput): Promise<SendPanelMessageResult | undefined> {
		if (!params.value || isSending) {
			return
		}

		setIsSending(true)

		try {
			if (!currentProject?.id || !currentTopic?.id) {
				this.deps.logger.error({
					eventKey: "send_project_topic_context_missing",
					errorKind: "invalid_state",
					message: "handleSend error: missing project/topic context",
				})
				return
			}

			const data = this.buildSendOptions({
				params,
				mentionItems: params.mentionItems,
				currentProject,
				currentTopic,
				isEmptyStatus,
			})

			const followUp = showLoading && messagesLength > 1
			const isDispatched = await this.dispatchMessage({
				canSend: params.canSend,
				jsonContent: params.value,
				showLoading: followUp,
				options: data,
				selectedProject: currentProject,
				selectedTopic: currentTopic,
				context,
				analyticsTopicMode: params.topicMode ?? tabPattern,
				shouldTrackAttempt: !params.isFromQueue,
			})
			if (!isDispatched) return
			this.deps.pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })

			if (shouldClearEditorAfterSend(params)) {
				editorRef?.clearContentAfterSend()
			}

			if (!params.isFromQueue && params.shouldFocusEditorAfterSend !== false) {
				if (isMobile) {
					setFocused(false)
				} else {
					setTimeout(() => {
						if (!editorRef?.editor || editorRef.editor.isDestroyed) return
						editorRef.focus({ enableWhenIsMobile: false })
						setFocused(true)
					}, 100)
				}
			} else {
				setFocused(false)
			}

			return {
				currentProject,
				currentTopic,
			}
		} catch (error) {
			this.deps.logger.error({
				eventKey: "handle_send_failed",
				errorKind: "unknown",
				error: error,
				message: "handleSend error",
			})
		} finally {
			setIsSending(false)
		}
	}

	/**
	 * Surfaces a failed send. The failed sidecar only renders a small icon next to the bubble, which users
	 * overlook when the chat WebSocket cannot connect; a toast plus a log record makes the loss visible
	 * and traceable (previously the rejection was only written to the console).
	 */
	private reportSendFailure(reason: string, chatTopicId: string, error?: unknown) {
		this.deps.logger.error({
			eventKey: "message_send_failed",
			errorKind: "network",
			error,
			message: "message send failed",
			context: { reason, chatTopicId },
		})
		magicToast.error(i18next.t("messageSendFailed", { ns: "super" }))
	}

	private buildSendOptions({
		params,
		mentionItems,
		currentProject,
		currentTopic,
		isEmptyStatus,
	}: {
		params: HandleSendParams
		mentionItems: MentionListItem[]
		currentProject: ProjectListItem | null | undefined
		currentTopic: Topic | null | undefined
		isEmptyStatus: boolean
	}): SendMessageOptions {
		const { legacySuperAgentExtra, nestedSuperAgentExtra } = splitSuperAgentExtra(params.extra)

		const model = params.selectedModel
			? {
					model_id: params.selectedModel.model_id,
					model_name: params.selectedModel.model_name,
					model_icon: params.selectedModel.model_icon,
				}
			: undefined

		const imageModel = params.selectedImageModel?.model_id
			? {
					model_id: params.selectedImageModel.model_id,
					model_name: params.selectedImageModel.model_name,
					model_icon: params.selectedImageModel.model_icon,
				}
			: undefined
		const videoModel = params.selectedVideoModel?.model_id
			? {
					model_id: params.selectedVideoModel.model_id,
					model_name: params.selectedVideoModel.model_name,
					model_icon: params.selectedVideoModel.model_icon,
				}
			: undefined

		// 根据话题读取联网搜索开关
		const isInternetSearch = internetSearchManager.getIsChecked(
			isEmptyStatus ? DEFAULT_KEY : currentTopic?.id,
		)

		if (isEmptyStatus && currentTopic?.id) {
			internetSearchManager.setIsChecked(currentTopic.id, isInternetSearch)
		}

		const structuredMentionItems = mentionItems.filter(
			(item) => item.attrs.type !== MentionItemType.TEXT,
		)
		const transformedMentionItems = transformMentions(structuredMentionItems)

		return {
			extra: {
				super_agent: {
					mentions: transformedMentionItems,
					chat_mode: "normal" as const,
					topic_pattern: currentTopic?.topic_mode,
					...(currentTopic?.agent_code && { agent_code: currentTopic.agent_code }),
					model,
					enable_web_search: isInternetSearch,
					...(imageModel && { image_model: imageModel }),
					...(videoModel && { video_model: videoModel }),
					...(params.queueId && { queue_id: params.queueId }),
					...legacySuperAgentExtra,
					...nestedSuperAgentExtra,
				},
			},
			_tempProject: currentProject ?? undefined,
			_tempTopic: currentTopic ?? undefined,
		}
	}

	private getMessageList(topic: Topic) {
		return this.deps.superMagicStore.messages?.get(topic?.chat_topic_id || "") || []
	}

	private async confirmRevokedMessagesBeforeSend(topic: Topic) {
		try {
			const confirmPromise = this.deps.superMagicApi.confirmUndoMessage({
				topic_id: topic.id,
			})
			if (!confirmPromise) return false
			await confirmPromise
			// Confirmation closes revoke-edit mode even if the following message send later fails;
			// the sidecar must not keep projecting the old User branch as editable.
			optimisticMessageStore.clearActiveRevokedAnchor(topic.chat_topic_id)
			return true
		} catch (error) {
			this.deps.logger.error({
				eventKey: "confirm_undo_message_failed",
				errorKind: "unknown",
				error: error,
				message: "confirm undo message failed",
			})
			return false
		}
	}

	private async handleSmartProjectRename({
		project,
		topicName,
		context,
	}: {
		project: ProjectListItem
		topicName: string
		context?: SendRuntimeContext
	}) {
		if (!topicName || !project) return

		// Chat conversations: topic was already renamed by smartRenameTopic; mirror name on project.
		if (shouldSyncChatConversationName(project)) {
			await syncChatProjectNameOnly({
				projectId: project.id,
				name: topicName,
			})
			return
		}

		// AI canvas projects are created as "Untitled canvas" rather than unnamed; they are renamed
		// the same way, and their canvas folder follows the new project name (useAiCanvasDocument).
		if (!project.project_name || hasAiCanvasDefaultName(project)) {
			const workspaceId =
				(context?.workspaceId ?? context?.selectedWorkspace?.id ?? project.workspace_id) ||
				""
			if (workspaceId) {
				await context?.renameProject?.(project.id, topicName, workspaceId)
			}
		}
	}
}

function createMessageSendService(deps: Partial<MessageSendServiceDeps> = {}) {
	const service = new MessageSendService()
	service.configure(deps)
	return service
}

export const messageSendService = new MessageSendService()
export { createMessageSendService }

function generateUniqueId(): string {
	const timestamp = Date.now().toString(36)
	const randomPart = Math.random().toString(36).substring(2, 15)
	return `${timestamp}-${randomPart}`
}

function readTopicPattern(options?: SendMessageOptions): string | undefined {
	const topicPattern = options?.extra?.super_agent?.topic_pattern
	return typeof topicPattern === "string" ? topicPattern : undefined
}

function stripTempOptions(options?: SendMessageOptions): SendMessageOptions | undefined {
	if (!options) return undefined
	// 发送前移除临时字段
	const { _tempProject, _tempTopic, ...rest } = options
	void _tempProject
	void _tempTopic
	return rest
}

function splitSuperAgentExtra(extra?: Record<string, unknown>) {
	if (!extra) {
		return {
			legacySuperAgentExtra: {},
			nestedSuperAgentExtra: {},
		}
	}

	const { super_agent, ...legacySuperAgentExtra } = extra

	return {
		legacySuperAgentExtra,
		nestedSuperAgentExtra: isObject(super_agent)
			? (super_agent as Record<string, unknown>)
			: {},
	}
}
