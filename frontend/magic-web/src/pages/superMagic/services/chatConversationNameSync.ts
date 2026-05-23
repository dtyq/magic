import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import { getCachedChatWorkspaceId } from "@/pages/superMagic/hooks/useChatWorkspace"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { isChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"
import TopicService from "./topicService"

export interface SyncChatConversationNameParams {
	projectId: string
	name: string
	workspaceId: string
	topicId?: string
}

/**
 * Resolves the single topic id for a chat project (chat workspace allows one topic per project).
 */
export async function resolveChatTopicId(
	projectId: string,
	explicitTopicId?: string,
): Promise<string | null> {
	const trimmedExplicit = explicitTopicId?.trim()
	if (trimmedExplicit) return trimmedExplicit

	const selected = topicStore.selectedTopic
	if (selected?.id && selected.project_id === projectId) {
		return selected.id
	}

	const fromList = topicStore.topics.find((topic) => topic.project_id === projectId)
	if (fromList?.id) return fromList.id

	const topicService = new TopicService({ store: topicStore })
	const response = await topicService.getTopicsByProjectId(projectId, 1, 1)
	return response.list[0]?.id ?? null
}

/**
 * Writes the same display name to both project and topic APIs for chat workspace projects.
 */
export async function syncChatConversationName({
	projectId,
	topicId,
	name,
}: SyncChatConversationNameParams): Promise<void> {
	const trimmedName = name.trim()
	if (!trimmedName) {
		throw new Error("Chat conversation name cannot be empty")
	}

	const resolvedTopicId = await resolveChatTopicId(projectId, topicId)
	if (!resolvedTopicId) {
		throw new Error("Chat conversation topic not found")
	}

	await Promise.all([
		SuperMagicApi.editProject({
			id: projectId,
			project_name: trimmedName,
			project_description: "",
		}),
		SuperMagicApi.editTopic({
			id: resolvedTopicId,
			topic_name: trimmedName,
			project_id: projectId,
		}),
	])

	runInAction(() => {
		const originalProject = projectStore.projects.find((p) => p.id === projectId)
		if (originalProject) {
			projectStore.updateProject({
				...originalProject,
				project_name: trimmedName,
			})
		}
		if (projectStore.selectedProject?.id === projectId) {
			projectStore.updateProject({
				...projectStore.selectedProject,
				project_name: trimmedName,
			})
		}
		topicStore.updateTopicName(resolvedTopicId, trimmedName)
	})
}

/**
 * Returns true when the project should use dual project/topic name sync.
 */
export function shouldSyncChatConversationName(
	project: { workspace_id: string } | null | undefined,
	chatWorkspaceId: string | null = getCachedChatWorkspaceId(),
): boolean {
	return isChatWorkspaceProject(project, chatWorkspaceId)
}

export interface RenameTopicWithChatSyncParams {
	project: ProjectListItem
	topicId: string
	topicName: string
}

/**
 * Renames a topic; for chat workspace projects also updates the paired project name.
 */
export async function renameTopicWithChatSync({
	project,
	topicId,
	topicName,
}: RenameTopicWithChatSyncParams): Promise<void> {
	const trimmedName = topicName.trim()
	if (!trimmedName) {
		throw new Error("Topic name cannot be empty")
	}

	if (shouldSyncChatConversationName(project)) {
		await syncChatConversationName({
			projectId: project.id,
			topicId,
			name: trimmedName,
			workspaceId: project.workspace_id,
		})
		return
	}

	await SuperMagicApi.editTopic({
		id: topicId,
		topic_name: trimmedName,
		project_id: project.id,
	})
	runInAction(() => {
		topicStore.updateTopicName(topicId, trimmedName)
	})
}

export interface SyncChatProjectNameOnlyParams {
	projectId: string
	name: string
}

/**
 * Updates only the project name for chat conversations (topic already renamed, e.g. smart rename).
 */
export async function syncChatProjectNameOnly({
	projectId,
	name,
}: SyncChatProjectNameOnlyParams): Promise<void> {
	const trimmedName = name.trim()
	if (!trimmedName) return

	await SuperMagicApi.editProject({
		id: projectId,
		project_name: trimmedName,
		project_description: "",
	})

	runInAction(() => {
		const originalProject = projectStore.projects.find((p) => p.id === projectId)
		if (originalProject) {
			projectStore.updateProject({
				...originalProject,
				project_name: trimmedName,
			})
		}
		if (projectStore.selectedProject?.id === projectId) {
			projectStore.updateProject({
				...projectStore.selectedProject,
				project_name: trimmedName,
			})
		}
	})
}
