import { useEffect } from "react"
import { useLocation, useParams } from "react-router"
import { useIsMobile } from "@/hooks/useIsMobile"
import { userStore } from "@/models/user"
import { RouteName } from "@/routes/constants"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import useNavigate from "@/routes/hooks/useNavigate"
import { projectStore, topicStore } from "../stores/core"
import { isAiCanvasProject } from "../utils/isAiCanvasProject"
import { ProjectTopicMapCache } from "../utils/superMagicCache"

/**
 * Keeps a project on the address that matches its mode, once its details are loaded: desktop
 * AI canvas projects belong at `/super/ai-canvas/:projectId`, every other project (and every
 * project on mobile) at the generic project routes. Old `/super/:projectId/:topicId` links of
 * canvas projects land on the canvas address this way.
 *
 * The canvas address carries no topic, so a topic in the old link is recorded as the project's
 * last topic first; the canvas page and state restore then open that topic. Query and history
 * state travel along, and the redirect replaces the history entry.
 */
export function useAiCanvasRouteRedirect() {
	const isMobile = useIsMobile()
	const navigate = useNavigate()
	const { projectId, topicId: routeTopicId } = useParams()
	const { pathname, search, state } = useLocation()
	const project = projectStore.selectedProject
	const projectReady = Boolean(projectId) && project?.id === projectId
	const isCanvasRoute = routesMatch(pathname)?.route.name === RouteName.AiCanvasProjectState
	const belongsOnCanvasRoute = !isMobile && projectReady && isAiCanvasProject(project)
	const selectedTopic = topicStore.selectedTopic
	const openTopicId = selectedTopic?.project_id === projectId ? selectedTopic?.id : undefined

	useEffect(() => {
		if (!projectId || !projectReady || belongsOnCanvasRoute === isCanvasRoute) return

		const query = convertSearchParams(new URLSearchParams(search))

		if (belongsOnCanvasRoute) {
			if (routeTopicId) {
				ProjectTopicMapCache.set(userStore.user.userInfo, projectId, routeTopicId)
			}
			navigate({
				name: RouteName.AiCanvasProjectState,
				params: { projectId },
				query,
				state,
				replace: true,
			})
			return
		}

		navigate({
			name: openTopicId
				? RouteName.SuperWorkspaceProjectTopicState
				: RouteName.SuperWorkspaceProjectState,
			params: { projectId, topicId: openTopicId },
			query,
			state,
			replace: true,
		})
	}, [
		belongsOnCanvasRoute,
		isCanvasRoute,
		navigate,
		openTopicId,
		projectId,
		projectReady,
		routeTopicId,
		search,
		state,
	])
}
