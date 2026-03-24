import { isObject } from "lodash-es"
import { JSONContent } from "@tiptap/core"
import { ChatApi, SuperMagicApi } from "@/apis"
import { EventType } from "@/types/chat"
import {
	ConversationMessageType,
	type ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { logger as Logger } from "@/utils/log"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import GlobalMentionPanelStore, {
	type MentionPanelStore,
} from "@/components/business/MentionPanel/store"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { userStore } from "@/models/user"
import {
	DEFAULT_KEY,
	internetSearchManager,
} from "../components/MessageEditor/services/InternetSearchManager"
import type { MessageEditorRef } from "../components/MessageEditor/MessageEditor"
import { generateTextFromJSONContent, isEmptyJSONContent } from "../components/MessageEditor/utils"
import { transformMentions } from "../components/MessageEditor/utils/mention"
import type { ModelItem } from "../components/MessageEditor/types"
import type { SendMessageOptions } from "../components/MessagePanel/types"
import {
	MessageStatus,
	type Workspace,
	type ProjectListItem,
	type Topic,
	type TopicMode,
} from "../pages/Workspace/types"
import { superMagicStore } from "../stores"
import { smartRenameTopicIfUnnamed } from "./topicRename"

const logger = Logger.createLogger("messageSendService")

export interface HandleSendParams {
	value: JSONContent | undefined
	mentionItems: MentionListItem[]
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	topicMode?: TopicMode
	isFromQueue?: boolean
	queueId?: string
	extra?: Record<string, unknown>
}

export interface SendContentParams {
	content: JSONContent | string
	options?: SendMessageOptions
	showLoading?: boolean
	context?: SendRuntimeContext
}

export interface DispatchMessageParams {
	content?: string
	jsonContent?: JSONContent
	options?: SendMessageOptions
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
	workspaceId?: string
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
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
			this.dispatchMessage({
				content,
				showLoading,
				options,
				context,
			})
			return
		}

		if (!isEmptyJSONContent(content)) {
			this.dispatchMessage({
				jsonContent: content,
				showLoading,
				options,
				context,
			})
		}
	}

	dispatchMessage({
		content: textContent,
		jsonContent,
		showLoading,
		options,
		selectedProject,
		selectedTopic,
		context,
	}: DispatchMessageParams) {
		// 发送前必须有有效话题
		const currentProject =
			selectedProject ?? context?.selectedProject ?? options?._tempProject ?? null
		const currentTopic = selectedTopic ?? context?.selectedTopic ?? options?._tempTopic ?? null

		if (!currentTopic?.id) {
			this.deps.logger.error("发送消息 - 未找到选中的话题")
			return
		}

		const isRichText = isObject(jsonContent)
		const content = isRichText ? JSON.stringify(jsonContent) : textContent?.trim()
		if (!content) {
			return
		}

		// 话题名为空时根据内容自动命名
		if (currentProject && currentTopic) {
			const userQuestion = isRichText
				? generateTextFromJSONContent(jsonContent)
				: textContent?.trim() || ""

			void smartRenameTopicIfUnnamed({
				topic: currentTopic,
				userQuestion,
				updateTopicName: context?.updateTopicName,
			})
				.then((topicName) => {
					if (!topicName) return

					this.handleSmartProjectRename({
						project: currentProject,
						topicName,
						context,
					})
				})
				.catch((error) => {
					this.deps.logger.error("Smart topic rename failed", error)
				})
		}

		const messageType = isRichText
			? ConversationMessageType.RichText
			: ConversationMessageType.Text
		const messageId = generateUniqueId()
		const { chat_topic_id, chat_conversation_id } = currentTopic
		const date = new Date().getTime()

		const sendOptions = stripTempOptions(options)

		if (currentTopic?.id && sendOptions?.extra?.super_agent?.mentions) {
			const mentions = sendOptions.extra.super_agent.mentions
			this.deps.mentionPanelStore.addMentionListItemsToHistory(mentions)
		}

		// 调用聊天接口发送消息
		const sendMessage = () => {
			this.deps.chatApi.chat(EventType.Chat, {
				message: {
					type: messageType,
					[messageType]: {
						content,
						instructs: [{ value: showLoading ? "follow_up" : "normal" }],
						...sendOptions,
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
		}

		// 存在撤回消息时先确认撤回状态
		const messageList = this.getMessageList(currentTopic)
		if (messageList.some((message) => message?.status === MessageStatus.REVOKED)) {
			this.deps.pubsub.publish(PubSubEvents.Hide_Revoked_Messages)
			const confirmPromise = this.deps.superMagicApi.confirmUndoMessage({
				topic_id: currentTopic.id,
			})
			if (confirmPromise) {
				confirmPromise
					.then(() => {
						sendMessage()
						this.deps.pubsub.publish(PubSubEvents.Refresh_Topic_Messages)
					})
					.catch(() => {
						this.deps.pubsub.publish(PubSubEvents.Show_Revoked_Messages)
					})
			}
			return
		}

		sendMessage()
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
		void tabPattern

		try {
			if (!currentProject?.id || !currentTopic?.id) {
				this.deps.logger.error("handleSend error: missing project/topic context")
				setIsSending(false)
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
			this.dispatchMessage({
				jsonContent: params.value,
				showLoading: followUp,
				options: data,
				selectedProject: currentProject,
				selectedTopic: currentTopic,
				context,
			})

			if (!params.isFromQueue) {
				editorRef?.clearContentAfterSend()
			}

			setIsSending(false)

			if (!params.isFromQueue) {
				if (isMobile) {
					setFocused(false)
				} else {
					setTimeout(() => {
						editorRef?.focus({ enableWhenIsMobile: false })
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
			this.deps.logger.error("handleSend error", error)
			setIsSending(false)
		}
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
		const model = params.selectedModel
			? {
					model_id: params.selectedModel.model_id,
				}
			: undefined

		const imageModel = params.selectedImageModel?.model_id
			? {
					model_id: params.selectedImageModel.model_id,
				}
			: undefined

		// 根据话题读取联网搜索开关
		const isInternetSearch = internetSearchManager.getIsChecked(
			isEmptyStatus ? DEFAULT_KEY : currentTopic?.id,
		)

		if (isEmptyStatus && currentTopic?.id) {
			internetSearchManager.setIsChecked(currentTopic.id, isInternetSearch)
		}

		const transformedMentionItems = transformMentions(mentionItems)

		return {
			extra: {
				super_agent: {
					mentions: transformedMentionItems,
					chat_mode: "normal" as const,
					topic_pattern: currentTopic?.topic_mode,
					model,
					enable_web_search: isInternetSearch,
					...(imageModel && { image_model: imageModel }),
					...(params.queueId && { queue_id: params.queueId }),
					...(params.extra && { ...params.extra }),
				},
			},
			_tempProject: currentProject ?? undefined,
			_tempTopic: currentTopic ?? undefined,
		}
	}

	private getMessageList(topic: Topic) {
		return this.deps.superMagicStore.messages?.get(topic?.chat_topic_id || "") || []
	}

	private handleSmartProjectRename({
		project,
		topicName,
		context,
	}: {
		project: ProjectListItem
		topicName: string
		context?: SendRuntimeContext
	}) {
		if (topicName && project && !project.project_name) {
			const workspaceId =
				(context?.workspaceId ?? context?.selectedWorkspace?.id ?? project.workspace_id) ||
				""
			if (workspaceId) {
				void context?.renameProject?.(project.id, topicName, workspaceId)
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

function stripTempOptions(options?: SendMessageOptions): SendMessageOptions | undefined {
	if (!options) return undefined
	// 发送前移除临时字段
	const { _tempProject, _tempTopic, ...rest } = options
	void _tempProject
	void _tempTopic
	return rest
}
