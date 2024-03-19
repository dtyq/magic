import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import WorkspacePageDesktopSkeleton from "./skeleton/WorkspacePageDesktopSkeleton"
import { Navigate } from "@/opensource/routes/components/Navigate"
import { RouteName } from "@/opensource/routes/constants"
import { MobileTabParam } from "@/opensource/pages/mobileTabs/constants"

const WorkspacePageDesktop = lazy(
	() => import("@/opensource/pages/superMagic/pages/AgentsPage/index.desktop"),
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
