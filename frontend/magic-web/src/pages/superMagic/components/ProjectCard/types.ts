import { ReactNode } from "react"
import type { ProjectListItem, Workspace } from "../../pages/Workspace/types"

export interface ProjectCardProps {
	/** Project name */
	project: ProjectListItem
	/** Workspace name */
	workspaceName: string
	/** Collaboration status text */
	collaborators?: ReactNode
	onWorkspaceProjectsOpen?: () => void
	onCollapse?: () => void
	isPanelVisible?: boolean
	onShareClick?: () => void
	onInviteClick?: () => void
	/** Workspace context for project actions */
	actionWorkspace: Workspace | null
	/** Custom className */
	className?: string
	/**
	 * `compact`: one row (name with share and more beside it), without the collapse button, the
	 * workspace row or the collaborator section. Used where the card floats over content.
	 */
	variant?: "default" | "compact"
}

export interface SeparatorProps {
	/** Separator orientation */
	orientation?: "horizontal" | "vertical"
	/** Custom className */
	className?: string
}
