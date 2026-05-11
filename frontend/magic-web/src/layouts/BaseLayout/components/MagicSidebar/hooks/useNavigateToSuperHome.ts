import type { MouseEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { RoutePath } from "@/constants/routes"
import { userStore } from "@/models/user"
import SuperMagicService from "@/pages/superMagic/services"
import { UserWorkspaceMapCache } from "@/pages/superMagic/utils/superMagicCache"
import { env } from "@/utils/env"

interface UseNavigateToSuperHomeReturn {
	superRouteUrl: string
	navigateToSuperHome: () => void
	handleNavigateToSuperHome: (event: MouseEvent<HTMLAnchorElement>) => void
}

export function useNavigateToSuperHome(): UseNavigateToSuperHomeReturn {
	const { userInfo } = userStore.user
	const navigateToSuperHome = useMemoizedFn(() => {
		const lastWorkspaceId = UserWorkspaceMapCache.get(userInfo)
		SuperMagicService.navigateToHome(lastWorkspaceId)
	})

	const handleNavigateToSuperHome = useMemoizedFn((event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault()
		event.stopPropagation()
		navigateToSuperHome()
	})

	const superRouteUrl = `${env("MAGIC_WEB_URL") || window.location.origin}${RoutePath.Super}`

	return {
		superRouteUrl,
		navigateToSuperHome,
		handleNavigateToSuperHome,
	}
}
