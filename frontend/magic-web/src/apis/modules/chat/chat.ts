import { genRequestUrl } from "@/utils/http"

import type {
	ConversationFromService,
	GroupConversationDetail,
	GroupConversationMember,
	OpenConversationMessage,
} from "@/types/chat/conversation"
import type {
	ConversationMessageSend,
	ChatFileUrlData,
	ConversationMessage,
} from "@/types/chat/conversation_message"
import type { RevokeMessage, GroupCreateMessage } from "@/types/chat/control_message"
import { type CMessage, type MessageReceiveType, EventType } from "@/types/chat"
import { ControlEventMessageType } from "@/types/chat/control_message"
import { IntermediateMessageType } from "@/types/chat/intermediate_message"
import type {
	EditMessageOptions,
	LoginResponse,
	PaginationResponse,
	SeqResponse,
} from "@/types/request"
import { encodeSocketIoMessage } from "@/utils/socketio"
import { genAppMessageId, genRequestId } from "@/utils/random"
import type {
	DeleteTopicMessage,
	ConversationTopic,
	CreateTopicMessage,
} from "@/types/chat/topic"
import type { CreateGroupConversationParams } from "@/types/chat/seen_message"
import type {
	SeqRecord,
	GetMagicTopicNameResponse,
	MessageReceiveListResponse,
	GetConversationAiAutoCompletionResponse,
	GetConversationMessagesParams,
	UserAvailableAgentInfo,
} from "@/apis/modules/chat/types"
import { isString } from "lodash-es"
import type { Bot, QuickInstructionList, WithPage } from "@/types/bot"
import type {
	TaskListParams,
	UserTask,
	CreateTaskParams,
	ListData,
} from "@/types/chat/task"
import type { HttpClient } from "../../core/HttpClient"
import type { ChatWebSocket } from "../../clients/chatWebSocket"
import { fetchPaddingData } from "@/utils/request"

