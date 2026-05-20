import { lazy, Suspense } from "react"
import WorkspacePageDesktopSkeleton from "./skeleton/WorkspacePageDesktopSkeleton"
import { DesktopOnlyRoute } from "@/routes/components/ViewportRouteGuard"

const WorkspacePageDesktop = lazy(() => import("@/pages/superMagic/pages/AgentsPage/index.desktop"))

/** Desktop workspace route: mobile viewport redirects to mobile home. */
export default function WorkspacePage() {
	return (
		<DesktopOnlyRoute>
			<Suspense fallback={<WorkspacePageDesktopSkeleton />}>
				<WorkspacePageDesktop />
			</Suspense>
		</DesktopOnlyRoute>
	)
}
