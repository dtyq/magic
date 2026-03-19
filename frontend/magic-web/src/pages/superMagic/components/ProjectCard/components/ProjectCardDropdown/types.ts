import type { RefObject } from "react"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"

export interface ProjectCardDropdownProps {
	/** Whether the dropdown is expanded */
	isExpanded: boolean
	/** Close the dropdown (e.g. when overlay clicked) */
	onClose: () => void
	/** Currently selected project */
	selectedProject: ProjectListItem
	/** List of projects to display in dropdown */
	projectOptions: ProjectListItem[]
	/** Whether to show create project button */
	showCreateProject: boolean
	/** Workspace context for project actions (hook uses this internally) */
	actionWorkspace: Workspace | null
	/** Ref for project menu content (used by CollapsedWorkspaceProjectRow) */
	projectMenuContentRef: RefObject<HTMLDivElement | null>
}
