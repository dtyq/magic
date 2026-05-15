import { canManageProject, isOwner } from "@/pages/superMagic/utils/permission"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"

interface ProjectCollaboratorActionVisibilityParams {
	mode: "default" | "chat"
	isCollaborationProject: boolean
	userRole?: CollaboratorPermission
	canManageCollaborators: boolean
}

interface ProjectTransferActionVisibilityParams {
	mode: "default" | "chat"
	userRole?: CollaboratorPermission
	isWorkspaceShortcutProject: boolean
	canTransferProject: boolean
}

interface HierarchicalCollaboratorActionVisibilityParams {
	userRole?: CollaboratorPermission
	canManageCollaborators: boolean
}

export function shouldShowProjectCollaboratorAction({
	mode,
	isCollaborationProject,
	userRole,
	canManageCollaborators,
}: ProjectCollaboratorActionVisibilityParams) {
	if (mode === "chat" || !canManageCollaborators) {
		return false
	}

	return (isCollaborationProject && canManageProject(userRole)) || isOwner(userRole)
}

export function shouldShowProjectTransferAction({
	mode,
	userRole,
	isWorkspaceShortcutProject,
	canTransferProject,
}: ProjectTransferActionVisibilityParams) {
	if (mode === "chat" || !canTransferProject) {
		return false
	}

	return isOwner(userRole) && !isWorkspaceShortcutProject
}

export function shouldShowHierarchicalCollaboratorAction({
	userRole,
	canManageCollaborators,
}: HierarchicalCollaboratorActionVisibilityParams) {
	return canManageCollaborators && canManageProject(userRole)
}