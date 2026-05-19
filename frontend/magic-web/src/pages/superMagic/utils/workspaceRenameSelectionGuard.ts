const WORKSPACE_RENAME_SELECTION_SUPPRESS_MS = 220

let workspaceRenameSelectionSuppressUntil = 0

export function suppressSelectionAfterWorkspaceRename(
	durationMs: number = WORKSPACE_RENAME_SELECTION_SUPPRESS_MS,
) {
	workspaceRenameSelectionSuppressUntil = Date.now() + durationMs
}

export function shouldIgnoreSelectionAfterWorkspaceRename() {
	return Date.now() < workspaceRenameSelectionSuppressUntil
}
