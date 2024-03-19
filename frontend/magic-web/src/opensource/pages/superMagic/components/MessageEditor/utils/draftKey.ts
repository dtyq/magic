import type { DraftKey } from "../types"
import type { ProjectListItem, Topic, Workspace } from "../../../pages/Workspace/types"
import { isOtherCollaborationProject, SHARE_WORKSPACE_ID } from "../../../constants"

interface CreateMessageEditorDraftKeyParams {
	selectedWorkspace?: Workspace | null
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	workspaceId?: string | null
}

export function createMessageEditorDraftKey({
	selectedWorkspace,
	selectedProject,
	selectedTopic,
	workspaceId,
}: CreateMessageEditorDraftKeyParams): DraftKey {
	const resolvedWorkspaceId =
		workspaceId ??
		(isOtherCollaborationProject(selectedProject)
			? SHARE_WORKSPACE_ID
			: selectedProject?.workspace_id) ??
		selectedWorkspace?.id ??
		"defaultWorkspaceId"

	return {
		workspaceId: resolvedWorkspaceId,
		projectId: selectedProject?.id || "defaultProjectId",
		topicId: selectedTopic?.id || "defaultTopicId",
	}
}
