import { FullMessage, ApplyMessageOptions } from "@/types/chat/message"
import MessageStore from "@/opensource/stores/chatNew/message"
import MessageCacheStore from "@/opensource/stores/chatNew/messageCache"
import MessageService from "./MessageService"
import {
	ConversationMessageSend,
	ConversationMessageStatus,
	SendStatus,
	ConversationMessage,
} from "@/types/chat/conversation_message"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { SeqResponse } from "@/types/request"
import { userStore } from "@/opensource/models/user"
import MessageApplyServices from "./MessageApplyServices"
import { CMessage } from "@/types/chat"

class MessageDispatchService {
	addSendMessage(renderMessage: FullMessage, message: ConversationMessageSend) {
		// 如果是当前会话，则添加到消息列表中
		const { currentConversation } = conversationStore

		if (
			currentConversation?.id === message.conversation_id &&
			currentConversation.current_topic_id === message.message.topic_id
		) {
			MessageStore.addSendMessage(renderMessage)
			console.log("发送消息到当前会话", message.conversation_id, "消息ID", message.message_id)
		} else {
			console.log(
				"发送消息到非当前会话",
				message.conversation_id,
				"当前会话",
				currentConversation?.id,
				"消息ID",
				message.message_id,
			)
		}

		// 添加到待发送消息队列
		MessageService.addPendingMessage(message)
	}

	/**
	 * 添加接收到的消息
	 * @param fullMessage 消息
	 * @param message 消息
	 */
	addReceivedMessage(fullMessage: FullMessage) {
		// 如果当前会话id和topicId与消息的会话id和topicId相同，则添加到消息队列中
		if (
			MessageStore.conversationId === fullMessage.conversation_id &&
			MessageStore.topicId === fullMessage.message.topic_id
		) {
			// 检查消息附件是否过期
			MessageService.checkMessageAttachmentExpired([fullMessage])

			MessageStore.addReceivedMessage(fullMessage)
			if (!fullMessage.is_self) MessageService.sendReadReceipt([fullMessage])
		} else {
			MessageCacheStore.addOrReplaceMessage(
				fullMessage.conversation_id,
				fullMessage.message.topic_id ?? "",
				fullMessage,
			)
		}
	}

	updateSendMessage(message: SeqResponse<ConversationMessage>, sendStatus: SendStatus) {
		// 如果当前会话id和topicId与消息的会话id和topicId相同，则添加到消息队列中
		if (
			MessageStore.conversationId === message.conversation_id &&
			MessageStore.topicId === message.message.topic_id
		) {
			const fullMessage = MessageService.formatMessage(message, userStore.user.userInfo)

			// 检查消息附件是否过期
			MessageService.checkMessageAttachmentExpired([fullMessage])

			MessageStore.addReceivedMessage(fullMessage)
			if (!fullMessage.is_self) MessageService.sendReadReceipt([fullMessage])
		} else {
			const fullMessage = MessageService.formatMessage(message, userStore.user.userInfo)
			MessageCacheStore.addOrReplaceMessage(
				message.conversation_id,
				message.message.topic_id ?? "",
				fullMessage,
			)
		}

		// 更新消息状态
		MessageStore.updateMessageSendStatus(message.message_id, sendStatus)
	}

	/**
	 * 更新消息状态
	 * @param messageId 消息ID
	 * @param sendStatus 发送状态
	 * @param seenStatus 已读状态
	 */
	updateMessageStatus(
		messageId: string,
		sendStatus: SendStatus | undefined,
		seenStatus: ConversationMessageStatus | undefined,
	) {
		if (sendStatus) {
			MessageStore.updateMessageSendStatus(messageId, sendStatus)
			MessageService.updatePendingMessageStatus(messageId, sendStatus, false)
		}

		if (seenStatus) {
			MessageStore.updateMessageSeenStatus(messageId, seenStatus)
		}
	}

	/**
	 * 更新消息ID
	 * @param tempId 临时ID
	 * @param messageId 消息ID
	 */
	updateMessageId(tempId: string, messageId: string) {
		MessageStore.updateMessageId(tempId, messageId)
	}

	/**
	 * 应用消息
	 * @param message 消息
	 * @param options 应用选项
	 */
	applyMessage(message: SeqResponse<CMessage>, options: ApplyMessageOptions) {
		console.log("应用消息 ==========", message, options)
		// 非当前组织或用户的消息不处理
		if (
			message.organization_code !== userStore.user.userInfo?.organization_code ||
			message.magic_id !== userStore.user.userInfo?.magic_id
		) {
			return
		}

		MessageApplyServices.doApplyMessage(message, options)
	}
}

export default new MessageDispatchService()
