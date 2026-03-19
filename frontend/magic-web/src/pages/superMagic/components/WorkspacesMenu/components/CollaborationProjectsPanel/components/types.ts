// Shared types for CollaborationProjectsPanel components

import { CollaborationProjectCreator } from "@/pages/superMagic/pages/Workspace/types"
import { SortType, ViewMode } from "../../../../EmptyWorkspacePanel/components/ProjectItem"

// Component props interfaces
export interface CreatorFilterProps {
	value: CollaborationProjectCreator[]
	onChange: (value: CollaborationProjectCreator) => void
}

export interface SortSelectorProps {
	value: SortType
	onChange: (value: SortType) => void
}

export interface ViewToggleProps {
	value: ViewMode
	onChange: (value: ViewMode) => void
}
