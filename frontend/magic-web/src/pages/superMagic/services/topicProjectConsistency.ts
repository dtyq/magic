import type { Topic, ProjectListItem } from "../pages/Workspace/types"

/**
 * 统一判断当前话题是否仍然属于目标项目，避免移动端 chat 项目页继续复用旧会话状态。
 */
export function isTopicBoundToProject(
	topic: Topic | null | undefined,
	projectId: string | null | undefined,
): boolean {
	if (!topic?.id || !projectId) {
		return false
	}

	return topic.project_id === projectId
}

/**
 * 只有项目、工作区、话题三者都已经对齐时，chat 项目路由才允许跳过状态恢复。
 */
export function shouldRefreshChatProjectState({
	projectId,
	routeTopicId,
	selectedProjectId,
	selectedWorkspaceId,
	selectedTopic,
}: {
	projectId: string | undefined
	routeTopicId: string | undefined
	selectedProjectId: string | undefined
	selectedWorkspaceId: string | undefined
	selectedTopic: Topic | null | undefined
}): boolean {
	if (!projectId) {
		return false
	}

	if (selectedProjectId !== projectId) {
		return true
	}

	if (!selectedWorkspaceId) {
		return true
	}

	if (routeTopicId && selectedTopic?.id !== routeTopicId) {
		return true
	}

	return !isTopicBoundToProject(selectedTopic, projectId)
}

/**
 * 发送前若发现当前话题不属于选中项目，需要先补齐正确的话题上下文再继续发送。
 */
export function shouldCreateFreshTopicForProject(
	project: ProjectListItem | null | undefined,
	topic: Topic | null | undefined,
): boolean {
	if (!project?.id) {
		return false
	}

	return !isTopicBoundToProject(topic, project.id)
}
