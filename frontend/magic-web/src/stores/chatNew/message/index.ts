import { makeAutoObservable, observable } from "mobx"
import type { FullMessage } from "@/types/chat/message"
import {
	ConversationMessage,
	ConversationMessageStatus,
	SendStatus,
} from "@/types/chat/conversation_message"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("MessageStore")

class MessageStore {
	conversationId: string = ""

	topicId: string = ""

	// 消息队列
	messages: FullMessage[] = []

	messageIdMap: Map<string, string> = new Map() // 临时消息id -> 消息id

	hasMoreHistoryMessage: boolean = true

	seenStatusMap: Map<string, ConversationMessageStatus> = observable.map()

	sendStatusMap: Map<string, SendStatus> = observable.map()

	// 最新一条消息的seq_id
	lastSeqId: string = ""

	// 最早一条消息的seq_id
	firstSeqId: string = ""

	page: number = 1

	pageSize: number = 10

	totalPages: number = 1

	focusMessageId: string | null = null

	// 当前会话的最后一条消息是否正在流式输出
	isLastMessageStreaming: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get lastMessage() {
		if (this.messages.length) {
			return this.messages[this.messages.length - 1]
		}
		return null
	}

	reset() {
		this.conversationId = ""
		this.topicId = ""
		this.messages = []
		this.hasMoreHistoryMessage = true
		this.lastSeqId = ""
		this.firstSeqId = ""
		this.sendStatusMap.clear()
		this.seenStatusMap.clear()
		this.messageIdMap.clear()
	}

	setMessages(conversationId: string, topicId: string, messages: FullMessage[]) {
		this.conversationId = conversationId
		this.topicId = topicId
		this.messages = []
		this.hasMoreHistoryMessage = true
		this.lastSeqId = ""
		this.firstSeqId = ""
		this.sendStatusMap.clear()
		this.seenStatusMap.clear()
		this.messageIdMap.clear()
		logger.log("setMessages ====> ", messages)
		if (messages.length) {
			messages.forEach((message: any) => {
				this.updateMessageSendStatus(
					message.message_id || message.temp_id,
					message.send_status,
				)
				this.updateMessageSeenStatus(
					message.message_id || message.temp_id,
					message.seen_status,
				)
			})

			// 确保消息按时间顺序排列，老消息在前
			this.messages = messages.slice().reverse()
			logger.log("setMessages messages ====> ", this.messages)
			this.lastSeqId = this.messages[messages.length - 1]?.seq_id || ""
			this.firstSeqId = this.messages[0]?.seq_id || ""
		}
	}

	/**
	 * 添加发送消息
	 * @param message 消息
	 * @param send_status 发送状态
	 * @param seen_status 已读状态
	 */
	addSendMessage(
		message: FullMessage<ConversationMessage>,
		send_status: SendStatus = SendStatus.Pending,
		seen_status: ConversationMessageStatus = ConversationMessageStatus.Unread,
	) {
		// 新消息添加到数组末尾
		this.messages.push(message)
		logger.log("addMessage ====> ", this.messages)
		this.updateMessageSendStatus(message.message_id || message?.temp_id || "", send_status)
		this.updateMessageSeenStatus(message.message_id || message?.temp_id || "", seen_status)
		this.updateMessageId(message.message_id || message?.temp_id || "", message.message_id)
		this.lastSeqId = message.seq_id || this.lastSeqId

		if (this.messages.length === 1) {
			this.firstSeqId = message.seq_id || ""
		}
	}

	/**
	 * 添加接收消息
	 * @param message 消息
	 */
	addReceivedMessage(message: FullMessage) {
		// 如果消息已存在，则不添加
		if (this.messages.find((m) => m.message_id === message.message_id)) {
			logger.log("message already exists ====> ", message)
			return
		}
		// 如果消息存在，则替换
		const messageIndex = this.messages.findIndex((m) => m.temp_id === message.temp_id)
		// temp_id 为空，可能是控制消息
		if (message.temp_id && messageIndex !== -1) {
			logger.log("replace local send message ====> ", message)
			this.messages.splice(messageIndex, 1, { ...message })
			this.updateMessageSeenStatus(message?.temp_id || "", message.seen_status)
			this.updateMessageSeenStatus(message?.message_id || "", message.seen_status)
		} else {
			// 新消息添加到数组末尾
			logger.log("add new message ====> ", message)
			this.messages.push(message)
		}
		this.lastSeqId = message.seq_id || this.lastSeqId

		if (this.messages.length === 1) {
			this.firstSeqId = message.seq_id || ""
		}
	}

