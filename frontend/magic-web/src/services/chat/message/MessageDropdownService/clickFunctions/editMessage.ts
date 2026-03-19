/** Services */
import MessageEditService from "@/services/chat/message/MessageEditService"

/**
 * 编辑消息
 * @param messageId 消息ID
 */
const editMessage = (messageId: string) => {
	MessageEditService.setEditMessageId(messageId)
}

export default editMessage
