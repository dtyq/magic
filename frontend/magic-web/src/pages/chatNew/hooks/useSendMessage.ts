import { useMemoizedFn } from "ahooks"
import type {
	AIImagesMessage,
	FileConversationMessage,
	MarkdownConversationMessage,
	RichTextConversationMessage,
	TextConversationMessage,
} from "@/types/chat/conversation_message"
import MessageService from "@/services/chat/message/MessageService"
import MessageReplyStore from "@/stores/chatNew/messageUI/Reply"
import ConversationStore from "@/stores/chatNew/conversation"
import { userStore } from "@/models/user"

type SendData =
	| Pick<TextConversationMessage, "type" | "text">
	| Pick<RichTextConversationMessage, "type" | "rich_text">
	| Pick<FileConversationMessage, "type" | "files">
	| Pick<MarkdownConversationMessage, "type" | "markdown">
	| Pick<AIImagesMessage, "type" | "ai_image_card">

/**
 * 封装发送消息逻辑
 * @returns
 */
const useSendMessage = (referMsgId?: string, conversationId?: string) => {
	return useMemoizedFn((data: SendData) => {
		const currentConversationId = conversationId || ConversationStore.currentConversation?.id
		const referMessageId = referMsgId ?? MessageReplyStore.replyMessageId

		if (!currentConversationId) {
			console.warn("当前会话不存在")
			return
		}
		if (!userStore.user.userInfo?.user_id) {
			console.warn("当前用户不存在")
			return
		}
		MessageService.formatAndSendMessage(currentConversationId, data, referMessageId)
	})
}

export default useSendMessage
