import type { CMessage } from "@/types/chat"
import { ControlEventMessageType } from "@/types/chat/control_message"
import type {
	ConversationMessageSend,
	ConversationMessage,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"

export const isConversationMessage = (
	message: CMessage | ConversationMessageSend["message"],
): message is ConversationMessage | ConversationMessageSend["message"] => {
	return [
		ConversationMessageType.Text,
		ConversationMessageType.RichText,
		ConversationMessageType.Markdown,
		ConversationMessageType.AggregateAISearchCard,
		ConversationMessageType.MagicSearchCard,
		ConversationMessageType.Files,
		ConversationMessageType.Image,
		ConversationMessageType.Video,
		ConversationMessageType.Voice,
		ControlEventMessageType.RevokeMessage,
		ControlEventMessageType.GroupCreate,
		ControlEventMessageType.GroupAddMember,
		ControlEventMessageType.GroupDisband,
		ControlEventMessageType.GroupUsersRemove,
		ControlEventMessageType.GroupUpdate,
		ConversationMessageType.AiImage,
		ConversationMessageType.HDImage,
	].includes(message.type as ConversationMessageType)
}
