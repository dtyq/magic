import { useState, useEffect, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useAdminStore } from "@admin/stores/admin"
import { useAdmin } from "@admin/provider/AdminProvider"
import { getMatchedRouteChain } from "@admin/utils/routeMeta"
import { isRouteChainFullyAccessible } from "@admin/routes/routeAccess"
import { routes } from "@admin/routes"

export function useAdminAuth() {
	const {
		isOfficialOrg,
		userPermissions,
		teamshareUserPermissions,
		isPermissionInitialized,
		permissionsKeys,
		teamsharePermissionsKeys,
		isPersonalOrganization,
	} = useAdminStore()

	const { env } = useAdmin()
	const { pathname } = useLocation()
	const [hasPermission, setHasPermission] = useState<boolean | null>(true)
	const routeChain = useMemo(() => getMatchedRouteChain(routes, pathname), [pathname])

	useEffect(() => {
		if (!isPermissionInitialized) return

		setHasPermission(
			isRouteChainFullyAccessible(routeChain, {
				isOfficialOrg,
				isPersonalOrganization,
				userPermissions,
				teamshareUserPermissions,
				env,
			}),
		)
	}, [
		env,
		isOfficialOrg,
		isPermissionInitialized,
		isPersonalOrganization,
		permissionsKeys,
		routeChain,
		teamsharePermissionsKeys,
		teamshareUserPermissions,
		userPermissions,
	])

	return { hasPermission }
}
