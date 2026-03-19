import MessageStore from "@/stores/chatNew/message"
import MessageEditStore from "@/stores/chatNew/messageUI/Edit"
import {
	ConversationMessage,
	ConversationMessageSend,
	ConversationMessageType,
	MarkdownConversationMessage,
	RichTextConversationMessage,
	TextConversationMessage,
} from "@/types/chat/conversation_message"

import MessageReplyService from "./MessageReplyService"
import { EditMessageOptions, SeqResponse } from "@/types/request"

class MessageEditService {
	/**
	 * 是否是编辑消息
	 * @param message 消息
	 * @returns 是否是编辑消息
	 */
	isEditMessage(message: ConversationMessageSend | SeqResponse<ConversationMessage>) {
		const isEditMessage =
			[
				ConversationMessageType.Text,
				ConversationMessageType.RichText,
				ConversationMessageType.Markdown,
				ConversationMessageType.Files,
			].includes(message.message.type as ConversationMessageType) &&
			message.edit_message_options
		return isEditMessage
	}

	/**
	 * 设置编辑消息ID
	 * @param messageId 消息ID
	 */
	setEditMessageId(messageId: string) {
		const message = MessageStore.getMessage(messageId)
		if (message) {
			MessageEditStore.setEditMessage(message)
		}

		MessageReplyService.reset()
	}

	/**
	 * 重置编辑消息ID
	 */
	resetEditMessageId() {
		MessageEditStore.reset()
	}

	/**
	 * 生成编辑消息选项
	 */
	generateEditMessageOptions(): EditMessageOptions | undefined {
		if (!MessageEditStore.editMessage) {
			return undefined
		}

		const message = MessageEditStore.editMessage.message as
			| TextConversationMessage
			| RichTextConversationMessage
			| MarkdownConversationMessage

		return {
			magic_message_id: message.magic_message_id,
			message_version_id:
				MessageEditStore.editMessage.edit_message_options?.message_version_id ?? null,
		}
	}
}

export default new MessageEditService()
