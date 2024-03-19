import type {
	Collaborator,
	ProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"

/**
 * Open-source stub: collaboration panel is enterprise-only.
 * Returns no-op values so callers do not break.
 */
function useCollaboratorUpdatePanel({
	selectedProject: _selectedProject,
	onClose: _onClose,
}: {
	selectedProject: ProjectListItem | null
	onClose?: () => void
}) {
	const collaborators: Collaborator[] = []
	const collaborationInfo = {
		is_collaboration_enabled: false,
		default_join_permission: "viewer" as const,
	}
	const openManageModal = () => {}
	const CollaboratorUpdatePanel = null

	return {
		collaborators,
		collaborationInfo,
		openManageModal,
		CollaboratorUpdatePanel,
	}
}

export default useCollaboratorUpdatePanel
