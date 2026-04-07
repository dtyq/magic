import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useLocation } from "react-router"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { Navigate } from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import { routesPathMatch } from "@/routes/history/helpers"

const MagiClawDesktopPage = lazy(() => import("./index.desktop"))
const MagiClawMobilePage = lazy(() => import("./index.mobile"))

export default function MagiClawPage() {
	const isMobile = useIsMobile()
	const location = useLocation()
	const isMagiClawRoute = routesPathMatch(RouteName.MagiClaw, location.pathname)

	if (isMobile && isMagiClawRoute && !location.pathname.includes("/mobile-tabs")) {
		return (
			<Navigate
				name={RouteName.MobileTabs}
				query={{ tab: MobileTabParam.MagiClaw }}
				replace
			/>
		)
	}

	if (isMobile) return <MagiClawMobilePage />

	return <MagiClawDesktopPage />
}
