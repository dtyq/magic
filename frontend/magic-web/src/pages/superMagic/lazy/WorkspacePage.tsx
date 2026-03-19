import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import WorkspacePageDesktopSkeleton from "./skeleton/WorkspacePageDesktopSkeleton"
import { Navigate } from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import { MobileTabParam } from "@/pages/mobileTabs/constants"

const WorkspacePageDesktop = lazy(
	() => import("@/pages/superMagic/pages/AgentsPage/index.desktop"),
)

export default function WorkspacePage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Navigate name={RouteName.MobileTabs} query={{ tab: MobileTabParam.Super }} replace />
		)
	}

	return (
		<Suspense fallback={<WorkspacePageDesktopSkeleton />}>
			<WorkspacePageDesktop />
		</Suspense>
	)
}
