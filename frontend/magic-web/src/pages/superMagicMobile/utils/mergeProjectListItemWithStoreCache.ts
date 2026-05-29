import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore } from "@/pages/superMagic/stores/core"

/** Picks the richest cached row for permission fields (prefer entries that include user_role). */
function findCachedProjectInWorkspace(
	workspaceId: string,
	projectId: string,
): ProjectListItem | undefined {
	const matches = projectStore
		.getProjectsByWorkspace(workspaceId)
		.filter((item) => item.id === projectId)

	if (matches.length === 0) return undefined

	return matches.find((item) => item.user_role) ?? matches[0]
}

/**
 * Merges a lightweight project payload (e.g. recent-menu API row) with cached store data
 * so permission checks use the same user_role/tag as project detail.
 */
export function mergeProjectListItemWithStoreCache(
	project: ProjectListItem | null | undefined,
): ProjectListItem | null {
	if (!project) return null

	const cachedInWorkspace = findCachedProjectInWorkspace(project.workspace_id, project.id)

	const selectedProject =
		projectStore.selectedProject?.id === project.id ? projectStore.selectedProject : null

	const merged: ProjectListItem = {
		...(cachedInWorkspace ?? {}),
		...(selectedProject ?? {}),
		...project,
		user_role: project.user_role ?? selectedProject?.user_role ?? cachedInWorkspace?.user_role,
		tag: project.tag ?? selectedProject?.tag ?? cachedInWorkspace?.tag,
	}

	return merged
}
