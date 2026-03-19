import { useState } from "react"
import { useTranslation } from "react-i18next"
import superMagicService from "@/pages/superMagic/services"
import SidebarCreateInput from "../components/SidebarCreateInput"

interface CreateWorkspaceInputProps {
	onCancel: () => void
	onCreated: () => void
}

function CreateWorkspaceInput({ onCancel, onCreated }: CreateWorkspaceInputProps) {
	const { t } = useTranslation()
	const [workspaceName, setWorkspaceName] = useState("")
	const [isCreating, setIsCreating] = useState(false)

	async function handleSubmit() {
		const trimmedName = workspaceName.trim()
		if (!trimmedName || isCreating) return

		setIsCreating(true)
		try {
			await superMagicService.createWorkspace(trimmedName)
			onCreated()
		} catch (error) {
			console.error("Failed to create workspace:", error)
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<SidebarCreateInput
			value={workspaceName}
			onValueChange={setWorkspaceName}
			onSubmit={handleSubmit}
			onCancel={onCancel}
			placeholder={t("super:workspace.createWorkspaceTip")}
			disabled={isCreating}
			containerClassName="px-1"
			containerTestId="sidebar-create-workspace-input"
			inputTestId="sidebar-create-workspace-name-input"
			submitButtonTestId="sidebar-create-workspace-submit-button"
			cancelButtonTestId="sidebar-create-workspace-cancel-button"
			submitButtonAriaLabel={t("common.confirm")}
			cancelButtonAriaLabel={t("common.cancel")}
			inputClassName="my-1"
		/>
	)
}

export default CreateWorkspaceInput
