import type { Collaborator, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

/**
 * 默认实现保持空协作者面板，调用方通过能力位决定是否展示入口。
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
		canManageCollaborators: false,
		openManageModal,
		CollaboratorUpdatePanel,
	}
}

export default useCollaboratorUpdatePanel
