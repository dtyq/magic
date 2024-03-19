import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"

/**
 * 回复消息
 * @param messageId 消息ID
 */
function replyMessage(messageId: string) {
	// console.log("replyMessage", messageId)
	MessageReplyService.setReplyMessageId(messageId)
}

export default replyMessage
