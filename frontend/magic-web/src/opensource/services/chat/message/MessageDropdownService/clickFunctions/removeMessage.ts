import MessageService from "../../MessageService"
import MessageDropdownStore from "@/opensource/stores/chatNew/messageUI/Dropdown"

/**
 * 删除消息
 * @param messageId 消息ID
 */
function removeMessage(messageId: string) {
	console.log("removeMessage", messageId)
	const message = MessageDropdownStore.currentMessage
	// if (message?.message?.type === ConversationMessageType.RecordingSummary) {
	// 	recorder.destroyRecord()
	// 	 chatBusiness.recordSummaryManager.updateIsRecording(false)
	// }
	MessageService.removeMessage(
		message?.conversation_id ?? "",
		messageId,
		message?.message?.topic_id ?? "",
	)
}

export default removeMessage
