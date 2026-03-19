import { ReactNode } from "react"
import type { ProjectListItem, Workspace } from "../../pages/Workspace/types"

export interface ProjectCardProps {
	/** Project name */
	project: ProjectListItem
	/** Workspace name */
	workspaceName: string
	/** Collaboration status text */
	collaborators?: ReactNode
	/** Click handler for project selector */
	onProjectClick?: () => void
	/** Click handler for share button */
	onShareClick?: () => void
	/** Click handler for dropdown toggle */
	onDropdownClick?: () => void
	/** Click handler for invite collaborator button */
	onInviteClick?: () => void
	/** Project options under current workspace */
	projectOptions?: ProjectListItem[]
	/** Whether to show the create project button (hidden for received collaboration projects) */
	showCreateProject?: boolean
	/** Project dropdown open state change handler */
	onProjectMenuOpenChange?: (open: boolean) => void
	/** Workspace context for project actions */
	actionWorkspace: Workspace | null
	/** Custom className */
	className?: string
}

export interface SeparatorProps {
	/** Separator orientation */
	orientation?: "horizontal" | "vertical"
	/** Custom className */
	className?: string
}
