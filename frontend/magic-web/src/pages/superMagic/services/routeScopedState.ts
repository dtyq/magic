import { routesMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { projectStore, topicStore } from "../stores/core"
import { isSuperWorkspaceRouteName } from "./routeScopedStateMatcher"

interface RouteLocationLike {
	pathname: string
	search?: string
}

export function isSuperWorkspaceRouteLocation(location: RouteLocationLike): boolean {
	const matchedRoute = routesMatch(location.pathname)
	return isSuperWorkspaceRouteName(
		matchedRoute?.route?.name as RouteName | undefined,
		location.search,
	)
}

export function clearSuperRouteScopedSelectionState() {
	projectStore.setSelectedProject(null)
	topicStore.setSelectedTopic(null)
}
