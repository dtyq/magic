import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { RouteName } from "@/routes/constants"

const superWorkspaceRouteNames = new Set<RouteName>([
	RouteName.Super,
	RouteName.SuperWorkspaceState,
	RouteName.SuperWorkspaceProjectState,
	RouteName.SuperWorkspaceProjectTopicState,
])

export function isSuperWorkspaceRouteName(
	routeName: RouteName | undefined,
	search?: string,
): boolean {
	if (!routeName) return false
	if (superWorkspaceRouteNames.has(routeName)) return true
	if (routeName !== RouteName.MobileTabs) return false

	const searchParams = new URLSearchParams(search || "")
	const activeTab = searchParams.get("tab")

	if (
		searchParams.has("workspaceId") ||
		searchParams.has("projectId") ||
		searchParams.has("topicId")
	) {
		return true
	}

	return activeTab === MobileTabParam.Super
}
