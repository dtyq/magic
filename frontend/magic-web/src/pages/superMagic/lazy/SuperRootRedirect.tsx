import { useEffect } from "react"
import { useParams } from "react-router"
import { useIsMobile } from "@/hooks/useIsMobile"
import { userStore } from "@/models/user"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import Navigate from "@/routes/components/Navigate"
import { baseHistory } from "@/routes/history"
import SuperMagicService from "../services"
import {
	ProjectTopicMapCache,
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "../utils/superMagicCache"

/** Returns true when pathname is bare /{cluster}/super without project/topic segments. */
function isBareSuperRootPath(pathname: string): boolean {
	return /^\/[^/]+\/super\/?$/.test(pathname) && !pathname.includes("/mobile-tabs")
}

/**
 * Single entry for /super index: render guard for mobile home, mount-only desktop cache restore.
 */
export default function SuperRootRedirect() {
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	const { projectId, topicId } = useParams()

	// Mobile viewport on bare /super index -> mobile home (covers resize, not only first mount).
	if (isMobile && !projectId && !topicId && isBareSuperRootPath(baseHistory.location.pathname)) {
		return <Navigate name={RouteName.MobileHome} replace viewTransition={false} />
	}

	useEffect(() => {
		// Desktop-only: restore workspace/project/topic from cache on first mount.
		if (isMobile) return

		const userInfo = userStore.user.userInfo
		const cachedState = WorkspaceStateCache.get(userInfo)
		const workspaceId = cachedState.workspaceId || UserWorkspaceMapCache.get(userInfo) || null
		const cachedProjectId = cachedState.projectId || null
		const topicIdResolved =
			cachedState.topicId ||
			(cachedProjectId ? ProjectTopicMapCache.get(userInfo, cachedProjectId) : null) ||
			null

		if (cachedProjectId && topicIdResolved) {
			navigate({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: { projectId: cachedProjectId, topicId: topicIdResolved },
				replace: true,
				viewTransition: false,
			})
			return
		}

		if (cachedProjectId) {
			navigate({
				name: RouteName.SuperWorkspaceProjectState,
				params: { projectId: cachedProjectId },
				replace: true,
				viewTransition: false,
			})
			return
		}

		if (workspaceId) {
			navigate({
				name: RouteName.SuperWorkspaceState,
				params: { workspaceId },
				replace: true,
				viewTransition: false,
			})
			return
		}

		void SuperMagicService.navigateToHome()
		// Intentionally omit isMobile: resize mobile/desktop is handled by route entry guards.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [navigate, projectId, topicId])

	return null
}
