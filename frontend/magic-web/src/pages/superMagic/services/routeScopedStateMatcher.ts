import { RouteName } from "@/routes/constants"

const superWorkspaceRouteNames = new Set<RouteName>([
	RouteName.Super,
	RouteName.SuperWorkspaceState,
	RouteName.SuperChatProjectState,
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

	if (
		searchParams.has("workspaceId") ||
		searchParams.has("projectId") ||
		searchParams.has("topicId")
	) {
		return true
	}

	// 纯 `mobile-tabs?tab=super` 现在代表“直接开聊首页”，不再视为 workspace route。
	return false
}
