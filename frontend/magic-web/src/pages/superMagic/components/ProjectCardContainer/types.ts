import {
	ProjectListItem,
	CollaborationProjectListItem,
	Workspace,
} from "../../pages/Workspace/types"

export interface ProjectCardContainerProps {
	/** Selected project */
	selectedProject: ProjectListItem | CollaborationProjectListItem | null
	/** Selected workspace */
	selectedWorkspace?: Workspace | null
	/** Click handler for navigating to workspace home */
	onWorkspaceHomeClick?: () => void
	/** Click handler for dropdown toggle */
	onDropdownClick?: () => void
	/** Custom className */
	className?: string
}
