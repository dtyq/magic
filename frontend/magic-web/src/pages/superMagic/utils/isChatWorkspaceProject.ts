import { getCachedChatWorkspaceId } from "@/pages/superMagic/hooks/useChatWorkspace"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

/**
 * Returns whether a project belongs to the dedicated chat workspace (mobile「对话」列表).
 */
export function isChatWorkspaceProject(
	project: Pick<ProjectListItem, "workspace_id"> | null | undefined,
	chatWorkspaceId: string | null,
): boolean {
	return Boolean(project && chatWorkspaceId && project.workspace_id === chatWorkspaceId)
}

/**
 * Resolves the cached chat workspace id used for lightweight chat-project checks.
 */
export function resolveChatWorkspaceId(): string | null {
	return getCachedChatWorkspaceId()
}

/**
 * Convenience helper: checks the project against the cached chat workspace id.
 */
export function isCachedChatWorkspaceProject(
	project: Pick<ProjectListItem, "workspace_id"> | null | undefined,
): boolean {
	return isChatWorkspaceProject(project, resolveChatWorkspaceId())
}
