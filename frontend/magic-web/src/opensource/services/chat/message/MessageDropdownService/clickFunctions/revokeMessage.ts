import MessageService from "@/opensource/services/chat/message/MessageService"
import MessageDropdownStore from "@/opensource/stores/chatNew/messageUI/Dropdown"
import { ChatApi } from "@/opensource/apis"

/**
 * 撤回消息
 * @param messageId 消息ID
 */
function revokeMessage(messageId: string) {
	console.log("revokeMessage", messageId)
	const message = MessageDropdownStore.currentMessage
	MessageService.flagMessageRevoked(
		message?.conversation_id ?? "",
		message?.message?.topic_id ?? "",
		messageId,
	)
	ChatApi.revokeMessage(messageId).then((res) => {
		console.log("撤回消息成功", res)
		// 更新数据库
	})
}

export default revokeMessage
