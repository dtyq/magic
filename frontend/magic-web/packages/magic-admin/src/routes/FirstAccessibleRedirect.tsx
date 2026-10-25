import { useMemo } from "react"
import type { RouteObject } from "react-router-dom"
import { useAdmin } from "@admin/provider/AdminProvider"
import { Navigate } from "@admin/pages/Navigate"
import { useAdminStore } from "@admin/stores/admin"
import {
	findFirstAccessibleRoutePath,
	isRedirectRoute,
	type RouteAccessContext,
} from "./routeAccess"

interface FirstAccessibleRedirectProps {
	/** Siblings of the index route. The list is generated from the real route tree. */
	routes: RouteObject[]
	/** Ancestors are needed because permissionSource and organization rules are inherited. */
	ancestors?: RouteObject[]
}

const NO_AUTHORIZED_PATH = "/admin/no-authorized"

export function FirstAccessibleRedirect({ routes, ancestors = [] }: FirstAccessibleRedirectProps) {
	const {
		isPermissionInitialized,
		isOfficialOrg,
		isPersonalOrganization,
		userPermissions,
		teamshareUserPermissions,
	} = useAdminStore()
	const { env } = useAdmin()

	const targetPath = useMemo(() => {
		if (!isPermissionInitialized) return null

		const context: RouteAccessContext = {
			isOfficialOrg,
			isPersonalOrganization,
			userPermissions,
			teamshareUserPermissions,
			env,
		}

		return findFirstAccessibleRoutePath(routes, context, ancestors)
	}, [
		ancestors,
		env,
		isOfficialOrg,
		isPersonalOrganization,
		isPermissionInitialized,
		routes,
		teamshareUserPermissions,
		userPermissions,
	])

	if (!isPermissionInitialized) return null
	return <Navigate to={targetPath ?? NO_AUTHORIZED_PATH} replace />
}

/** Replace only static index redirects; index pages such as approval lists remain untouched. */
export function withAccessibleIndexRedirect<T extends RouteObject>(routes: T[]): T[] {
	const transform = (items: T[], ancestors: RouteObject[]): T[] => {
		const transformed = items.map((route) => {
			const children = route.children
				? transform(route.children as T[], [...ancestors, route])
				: undefined
			return {
				...route,
				...(children ? { children } : {}),
			} as T
		})

		return transformed.map((route) => {
			// BaseLayout already owns the top-level /admin entry selection. Keep that
			// redirect intact and only make nested menu redirects permission-aware.
			if (ancestors.length < 2 || !route.index || !isRedirectRoute(route)) return route
			return {
				...route,
				// Keep the redirect identity after replacing Navigate so access lookup can
				// still skip groups whose redirect target has no accessible descendant.
				isAccessibleIndexRedirect: true,
				element: <FirstAccessibleRedirect routes={transformed} ancestors={ancestors} />,
			} as T
		})
	}

	return transform(routes, [])
}
