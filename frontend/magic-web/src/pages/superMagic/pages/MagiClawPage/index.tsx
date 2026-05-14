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
	const activeMobileTab = new URLSearchParams(location.search).get("tab")
	const isLegacyMobileTabsMagiClaw =
		location.pathname.includes("/mobile-tabs") && activeMobileTab === MobileTabParam.MagiClaw

	/**
	 * 兼容历史 `mobile-tabs?tab=magi-claw` 链接，统一收口到新的独立 `/claw` 路由。
	 */
	if (isMobile && isLegacyMobileTabsMagiClaw) {
		return <Navigate name={RouteName.MagiClaw} replace />
	}

	/**
	 * 移动端独立路由直接渲染新页面，不再反向跳回旧 `MobileTabs` 容器。
	 */
	if (isMobile && isMagiClawRoute) return <MagiClawMobilePage />

	if (isMobile) return <MagiClawMobilePage />

	return <MagiClawDesktopPage />
}