	updateMessageSendStatus(id: string, status: SendStatus) {
		this.sendStatusMap.set(id, status)
	}

	updateMessageId(tempId: string, messageId: string) {
		this.messageIdMap.set(tempId, messageId)
		const message = this.messages.find((m) => m.temp_id === tempId)
		if (message) {
			message.message_id = messageId
		}
	}

	/**
	 * 获取消息发送状态
	 * @param id 消息ID
	 * @returns 发送状态
	 */
	getMessageSendStatus(id: string) {
		return this.sendStatusMap.get(id)
	}

	/**
	 * 获取当前会话的最后一条消息
	 * @returns 最后一条消息
	 */
	getCurrentConversationLastMessage() {
		if (this.messages.length) {
			return this.messages[this.messages.length - 1]
		}
		return null
	}

	/**
	 * 更新消息已读状态
	 * @param messageIdOrTempId 消息ID
	 * @param status 已读状态
	 */
	updateMessageSeenStatus(messageIdOrTempId: string, status: ConversationMessageStatus) {
		const message = this.messages.find(
			(m) => m.message_id === messageIdOrTempId || m.temp_id === messageIdOrTempId,
		)

		if (message) {
			message.seen_status = status
		}
	}

	/**
	 * 设置是否还有更多历史消息
	 * @param hasMoreHistoryMessage 是否还有更多历史消息
	 */
	setHasMoreHistoryMessage(hasMoreHistoryMessage: boolean) {
		this.hasMoreHistoryMessage = hasMoreHistoryMessage
	}

	/**
	 * 设置分页配置
	 * @param page 当前页
	 * @param totalPages 总页数
	 */
	setPageConfig(page: number, totalPages: number) {
		this.page = page
		// this.pageSize = pageSize
		this.totalPages = totalPages
	}

	/**
	 * 添加消息
	 * @param messages 消息
	 */
	addMessages(messages: FullMessage[]) {
		// 历史消息添加到数组开头
		this.messages.unshift(...messages.slice().reverse())
		messages.forEach((message) => {
			// 历史消息没有temp_id，不需要设置id映射
			this.sendStatusMap.set(message.message_id || "", message.send_status)
			this.seenStatusMap.set(message.message_id || "", message.seen_status)
		})
		this.firstSeqId = this.messages[0]?.seq_id || ""
	}

	// 设置消息为已撤回
	flagMessageRevoked(message_id: string) {
		const message = this.messages.find((m) => m.message_id === message_id)
		if (message) {
			message.revoked = true
			message.message.revoked = true
		}
	}

	/**
	 * 删除消息
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @param topicId 话题ID
	 */
	removeMessage(messageId: string) {
		this.messages = this.messages.filter((message) => message.message_id !== messageId)
	}

	/**
	 * 更新消息
	 * @param message 消息
	 */
	updateMessage(
		messageId: string,
		replace: FullMessage | ((message: FullMessage) => FullMessage),
	): FullMessage | undefined {
		const messageIndex = this.messages.findIndex((m) => m.message_id === messageId)
		if (messageIndex !== -1) {
			this.messages[messageIndex] =
				typeof replace === "function" ? replace(this.messages[messageIndex]) : replace
			return this.messages[messageIndex]
		}
		return undefined
	}

	/**
	 * 更新消息未读数
	 * @param targetMessageId 目标消息ID
	 * @param unreadCount 未读数
	 */
	updateMessageUnreadCount(targetMessageId: string, unreadCount: number) {
		const messageIndex = this.messages.findIndex((m) => m.message_id === targetMessageId)
		logger.log("updateMessageUnreadCount messageIndex =======> ", targetMessageId, messageIndex)
		if (messageIndex !== -1) {
			const message = this.messages[messageIndex]
			message.unread_count = unreadCount
			message.message.unread_count = unreadCount
			if (unreadCount === 0) {
				message.seen_status = ConversationMessageStatus.Read
				message.message.status = ConversationMessageStatus.Read
			}
		}
	}

	getMessage(messageId: string): FullMessage | undefined {
		return this.messages.find((m) => m.message_id === messageId)
	}

	setFocusMessageId(messageId: string) {
		this.focusMessageId = messageId
	}

	resetFocusMessageId() {
		this.focusMessageId = null
	}

	setIsLastMessageStreaming(isStreaming: boolean) {
		this.isLastMessageStreaming = isStreaming
	}

	getIsLastMessageStreaming() {
		return this.isLastMessageStreaming
	}
}

export default new MessageStore()
