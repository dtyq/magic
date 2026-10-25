import { useParams } from "react-router"
import { ProjectOrganizationAccessProvider } from "../../contexts/ProjectOrganizationAccessContext"
import { useProjectOrganizationAccess } from "../../hooks/useProjectOrganizationAccess"
import { useProjectOrganizationAccessRouteRestore } from "../../hooks/useProjectOrganizationAccessRouteRestore"
import type { ProjectRouteRestoreOptions } from "../../hooks/useProjectOrganizationAccessRouteRestore"
import type { ReactNode } from "react"

interface ProjectOrganizationAccessBoundaryProps {
	children: ReactNode
	restoreStateFromPathname: (pathname: string, options?: ProjectRouteRestoreOptions) => void
}

/** Coordinates access checking with route restoration without coupling that state to MainLayout. */
export default function ProjectOrganizationAccessBoundary({
	children,
	restoreStateFromPathname,
}: ProjectOrganizationAccessBoundaryProps) {
	const { projectId } = useParams<{ projectId?: string }>()
	const organizationAccess = useProjectOrganizationAccess(projectId)

	useProjectOrganizationAccessRouteRestore({
		status: organizationAccess.status,
		restoreStateFromPathname,
	})

	return (
		<ProjectOrganizationAccessProvider value={organizationAccess}>
			{children}
		</ProjectOrganizationAccessProvider>
	)
}
