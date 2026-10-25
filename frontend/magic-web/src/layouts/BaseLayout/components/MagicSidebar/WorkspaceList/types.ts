import type { RefObject } from "react"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"

type ProjectItemActionHandler = (project: ProjectListItem) => void | Promise<void>

export interface WorkspaceItemProps {
	onBusyChange?: (id: string, busy: boolean) => void
	active: boolean
	scrollRef: RefObject<HTMLDivElement>
	maxProjectHeight?: number
	onOpenManager: () => void
	workspace: Workspace
	className?: string
	dndDisabled?: boolean
	/** Search mode renders only the matching projects without updating the normal sidebar cache. */
	searchProjects?: ProjectListItem[]
}

export interface ProjectListProps {
	onBusyChange?: (busy: boolean) => void
	isSearchResult?: boolean
	active: boolean
	workspace: Workspace
	projects: ProjectListItem[]
	workspaceId: string
	isLoading?: boolean
	isCreatingProject?: boolean
	onCancelCreate?: () => void
	onProjectCreated?: () => void
	dndDisabled?: boolean
	maxProjectHeight?: number
}

export interface ProjectItemProps {
	onInteractionChange?: (id: string, active: boolean) => void
	project: ProjectListItem
	dndDisabled?: boolean
	onOpenInNewWindow?: ProjectItemActionHandler
	onPinProject?: ProjectItemActionHandler
	onCopyCollaborationLink?: ProjectItemActionHandler
	onTransferProject?: ProjectItemActionHandler
	onMoveProject?: (projectId: string) => void
	onAddCollaborators?: ProjectItemActionHandler
	onCancelWorkspaceShortcut?: ProjectItemActionHandler
	onDeleteProject: ProjectItemActionHandler
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
}

export type SidebarDragData =
	| { type: "workspace"; workspaceId: string }
	| { type: "project"; projectId: string; workspaceId: string }
	| { type: "project-list"; workspaceId: string }

export type SidebarDropPosition = "before" | "after"

export const getWorkspaceDragId = (workspaceId: string) => `workspace:${workspaceId}`
export const getProjectDragId = (projectId: string) => `project:${projectId}`
export const getProjectListDropId = (workspaceId: string) => `project-list:${workspaceId}`
