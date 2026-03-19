import type { CurrentActionItem } from "../../../types"

export interface RenameModalProps {
	visible: boolean
	currentActionItem: CurrentActionItem | null
	onCancel: () => void
	onOk: () => void
	onInputChange: (val: string) => void
	translations: {
		workspaceRename: string
		projectRename: string
		topicRename: string
		inputWorkspaceName: string
		inputProjectName: string
		inputTopicName: string
		newName: string
		cancel: string
		confirm: string
	}
}
