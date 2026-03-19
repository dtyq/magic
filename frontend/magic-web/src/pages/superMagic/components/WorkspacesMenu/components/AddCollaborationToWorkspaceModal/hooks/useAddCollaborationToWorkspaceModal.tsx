import { FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import {
	CollaborationProjectListItem,
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import AddCollaborationToWorkspaceModal from ".."
import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"

const useAddCollaborationToWorkspaceModal = ({
	workspaces,
	fetchWorkspaces,
	onSuccess,
}: {
	workspaces: Workspace[]
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
	onSuccess?: (workspaceId: string) => void
}) => {
	const { t } = useTranslation("super")
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
	const [open, setOpen] = useState<boolean>(false)
	const [project, setProject] = useState<ProjectListItem | CollaborationProjectListItem | null>(
		null,
	)

	const onConfirm = useMemoizedFn((workspaceId: string) => {
		if (!project) return
		setIsSubmitting(true)
		SuperMagicApi.updateCollaborationProjectShortcutStatus(project.id, {
			workspace_id: workspaceId,
			is_bind_workspace: 1,
		})
			.then(() => {
				magicToast.success(t("project.associateWorkspaceSuccess"))
				onSuccess?.(workspaceId)

				setOpen(false)
			})
			.finally(() => {
				setIsSubmitting(false)
			})
	})

	const AddCollaborationToWorkspaceModalComponent = (
		<AddCollaborationToWorkspaceModal
			workspaces={workspaces}
			fetchWorkspaces={fetchWorkspaces}
			open={open}
			onClose={() => setOpen(false)}
			isMoveProjectLoading={isSubmitting}
			onConfirm={onConfirm}
		/>
	)

	const onOpen = useMemoizedFn((project: ProjectListItem | CollaborationProjectListItem) => {
		setProject(project)
		setOpen(true)
	})

	return {
		AddCollaborationToWorkspaceModal: AddCollaborationToWorkspaceModalComponent,
		onOpen,
	}
}

export default useAddCollaborationToWorkspaceModal
