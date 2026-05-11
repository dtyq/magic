import { RouteName } from "@/routes/constants"
import { routesMatch } from "@/routes/history/helpers"

function isAdminConsolePath(pathname: string): boolean {
	return pathname === "/admin" || pathname.startsWith("/admin/")
}

/**
 * Skip session restore on share/admin routes (no recording UI).
 */
export function shouldSkipRecordingSessionRestoreOnCurrentRoute(): boolean {
	if (typeof window === "undefined") return false
	const pathname = window.location.pathname
	if (isAdminConsolePath(pathname)) return true

	const matched = routesMatch(pathname)
	const name = matched?.route?.name
	if (name === RouteName.SuperMagicShare) return true
	if (name === RouteName.SuperMagicFileShare) return true
	return false
}
