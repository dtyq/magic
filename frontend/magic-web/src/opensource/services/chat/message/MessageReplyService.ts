import MessageStore from "@/opensource/stores/chatNew/message"
import ReplyStore from "@/opensource/stores/chatNew/messageUI/Reply"
import type { FullMessage } from "@/opensource/types/chat/message"

const MessageReplyService = {
	setReplyMessageId(messageId: string) {
		if (MessageStore.getMessage(messageId)) {
			ReplyStore.setReplyMessage(messageId, MessageStore.getMessage(messageId) as FullMessage)
		}
	},

	resetReplyMessageId() {
		ReplyStore.resetReplyMessage()
		MessageStore.resetFocusMessageId()
	},

	setReplyFile(fileId: string, referText: string) {
		ReplyStore.setReplyFile(fileId, referText)
	},

	reset() {
		ReplyStore.resetReplyFile()
		ReplyStore.resetReplyMessage()
	},
}

export default MessageReplyService
