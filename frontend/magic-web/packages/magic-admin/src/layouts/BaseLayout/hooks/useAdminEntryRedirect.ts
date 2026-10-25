import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { RoutePath } from "@admin/const/routes"
import { useAdminStore } from "@admin/stores/admin"

interface UseAdminEntryRedirectOptions {
	authLoading?: boolean
	firstAccessiblePath?: string
}

export function useAdminEntryRedirect({
	authLoading,
	firstAccessiblePath,
}: UseAdminEntryRedirectOptions) {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const { isPermissionInitialized } = useAdminStore()

	useEffect(() => {
		if (!isPermissionInitialized || authLoading) return

		if (pathname === RoutePath.AdminNoAuthorized) {
			if (firstAccessiblePath) {
				navigate(firstAccessiblePath, { replace: true })
			}
			return
		}

		if (pathname !== RoutePath.Admin) return

		navigate(firstAccessiblePath ?? RoutePath.AdminNoAuthorized, { replace: true })
	}, [pathname, firstAccessiblePath, isPermissionInitialized, authLoading, navigate])
}
