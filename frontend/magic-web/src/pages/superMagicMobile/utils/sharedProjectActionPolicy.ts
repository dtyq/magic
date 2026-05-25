import { isOtherCollaborationProject } from "@/pages/superMagic/constants"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { canManageProject, isReadOnlyProject } from "@/pages/superMagic/utils/permission"

export type SharedProjectVisibleActionKey = "setCollaborators"

export interface SharedProjectActionPolicy {
	showShareButton: boolean
	showMoreButton: boolean
	/** When true, render add-collaborators in the header MORE slot instead of an ellipsis menu. */
	showCollaboratorsButton: boolean
	visibleActionKeys?: SharedProjectVisibleActionKey[]
	useSimplifiedSharedProjectActions: boolean
}

export interface ProjectDetailHeaderActionPolicy extends SharedProjectActionPolicy {
	/** Hide the header capsule when no action buttons are available. */
	showActionCapsule: boolean
	/** Whether the More menu would contain at least one item after visibility filtering. */
	hasMenuActions: boolean
}

export interface ProjectDetailHeaderActionSlots {
	share: boolean
	more: boolean
	collaborators: boolean
}

interface ResolveProjectDetailHeaderActionsOptions {
	canManageCollaborators: boolean
}

/**
 * Single source of truth for project-detail header buttons and simplified menus.
 * Merges role-based rules with collaborator-management capability.
 */
export function resolveProjectDetailHeaderActions(
	project?: ProjectListItem | null,
	options: ResolveProjectDetailHeaderActionsOptions = { canManageCollaborators: false },
): ProjectDetailHeaderActionPolicy & { actionSlots: ProjectDetailHeaderActionSlots } {
	const isReadonly = isReadOnlyProject(project?.user_role)
	const isReceivedSharedProject = isOtherCollaborationProject(project)

	if (!isReceivedSharedProject) {
		return attachHeaderDerivedFields({
			showShareButton: !isReadonly,
			showMoreButton: true,
			showCollaboratorsButton: false,
			visibleActionKeys: undefined,
			useSimplifiedSharedProjectActions: false,
			hasMenuActions: true,
		})
	}

	if (isReadonly) {
		return attachHeaderDerivedFields({
			showShareButton: false,
			showMoreButton: false,
			showCollaboratorsButton: false,
			visibleActionKeys: [],
			useSimplifiedSharedProjectActions: true,
			hasMenuActions: false,
		})
	}

	const canShowCollaborators =
		options.canManageCollaborators && canManageProject(project?.user_role)

	if (canShowCollaborators) {
		return attachHeaderDerivedFields({
			showShareButton: true,
			showMoreButton: false,
			showCollaboratorsButton: true,
			visibleActionKeys: ["setCollaborators"],
			useSimplifiedSharedProjectActions: true,
			hasMenuActions: false,
		})
	}

	// Editor, or manage without collaborator capability (e.g. opensource): share only, no empty More menu.
	return attachHeaderDerivedFields({
		showShareButton: true,
		showMoreButton: false,
		showCollaboratorsButton: false,
		visibleActionKeys: [],
		useSimplifiedSharedProjectActions: true,
		hasMenuActions: false,
	})
}

/** Attaches capsule visibility and per-slot flags used by the header shell. */
function attachHeaderDerivedFields(
	policy: SharedProjectActionPolicy & { hasMenuActions: boolean },
): ProjectDetailHeaderActionPolicy & { actionSlots: ProjectDetailHeaderActionSlots } {
	const showActionCapsule =
		policy.showShareButton || policy.showMoreButton || policy.showCollaboratorsButton

	return {
		...policy,
		showActionCapsule,
		actionSlots: {
			share: policy.showShareButton,
			more: policy.showMoreButton,
			collaborators: policy.showCollaboratorsButton,
		},
	}
}

/**
 * Role-only policy helper for callers that do not have collaborator capability context.
 * Prefer resolveProjectDetailHeaderActions when wiring header or detail menus.
 */
export function buildSharedProjectActionPolicy(
	project?: ProjectListItem | null,
): SharedProjectActionPolicy {
	const { showActionCapsule: _showActionCapsule, hasMenuActions: _hasMenuActions, actionSlots: _actionSlots, ...policy } =
		resolveProjectDetailHeaderActions(project, { canManageCollaborators: false })
	return policy
}
