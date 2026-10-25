import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { canManageProject } from "@/pages/superMagic/utils/permission"

/** Returns whether a sidebar project can participate in drag-and-drop. */
export function canDragSidebarProject(project: ProjectListItem, dndDisabled = false): boolean {
	if (dndDisabled || isWorkspaceShortcutProject(project)) return false
	if (!isCollaborationProject(project)) return true
	return canManageProject(project.user_role)
}
