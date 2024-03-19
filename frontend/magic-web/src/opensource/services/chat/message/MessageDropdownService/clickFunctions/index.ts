import { MessageContextMenuKey } from "@/opensource/stores/chatNew/messageUI/const"
import copyMessage from "./copyMessage"
import replyMessage from "./replyMessage"
import revokeMessage from "./revokeMessage"
import removeMessage from "./removeMessage"
import editMessage from "./editMessage"
import copyMessageId from "./copyMessageId"

const clickFunctions: Partial<
	Record<MessageContextMenuKey, (messageId: string, e: EventTarget | null) => void>
> = {
	[MessageContextMenuKey.Copy]: (messageId: string, e: EventTarget | null) => {
		copyMessage(messageId, e)
	},
	[MessageContextMenuKey.Reply]: (messageId: string) => {
		replyMessage(messageId)
	},
	[MessageContextMenuKey.Revoke]: (messageId: string) => {
		revokeMessage(messageId)
	},
	[MessageContextMenuKey.Remove]: (messageId: string) => {
		removeMessage(messageId)
	},
	[MessageContextMenuKey.Edit]: (messageId: string) => {
		editMessage(messageId)
	},
	[MessageContextMenuKey.CopyMessageId]: (messageId: string) => {
		copyMessageId(messageId)
	},
}

export default clickFunctions
export { copyMessage, replyMessage, revokeMessage, removeMessage }
