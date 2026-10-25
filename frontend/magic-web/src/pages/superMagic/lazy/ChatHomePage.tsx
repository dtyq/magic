import { lazy, Suspense } from "react"
import { DesktopOnlyRoute } from "@/routes/components/ViewportRouteGuard"
import WorkspacePageDesktopSkeleton from "./skeleton/WorkspacePageDesktopSkeleton"

const ChatHomePageDesktop = lazy(() => import("../pages/ChatHomePage/index.desktop"))

export default function ChatHomePage() {
	return (
		<DesktopOnlyRoute>
			<Suspense fallback={<WorkspacePageDesktopSkeleton />}>
				<ChatHomePageDesktop />
			</Suspense>
		</DesktopOnlyRoute>
	)
}
