import { useEffect } from "react"
import { userStore } from "@/opensource/models/user"
import { RouteName } from "@/opensource/routes/constants"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import {
	ProjectTopicMapCache,
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "../utils/superMagicCache"

export default function SuperRootRedirect() {
	const navigate = useNavigate()

	useEffect(() => {
		const userInfo = userStore.user.userInfo
		const cachedState = WorkspaceStateCache.get(userInfo)
		const workspaceId = cachedState.workspaceId || UserWorkspaceMapCache.get(userInfo) || null
		const projectId = cachedState.projectId || null
		const topicId =
			cachedState.topicId ||
			(projectId ? ProjectTopicMapCache.get(userInfo, projectId) : null) ||
			null

		if (projectId && topicId) {
			navigate({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: { projectId, topicId },
				replace: true,
				viewTransition: false,
			})
			return
		}

		if (projectId) {
			navigate({
				name: RouteName.SuperWorkspaceProjectState,
				params: { projectId },
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
		}
	}, [navigate])

	return null
}
