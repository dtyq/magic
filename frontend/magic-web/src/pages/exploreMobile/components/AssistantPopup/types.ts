import { AssistantData } from "../../types"

export interface AssistantPopupProps {
	visible: boolean
	onClose: () => void
	assistant?: AssistantData
	isAdded?: boolean // 是否已添加助理
	onAddAssistant?: (assistant: AssistantData, addAgent: boolean, isNavigate: boolean) => void
}
