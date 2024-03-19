import type {
	ProjectListItem,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { HandleRenameProjectParams } from "@/opensource/pages/superMagic/hooks/useProjects"

type ProjectItemActionHandler = (project: ProjectListItem) => void | Promise<void>

export interface WorkspaceItemProps {
	workspace: Workspace
	className?: string
}

export interface ProjectListProps {
	workspace: Workspace
	projects: ProjectListItem[]
	workspaceId: string
	isLoading?: boolean
	isCreatingProject?: boolean
	onCancelCreate?: () => void
	onProjectCreated?: () => void
}

export interface ProjectItemProps {
	project: ProjectListItem
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
