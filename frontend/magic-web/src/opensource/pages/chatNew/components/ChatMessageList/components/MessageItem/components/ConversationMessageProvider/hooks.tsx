import { useContext } from "react"
import { ConversationMessageContext } from "./context"

export const useConversationMessage = () => {
	return useContext(ConversationMessageContext)
}
