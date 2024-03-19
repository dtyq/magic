import { ProjectListItem, CollaborationProjectListItem } from "../pages/Workspace/types"
import {
	SHARE_WORKSPACE_ID,
	isOtherCollaborationProject,
	isWorkspaceShortcutProject,
} from "../constants"
import { env } from "@/opensource/utils/env"
import { convertSearchParams, getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"

export const openInNewTab = (url: string) => {
	const a = document.createElement("a")
	a.href = url
	a.target = "_blank"
	a.rel = "noopener noreferrer"
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

/**
 * 生成项目话题路由链接
 * @param workspaceId 工作区ID
 * @param projectId 项目ID
 * @param topicId 话题ID
 * @returns 项目话题路由链接
 */
export const genProjectTopicUrl = (
	_workspaceId: string | null | undefined,
	projectId: string | null | undefined,
	topicId?: string | null | undefined,
) => {
	if (!projectId || !topicId) {
		console.error("projectId, topicId is required")
		return ""
	}
	const url = new URL(window.location.href)
	const path = getRoutePath({
		name: RouteName.SuperWorkspaceProjectTopicState,
		params: {
			projectId,
			topicId,
		},
		query: convertSearchParams(url.searchParams),
	})
	const domain = env("MAGIC_WEB_URL") || window.location.origin
	return `${domain}${path}`
}

export const generateCollaborationProjectUrl = (
	project: CollaborationProjectListItem | ProjectListItem,
) => {
	const url = new URL(window.location.href)
	const path = getRoutePath({
		name: RouteName.SuperWorkspaceProjectState,
		params: {
			projectId: project.id,
		},
		query: convertSearchParams(url.searchParams),
	})
	const domain = env("MAGIC_WEB_URL") || window.location.origin
	return `${domain}${path}`
}

/**
 * 生成项目或话题的URL（用于新窗口打开）
 * @param projectId 项目ID
 * @param topicId 话题ID（可选）
 * @returns 完整的URL
 */
export const generateProjectTopicUrl = (
	projectId: string | null | undefined,
	topicId?: string | null | undefined,
): string => {
	if (!projectId) {
		console.error("projectId is required")
		return ""
	}
	const url = new URL(window.location.href)
	const routeName = topicId
		? RouteName.SuperWorkspaceProjectTopicState
		: RouteName.SuperWorkspaceProjectState
	const params: { projectId: string; topicId?: string } = { projectId }
	if (topicId) {
		params.topicId = topicId
	}
	const path = getRoutePath({
		name: routeName,
		params,
		query: convertSearchParams(url.searchParams),
	})
	const domain = env("MAGIC_WEB_URL") || window.location.origin
	return `${domain}${path}`
}

// 在新窗口打开项目
export const openProjectInNewTab = (project: ProjectListItem | CollaborationProjectListItem) => {
	try {
		const url = new URL(window.location.href)
		const path = getRoutePath({
			name: RouteName.SuperWorkspaceProjectState,
			params: {
				projectId: project.id,
			},
			query: convertSearchParams(url.searchParams),
		})
		const domain = env("MAGIC_WEB_URL") || window.location.origin
		openInNewTab(`${domain}${path}`)
	} catch (error) {
		console.log("🚀 ~ EmptyWorkspacePanel ~ error:", error)
	}
}
