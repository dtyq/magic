import type { ControlEventMessageType } from "@/types/chat/control_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"

/**
 * 是否可以复制消息
 * @param messageType 消息类型
 * @returns 是否可以复制消息
 */
export function canCopy(messageType: ConversationMessageType | ControlEventMessageType) {
	return [
		ConversationMessageType.Text,
		ConversationMessageType.RichText,
		ConversationMessageType.Markdown,
		ConversationMessageType.AggregateAISearchCard,
		ConversationMessageType.AggregateAISearchCardV2,
		ConversationMessageType.AiImage,
		ConversationMessageType.HDImage,
	].includes(messageType as ConversationMessageType)
}

/**
 * 是否可以回复消息
 * @param messageType 消息类型
 * @returns 是否可以回复消息
 */
export function canReply(messageType: ConversationMessageType | ControlEventMessageType) {
	return [
		ConversationMessageType.Text,
		ConversationMessageType.RichText,
		ConversationMessageType.Markdown,
		ConversationMessageType.AggregateAISearchCard,
		ConversationMessageType.AggregateAISearchCardV2,
	].includes(messageType as ConversationMessageType)
}

/**
 * 是否可以编辑消息
 * @param messageType 消息类型
 * @returns 是否可以编辑消息
 */
export function canEdit(messageType: ConversationMessageType | ControlEventMessageType) {
	return [
		ConversationMessageType.Text,
		ConversationMessageType.RichText,
		ConversationMessageType.Markdown,
	].includes(messageType as ConversationMessageType)
}
