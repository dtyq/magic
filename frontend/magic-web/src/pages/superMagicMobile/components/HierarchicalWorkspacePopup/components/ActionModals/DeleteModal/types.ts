import type { CurrentActionItem } from "../../../types"

export interface DeleteModalProps {
	visible: boolean
	currentActionItem: CurrentActionItem | null
	onCancel: () => void
	onOk: () => void
	translations: {
		deleteWorkspace: string
		deleteProject: string
		deleteTopic: string
		deleteWorkspaceConfirm: (name: string) => string
		deleteProjectConfirm: (name: string) => string
		deleteTopicConfirm: (name: string) => string
		deleteTopicConfirmTitle?: string
		deleteWorkspaceConfirmTitle?: string
		deleteProjectConfirmTitle?: string
		deleteTopicDescription: (name: string) => string
		deleteWorkspaceDescription: (name: string) => string
		deleteProjectDescription: (name: string) => string
		unnamedWorkspace: string
		unnamedProject: string
		unnamedTopic: string
		cancel: string
		confirm: string
	}
}
