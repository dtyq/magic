import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const ConnectorMarketDesktopPage = lazy(() => import("./index.desktop"))
const ConnectorMarketMobilePage = lazy(() => import("./index.mobile"))

export default function ConnectorMarketPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <ConnectorMarketMobilePage />

	return <ConnectorMarketDesktopPage />
}
