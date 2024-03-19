/** Services */
import MessageEditService from "@/opensource/services/chat/message/MessageEditService"

/**
 * 编辑消息
 * @param messageId 消息ID
 */
const editMessage = (messageId: string) => {
	MessageEditService.setEditMessageId(messageId)
}

export default editMessage
