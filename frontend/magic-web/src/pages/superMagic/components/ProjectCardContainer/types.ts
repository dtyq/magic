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
	onCollapse?: () => void
	isPanelVisible?: boolean
	/** Custom className */
	className?: string
	/** Card layout; see ProjectCard `variant`. */
	variant?: "default" | "compact"
}
