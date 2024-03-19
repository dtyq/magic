import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useMemoizedFn } from "ahooks"
import { RouteName } from "@/opensource/routes/constants"
import routeManageService from "@/opensource/pages/superMagic/services/routeManageService"

export function useSuperMagicNavigate() {
	const navigate = useNavigate()

	/** 处理跳转超级麦吉的场景 */
	const handleSuperMagicNavigate = useMemoizedFn(() => {
		const workspaceStateSessionStorageKey =
			routeManageService.getWorkspaceStateSessionStorageKey()
		const superMaigcWorkspaceStateStr = sessionStorage.getItem(workspaceStateSessionStorageKey)
		if (superMaigcWorkspaceStateStr) {
			const superMaigcWorkspaceState = JSON.parse(superMaigcWorkspaceStateStr)
			const cache_workspaceId = superMaigcWorkspaceState.workspaceId || null
			const cache_projectId = superMaigcWorkspaceState.projectId || null
			const cache_topicId = superMaigcWorkspaceState.topicId || null

			if (cache_projectId && cache_topicId) {
				navigate({
					name: RouteName.SuperWorkspaceProjectTopicState,
					params: {
						projectId: cache_projectId,
						topicId: cache_topicId,
					},
					viewTransition: false,
					replace: false,
				})
			} else if (cache_projectId) {
				navigate({
					name: RouteName.SuperWorkspaceProjectState,
					params: {
						projectId: cache_projectId,
					},
					viewTransition: false,
					replace: false,
				})
			} else if (cache_workspaceId) {
				navigate({
					name: RouteName.SuperWorkspaceState,
					params: {
						workspaceId: cache_workspaceId,
					},
					viewTransition: false,
					replace: false,
				})
			} else {
				navigate({
					name: RouteName.Super,
					viewTransition: false,
					replace: false,
				})
			}
		} else {
			navigate({
				name: RouteName.Super,
				viewTransition: false,
				replace: false,
			})
		}
	})

	return {
		handleSuperMagicNavigate,
	}
}
