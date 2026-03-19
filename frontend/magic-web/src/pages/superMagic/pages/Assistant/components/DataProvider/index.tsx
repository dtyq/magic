import { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import { createContext, useContext } from "react"

const AssistantDataContext = createContext<{
	selectedAgent: UserAvailableAgentInfo | null
}>({
	selectedAgent: null,
})

export const AssistantDataProvider = AssistantDataContext.Provider

export const useAssistantData = () => {
	const context = useContext(AssistantDataContext)
	return context
}

export default AssistantDataContext
