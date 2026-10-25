import { isValidElement, type RouteObject } from "react"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { checkItemPermission } from "@admin/utils/routeUtils"
import {
	getMatchedRouteChain,
	isRouteChainAccessible,
	PermissionSource,
	type EnvironmentAccessContext,
	type OrganizationAccessContext,
	type RouteWithMeta,
} from "@admin/utils/routeMeta"

type AccessRoute = RouteWithMeta & {
	isAccessibleIndexRedirect?: boolean
	validate?: (permissions: string[], isSuperAdmin: boolean) => boolean
	validateEnvironment?: (env: EnvironmentAccessContext) => boolean
}

export interface RouteAccessContext extends OrganizationAccessContext {
	userPermissions: string[]
	teamshareUserPermissions: string[]
	env: EnvironmentAccessContext
}

/** Keep sidebar visibility in sync with route-level organization/environment rules. */
export function isRoutePathAccessible(
	routeList: RouteObject[],
	pathname: string,
	context: RouteAccessContext,
) {
	const routeChain = getMatchedRouteChain(routeList, pathname)
	return routeChain.length > 0 && isRouteChainFullyAccessible(routeChain, context)
}

function hasAllPermissions(permissions: string[], source: PermissionSource) {
	if (source === PermissionSource.Teamshare) {
		return permissions.includes("super_admin") || permissions.includes("organization_owner")
	}

	return (
		permissions.includes(PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS) ||
		permissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS) ||
		permissions.includes(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS)
	)
}

function getInheritedPermissionSource(routeChain: RouteObject[], index: number) {
	return (
		routeChain
			.slice(0, index + 1)
			.reverse()
			.map((route) => (route as AccessRoute).meta?.permissionSource)
			.find(Boolean) ?? PermissionSource.Magic
	)
}

export function isRouteChainFullyAccessible(
	routeChain: RouteObject[],
	context: RouteAccessContext,
) {
	if (!isRouteChainAccessible(routeChain, context, context.env)) return false

	return routeChain.every((route, index) => {
		const source = getInheritedPermissionSource(routeChain, index)
		const permissions =
			source === PermissionSource.Teamshare
				? context.teamshareUserPermissions
				: context.userPermissions

		return (
			!(route as AccessRoute).validate ||
			checkItemPermission(
				route as AccessRoute,
				permissions,
				hasAllPermissions(permissions, source),
			)
		)
	})
}

export function isRedirectRoute(route: RouteObject) {
	const candidate = route as AccessRoute
	return (
		candidate.isAccessibleIndexRedirect === true ||
		(isValidElement(candidate.element) && "to" in candidate.element.props)
	)
}

function getFirstAccessibleLeaf(
	routes: RouteObject[],
	context: RouteAccessContext,
	ancestors: RouteObject[] = [],
): string | null {
	for (const route of routes) {
		const candidate = route as AccessRoute
		if (
			candidate.index ||
			candidate.hiddenMenu ||
			!candidate.path ||
			isRedirectRoute(candidate)
		) {
			continue
		}

		const routeChain = [...ancestors, candidate]
		if (!isRouteChainFullyAccessible(routeChain, context)) continue

		const nestedTarget = getFirstAccessibleLeaf(candidate.children ?? [], context, routeChain)
		const hasRedirectChild = candidate.children?.some(
			(child) => child.index && isRedirectRoute(child),
		)
		// A group with a redirect index is visible only when one of its visible descendants is usable.
		if (hasRedirectChild && !nestedTarget) continue

		// Only titled routes represent visible navigation entries. Detail routes are deliberately skipped.
		if (candidate.title) return candidate.path
		if (nestedTarget) return nestedTarget
	}

	return null
}

export function findFirstAccessibleRoutePath(
	routes: RouteObject[],
	context: RouteAccessContext,
	ancestors: RouteObject[] = [],
) {
	return getFirstAccessibleLeaf(routes, context, ancestors)
}
