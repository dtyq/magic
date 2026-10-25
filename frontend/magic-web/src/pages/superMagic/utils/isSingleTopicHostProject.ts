import type { ProjectListItem } from "../pages/Workspace/types"
import { TopicMode } from "../pages/Workspace/TopicMode"
import { isCachedChatWorkspaceProject } from "./isChatWorkspaceProject"

const SINGLE_TOPIC_HOST_MODES = new Set<TopicMode>([TopicMode.MagiClaw, TopicMode.Chat])

export type SingleTopicHostProject = Partial<Pick<ProjectListItem, "project_mode" | "workspace_id">>

function toChatWorkspaceProject(project?: SingleTopicHostProject | null) {
	return project ? { workspace_id: project.workspace_id ?? "" } : null
}

/** 龙虾 / 对话工作区各只有一个话题，不能再建新话题。 */
export function isSingleTopicHostProject(project?: SingleTopicHostProject | null): boolean {
	if (isCachedChatWorkspaceProject(toChatWorkspaceProject(project))) return true
	return Boolean(project?.project_mode && SINGLE_TOPIC_HOST_MODES.has(project.project_mode))
}

/** 单话题宿主沿用自身模式；对话工作区即使 mode 缺失也按 Chat。 */
export function resolveIframeHostTopicMode(project?: SingleTopicHostProject | null): TopicMode {
	if (project?.project_mode === TopicMode.MagiClaw) return TopicMode.MagiClaw
	if (
		project?.project_mode === TopicMode.Chat ||
		isCachedChatWorkspaceProject(toChatWorkspaceProject(project))
	) {
		return TopicMode.Chat
	}
	return TopicMode.MicroApp
}
