/* eslint-disable class-methods-use-this */
import MessageCacheStore from "@/opensource/stores/chatNew/messageCache"
import MessageStore from "@/opensource/stores/chatNew/message"
import { isAppMessageId, genAppMessageId } from "@/utils/random"
import {
	SendStatus,
	ConversationMessageStatus,
	ConversationMessageType,
	AggregateAISearchCardV2Status,
} from "@/types/chat/conversation_message"
import dayjs from "dayjs"
import type {
	AIImagesMessage,
	FileConversationMessage,
	MarkdownConversationMessage,
	RecordSummaryConversationMessage,
	RichTextConversationMessage,
	TextConversationMessage,
	ConversationMessageSend,
	ConversationMessage,
	ImageConversationMessage,
	VideoConversationMessage,
	HDImageMessage,
	AggregateAISearchCardConversationMessageV2,
	AggregateAISearchCardConversationMessage,
} from "@/types/chat/conversation_message"
import { EventType } from "@/types/chat"
import { action, makeObservable, toJS } from "mobx"
import { isUndefined } from "lodash-es"
import { message as AntdMessage } from "antd"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import type { User } from "@/types/user"
import userInfoStore from "@/opensource/stores/userInfo"
import { StreamStatus, type SeqResponse } from "@/types/request"
import type { SeenMessage } from "@/types/chat/seen_message"
import Logger from "@/utils/log/Logger"
import type { FullMessage, MessagePage } from "@/types/chat/message"
import MessageReferStore from "@/opensource/stores/chatNew/messageUI/Reply"
import { ChatApi } from "@/apis"
import MessageDbService from "./MessageDbService"
import MessagePullService from "./MessagePullService"
import MessageSeqIdService from "./MessageSeqIdService"
import MessageCacheService from "./MessageCacheService"
import ConversationBotDataService from "../conversation/ConversationBotDataService"
import ConversationService from "../conversation/ConversationService"
import { getRevokedText, getSlicedText } from "../conversation/utils"
import DotsService from "../dots/DotsService"
import { userStore } from "@/opensource/models/user"
import { UpdateSpec } from "dexie"
import MessageFileService from "./MessageFileService"
import { getStringSizeInBytes } from "@/opensource/utils/size"
import { JSONContent } from "@tiptap/core"
import ChatFileService from "../file/ChatFileService"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"

import AiSearchApplyService from "./MessageApplyServices/ChatMessageApplyServices/AiSearchApplyService"
import { SeqRecord } from "@/opensource/apis/modules/chat/types"
const console = new Logger("MessageService", "blue")

type SendData =
	| Pick<TextConversationMessage, "type" | "text">
	| Pick<RichTextConversationMessage, "type" | "rich_text">
	| Pick<FileConversationMessage, "type" | "files">
	| Pick<MarkdownConversationMessage, "type" | "markdown">
	| Pick<AIImagesMessage, "type" | "ai_image_card">
	| Pick<RecordSummaryConversationMessage, "type" | "recording_summary">

interface MessageData {
	jsonValue: any
	normalValue: string
	onlyTextContent: boolean
	files: any[]
}

class MessageService {
	private messageDbService: MessageDbService

	private messagePullService: MessagePullService

	private userInfoCache: Map<string, User.UserInfo> = new Map()

	private pendingMessages: Map<string, ConversationMessageSend> = new Map()

	constructor() {
		this.messageDbService = new MessageDbService()
		this.messagePullService = new MessagePullService()

		makeObservable(this, { updateMessage: action.bound })
	}

	/**
	 * 初始化
	 */
	init() {
		this.messagePullService.registerMessagePullLoop()
	}

	/**
	 * 注销
	 */
	destroy() {
		this.messagePullService.unregisterMessagePullLoop()
		this.reset()
	}

	/**
	 * 重置数据
	 */
	reset() {
		// 记录到预热缓存
		this.changeConversationCache()
		// 重置消息数据
		MessageStore.reset()
	}

	/**
	 * 初始化消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 */
	public async initMessages(conversationId: string, topicId: string = "") {
		console.log("initMessages ====> ", conversationId, topicId)
		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			return
		}

		// 切换会话, 或者切换话题
		if (
			MessageStore.conversationId &&
			(conversationId !== MessageStore.conversationId || topicId !== MessageStore.topicId)
		) {
			this.changeConversationCache()
		}

		// 重置，避免视图混乱
		MessageStore.reset()

		console.log("getMessages ====> ", conversationId, topicId)
		let data: MessagePage = {
			page: 1,
			pageSize: 10,
			totalPages: 1,
			messages: [],
		}

		// 优先读取从缓存中获取
		if (MessageCacheStore.has(conversationId, topicId)) {
			data = MessageCacheStore.getPage(conversationId, topicId, 1, MessageStore.pageSize)
			console.log("messages cache ====> ", data)
		}

		// 没有数据，则从服务器获取
		if (!data.messages?.length) {
			// 缓存中没有，尝试从数据库取
			data = await this.getMessagesByPage(conversationId, topicId, 1, MessageStore.pageSize)
			console.log("messages db ====> ", data)

			// 数据库没有，则从服务端获取
			if (!data.messages?.length) {
				const serverMessages = await this.messagePullService.pullMessagesFromServer({
					conversationId,
					topicId,
					pageSize: MessageStore.pageSize,
					withoutSeqId: true,
				})

				// 如果有远程数据，处理数据
				if (serverMessages) {
					const messages = serverMessages.map((item) =>
						this.formatMessage(item, userStore.user.userInfo),
					)

					data = {
						pageSize: MessageStore.pageSize,
						totalPages: Math.ceil(serverMessages.length / MessageStore.pageSize),
						messages,
					}

					console.log("messages server ====> ", data)
				}
			}
		}

