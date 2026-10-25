import { useEffect, useRef } from "react"
import { useLocation, useNavigationType } from "react-router"
import type { ProjectOrganizationAccessStatus } from "../contexts/ProjectOrganizationAccessContext"

export interface ProjectRouteRestoreOptions {
	enableErrorMessagePrompt?: boolean
}

interface UseProjectOrganizationAccessRouteRestoreParams {
	status: ProjectOrganizationAccessStatus
	restoreStateFromPathname: (pathname: string, options?: ProjectRouteRestoreOptions) => void
}

/** Defers cold-entry, POP and notification navigation until destination access is ready. */
export function useProjectOrganizationAccessRouteRestore({
	status,
	restoreStateFromPathname,
}: UseProjectOrganizationAccessRouteRestoreParams) {
	const location = useLocation()
	const navigationType = useNavigationType()
	const initialLocation = useRef(location)
	const handledLocation = useRef<typeof location | null>(null)

	useEffect(() => {
		if (status !== "ready" || handledLocation.current === location) return
		const fromNotification = location.state?.restoreSuperMagicState === true
		// Sidebar switches already load their own data. Only bare notification links need
		// additional PUSH/REPLACE restoration; observe router state so access belongs to this URL.
		if (location !== initialLocation.current && navigationType !== "POP" && !fromNotification)
			return

		handledLocation.current = location
		if (fromNotification) {
			restoreStateFromPathname(location.pathname, { enableErrorMessagePrompt: true })
		} else {
			restoreStateFromPathname(location.pathname)
		}
	}, [location, navigationType, restoreStateFromPathname, status])
}
