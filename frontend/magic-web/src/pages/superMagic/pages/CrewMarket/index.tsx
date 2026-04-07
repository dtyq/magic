import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const CrewMarketDesktopPage = lazy(() => import("./index.desktop"))
const CrewMarketMobilePage = lazy(() => import("./index.mobile"))

export default function CrewMarketPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <CrewMarketMobilePage />

	return <CrewMarketDesktopPage />
}
