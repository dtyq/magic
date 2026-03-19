import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"

export interface WorkspaceListItemProps {
	workspace: Workspace
	isSelected: boolean
	onSelect: (workspace: Workspace) => void
	onActionClick: (workspace: Workspace) => void
	onNavigate: (workspace: Workspace) => void
	emptyText: string
}
