import { getRoutePath } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { env } from "@/utils/env"
import { RoutePath } from "@/constants/routes"

/**
 * Get workspace route URL
 * @param workspaceId - Optional workspace ID
 * @returns Full URL for workspace route
 */
export function getWorkspaceRouteUrl(workspaceId?: string): string {
	const domain = env("MAGIC_WEB_URL") || window.location.origin
	const path = workspaceId
		? getRoutePath({
			name: RouteName.SuperWorkspaceState,
			params: {
				workspaceId,
			},
		})
		: RoutePath.Super
	return `${domain}${path}`
}

/**
 * Get workspace project route URL
 * @param workspaceId - Workspace ID
 * @param projectId - Project ID
 * @returns Full URL for workspace project route
 */
export function getWorkspaceProjectRouteUrl(
	_workspaceId: string | undefined,
	projectId: string,
): string {
	const domain = env("MAGIC_WEB_URL") || window.location.origin
	const path = projectId
		? getRoutePath({
			name: RouteName.SuperWorkspaceProjectState,
			params: {
				projectId,
			},
		})
		: RoutePath.Super
	return `${domain}${path}`
}
