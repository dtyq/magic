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
	includeWorkspaceOrder?: boolean
	compact?: boolean
	/** 窄工具栏仅缩短触发器，菜单仍展示完整排序选项。 */
	responsive?: boolean
}

export interface ViewToggleProps {
	value: ViewMode
	onChange: (value: ViewMode) => void
}
