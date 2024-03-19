export interface SuperIdState {
	workspaceId?: string
	projectId?: string
	topicId?: string
}

/**
 * Parse super magic path and extract workspace, project, and topic IDs
 */
export const getSuperIdState = (): SuperIdState => {
	const pathname = document.location.pathname
	const superIndex = pathname.indexOf("/super/")
	if (superIndex === -1) return {}

	const superPath = pathname.substring(superIndex + 7)
	if (!superPath) return {}

	const pathParts = superPath.split("/").filter(Boolean)
	const result: SuperIdState = {}

	// /super/workspace/:workspaceId
	if (pathParts[0] === "workspace" && pathParts[1]) {
		result.workspaceId = pathParts[1]
		return result
	}

	// /super/:projectId 或 /super/:projectId/:topicId
	if (pathParts.length <= 2) {
		result.projectId = pathParts[0]
		result.topicId = pathParts[1]
		return result
	}

	// 兼容旧 URL：/super/:workspaceId/:projectId/:topicId
	if (pathParts.length >= 3) {
		result.workspaceId = pathParts[0]
		result.projectId = pathParts[1]
		result.topicId = pathParts[2]
	}

	return result
}
