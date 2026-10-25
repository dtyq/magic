import { userStore } from "@/models/user"
import { RouteName } from "@/routes/constants"
import { routesMatch } from "@/routes/history/helpers"
import { topicStore } from "../stores/core"
import { ProjectTopicMapCache } from "./superMagicCache"

export interface SuperPopRefreshParams {
	workspaceId?: string
	projectId?: string
	topicId?: string
}

/**
 * Maps the current pathname to refreshState inputs for browser POP (back/forward).
 * Uses routesMatch so chat/workspace routes stay aligned with the route table.
 */
export function resolveSuperPopRefreshParams(pathname: string): SuperPopRefreshParams | null {
	if (!pathname.includes("/super")) {
		return null
	}

	const matched = routesMatch(pathname)
	const routeName = matched?.route?.name as RouteName | undefined
	if (!routeName) {
		return null
	}

	const params = (matched?.params ?? {}) as Record<string, string | undefined>

	switch (routeName) {
		case RouteName.SuperChatProjectState:
			return {
				projectId: params.projectId,
				topicId: params.topicId,
			}
		case RouteName.SuperWorkspaceProjectTopicState:
			return {
				projectId: params.projectId,
				topicId: params.topicId,
			}
		case RouteName.SuperWorkspaceProjectState:
			return {
				projectId: params.projectId,
			}
		case RouteName.AiCanvasProjectState: {
			// Canvas addresses carry no topic. Keep the project's open topic, else its last one, so
			// restoring a canvas never treats the selected topic as stale or opens another one.
			const projectId = params.projectId
			const openTopicId =
				topicStore.selectedTopic?.project_id === projectId
					? topicStore.selectedTopic?.id
					: undefined
			return {
				projectId,
				topicId:
					openTopicId ??
					(projectId
						? (ProjectTopicMapCache.get(userStore.user.userInfo, projectId) ??
							undefined)
						: undefined),
			}
		}
		case RouteName.SuperWorkspaceState:
			return {
				workspaceId: params.workspaceId,
			}
		case RouteName.SuperWorkspaceProjects:
			return {
				workspaceId: params.workspaceId,
			}
		case RouteName.SuperChatsList:
		case RouteName.SuperWorkspacesList:
		case RouteName.SuperSharedWorkspace:
		case RouteName.MobileHome:
		case RouteName.SuperApps:
			return {
				projectId: undefined,
				topicId: undefined,
			}
		default:
			return null
	}
}