export const generateChatApi = (fetch: HttpClient, socket: ChatWebSocket) => ({
	/**
	 * 登录
	 * @param authorization 授权
	 * @returns
	 */
	login(authorization: string) {
		return socket.apiSend<LoginResponse>(
			encodeSocketIoMessage(
				EventType.Login,
				{
					message: {
						type: "text",
						text: {
							content: "登录",
						},
						app_message_id: genAppMessageId(),
					},
					conversation_id: "",
				},
				0,
				{
					authorization,
				},
			),
		)
	},
	/**
	 * 发送消息
	 * @param chatMessage 消息内容
	 * @param penddingIndex 等待发送索引
	 * @returns
	 */
	chat(
		chatType: EventType,
		chatMessage: {
			message: Omit<ConversationMessageSend["message"], "send_time" | "sender_id">
			conversation_id: string
			refer_message_id?: string
			edit_message_options?: EditMessageOptions
		},
	) {
		return socket.apiSend<{ type: "seq"; seq: SeqResponse<CMessage> }>(
			encodeSocketIoMessage(chatType, chatMessage),
		)
	},

	/**
	 * 创建会话
	 * @param receive_type 接收者类型
	 * @param receive_id 接收者id
	 * @returns
	 */
	createConversation(receive_type: MessageReceiveType, receive_id: string) {
		return socket.apiSend<{ type: "seq"; seq: SeqResponse<OpenConversationMessage> }>(
			encodeSocketIoMessage(
				EventType.Control,
				{
					message: {
						type: ControlEventMessageType.OpenConversation,
						[ControlEventMessageType.OpenConversation]: {
							receive_type,
							receive_id,
						},
						app_message_id: genAppMessageId(),
					},
					request_id: genRequestId(),
				},
				0,
			),
		)
	},

	/**
	 * 标记消息已读
	 * @param messageIds 消息id列表
	 * @returns
	 */
	seenMessages(messageIds: string[]) {
		return socket.apiSend<
			{
				type: "seq"
				seq: SeqResponse<ConversationMessage>
			}[]
		>(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.SeenMessages,
					[ControlEventMessageType.SeenMessages]: {
						refer_message_ids: messageIds,
					},
					app_message_id: genAppMessageId(),
				},
				request_id: genRequestId(),
			}),
		)
	},

	/**
	 * 获取多个会话详情
	 * @param ids 会话id列表
	 * @returns
	 */
	getConversationList(
		ids?: string[],
		options?: {
			status?: number
			limit?: number
			page_token?: string
			is_not_disturb?: 0 | 1
			is_top?: 0 | 1
			is_mark?: 0 | 1
			organization_code?: string
		},
	) {
		return fetch.post<PaginationResponse<ConversationFromService>>(
			genRequestUrl("/api/v1/im/conversations/queries"),
			{ ids, ...options },
		)
	},

	/**
	 * 拉取离线消息
	 * @param max_seq_info 最大序号
	 * @returns
	 */
	messagePull(data: { page_token: string }) {
		return fetch.get<PaginationResponse<SeqRecord<CMessage>>>(
			genRequestUrl("/api/v1/im/messages/page", {}, data),
		)
	},

	/**
	 * 拉取最近离线消息
	 * @param max_seq_info 最大序号
	 * @returns
	 */
	messagePullCurrent(data: { page_token: string }) {
		return fetch.get<PaginationResponse<{ type: "seq"; seq: SeqResponse<CMessage> }>>(
			genRequestUrl("/api/v1/im/messages", {}, data),
		)
	},

	/**
	 * 创建话题
	 * @param topicName 话题名称
	 * @param conversation_id 会话id
	 * @returns
	 */
	createTopic(topicName: string | undefined, conversation_id: string) {
		return socket.apiSend<{
			type: "seq"
			seq: SeqResponse<CreateTopicMessage>
		}>(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.CreateTopic,
					[ControlEventMessageType.CreateTopic]: {
						name: topicName,
						conversation_id,
					},
				},
			}),
		)
	},

	/**
	 * 更新话题
	 * @param topicId 话题id
	 * @param topicName 话题名称
	 * @returns
	 */
	updateTopic(conversation_id: string, topicId: string, topicName: string) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.UpdateTopic,
					[ControlEventMessageType.UpdateTopic]: {
						id: topicId,
						name: topicName,
						conversation_id,
					},
				},
			}),
		)
	},

	/**
	 * 删除话题
	 * @param topicId 话题id
	 * @returns
	 */
	deleteTopic(conversation_id: string, topicId: string) {
		return socket.apiSend<{
			type: "seq"
			seq: SeqResponse<DeleteTopicMessage>
		}>(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.DeleteTopic,
					[ControlEventMessageType.DeleteTopic]: {
						id: topicId,
						conversation_id,
					},
				},
			}),
		)
	},

	/**
	 * 获取AI 总结话题名称
	 * @param conversation_id 会话id
	 * @param id 话题id
	 * @returns
	 */
	getMagicTopicName(conversation_id: string, id: string) {
		return fetch.put<GetMagicTopicNameResponse>(
			genRequestUrl("/api/v1/im/conversations/${conversationId}/topics/${topicId}/name", {
				conversationId: conversation_id,
				topicId: id,
			}),
		)
	},

	/**
	 * 获取话题列表
	 * @param conversation_id 会话id
	 * @returns
	 */
	getTopicList(conversationId: string) {
		return fetch.post<ConversationTopic[]>(
			genRequestUrl("/api/v1/im/conversations/${conversationId}/topics/queries", {
				conversationId,
			}),
		)
	},

	/**
	 * 获取话题消息
	 * @param {string | Array<string>} topic_ids 话题id列表
	 * @returns
	 */
	getTopicMessages(topicIds: string | string[]) {
		const topic_ids = isString(topicIds) ? [topicIds] : topicIds

		return fetch.post(genRequestUrl("/api/v2/magic/topic/messages"), { topic_ids })
	},

	/**
	 * 开始会话输入
	 * @param conversation_id 会话id
	 * @returns
	 */
	startConversationInput(conversation_id: string) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: IntermediateMessageType.StartConversationInput,
					[IntermediateMessageType.StartConversationInput]: {
						conversation_id,
					},
				},
			}),
		)
	},

	/**
	 * 结束会话输入
	 * @param conversation_id 会话id
	 * @returns
	 */
	endConversationInput(conversation_id: string) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: IntermediateMessageType.EndConversationInput,
					[IntermediateMessageType.EndConversationInput]: {
						conversation_id,
					},
				},
			}),
		)
	},

	/**
	 * 创建群聊
	 * @param data 创建群聊参数
	 * @returns
	 */
	createGroupConversation(data: CreateGroupConversationParams) {
		return fetch.post<{ type: "seq"; seq: SeqResponse<GroupCreateMessage> }>(
			genRequestUrl("/api/v1/contact/groups"),
			data,
		)
	},

	/**
	 * 批量获取群聊详情
	 * @param data 获取群聊详情参数
	 * @returns
	 */
	getGroupConversationDetails(data: { group_ids: string[]; page_token?: string }) {
		return fetch.post<PaginationResponse<GroupConversationDetail>>(
			genRequestUrl("/api/v1/contact/groups/queries"),
			data,
		)
	},

	/**
	 * 获取群聊成员
	 * @param conversation_id 会话id
	 * @returns
	 */
	getGroupConversationMembers(data: { group_id: string; page_token?: string }) {
		return fetch.get<PaginationResponse<GroupConversationMember>>(
			genRequestUrl(
				"/api/v1/contact/groups/${id}/members",
				{ id: data.group_id },
				{
					page_token: data.page_token,
				},
			),
		)
	},

	/**
	 * 获取消息接收者列表
	 * @param messageId 消息id
	 * @returns
	 */
	getMessageReceiveList(messageId: string) {
		return fetch.get<MessageReceiveListResponse>(
			genRequestUrl("/api/v1/im/messages/${messageId}/recipients", { messageId }),
		)
	},

	/**
	 * 添加群组成员
	 * @param data 添加群组成员参数
	 * @returns
	 */
	addGroupUsers(data: { group_id: string; user_ids?: string[]; department_ids?: string[] }) {
		return fetch.post(
			genRequestUrl("/api/v1/contact/groups/${id}/members", { id: data.group_id }),
			data,
		)
	},

	/**
	 * 撤回消息
	 * @param messageId 消息id
	 * @returns
	 */
	revokeMessage(messageId: string) {
		return socket.apiSend<{
			type: "seq"
			seq: SeqResponse<RevokeMessage>
		}>(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.RevokeMessage,
					[ControlEventMessageType.RevokeMessage]: {
						refer_message_id: messageId,
					},
					app_message_id: genAppMessageId(),
				},
				request_id: genRequestId(),
			}),
		)
	},

	/**
	 * 退出群聊
	 * @param data 退出群聊参数
	 * @returns
	 */
	leaveGroup(data: { group_id: string }) {
		return fetch.delete(
			genRequestUrl("/api/v1/contact/groups/${id}/members/self", { id: data.group_id }),
		)
	},

	/**
	 * 踢出群聊
	 * @param data 踢出群聊参数
	 * @returns
	 */
	kickGroupUsers(data: { group_id: string; user_ids: string[] }) {
		return fetch.delete(
			genRequestUrl("/api/v1/contact/groups/${id}/members", { id: data.group_id }),
			data,
		)
	},

	/**
	 * 解散群聊
	 * @param data 解散群聊参数
	 * @returns
	 */
	removeGroup(data: { group_id: string }) {
		return fetch.delete(genRequestUrl("/api/v1/contact/groups/${id}", { id: data.group_id }))
	},

	/**
	 * 更新群信息
	 * @param data 更新群信息参数
	 * @returns
	 */
	updateGroupInfo(data: { group_id: string; group_name?: string; group_avatar?: string }) {
		return fetch.put<GroupConversationDetail>(
			genRequestUrl("/api/v1/contact/groups/${id}", { id: data.group_id }),
			data,
		)
	},

	/**
	 * 获取聊天文件信息
	 * @param data 获取聊天文件参数
	 * @returns
	 */
	getChatFileUrls(data: { file_id: string; message_id: string }[]) {
		return fetch.post<Record<string, ChatFileUrlData>>(
			genRequestUrl("/api/v1/im/files/download-urls/queries"),
			data,
		)
	},

	/**
	 * 置顶会话
	 */
	topConversation(conversation_id: string, is_top: 0 | 1) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.TopConversation,
					[ControlEventMessageType.TopConversation]: {
						conversation_id,
						is_top,
					},
					app_message_id: genAppMessageId(),
				},
				request_id: genRequestId(),
			}),
		)
	},

	/**
	 * 隐藏会话
	 */
	hideConversation(conversation_id: string) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.HideConversation,
					[ControlEventMessageType.HideConversation]: {
						conversation_id,
					},
					app_message_id: genAppMessageId(),
				},
				request_id: genRequestId(),
			}),
		)
	},

	/**
	 * 免打扰消息
	 */
	muteConversation(conversation_id: string, is_not_disturb: 0 | 1) {
		return socket.apiSend(
			encodeSocketIoMessage(EventType.Control, {
				message: {
					type: ControlEventMessageType.MuteConversation,
					[ControlEventMessageType.MuteConversation]: {
						conversation_id,
						is_not_disturb,
					},
					app_message_id: genAppMessageId(),
				},
				request_id: genRequestId(),
			}),
		)
	},

	/**
	 * 获取AI 总结消息
	 * @returns
	 * @param data
	 */
	getConversationAiAutoCompletion(
		data: {
			conversation_id: string
			topic_id: string
			message: string
		},
		signal?: AbortSignal,
	) {
		return fetch.post<GetConversationAiAutoCompletionResponse>(
			genRequestUrl("/api/v1/im/conversations/${conversationId}/completions", {
				conversationId: data.conversation_id,
			}),
			data,
			{ signal },
		)
	},

	/**
	 * 获取 AI 自动补全(支持会话和话题为空)
	 * @param data
	 * @returns
	 */
	getAiAutoCompletion(data: { conversation_id: string; topic_id: string; message: string }) {
		return fetch.post<GetConversationAiAutoCompletionResponse>(
			genRequestUrl("/api/v1/im/typing/completions", {
				conversationId: data.conversation_id,
				topicId: data.topic_id,
				message: data.message,
			}),
			data,
		)
	},

	/**
	 * 获取 AI助理对应的机器人信息
	 * @param data 获取 AI助理对应的机器人信息参数
	 * @returns
	 */
	getAiAssistantBotInfo(data: { user_id: string }) {
		return fetch.get<Bot.Detail["botEntity"]>(
			genRequestUrl("/api/v1/agents/versions/${userId}/user", { userId: data.user_id }),
		)
	},

	/**
	 * 更新 AI会话 快捷指令配置
	 * @param data
	 * @returns
	 */
	updateAiConversationQuickInstructionConfig(data: {
		conversation_id: string
		receive_id: string
		instructs?: Record<string, unknown>
	}) {
		return fetch.post<{ instructs?: Record<string, unknown> }>(
			genRequestUrl("/api/v1/im/conversations/${conversationId}/instructs", {
				conversationId: data.conversation_id,
			}),
			data,
		)
	},

	/**
	 * 获取会话消息
	 * @param conversationId
	 * @param data
	 */
	getConversationMessages(conversationId: string, data: GetConversationMessagesParams) {
		return fetch.post<PaginationResponse<SeqRecord<ConversationMessage>>>(
			genRequestUrl("/api/v1/im/conversations/${conversationId}/messages/queries", {
				conversationId,
			}),
			data,
		)
	},

	/**
	 * 拉取离线消息
	 * 当WebSocket重连或页面从不可见变为可见时调用
	 */
	pullOfflineMessages() {
		// 获取当前最新的seq_id
		const lastSeqId = localStorage.getItem("lastSeqId") || "0"
		return this.messagePull({ page_token: lastSeqId })
	},

	/**
	 * 批量获取会话消息
	 * @param arg0
	 * @returns
	 */
	batchGetConversationMessages(arg0: { conversation_ids?: string[]; limit?: number }) {
		return fetch.post<Record<string, SeqRecord<ConversationMessage>[]>>(
			genRequestUrl("/api/v1/im/conversations/messages/queries"),
			arg0,
		)
	},

	/**
	 * 根据应用消息ID获取消息
	 * @param appMessageId 应用消息ID
	 * @returns
	 */
	getMessagesByAppMessageId(appMessageId: string) {
		return fetchPaddingData(
			(params) => {
				return fetch.post<PaginationResponse<SeqRecord<ConversationMessage>>>(
					genRequestUrl("/api/v1/im/messages/app-message-ids/${appMessageId}/queries", {
						appMessageId,
					}),
					params,
				)
			},
			[],
			"",
		)
	},

	/**
	 * 获取用户任务列表
	 * @param data
	 * @returns
	 */
	getTaskList(data: TaskListParams) {
		return fetch.get<ListData<UserTask>>(genRequestUrl("/api/v1/user/task", {}, { ...data }))
	},

	/**
	 * 获取用户任务
	 * @param id
	 * @returns
	 */
	getTask(id: string) {
		return fetch.get<null>(genRequestUrl("/api/v1/user/task/${id}", { id }))
	},

	/**
	 * 更新用户任务
	 * @param id
	 * @param data
	 * @returns
	 */
	updateTask(data: UserTask) {
		return fetch.put<ListData<UserTask>>(
			genRequestUrl("/api/v1/user/task/${id}", { id: data.id }),
			data,
		)
	},

	/**
	 * 删除用户任务
	 * @param id
	 * @returns
	 */
	deleteTask(id: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/user/task/${id}", { id }))
	},

	/**
	 * 创建用户任务
	 * @param {CreateTaskParams} data
	 * @returns
	 */
	createTask(data: CreateTaskParams) {
		return fetch.post<boolean>(genRequestUrl("/api/v1/user/task"), data)
	},

	/** 获取语音输入 token */
	getVoiceInputToken({
		duration = 300,
		refresh = false,
	}: { duration?: number; refresh?: boolean } = {}) {
		return fetch.get<{
			token: string
			app_id: string
			duration: number
			expires_at: number
			user?: {
				user_id: string
				organization_code: string
			}
		}>(
			genRequestUrl("/api/v1/asr/tokens", {
				duration,
				refresh: refresh ? "true" : "false",
			}),
		)
	},
	/** 获取可用AI助理列表 */
	async getAssistantAvailableList({
		page,
		pageSize,
		keyword,
	}: {
		page: number
		pageSize: number
		keyword?: string
	}) {
		return fetch.get<WithPage<UserAvailableAgentInfo[]>>(
			genRequestUrl(
				"/api/v1/agents/chat-mode/available",
				{},
				{
					page,
					page_size: pageSize,
					agent_name: keyword,
				},
			),
			{},
		)
	},
})
