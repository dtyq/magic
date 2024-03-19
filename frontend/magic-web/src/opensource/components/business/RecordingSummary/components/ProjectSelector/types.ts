import { ProjectListItem, Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"

/**
 * Project selector related types
 * 项目选择器相关类型定义
 */

export interface ProjectSelectorMainProps {
	/** Selected project ID */
	selectedProject?: ProjectListItem | null
	/** Selected workspace ID */
	selectedWorkspace?: Workspace | null
	/** Project selection callback */
	onProjectSelect?: (project: ProjectListItem | null) => void
	/** Workspace confirmation callback */
	onWorkspaceConfirm?: (workspaceId: string) => void
	/** Search callback */
	onSearch?: (keyword: string) => void
	/** Project confirmation callback */
	onProjectConfirm?: (project: ProjectListItem | null, workspace: Workspace | null) => void
	/** Workspace change callback */
	onWorkspaceChange?: (workspace: Workspace | null) => void
	/** Workspace arrow click callback */
	onWorkspaceArrowClick?: (workspace: Workspace) => void
	/** Cancel callback */
	onCancel?: () => void
}

export interface ProjectOption {
	id: string
	name: string
	workspaceName: string
	workspaceId: string
}

export interface SearchInputProps {
	/** Placeholder text */
	placeholder?: string
	/** Search value */
	value?: string
	/** Search change callback */
	onChange?: (value: string) => void
	/** Search callback */
	onSearch?: (value: string) => void
	/** Input class name */
	inputClassName?: string
	/** Class name */
	className?: string
}

export interface ProjectItemProps {
	/** Project data */
	project: ProjectListItem
	/** Selected state */
	selected?: boolean
	/** Click callback */
	onClick?: (project: ProjectListItem) => void
	/** Show workspace name */
	showWorkspaceName?: boolean
}

export interface WorkspaceItemProps {
	/** Workspace data */
	workspace: Workspace
	/** Selected state */
	selected?: boolean
	/** Click callback */
	onClick?: (workspace: Workspace) => void
	/** Arrow click callback */
	onArrowClick?: (workspace: Workspace) => void
}

export interface SearchedProjectListProps {
	/** Selected project */
	selectedProject?: ProjectListItem | null
	/** Project click callback */
	onProjectClick?: (project: ProjectListItem) => void
	/** Keyword */
	keyword?: string
	/** Empty state text */
	emptyText?: string
	/** Set keyword callback */
	setKeyword?: (keyword: string) => void
}

export interface ProjectListProps {
	/** Selected project ID */
	selectedProject?: ProjectListItem | null
	/** Selected workspace */
	selectedWorkspace?: Workspace | null
	/** Project click callback */
	onProjectClick?: (project: ProjectListItem | null) => void
	/** Loading state */
	loading?: boolean
	/** Empty state text */
	emptyText?: string
	/** Keyword */
	keyword?: string
}

export interface ProjectListRef {
	createNewProject?: () => void
	startProjectCreation?: () => void
}

export interface WorkspaceListProps {
	/** Selected workspace ID */
	selectedWorkspaceId?: string
	/** Project click callback */
	onWorkspaceChange?: (workspace: Workspace) => void
	/** Arrow click callback */
	onWorkspaceArrowClick?: (workspace: Workspace) => void
	/** Loading state */
	loading?: boolean
	/** Empty state text */
	emptyText?: string
	/** Keyword */
	keyword?: string
}

export interface WorkspaceListRef {
	createNewWorkspace?: () => void
	startWorkspaceCreation?: () => void
}

/**
 * Transform ProjectListItem to ProjectOption
 */
export function transformProjectData(item: ProjectListItem): ProjectOption {
	return {
		id: item.id,
		name: item.project_name,
		workspaceName: item.workspace_name,
		workspaceId: item.workspace_id,
	}
}
