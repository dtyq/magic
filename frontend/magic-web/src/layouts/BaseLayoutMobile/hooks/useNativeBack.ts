import { useEffect } from "react"
import { getNativePort } from "@/platform/native"
import useNavigate from "@/routes/hooks/useNavigate"
import { getRoutePath, routesMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { isCollaborationProject, isCollaborationWorkspace } from "@/pages/superMagic/constants"
import {
	resolveSuperMobileBackFallbackByRoute,
	resolveSuperMobileProjectDetailBackFallback,
} from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"

/**
 * Subscribes to native hardware back and mirrors Super mobile UI back (history first, else semantic parent).
 */
function useNativeBack() {
	const navigate = useNavigate()

	useEffect(() => {
		const destroy = getNativePort().navigation.observeGoBack(() => {
			const chatPath = getRoutePath({ name: RouteName.Chat })
			const pathname = window.location.pathname

			if (pathname === chatPath) {
				return { canGoBack: false }
			}

			const matched = routesMatch(pathname)
			const routeName = matched?.route.name as RouteName | undefined
			const projectId = matched?.params?.projectId
			const workspaceId = matched?.params?.workspaceId

			let fallback =
				routeName === RouteName.SuperWorkspaceProjectState
					? resolveSuperMobileProjectDetailBackFallback({
							workspaceId:
								workspaceStore.selectedWorkspace?.id ||
								projectStore.selectedProject?.workspace_id ||
								"",
							isSharedProjectDetail:
								isCollaborationWorkspace(workspaceStore.selectedWorkspace) ||
								isCollaborationProject(projectStore.selectedProject),
						})
					: resolveSuperMobileBackFallbackByRoute({
							routeName,
							projectId,
							workspaceId,
						})

			navigate({
				delta: -1,
				name: fallback?.name,
				params: fallback?.params,
				viewTransition: { type: "slide", direction: "right" },
			})

			return { canGoBack: true }
		})

		return () => {
			destroy?.(true)
		}
	}, [navigate])
}

export default useNativeBack
