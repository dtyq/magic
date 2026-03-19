import { useState } from "react"
import { useTranslation } from "react-i18next"
import superMagicService from "@/pages/superMagic/services"
import SidebarCreateInput from "../components/SidebarCreateInput"

interface CreateProjectInputProps {
	workspaceId: string
	onCancel: () => void
	onCreated: () => void
}

function CreateProjectInput({ workspaceId, onCancel, onCreated }: CreateProjectInputProps) {
	const { t } = useTranslation()
	const [projectName, setProjectName] = useState("")
	const [isCreating, setIsCreating] = useState(false)

	async function handleSubmit() {
		const trimmedName = projectName.trim()
		if (!trimmedName || isCreating) return

		setIsCreating(true)
		try {
			const result = await superMagicService.handleCreateProjectAndNavigate(
				workspaceId,
				trimmedName,
			)
			if (!result) return
			onCreated()
		} catch (error) {
			console.error("Failed to create project:", error)
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<SidebarCreateInput
			value={projectName}
			onValueChange={setProjectName}
			onSubmit={handleSubmit}
			onCancel={onCancel}
			placeholder={t("sidebar:project.enterName")}
			disabled={isCreating}
			containerClassName="px-2"
			containerTestId={`sidebar-create-project-input-${workspaceId}`}
			inputTestId={`sidebar-create-project-name-input-${workspaceId}`}
			submitButtonTestId={`sidebar-create-project-submit-button-${workspaceId}`}
			cancelButtonTestId={`sidebar-create-project-cancel-button-${workspaceId}`}
			submitButtonAriaLabel={t("common.confirm")}
			cancelButtonAriaLabel={t("common.cancel")}
		/>
	)
}

export default CreateProjectInput