		console.log("messages init ====> ", data)

		// 当前一定是第一页
		MessageStore.setPageConfig(1, data.totalPages ?? 1)
		this.checkMessageAttachmentExpired(data.messages)
		MessageStore.setMessages(conversationId, topicId, data.messages ?? [])

		// 获取未读的消息，发送已读回执
		const unreadMessages = MessageStore.messages.filter(
			(message) =>
				!message.is_self &&
				(message.message.unread_count > 0 ||
					message.seen_status === ConversationMessageStatus.Unread),
		)
		if (unreadMessages.length) {
			this.sendReadReceipt(unreadMessages)
		}

		// 设置渲染会话的拉取序列号
		MessageSeqIdService.updateConversationRenderSeqId(
			conversationId,
			data.messages[0]?.seq_id ?? "",
		)

		// 拉取会话的离线消息
		this.messagePullService.pullMessagesFromServer({
			conversationId,
			topicId,
			pageSize: 100,
			withoutSeqId: true,
		})
	}

	/**
	 * 发送已读回执
	 */
	sendReadReceipt(messages: FullMessage[]) {
		console.log("sendReadReceipt ====> ", messages)
		const messageIds = messages.map((message) => message.message_id)
		ChatApi.seenMessages(messageIds).then(({ data: response }) => {
			response?.forEach(({ seq: item }) => {
				// 标记为 0，认为该消息已经已读，后续不再发送
				this.updateMessageUnreadCount(
					item.conversation_id,
					item.message.topic_id ?? "",
					item.message_id,
					item.seq_id,
					0,
				)
			})
		})
	}

	/**
	 * 当前会话置入缓存
	 */
	private changeConversationCache() {
		if (!MessageStore.conversationId || !MessageStore.messages) {
			return
		}

		const messages = toJS(MessageStore.messages).reverse() // 重置排序，避免缓存读取序列乱了

		// 合并状态
		messages.forEach((message) => {
			const sendStatus = MessageStore.sendStatusMap.get(message.message_id)
			if (sendStatus) {
				message.send_status = sendStatus
			}
			const seenStatus = MessageStore.seenStatusMap.get(message.message_id)
			if (seenStatus) {
				message.seen_status = seenStatus
			}
		})

		console.log("changeConversationCache messages ======> ", messages)

		// 切换的消息默认最高优先级
		MessageCacheStore.set(
			MessageStore.conversationId,
			MessageStore.topicId,
			{
				page: 1,
				pageSize: MessageStore.pageSize,
				totalPages: MessageStore.totalPages,
				messages,
			},
			1,
		)
	}

	/**
	 * 格式化消息数据
	 * @param message 原始消息数据
	 * @param currentUserInfo 当前用户信息
	 * @returns 格式化后的消息
	 */
	public formatMessage(
		message: ConversationMessageSend | SeqResponse<ConversationMessage>,
		currentUserInfo: User.UserInfo | null,
	): FullMessage {
		const isUnReceived = isAppMessageId(message.message_id)
		const isSelf = message.message.sender_id === currentUserInfo?.user_id

		let senderInfo = currentUserInfo
		if (!isSelf) {
			// 获取发送者信息
			senderInfo = this.getUserInfo(message.message.sender_id)
		}

		const messageType = message.message.type

		return {
			temp_id: message.message.app_message_id,
			message_id: message.message_id,
			// @ts-ignore
			seq_id: message.seq_id,
			sender_id: message.message.sender_id,
			magic_id: message.message.sender_id,
			conversation_id: message.conversation_id,
			type: messageType,
			send_time: message.message.send_time.toString(),
			is_self: isSelf,
			is_unreceived: isUnReceived,
			name: senderInfo?.nickname ?? "", // 用户名
			avatar: senderInfo?.avatar ?? "", // 头像
			// @ts-ignore
			message: message.message,
			// @ts-ignore
			seen_status: message.message.status,
			send_status: SendStatus.Success,
			// @ts-ignore
			unread_count: message.message.unread_count,
			refer_message_id: message.refer_message_id,
			revoked:
				message.message?.revoked ||
				// @ts-ignore
				message.message?.status === ConversationMessageStatus.Revoked ||
				false,
		}
	}

	/**
	 * 从服务端拉取更多消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param loadHistory 是否是加载历史消息
	 * @returns 消息列表
	 */
	private async pullMoreMessages(
		conversationId: string,
		topicId: string = "",
		loadHistory: boolean = true,
	): Promise<MessagePage | null> {
		// 尝试从服务器获取下一页的
		const messages = await this.messagePullService.pullMessagesFromServer({
			conversationId,
			topicId,
			pageSize: MessageStore.pageSize,
			loadHistory,
		})

		if (messages && messages.length > 0) {
			return {
				pageSize: MessageStore.pageSize,
				totalPages: Math.ceil(messages.length / MessageStore.pageSize),
				messages: messages.map((item) => this.formatMessage(item, userStore.user.userInfo)),
			}
		}

		return null
	}

	/**
	 * 获取历史消息
	 * @param conversationId
	 * @param topicId
	 * @returns
	 */
	public async getHistoryMessages(conversationId: string, topicId: string = "") {
		if (!MessageStore.hasMoreHistoryMessage) return
		if (conversationId !== MessageStore.conversationId || topicId !== MessageStore.topicId) {
			return
		}

		console.log("getHistoryMessages start ====> ", conversationId, topicId)

		let data: MessagePage | null = null
		// 优先从缓存中获取
		if (MessageCacheStore.has(conversationId, topicId)) {
			data = MessageCacheStore.getPage(
				conversationId,
				topicId,
				MessageStore.page + 1,
				MessageStore.pageSize,
			)
		}

		// 缓存没有数据，从其他渠道获取
		if (!data?.messages?.length) {
			// 从数据库获取数据
			data = await this.getMessagesByPage(
				conversationId,
				topicId,
				MessageStore.page + 1, // 下一页
				MessageStore.pageSize,
			)

			if (!data?.messages?.length) {
				data = await this.pullMoreMessages(conversationId, topicId)
				console.log("getHistoryMessages by server ====> ", data)
			}
		}

		// 会话变化，则不添加消息，增加到缓存区
		if (conversationId !== MessageStore.conversationId || topicId !== MessageStore.topicId) {
			MessageCacheStore.addMessages(conversationId, topicId, {
				page: MessageStore.page + 1,
				pageSize: MessageStore.pageSize,
				totalPages: data?.totalPages ?? 1,
				messages: data?.messages ?? [],
			})
			return
		}
		if (data?.messages?.length) {
			// 获取未读的消息，发送已读回执
			const unreadMessages = data.messages.filter((message) => message.unread_count > 0)
			if (unreadMessages.length) {
				this.sendReadReceipt(unreadMessages)
			}
			this.checkMessageAttachmentExpired(data.messages)
			MessageStore.addMessages(data.messages)
			MessageStore.setPageConfig(MessageStore.page + 1, data.totalPages ?? 1)
		} else {
			MessageStore.setHasMoreHistoryMessage(false)
		}
	}

	/**
	 * 检查消息附件是否过期
	 */
	checkMessageAttachmentExpired(messages: FullMessage[]) {
		const expiredFiles = messages.reduce((prev, cur) => {
			switch (cur.type) {
				case ConversationMessageType.Files:
					;(cur.message as FileConversationMessage).files?.attachments.forEach((file) => {
						if (ChatFileService.checkFileExpired(file.file_id)) {
							prev.push({ message_id: cur.message_id, file_id: file.file_id })
						}
					})
					break
				case ConversationMessageType.RichText:
					;(cur.message as RichTextConversationMessage).rich_text?.attachments?.forEach(
						(file) => {
							if (ChatFileService.checkFileExpired(file.file_id)) {
								prev.push({ message_id: cur.message_id, file_id: file.file_id })
							}
						},
					)
					break
				case ConversationMessageType.Text:
					;(cur.message as TextConversationMessage).text?.attachments?.forEach((file) => {
						if (ChatFileService.checkFileExpired(file.file_id)) {
							prev.push({ message_id: cur.message_id, file_id: file.file_id })
						}
					})
					break
				case ConversationMessageType.Markdown:
					;(cur.message as MarkdownConversationMessage).markdown?.attachments?.forEach(
						(file) => {
							if (ChatFileService.checkFileExpired(file.file_id)) {
								prev.push({ message_id: cur.message_id, file_id: file.file_id })
							}
						},
					)
					break
				case ConversationMessageType.Image:
					const fileId = (cur.message as ImageConversationMessage).image?.file_id
					if (fileId && ChatFileService.checkFileExpired(fileId)) {
						prev.push({ message_id: cur.message_id, file_id: fileId })
					}
					break
				case ConversationMessageType.Video:
					const videoId = (cur.message as VideoConversationMessage).video?.file_id
					if (videoId && ChatFileService.checkFileExpired(videoId)) {
						prev.push({ message_id: cur.message_id, file_id: videoId })
					}
					break
				case ConversationMessageType.AiImage:
					;(cur.message as AIImagesMessage).ai_image_card?.items?.forEach((item) => {
						if (ChatFileService.checkFileExpired(item.file_id)) {
							prev.push({ message_id: cur.message_id, file_id: item.file_id })
						}
					})
					break
				case ConversationMessageType.HDImage:
					const hdImageId = (cur.message as HDImageMessage).image_convert_high_card
						?.new_file_id
					if (hdImageId && ChatFileService.checkFileExpired(hdImageId)) {
						prev.push({ message_id: cur.message_id, file_id: hdImageId })
					}
					break
				default:
					break
			}

			return prev
		}, [] as { message_id: string; file_id: string }[])

		// 获取过期文件的url
		if (expiredFiles.length) {
			ChatFileService.fetchFileUrl(expiredFiles)
		}
	}

	/**
	 * 添加待发送的消息
	 * @param message 消息
	 */
	public async addPendingMessage(message: ConversationMessageSend) {
		// 已经存在不需重复添加
		if (this.pendingMessages.has(message.message_id)) {
			return
		}

		this.pendingMessages.set(message.message_id, message)
		// 增加到数据库
		setTimeout(() => {
			this.messageDbService.addPendingMessage(message)
		})
	}

	/**
	 * 发送文本消息
	 * @param conversationId 会话ID
	 * @param sendData 发送数据
	 * @param referMessageId 引用消息ID
	 */
	public async formatAndSendMessage(
		conversationId: string,
		sendData: SendData,
		referMessageId = "",
	) {
		const { userInfo } = userStore.user
		const sendId = genAppMessageId()

		const message: ConversationMessageSend = {
			message_id: sendId,
			conversation_id: conversationId,
			status: SendStatus.Pending,
			refer_message_id: referMessageId,
			message: {
				...sendData,
				app_message_id: sendId,
				topic_id: conversationStore.currentConversation?.current_topic_id ?? "",
				sender_id: userInfo?.user_id ?? "",
				send_time: dayjs().unix(),
			},
		}

		const renderMessage: FullMessage = {
			temp_id: sendId,
			message_id: sendId,
			magic_id: "",
			seq_id: "",
			refer_message_id: "",
			sender_message_id: sendId,
			conversation_id: conversationId,
			type: message.message.type,
			send_time: message.message.send_time.toString(),
			sender_id: userInfo?.user_id ?? "",
			is_self: true,
			is_unreceived: isAppMessageId(sendId),
			name: userInfo?.nickname ?? "",
			avatar: userInfo?.avatar ?? "", // 使用新方法处理头像
			message: {
				...message.message,
				unread_count: 1,
				status: ConversationMessageStatus.Unread,
				magic_message_id: sendId,
			},
			send_status: SendStatus.Pending, // 发送中
			seen_status: ConversationMessageStatus.Unread, // 未读
			unread_count: 1,
		}

		// 如果是当前会话，则添加到消息列表中
		const { currentConversation } = conversationStore

		if (currentConversation?.id === conversationId) {
			MessageStore.addSendMessage(renderMessage)
			console.log("发送消息到当前会话", conversationId, "消息ID", sendId)
		} else {
			console.log(
				"发送消息到非当前会话",
				conversationId,
				"当前会话",
				currentConversation?.id,
				"消息ID",
				sendId,
			)
		}
		// 发送
		console.log("发送消息 ========> ", message)
		this.send(conversationId, referMessageId, message)
		// 广播
		BroadcastChannelSender.addSendMessage(renderMessage, message)
		// 添加消息到数据库中
		this.addPendingMessage(message)
	}

	/**
	 * 执行发送
	 */
	private async send(
		conversationId: string,
		referMessageId: string,
		message: ConversationMessageSend,
	) {
		const promise = ChatApi.chat(
			EventType.Chat,
			{
				message: message.message,
				conversation_id: conversationId,
				refer_message_id: referMessageId,
			},
			this.pendingMessages.size + 1,
		)
			.then(({ data: response }) => {
				if (!isUndefined(response)) {
					console.log(
						"消息发送成功，更新状态",
						"response:",
						response,
						"message:",
						message,
					)
					const tempId = message.message_id
					MessageStore.updateMessageSendStatus(tempId, SendStatus.Success)
					// 更新数据中pending的状态
					this.updatePendingMessageStatus(tempId, SendStatus.Success)
					this.addReceivedMessage(response.seq as SeqResponse<ConversationMessage>)
					console.log("发送成功，更新消息状态", response.seq)
					// 更新数据库
					// this.messageDbService.addMessage(message.conversation_id, response.seq)
					// 广播，更新状态和消息
					BroadcastChannelSender.updateSendMessage(
						response.seq as SeqResponse<ConversationMessage>,
						SendStatus.Success,
					)
					// 拉取离线消息
					this.messagePullService.pullOfflineMessages(response.seq.seq_id)
				}
			})
			.catch((err) => {
				// 发送失败
				console.log("发送失败 ======> ", message)
				MessageStore.updateMessageSendStatus(message.message_id, SendStatus.Failed)
				// 广播
				BroadcastChannelSender.updateMessageStatus(message.message_id, SendStatus.Failed)
				this.updatePendingMessageStatus(message.message_id, SendStatus.Failed)
				if (err?.message) AntdMessage.error(err.message)
			})

		console.log("promise =====> ", promise)
	}

	/**
	 * 发送录音消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param referMessageId 引用消息ID
	 * @param messageBase 消息基础数据
	 */
	sendRecordMessage(conversationId: string, referMessageId: string, messageBase: SendData) {
		this.formatAndSendMessage(conversationId, messageBase, referMessageId)
	}

	/**
	 * 提取文本
	 * @param jsonValue 富文本
	 * @returns 文本
	 */
	extractText(jsonValue: JSONContent) {
		if (!jsonValue) {
			return ""
		}
		const text: string[] = []

		const formatContent = (content: JSONContent) => {
			content.forEach((item: JSONContent) => {
				if (item.type === "text") {
					text.push(item.text ?? "")
				}

				if (item.type === "image") {
					try {
						text.push(JSON.stringify(item.attrs))
					} catch (error) {
						text.push(JSON.stringify(item))
					}
				}

				if (Array.isArray(item.content)) {
					formatContent(item.content)
				}
			})
		}

		if (jsonValue.content) {
			formatContent(jsonValue.content)
		}

		return text.join(`\n`)
	}

	/**
	 * 判断文本是否超过限制大小
	 * @param text 文本
	 * @param limitKB 限制大小，默认20KB
	 * @returns 是否超过限制
	 */
	isTextSizeOverLimit(text: string, limitKB = 20) {
		return getStringSizeInBytes(text) > limitKB
	}

	public async sendLongMessage(
		conversationId: string,
		data: MessageData,
		referMessageId?: string,
	) {
		const { normalValue, onlyTextContent, jsonValue, files } = data

		let text = ""

		// 纯文本直接走流程
		if (onlyTextContent) {
			text = normalValue ?? ""
		} else {
			text = this.extractText(jsonValue)
		}

		const reportRes = await MessageFileService.uploadFileByText(text)

		return this.sendMessage(
			conversationId,
			{
				normalValue: "",
				onlyTextContent: true,
				jsonValue: {
					type: "doc",
					content: [{ type: "paragraph", attrs: { suggestion: "" } }],
				},
				files: [...(reportRes as any[]), ...files],
			},
			referMessageId,
		)
	}

	/**
	 * 发送消息
	 * @param conversationId 会话ID
	 * @param data 消息数据
	 */
	public async sendMessage(conversationId: string, data: MessageData, referMessageId?: string) {
		const isAi = conversationStore.currentConversation?.isAiConversation
		const instructs = isAi ? ConversationBotDataService.genFlowInstructs() : undefined

		// 发送消息
		// TODO：识别消息类型
		const { normalValue, onlyTextContent, jsonValue, files } = data
		if (onlyTextContent) {
			if (!normalValue) {
				// 如果只有文件，则只发送文件
				if (files.length > 0) {
					console.log("发送文件消息", files)
					this.formatAndSendMessage(
						conversationId,
						{
							type: ConversationMessageType.Files,
							files: {
								attachments: files.map((file) => ({
									file_id: file.file_id,
								})),
								instructs,
							},
						},
						referMessageId,
					)
				} else {
					throw new Error("empty message")
				}
				return
			}

			// 文生图引用图片
			if (MessageReferStore.replyFile?.fileId && MessageReferStore.replyMessageId) {
				this.formatAndSendMessage(
					conversationId,
					{
						type: ConversationMessageType.Text,
						text: {
							content: normalValue,
							attachments: [{ file_id: MessageReferStore.replyFile?.fileId }],
						},
					},
					MessageReferStore.replyMessageId,
				)
				return
			}

			// 文本消息
			this.formatAndSendMessage(
				conversationId,
				{
					type: ConversationMessageType.Text, // 确保类型正确
					text: {
						content: normalValue,
						attachments: files.map((file) => ({
							file_id: file.file_id,
						})),
						instructs,
					},
				},
				referMessageId,
			)
		} else {
			// 富文本消息：图片或表情
			if (!jsonValue) {
				throw new Error("has no jsonValue")
			}

			// 如果只有一个图片
			if (
				jsonValue.content?.length === 1 &&
				jsonValue.content[0].type === "paragraph" &&
				jsonValue.content[0].content?.length === 1 &&
				jsonValue.content[0].content[0].type === "image"
			) {
				console.log("发送图片消息", jsonValue)
				const image = jsonValue.content[0].content[0]
				this.formatAndSendMessage(
					conversationId,
					{
						type: ConversationMessageType.Files,
						files: {
							attachments: [
								{
									file_id: image.attrs?.file_id,
									file_name: image.attrs?.file_name,
									file_extension: image.attrs?.file_extension,
									file_size: image.attrs?.file_size,
								},
							],
							instructs,
						},
					},
					referMessageId,
				)
			} else {
				// 文生图引用图片
				if (MessageReferStore.replyFile?.fileId && MessageReferStore.replyMessageId) {
					this.formatAndSendMessage(
						conversationId,
						{
							type: ConversationMessageType.RichText,
							rich_text: {
								content: JSON.stringify(jsonValue),
								attachments: [{ file_id: MessageReferStore.replyFile?.fileId }],
								instructs,
							},
						},
						MessageReferStore.replyMessageId,
					)
					return
				}

				console.log("发送富文本消息", normalValue, onlyTextContent, jsonValue, files)
				this.formatAndSendMessage(
					conversationId,
					{
						type: ConversationMessageType.RichText,
						rich_text: {
							content: JSON.stringify(jsonValue),
							attachments: files.map((item) => ({
								file_id: item.file_id,
							})),
							instructs,
						},
					},
					referMessageId,
				)
			}
		}
	}

	/**
	 * 更新待发送的消息
	 * @param messageId 消息 ID
	 * @param status 消息状态
	 * @param updateDb 是否更新数据库
	 */
	public async updatePendingMessageStatus(
		messageId: string,
		status: SendStatus,
		updateDb: boolean = true,
	) {
		// 更新内存中的pendingMessages对象
		if (this.pendingMessages.has(messageId)) {
			this.pendingMessages.set(messageId, {
				...this.pendingMessages.get(messageId),
				status,
			} as ConversationMessageSend)
			console.log("更新消息状态", messageId, status, this.pendingMessages.get(messageId))
		}

		if (updateDb) {
			// 更新数据库
			setTimeout(() => {
				this.messageDbService.updatePendingMessageStatus(messageId, status)
			})
		}
	}

	/**
	 * 重发消息
	 * @param app_message_id 消息请求 ID
	 * @returns
	 */
	public resendMessage(app_message_id: string) {
		const target = this.pendingMessages.get(app_message_id)

		if (!target) {
			throw Error(`resend message not found: ${app_message_id}`)
		}

		return this.send(target.conversation_id, target.refer_message_id ?? "", target)
	}

	/**
	 * 重发所有未发送的消息
	 * @param user_id 用户ID
	 */
	public resendAllPendingMessages(user_id?: string) {
		// 取出当前用户的所有未发送的消息
		const messages = Object.values(this.pendingMessages).filter(
			(message) => message.message.sender_id === user_id,
		)

		// 并行重发
		messages.forEach((message) => {
			this.resendMessage(message.message_id)
		})
	}

	/**
	 * 分页获取消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param page 页码（从1开始）
	 * @param pageSize 每页大小
	 * @returns 分页消息结果
	 */
	public async getMessagesByPage(
		conversationId: string,
		topicId: string = "",
		page: number = 1,
		pageSize: number = 10,
		userInfo: User.UserInfo | null = null,
	): Promise<MessagePage> {
		try {
			const res = await this.messageDbService.getMessagesByPage(
				conversationId,
				topicId,
				page,
				pageSize,
			)

			if (!userInfo) {
				userInfo = userStore.user.userInfo
			}

			// 格式化消息数据
			const messages = await Promise.all(
				res.messages.map((message: SeqResponse<ConversationMessage>) => {
					return this.checkMessageIntegrity(message)
						.then((message) => {
							return this.formatMessage(message, userInfo)
						})
						.catch((err) => {
							console.error("消息完整性检查失败", err, message)
							return this.formatMessage(message, userInfo)
						})
				}),
			)

			return { messages, page: res.page, pageSize: res.pageSize, totalPages: res.totalPages }
		} catch (error) {
			console.error("数据库访问错误，无法获取消息", error)
			return { messages: [], page: 1, pageSize: 10, totalPages: 1 }
		}
	}

	/**
	 * 检查消息完整性
	 * @param message 消息
	 * @returns 消息
	 */
	private async checkMessageIntegrity(message: SeqResponse<ConversationMessage>) {
		const appMessageId = message.message?.app_message_id

		switch (message.message.type) {
			case ConversationMessageType.AggregateAISearchCardV2:
				const msg = (message as SeqResponse<AggregateAISearchCardConversationMessageV2>)
					.message
				if (
					appMessageId &&
					(msg.aggregate_ai_search_card_v2?.stream_options?.status !== StreamStatus.End ||
						msg.aggregate_ai_search_card_v2?.status !==
							AggregateAISearchCardV2Status.isEnd)
				) {
					const messages = await ChatApi.getMessagesByAppMessageId(appMessageId).then(
						(messages) => {
							return messages.filter(
								(m) =>
									m.seq.message.type ===
									ConversationMessageType.AggregateAISearchCardV2,
							)
						},
					)
					if (messages.length > 0) {
						const msg = messages[0]
							.seq as SeqResponse<AggregateAISearchCardConversationMessageV2>

						msg.message.aggregate_ai_search_card_v2!.status =
							AggregateAISearchCardV2Status.isEnd

						return msg
					}
					return message
				}
				return message
			case ConversationMessageType.Text:
				if (
					appMessageId &&
					// 如果消息类型为文本，并且有stream_options，并且stream_options的状态不为End
					(message as SeqResponse<TextConversationMessage>).message.text
						?.stream_options &&
					(message as SeqResponse<TextConversationMessage>).message.text?.stream_options
						?.status !== StreamStatus.End
				) {
					const messages = await ChatApi.getMessagesByAppMessageId(appMessageId).then(
						(messages) => {
							return messages.filter(
								(m) => m.seq.message.type === ConversationMessageType.Text,
							)
						},
					)
					if (messages.length > 0) {
						return messages[0].seq as SeqResponse<TextConversationMessage>
					}
					return message
				}
				return message
			case ConversationMessageType.Markdown:
				if (
					appMessageId &&
					// 如果消息类型为Markdown，并且有stream_options，并且stream_options的状态不为End
					(message as SeqResponse<MarkdownConversationMessage>).message.markdown
						?.stream_options &&
					(message as SeqResponse<MarkdownConversationMessage>).message.markdown
						?.stream_options?.status !== StreamStatus.End
				) {
					const messages = await ChatApi.getMessagesByAppMessageId(appMessageId).then(
						(messages) => {
							return messages.filter(
								(m) => m.seq.message.type === ConversationMessageType.Markdown,
							)
						},
					)
					if (messages.length > 0) {
						return messages[0].seq as SeqResponse<MarkdownConversationMessage>
					}
					return message
				}
				return message
			case ConversationMessageType.AggregateAISearchCard:
				if (
					appMessageId &&
					!(message as SeqResponse<AggregateAISearchCardConversationMessage<false>>)
						.message.aggregate_ai_search_card?.finish
				) {
					const messages = await ChatApi.getMessagesByAppMessageId(appMessageId).then(
						(messages) => {
							return messages.filter(
								(m) =>
									m.seq.message.type ===
									ConversationMessageType.AggregateAISearchCard,
							) as SeqRecord<AggregateAISearchCardConversationMessage>[]
						},
					)
					if (messages.length > 0) {
						return (
							AiSearchApplyService.combineAiSearchMessage(
								messages.map((m) => m.seq),
							) ?? message
						)
					}
					return message
				}
				return message
			default:
				return message
		}
	}

	/**
	 * 首次加载时拉取消息
	 * @param magic_id 魔法ID
	 * @param organization_code 组织代码
	 * @returns 消息列表
	 */
	public pullMessageOnFirstLoad(magic_id: string, organization_code: string) {
		return this.messagePullService.pullMessageOnFirstLoad(magic_id, organization_code)
	}

	/**
	 * 获取用户信息，优先从缓存中获取，如果没有则从 userInfoService 获取
	 * @param userId 用户ID
	 * @returns 用户信息
	 */
	private getUserInfo(userId: string): User.UserInfo | null {
		// 1. 先从缓存中查找
		const cachedInfo = this.userInfoCache.get(userId)
		if (cachedInfo) {
			return cachedInfo
		}

		// 2. 从 userInfoService 获取
		const userInfo = userInfoStore.get(userId)
		if (userInfo) {
			const info: User.UserInfo = {
				magic_id: userInfo.magic_id,
				user_id: userInfo.user_id,
				status: userInfo.status,
				nickname: userInfo.nickname,
				avatar: userInfo.avatar_url,
				organization_code: userInfo.organization_code,
			}
			this.userInfoCache.set(userId, info)
			return info
		}

		return null
	}

	/**
	 * 添加历史消息到数据库
	 * @param conversationId 会话ID
	 * @param messages 消息列表
	 */
	addHistoryMessagesToDB(conversationId: string, messages: SeqResponse<ConversationMessage>[]) {
		this.messageDbService.addMessages(conversationId, messages)
	}

	/**
	 * 添加接收到的消息
	 * @param message 消息
	 */
	addReceivedMessage(message: SeqResponse<ConversationMessage>) {
		// 如果当前会话id和topicId与消息的会话id和topicId相同，则添加到消息队列中
		if (
			MessageStore.conversationId === message.conversation_id &&
			MessageStore.topicId === message.message.topic_id
		) {
			const fullMessage = this.formatMessage(message, userStore.user.userInfo)

			// 检查消息附件是否过期
			this.checkMessageAttachmentExpired([fullMessage])

			MessageStore.addReceivedMessage(fullMessage)
			if (!fullMessage.is_self) this.sendReadReceipt([fullMessage])
		} else {
			const fullMessage = this.formatMessage(message, userStore.user.userInfo)
			MessageCacheStore.addOrReplaceMessage(
				message.conversation_id,
				message.message.topic_id ?? "",
				fullMessage,
			)
		}

		// 添加到数据库
		this.messageDbService.addMessage(message.conversation_id, message)
	}

	/**
	 * 标记消息已撤回
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @param topicId 话题ID
	 */
	flagMessageRevoked(conversationId: string, topicId: string, messageId: string) {
		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			// 更新内存中的消息
			MessageStore.flagMessageRevoked(messageId)
		}
		// 更新缓存
		if (MessageCacheService.hasCache(conversationId, topicId)) {
			MessageCacheService.updateMessage(conversationId, topicId, messageId, (message) => {
				return {
					...message,
					revoked: true,
				}
			})
		}

		// 如果最后一条消息是撤回的消息, 则更新内容
		const conversation = conversationStore.getConversation(conversationId)
		if (conversation && conversation.last_receive_message?.seq_id === messageId) {
			ConversationService.updateLastReceiveMessage(conversationId, {
				...conversation.last_receive_message,
				...getRevokedText(),
			})
		}

		// 获取消息，判断是否需要更新红点
		this.getMessageFromDb(conversationId, messageId).then((message) => {
			if (message) {
				console.log("flagMessageRevoked ====> ", message)
				// 如果消息未读，减少未读数量
				if (message.message.status === ConversationMessageStatus.Unread) {
					DotsService.reduceTopicUnreadDots(
						conversationStore.currentConversation?.user_organization_code ?? "",
						conversationId,
						topicId,
						1,
					)
				}
			}
		})

		this.messageDbService.flagMessageRevoked(conversationId, messageId)
	}

	/**
	 * 获取消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param messageId 消息ID
	 * @returns 消息
	 */
	getMessage(
		conversationId: string,
		topicId: string,
		messageId: string,
	): FullMessage | undefined {
		// 当前视图有没有
		const message = MessageStore.messages.find((m) => m.message_id === messageId)
		if (message) return message

		// 缓存有没有
		if (MessageCacheService.hasCache(conversationId, topicId)) {
			const cacheMessage = MessageCacheService.getMessages(conversationId, topicId)
			if (cacheMessage) {
				const target = cacheMessage.find((m) => m.message_id === messageId)
				if (target) return target
			}
		}

		return undefined
	}

	/**
	 * 获取会话消息
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @returns 会话消息
	 */
	async getMessageFromDb(
		conversationId: string,
		messageId: string,
	): Promise<SeqResponse<ConversationMessage> | undefined> {
		const table = await this.messageDbService.getMessageTable(conversationId)
		return table
			.get(messageId)
			.then((message: SeqResponse<ConversationMessage>) => {
				return message
			})
			.catch((err: any) => {
				console.error("获取消息失败", err)
				return undefined
			})
	}

	/**
	 * 删除消息
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 */
	removeMessage(conversationId: string, messageId: string, topicId: string) {
		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			// 删除store中的消息
			MessageStore.removeMessage(messageId)
		} else if (MessageCacheService.hasCache(conversationId, topicId)) {
			// 删除缓存中的消息
			MessageCacheService.removeMessageInCache(conversationId, messageId, topicId)
		}

		// 判断当前会话的最后一条消息是否是该消息
		const lastMessage = conversationStore.getConversationLastMessage(conversationId)
		if (lastMessage && lastMessage.seq_id === messageId) {
			const lastMessage = MessageStore.getCurrentConversationLastMessage()
			if (lastMessage) {
				ConversationService.updateLastReceiveMessage(conversationId, {
					time: lastMessage.message.send_time,
					seq_id: lastMessage.message_id,
					...getSlicedText(lastMessage.message, lastMessage.revoked),
					topic_id: lastMessage.message.topic_id ?? "",
				})
			} else {
				ConversationService.updateLastReceiveMessage(conversationId, null)
			}
		}

		// 删除数据库中的消息
		this.messageDbService.removeMessage(conversationId, messageId)
	}

	/**
	 * 更新消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param messageId 消息ID
	 * @param replace 替换函数
	 */
	updateMessage(
		conversationId: string,
		topicId: string,
		messageId: string,
		replace: FullMessage | ((message: FullMessage) => FullMessage),
		saveToDb: boolean = false,
	) {
		let updatedMessage: FullMessage | undefined

		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			updatedMessage = MessageStore.updateMessage(messageId, replace)
		}

		if (MessageCacheService.hasCache(conversationId, topicId)) {
			updatedMessage = MessageCacheService.updateMessage(
				conversationId,
				topicId,
				messageId,
				replace,
			)
		}

		if (updatedMessage && saveToDb) {
			this.messageDbService.updateMessage(messageId, conversationId, {
				message: toJS(updatedMessage.message),
			})
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: updatedMessage.message.send_time,
				seq_id: updatedMessage.message_id,
				...getSlicedText(updatedMessage.message, updatedMessage.revoked),
				topic_id: updatedMessage.message.topic_id ?? "",
			})
		}
	}

	/**
	 * 更新消息
	 * @param message 消息
	 */
	replaceMessage(message: SeqResponse<ConversationMessage>) {
		const fullMessage = this.formatMessage(message, userStore.user.userInfo)

		this.updateMessage(
			fullMessage.conversation_id,
			fullMessage.message.topic_id ?? "",
			fullMessage.message_id,
			fullMessage,
		)

		// 更新数据库
		this.messageDbService.replaceMessage(message.conversation_id, message)
	}

	/**
	 * 更新消息状态
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param messageId 消息ID
	 * @param seenMessage 已读消息
	 */
	updateMessageStatus(
		conversationId: string,
		topicId: string,
		messageId: string,
		tempId: string,
		seenMessage: SeqResponse<SeenMessage>,
	) {
		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			MessageStore.updateMessageSeenStatus(messageId, seenMessage.message.status)
			MessageStore.updateMessageSeenStatus(tempId, seenMessage.message.status)
		} else if (MessageCacheService.hasCache(conversationId, topicId)) {
			MessageCacheService.updateMessage(conversationId, topicId, messageId, (message) => {
				return {
					...message,
					seen_status: seenMessage.message.status,
				}
			})
		}

		// 更新数据库
		this.messageDbService.updateMessageStatus(conversationId, messageId, seenMessage)
	}

	/**
	 * 更新消息未读数
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param messageId 消息ID
	 * @param tempId 临时消息ID
	 * @param unreadCount 未读数
	 */
	updateMessageUnreadCount(
		conversationId: string,
		topicId: string,
		messageId: string,
		tempId: string,
		unreadCount: number,
	) {
		if (MessageStore.conversationId === conversationId && MessageStore.topicId === topicId) {
			MessageStore.updateMessageUnreadCount(messageId, unreadCount)
			MessageStore.updateMessageUnreadCount(tempId, unreadCount)
		}

		if (MessageCacheService.hasCache(conversationId, topicId)) {
			MessageCacheService.updateMessage(conversationId, topicId, messageId, (message) => {
				const status =
					unreadCount > 0 ? message.message.status : ConversationMessageStatus.Read
				return {
					...message,
					message: {
						...message.message,
						status,
						unread_count: unreadCount,
					},
					unread_count: unreadCount,
					seen_status: status,
				}
			})
		}

		// 更新数据库
		this.messageDbService.updateMessageUnreadCount(conversationId, messageId, unreadCount)
	}

	pullOfflineMessages() {
		const organizationSeqId = MessageSeqIdService.getOrganizationRenderSeqId(
			userStore.user.userInfo?.organization_code ?? "",
		)
		return this.messagePullService.pullOfflineMessages(organizationSeqId)
	}

	focusMessage(messageId: string) {
		// 是否在当前会话
		if (MessageStore.messageIdMap.has(messageId)) {
			MessageStore.resetFocusMessageId()
			setTimeout(() => {
				MessageStore.setFocusMessageId(messageId)
			}, 50)
		}
	}

	/**
	 * 更新数据库消息
	 * @param localMessageId 消息ID
	 * @param conversation_id 会话ID
	 * @param changes 消息
	 */
	updateDbMessage(
		localMessageId: string,
		conversation_id: string,
		changes: UpdateSpec<SeqResponse<ConversationMessage>>,
	) {
		this.messageDbService.updateMessage(localMessageId, conversation_id, changes)
	}

	/**
	 * 更新消息
	 * @param tempId 临时消息ID
	 * @param messsageId 消息ID
	 */
	updateMessageId(tempId: string, messsageId: string) {
		MessageStore.updateMessageId(tempId, messsageId)
	}

	/**
	 * 删除话题消息
	 * @param conversationId 会话ID
	 * @param deleteTopicId 话题ID
	 */
	removeTopicMessages(conversationId: string, deleteTopicId: string) {
		if (
			MessageStore.conversationId === conversationId &&
			MessageStore.topicId === deleteTopicId
		) {
			MessageStore.reset()
		} else if (MessageCacheService.hasCache(conversationId, deleteTopicId)) {
			// 删除缓存中的消息
			MessageCacheService.removeTopicMessages(conversationId, deleteTopicId)
		}

		// 删除数据库中的消息
		this.messageDbService.removeTopicMessages(conversationId, deleteTopicId)
	}
}

export default new MessageService()
