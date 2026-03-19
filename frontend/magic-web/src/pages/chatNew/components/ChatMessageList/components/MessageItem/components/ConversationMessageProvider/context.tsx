import type {
	ConversationMessage,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { createContext } from "react"

interface ConversationMessageContextProps {
	messageId: string
	isSelf: boolean
	isUnReceived?: boolean
	message?: ConversationMessage | ConversationMessageSend["message"]
}
export const ConversationMessageContext = createContext<ConversationMessageContextProps>({
	messageId: "",
	isSelf: false,
	isUnReceived: false,
	message: undefined,
})
