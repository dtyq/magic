import { cloneDeep, isObject } from "lodash-es"
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
import { ProjectStorage } from "@/components/Agent/MCP/service/MCPStorageService"
import { userStore } from "@/models/user"
import { mentionItemsProcessor } from "../components/MessageEditor/services/MentionItemsProcessor"
import { superMagicUploadTokenService } from "../components/MessageEditor/services/UploadTokenService"
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
	type ProjectListItem,
	type Topic,
	type TopicMode,
} from "../pages/Workspace/types"
import SuperMagicService from "../services"
import { superMagicStore } from "../stores"
import { projectStore, topicStore, workspaceStore } from "../stores/core"
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
}

export interface DispatchMessageParams {
	content?: string
	jsonContent?: JSONContent
	options?: SendMessageOptions
	showLoading: boolean
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
}

export interface PanelSendInput {
	params: HandleSendParams
	isSending: boolean
	setIsSending: (isSending: boolean) => void
	showLoading: boolean
	isMobile: boolean
	isEmptyStatus: boolean
	tabPattern: TopicMode
	editorRef?: MessageEditorRef | null
	setFocused: (isFocused: boolean) => void
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	messagesLength?: number
	setSelectedProject?: (project: ProjectListItem | null) => void
	setSelectedTopic?: (topic: Topic | null) => void
}

export interface SendPanelMessageResult {
	currentProject: ProjectListItem | null
	currentTopic: Topic | null
}

