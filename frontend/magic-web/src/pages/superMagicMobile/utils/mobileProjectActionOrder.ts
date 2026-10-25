import type { ProjectActionKey } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"

/** Prototype order for mobile project More menus (sidebar recent + project detail). */
export const MOBILE_PROJECT_ACTION_ORDER: ProjectActionKey[] = [
	"rename",
	"move",
	"enterWorkspace",
	"setCollaborators",
	"transfer",
	"delete",
]

/** AI canvas projects live in the AI canvas workspace only, so they cannot be moved out of it. */
export const AI_CANVAS_HIDDEN_ACTION_KEYS: ProjectActionKey[] = ["move", "enterWorkspace"]

/** Sidebar recent chat items: rename / save as project / delete (no pin). */
export const SHELL_RECENT_CHAT_ACTION_KEYS: ProjectActionKey[] = [
	"rename",
	"saveAsProject",
	"delete",
]

/** Chat pin UI is enabled now that the backend returns pin state for chat projects. */
export const MOBILE_CHAT_PIN_ENABLED = true

/** Chat list/detail More menus: align with MOBILE_CHAT_PIN_ENABLED. */
export const MOBILE_CHAT_DETAIL_ACTION_KEYS: ProjectActionKey[] = MOBILE_CHAT_PIN_ENABLED
	? ["pinProject", "rename", "saveAsProject", "delete"]
	: ["rename", "saveAsProject", "delete"]

interface SortFilteredProjectActionsOptions {
	isChatMode: boolean
}

/**
 * Sorts visible project actions to match prototype order; extras slot between core groups.
 */
export function sortFilteredProjectActions<T extends { key: ProjectActionKey }>(
	actions: T[],
	{ isChatMode }: SortFilteredProjectActionsOptions,
): T[] {
	return [...actions].sort(
		(a, b) =>
			getProjectActionSortIndex(a.key, isChatMode) -
			getProjectActionSortIndex(b.key, isChatMode),
	)
}

/** Lower index renders earlier in flat menus and within-group order. */
function getProjectActionSortIndex(key: ProjectActionKey, isChatMode: boolean): number {
	if (key === "pinProject") return -1

	if (isChatMode) {
		const chatIndex = SHELL_RECENT_CHAT_ACTION_KEYS.indexOf(key)
		if (chatIndex >= 0) return chatIndex
		return 100
	}

	const prototypeIndex = MOBILE_PROJECT_ACTION_ORDER.indexOf(key)
	if (prototypeIndex >= 0) return prototypeIndex

	if (key === "saveAsProject") return MOBILE_PROJECT_ACTION_ORDER.indexOf("move")
	if (key === "copyCollaborationLink") {
		return MOBILE_PROJECT_ACTION_ORDER.indexOf("setCollaborators") + 0.1
	}
	if (key === "cancelWorkspaceShortcut") {
		return MOBILE_PROJECT_ACTION_ORDER.indexOf("transfer") - 0.1
	}

	return 100
}

interface BuildMobileProjectActionGroupsOptions {
	shouldShowSaveAsProject: boolean
}

type ActionWithKey = { key: ProjectActionKey }

/**
 * Builds prototype-style card groups; optional extras get their own cards between core sections.
 */
export function buildMobileProjectActionGroups<T extends ActionWithKey>(
	actions: T[],
	{ shouldShowSaveAsProject }: BuildMobileProjectActionGroupsOptions,
): T[][] {
	const primaryKeys: ProjectActionKey[] = shouldShowSaveAsProject
		? ["rename", "saveAsProject", "enterWorkspace"]
		: ["rename", "move", "enterWorkspace"]

	const groupDefinitions: ProjectActionKey[][] = [primaryKeys, ["setCollaborators"]]

	if (actions.some((action) => action.key === "copyCollaborationLink")) {
		groupDefinitions.push(["copyCollaborationLink"])
	}
	if (actions.some((action) => action.key === "cancelWorkspaceShortcut")) {
		groupDefinitions.push(["cancelWorkspaceShortcut"])
	}

	groupDefinitions.push(["transfer"], ["delete"])

	if (actions.some((action) => action.key === "pinProject")) {
		groupDefinitions.unshift(["pinProject"])
	}

	return groupDefinitions
		.map((keys) => actions.filter((action) => keys.includes(action.key)))
		.filter((group) => group.length > 0)
}
