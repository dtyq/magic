import { useEffect } from "react"
import { useParams } from "react-router"
import { useIsMobile } from "@/hooks/useIsMobile"
import { userStore } from "@/models/user"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { baseHistory } from "@/routes/history"
import { RoutePath } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import SuperMagicService from "../services"
import {
	ProjectTopicMapCache,
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "../utils/superMagicCache"

/** Single entry for /super index: mobile shell, desktop cache, or workspace home */
export default function SuperRootRedirect() {
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	const { projectId, topicId } = useParams()

	useEffect(() => {
		// Mobile: /{cluster}/super -> /mobile-home
		if (isMobile) {
			if (!projectId && !topicId) {
				const currentPath = baseHistory.location.pathname
				const isSuperRootPath = /^\/[^/]+\/super\/?$/.test(currentPath)
				if (isSuperRootPath && !currentPath.includes("/mobile-tabs")) {
					const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
					const targetPath = `/${clusterCode}${RoutePath.MobileHome}`
					baseHistory.replace(targetPath)
				}
			}
			return
		}

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
	}, [isMobile, navigate, projectId, topicId])

	return null
}