interface MessageSendServiceDeps {
	chatApi: typeof ChatApi
	superMagicApi: typeof SuperMagicApi
	pubsub: typeof pubsub
	mentionPanelStore: MentionPanelStore
	userStore: typeof userStore
	superMagicStore: typeof superMagicStore
	projectStore: typeof projectStore
	topicStore: typeof topicStore
	workspaceStore: typeof workspaceStore
	superMagicService: typeof SuperMagicService
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
		projectStore,
		topicStore,
		workspaceStore,
		superMagicService: SuperMagicService,
		logger,
	}

	configure(deps: Partial<MessageSendServiceDeps>) {
		this.deps = {
			...this.deps,
			...deps,
		}
	}

	sendContent({ content, options, showLoading = false }: SendContentParams) {
		// 发送前统一处理内容格式
		if (typeof content === "string") {
			this.dispatchMessage({
				content,
				showLoading,
				options,
			})
			return
		}

		if (!isEmptyJSONContent(content)) {
			this.dispatchMessage({
				jsonContent: content,
				showLoading,
				options,
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
	}: DispatchMessageParams) {
		// 发送前必须有有效话题
		const currentProject =
			selectedProject ?? this.deps.projectStore.selectedProject ?? options?._tempProject
		const currentTopic =
			selectedTopic ?? this.deps.topicStore.selectedTopic ?? options?._tempTopic

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
				updateTopicName: this.deps.topicStore.updateTopicName,
			})
				.then((topicName) => {
					if (!topicName) return

					this.handleSmartProjectRename({
						project: currentProject,
						topicName,
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

	createTopic({
		selectedProject,
	}: {
		selectedProject?: ProjectListItem | null
	} = {}) {
		return this.deps.superMagicService.handleCreateTopic({
			selectedProject: selectedProject ?? this.deps.projectStore.selectedProject,
		})
	}

	async sendPanelMessage({
		params,
		isSending,
		setIsSending,
		showLoading,
		isMobile,
		isEmptyStatus,
		tabPattern,
		editorRef,
		setFocused,
		selectedProject,
		selectedTopic,
		messagesLength = 0,
		setSelectedProject,
		setSelectedTopic,
	}: PanelSendInput): Promise<SendPanelMessageResult | undefined> {
		if (!params.value || isSending) {
			return
		}

		setIsSending(true)

		const fallbackProject = this.deps.projectStore.selectedProject
		const fallbackTopic = this.deps.topicStore.selectedTopic
		let currentProject: ProjectListItem | null = selectedProject ?? fallbackProject ?? null
		let currentTopic: Topic | null = selectedTopic ?? fallbackTopic ?? null
		let mentionItems = cloneDeep(params.mentionItems)
		let content = cloneDeep(params.value)

		try {
			// 发送前准备项目、话题与提及信息
			const sendPreparation = currentProject?.id
				? await this.prepareSendWithProject({
					params,
					currentProject,
					currentTopic,
					mentionItems,
					content,
					tabPattern,
					editorRef,
					messagesLength,
					setSelectedTopic,
				})
				: await this.prepareSendWithoutProject({
					mentionItems,
					content,
					tabPattern,
					setSelectedProject,
					setSelectedTopic,
				})

			if (!sendPreparation) {
				setIsSending(false)
				return
			}

			currentProject = sendPreparation.currentProject
			currentTopic = sendPreparation.currentTopic
			mentionItems = sendPreparation.mentionItems
			content = sendPreparation.content

			const data = this.buildSendOptions({
				params,
				mentionItems,
				currentProject,
				currentTopic,
				isEmptyStatus,
			})

			const followUp = showLoading && messagesLength > 1
			this.dispatchMessage({
				jsonContent: content,
				showLoading: followUp,
				options: data,
				selectedProject: currentProject,
				selectedTopic: currentTopic,
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

	private async prepareSendWithoutProject({
		mentionItems,
		content,
		tabPattern,
		setSelectedProject,
		setSelectedTopic,
	}: {
		mentionItems: MentionListItem[]
		content: JSONContent
		tabPattern: TopicMode
		setSelectedProject?: (project: ProjectListItem | null) => void
		setSelectedTopic?: (topic: Topic | null) => void
	}) {
		let currentProject = this.deps.projectStore.selectedProject
		let currentTopic = this.deps.topicStore.selectedTopic

		// 未选中项目时自动创建项目与话题
		const lastWorkDir = superMagicUploadTokenService.getLastWorkDir()
		const res = await this.deps.superMagicService.handleCreateProject({
			projectMode: tabPattern,
			isAutoSelect: false,
			isEditProject: false,
			workdir: lastWorkDir,
		})

		if (res?.project) {
			currentProject = res.project
		}
		if (res?.topic) {
			currentTopic = res.topic
			currentTopic.topic_mode = tabPattern
		} else {
			return null
		}

		// 将缓存的 MCP 配置迁移到新项目
		const mcpCacheStorage = new ProjectStorage()
		const MCPCache = await mcpCacheStorage.getMCP()
		const storageStrategy = new ProjectStorage(currentProject?.id)

		if (MCPCache?.length > 0) {
			await storageStrategy.saveMCP(MCPCache)
			await mcpCacheStorage.saveMCP([])
		}

		let nextMentionItems = mentionItems

		// 按新项目/话题规范化提及信息
		if (currentProject && currentTopic) {
			const result = await mentionItemsProcessor.processMentionItems(
				content,
				mentionItems,
				currentProject.id,
				currentTopic.id,
			)
			nextMentionItems = result.mentionItems
			Object.assign(content, result.content)
		}

		this.setSelectedTopic(currentTopic, setSelectedTopic)
		this.setSelectedProject(currentProject, setSelectedProject)

		return {
			currentProject: currentProject ?? null,
			currentTopic: currentTopic ?? null,
			mentionItems: nextMentionItems,
			content,
		}
	}

	private async prepareSendWithProject({
		params,
		currentProject,
		currentTopic,
		mentionItems,
		content,
		tabPattern,
		editorRef,
		messagesLength,
		setSelectedTopic,
	}: {
		params: HandleSendParams
		currentProject: ProjectListItem | null | undefined
		currentTopic: Topic | null | undefined
		mentionItems: MentionListItem[]
		content: JSONContent
		tabPattern: TopicMode
		editorRef?: MessageEditorRef | null
		messagesLength: number
		setSelectedTopic?: (topic: Topic | null) => void
	}) {
		let nextTopic = currentTopic

		// 话题缺失时创建并设置话题模式
		if (!nextTopic?.id) {
			const newTopic = await this.deps.superMagicService.handleCreateTopic({
				selectedProject: currentProject ?? this.deps.projectStore.selectedProject,
			})
			if (newTopic) {
				const topicMode = params.topicMode ?? tabPattern
				const newTopicWithMode = {
					...newTopic,
					topic_mode: topicMode,
				}
				this.setSelectedTopic(newTopicWithMode, setSelectedTopic)
				nextTopic = newTopicWithMode

				if (params.selectedModel && params.selectedModel.model_id) {
					editorRef?.saveSuperMagicTopicModel({
						selectedTopic: newTopicWithMode,
						model: params.selectedModel,
						imageModel: params.selectedImageModel || null,
					})
				}
			}
		} else {
			const newTopicWithMode = {
				...nextTopic,
				topic_mode: params.topicMode ?? tabPattern,
			}
			this.setSelectedTopic(newTopicWithMode, setSelectedTopic)
			nextTopic = newTopicWithMode

			if (messagesLength === 0) {
				if (params.selectedModel && params.selectedModel.model_id) {
					editorRef?.saveSuperMagicTopicModel({
						selectedTopic: newTopicWithMode,
						model: params.selectedModel,
						imageModel: params.selectedImageModel || null,
					})
				}
			}
		}

		return {
			currentProject: currentProject ?? null,
			currentTopic: nextTopic ?? null,
			mentionItems,
			content,
		}
	}

	private setSelectedProject(
		project: ProjectListItem | null | undefined,
		setSelectedProject?: (project: ProjectListItem | null) => void,
	) {
		this.deps.projectStore.setSelectedProject(project ?? null)
		setSelectedProject?.(project ?? null)
	}

	private setSelectedTopic(
		topic: Topic | null | undefined,
		setSelectedTopic?: (topic: Topic | null) => void,
	) {
		this.deps.topicStore.setSelectedTopic(topic ?? null)
		setSelectedTopic?.(topic ?? null)
	}

	private getMessageList(topic: Topic) {
		return this.deps.superMagicStore.messages?.get(topic?.chat_topic_id || "") || []
	}

	private handleSmartProjectRename({
		project,
		topicName,
	}: {
		project: ProjectListItem
		topicName: string
	}) {
		if (topicName && project && !project.project_name) {
			const workspaceId =
				project.workspace_id || this.deps.workspaceStore.selectedWorkspace?.id || ""
			if (workspaceId) {
				void this.deps.superMagicService.project.renameProject(
					project.id,
					topicName,
					workspaceId,
				)
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
