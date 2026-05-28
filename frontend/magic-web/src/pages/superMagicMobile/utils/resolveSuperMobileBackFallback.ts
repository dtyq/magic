import { RouteName } from "@/routes/constants"
import type { RouteParams } from "@/routes/history/types"
import { isCollaborationProject } from "@/pages/superMagic/constants"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
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

interface ResolvePostMoveBackFallbackParams {
	targetWorkspaceId: string
	movedProject: Pick<ProjectListItem, "user_role"> | null | undefined
}

/**
 * Resolves the fallback route after a project move when history back is unavailable.
 * Uses the post-move workspace (target), not the source workspace.
 */
export function resolvePostMoveBackFallback({
	targetWorkspaceId,
	movedProject,
}: ResolvePostMoveBackFallbackParams): SuperMobileBackFallbackTarget | null {
	return resolveSuperMobileProjectDetailBackFallback({
		workspaceId: targetWorkspaceId,
		isSharedProjectDetail: isCollaborationProject(movedProject ?? null),
	})
}

interface ShouldExitPageAfterMoveParams {
	movedProjectId: string
	selectedProjectId: string | undefined
	isProjectDetailActionContext: boolean
	shouldShowSaveAsProject: boolean
	chatActionContext: "drawer" | "detail"
}

/**
 * Decides whether the user should leave the current page after moving a project.
 */
export function shouldExitPageAfterProjectMove({
	movedProjectId,
	selectedProjectId,
	isProjectDetailActionContext,
	shouldShowSaveAsProject,
	chatActionContext,
}: ShouldExitPageAfterMoveParams): boolean {
	const isMovingViewedProject = selectedProjectId === movedProjectId
	if (!isMovingViewedProject) return false

	if (isProjectDetailActionContext) return true

	return shouldShowSaveAsProject && chatActionContext === "detail"
}

interface ShouldExitDetailPageAfterDeleteParams {
	deletedProjectId: string
	selectedProjectId: string | undefined
	isProjectDetailActionContext: boolean
}

/**
 * Only workspace project detail pages should leave via back+fallback after delete; list pages keep local refresh.
 */
export function shouldExitDetailPageAfterDelete({
	deletedProjectId,
	selectedProjectId,
	isProjectDetailActionContext,
}: ShouldExitDetailPageAfterDeleteParams): boolean {
	if (!isProjectDetailActionContext) return false

	return selectedProjectId === deletedProjectId
}

/** Same guard as delete: leave project detail when the viewed project was transferred. */
export function shouldExitDetailPageAfterTransfer(
	params: ShouldExitDetailPageAfterDeleteParams,
): boolean {
	return shouldExitDetailPageAfterDelete(params)
}

interface ShouldExitChatDetailAfterDeleteParams {
	deletedProjectId: string
	selectedProjectId: string | undefined
	isChatMode: boolean
	chatActionContext: "drawer" | "detail"
}

/**
 * Chat conversation detail should leave via back+fallback; drawer/list keeps in-place refresh.
 */
export function shouldExitChatDetailAfterDelete({
	deletedProjectId,
	selectedProjectId,
	isChatMode,
	chatActionContext,
}: ShouldExitChatDetailAfterDeleteParams): boolean {
	if (!isChatMode || chatActionContext !== "detail") return false

	return selectedProjectId === deletedProjectId
}

interface ShouldExitTopicDetailAfterDeleteParams {
	deletedTopicId: string
	selectedTopicId: string | undefined
	isTopicDetailActionContext: boolean
}

/**
 * Project topic sub-page delete should return to project entry, not auto-select another topic.
 */
export function shouldExitTopicDetailAfterDelete({
	deletedTopicId,
	selectedTopicId,
	isTopicDetailActionContext,
}: ShouldExitTopicDetailAfterDeleteParams): boolean {
	if (!isTopicDetailActionContext) return false

	return selectedTopicId === deletedTopicId
}

/**
 * Fallback when leaving workspace detail after the workspace itself is deleted.
 */
export function resolveWorkspaceDetailDeleteFallback(): SuperMobileBackFallbackTarget {
	return { name: RouteName.SuperWorkspacesList }
}

interface ShouldExitWorkspaceDetailAfterTransferParams {
	routeWorkspaceId: string | undefined
	transferredWorkspaceId: string
}

/**
 * True when transfer happens on the workspace detail route for the workspace being transferred.
 */
export function shouldExitWorkspaceDetailAfterTransfer({
	routeWorkspaceId,
	transferredWorkspaceId,
}: ShouldExitWorkspaceDetailAfterTransferParams): boolean {
	if (!routeWorkspaceId || !transferredWorkspaceId) return false

	return routeWorkspaceId === transferredWorkspaceId
}

/**
 * Fallback when leaving chat conversation detail after deleting the chat project.
 */
export function resolveChatDetailDeleteFallback(): SuperMobileBackFallbackTarget {
	return { name: RouteName.SuperChatsList }
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
