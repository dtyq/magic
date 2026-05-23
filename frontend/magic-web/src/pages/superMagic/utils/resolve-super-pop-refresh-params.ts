import { RouteName } from "@/routes/constants"
import { routesMatch } from "@/routes/history/helpers"

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
