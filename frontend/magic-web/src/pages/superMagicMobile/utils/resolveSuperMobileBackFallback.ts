import { RouteName } from "@/routes/constants"
import type { RouteParams } from "@/routes/history/types"
import {
	getMobileTopicPageCapabilities,
	MobileTopicPageKind,
} from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"

export interface SuperMobileBackFallbackTarget {
	name: RouteName
	params?: RouteParams["params"]
}

interface ResolveProjectDetailBackFallbackParams {
	workspaceId: string
	isSharedProjectDetail: boolean
}

/**
 * Resolves the semantic parent route when leaving a workspace project detail page.
 */
export function resolveSuperMobileProjectDetailBackFallback({
	workspaceId,
	isSharedProjectDetail,
}: ResolveProjectDetailBackFallbackParams): SuperMobileBackFallbackTarget | null {
	if (!workspaceId) return null

	if (isSharedProjectDetail) {
		return { name: RouteName.SuperSharedWorkspace }
	}

	return {
		name: RouteName.SuperWorkspaceProjects,
		params: { workspaceId },
	}
}

interface ResolveBackFallbackByRouteParams {
	routeName?: RouteName
	projectId?: string
	workspaceId?: string
}

/**
 * Resolves a default semantic parent from the current route name and URL params (for native back, etc.).
 */
export function resolveSuperMobileBackFallbackByRoute({
	routeName,
	projectId,
	workspaceId,
}: ResolveBackFallbackByRouteParams): SuperMobileBackFallbackTarget | null {
	if (!routeName) return null

	switch (routeName) {
		case RouteName.SuperWorkspaceProjectTopicState: {
			if (!projectId) return null
			return getMobileTopicPageCapabilities(MobileTopicPageKind.ProjectTopic).resolveBackTarget(
				projectId,
			)
		}
		case RouteName.SuperChatProjectState:
			return getMobileTopicPageCapabilities(MobileTopicPageKind.SingleTopicChat).resolveBackTarget(
				projectId,
			)
		case RouteName.SuperWorkspaceProjects:
			return { name: RouteName.SuperWorkspacesList }
		case RouteName.SuperSharedWorkspace:
			return { name: RouteName.SuperWorkspacesList }
		case RouteName.SuperMagicNavigate:
			return { name: RouteName.Super }
		default:
			return null
	}
}
