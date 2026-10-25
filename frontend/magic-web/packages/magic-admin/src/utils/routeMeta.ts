import { matchRoutes, type RouteObject } from "react-router-dom"

export enum PermissionSource {
	Magic = "magic",
	Teamshare = "teamshare",
}

export interface OrganizationAccessContext {
	isOfficialOrg: boolean
	isPersonalOrganization: boolean
}

export interface EnvironmentAccessContext {
	MAGIC_APP_ENV?: string
	[key: string]: unknown
}

type RouteMeta = {
	permissionSource?: PermissionSource
	[key: string]: unknown
}

export type RouteWithMeta = RouteObject & {
	name?: string
	title?: string
	hiddenMenu?: boolean
	children?: RouteWithMeta[]
	validateOrganization?: (context: OrganizationAccessContext) => boolean
	validateEnvironment?: (env: EnvironmentAccessContext) => boolean
	meta?: RouteMeta
}

export interface MatchedRouteEntry<T extends RouteObject = RouteWithMeta> {
	route: T & RouteWithMeta
	pathname: string
}

const DEFAULT_PERMISSION_SOURCE = PermissionSource.Magic

export function getMatchedRouteEntries<T extends RouteObject>(
	routeList: T[],
	pathname: string,
): MatchedRouteEntry<T>[] {
	return (matchRoutes(routeList, pathname) ?? [])
		.filter((match) => !(match.route as T).index)
		.map((match) => ({
			route: match.route as T & RouteWithMeta,
			pathname: match.pathname,
		}))
}

export function getMatchedRouteChain<T extends RouteObject>(routeList: T[], pathname: string): T[] {
	return getMatchedRouteEntries(routeList, pathname).map((match) => match.route)
}

export function getRoutePermissionSource(routeChain: RouteObject[]): PermissionSource {
	for (let index = routeChain.length - 1; index >= 0; index -= 1) {
		const permissionSource = (routeChain[index] as RouteWithMeta).meta?.permissionSource
		if (permissionSource) {
			return permissionSource
		}
	}

	return DEFAULT_PERMISSION_SOURCE
}

export function isRouteChainAccessible(
	routeChain: RouteObject[],
	context: OrganizationAccessContext,
	env: EnvironmentAccessContext,
): boolean {
	return routeChain.every((route) => {
		const currentRoute = route as RouteWithMeta
		return (
			(!currentRoute.validateOrganization || currentRoute.validateOrganization(context)) &&
			(!currentRoute.validateEnvironment || currentRoute.validateEnvironment(env))
		)
	})
}

export function getPermissionSourceByPath<T extends RouteObject>(
	routeList: T[],
	pathname?: string,
): PermissionSource {
	if (!pathname) return DEFAULT_PERMISSION_SOURCE

	return getRoutePermissionSource(getMatchedRouteChain(routeList, pathname))
}
