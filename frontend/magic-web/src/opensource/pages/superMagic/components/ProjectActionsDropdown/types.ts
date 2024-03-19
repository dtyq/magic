import { TFunction } from "i18next"
import { CollaborationProjectListItem, ProjectListItem } from "../../pages/Workspace/types"
import { HandleRenameProjectParams } from "../../services/projectService"
import { ItemType } from "antd/es/menu/interface"

export enum ProjectActionMenuKey {
	OpenInNewWindow = "openInNewWindow",
	CopyCollaborationLink = "copyCollaborationLink",
	Rename = "rename",
	MoveTo = "moveTo",
	AddCollaborators = "addCollaborators",
	AddWorkspaceShortcut = "addWorkspaceShortcut",
	CancelWorkspaceShortcut = "cancelWorkspaceShortcut",
	Delete = "delete",
	Pin = "pin",
	ShortcutNavigateToWorkspace = "ShortcutNavigateToWorkspace",
	Transfer = "transfer",
}

export interface ProjectActionHandlers<T extends ProjectItemLike> {
	onOpenInNewWindow?: (project: T) => void | Promise<void>
	onCopyCollaborationLink?: (project: T) => void | Promise<void>
	onRenameStart?: (project: T) => void
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
	onDeleteProject?: (project: T) => void
	onMoveProject?: (projectId: string) => void
	onPinProject?: (project: T, isPin: boolean) => void | Promise<void>
	onAddCollaborators?: (project: T) => void
	onAddWorkspaceShortcut?: (project: T) => void
	onCancelWorkspaceShortcut?: (projectId: string, workspaceId?: string) => void
	onShortcutNavigateToWorkspace?: (project: T) => void
	onTransferProject?: (project: T) => void
	renderTransferModal?: (fallbackProjectName?: string) => React.ReactNode
}

export type ProjectItemLike = ProjectListItem | CollaborationProjectListItem
export interface BuildProjectActionMenuItemsParams<
	T extends ProjectItemLike,
> extends ProjectActionHandlers<T> {
	item: T
	t: TFunction
	inCollaborationPanel: boolean
}

export type VisibleMenuItem = ItemType & { visible?: boolean }
