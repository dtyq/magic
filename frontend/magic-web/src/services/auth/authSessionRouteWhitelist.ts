import { matchPath } from "react-router"
import { RoutePath } from "@/constants/routes"

/**
 * Public share pages recover access themselves. Session invalidation on these
 * routes would clear credentials and force login when a background request
 * returns 401.
 */
const SESSION_INVALIDATION_EXEMPT_ROUTES = [
	RoutePath.SuperMagicShare,
	RoutePath.MicroAppShare,
	RoutePath.MagicShare,
] as const

export function isSessionInvalidationExemptRoute(pathname: string): boolean {
	return SESSION_INVALIDATION_EXEMPT_ROUTES.some(
		(pattern) => matchPath({ path: pattern, end: false }, pathname) != null,
	)
}
