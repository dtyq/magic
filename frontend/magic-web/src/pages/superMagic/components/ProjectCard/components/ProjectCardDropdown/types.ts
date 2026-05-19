import type { RefObject } from "react"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"

/** Handlers for project row actions (shared with ProjectCard more menu) */
export interface ProjectCardProjectActionHandlers {
	onOpenInNewWindow?: (project: ProjectListItem) => void | Promise<void>
	onPinProject?: (project: ProjectListItem) => void | Promise<void>
	onCopyCollaborationLink?: (project: ProjectListItem) => void | Promise<void>
	onTransferProject?: (project: ProjectListItem) => void | Promise<void>
	onMoveProject?: (projectId: string) => void
	onAddCollaborators?: (project: ProjectListItem) => void | Promise<void>
	onCancelWorkspaceShortcut?: (project: ProjectListItem) => void | Promise<void>
	onDeleteProject?: (project: ProjectListItem) => void
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
	/** Switch project when user picks another row */
	handleProjectClick: (project: ProjectListItem) => void
}

export interface ProjectCardDropdownProps extends ProjectCardProjectActionHandlers {
	/** Whether the dropdown is expanded */
	isExpanded: boolean
	/** Enable workspace navigation inside dropdown */
	enableWorkspaceNavigation?: boolean
	/** Close the dropdown (e.g. when overlay clicked) */
	onClose: () => void
	/** Currently selected project */
	selectedProject: ProjectListItem
	/** List of projects to display in dropdown */
	projectOptions: ProjectListItem[]
	/** Whether to show create project button */
	showCreateProject: boolean
	/** Workspace context for project actions (used by CollapsedWorkspaceProjectRow) */
	actionWorkspace: Workspace | null
	/** Ref for project menu content (used by CollapsedWorkspaceProjectRow) */
	projectMenuContentRef: RefObject<HTMLDivElement | null>
}
