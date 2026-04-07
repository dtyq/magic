import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const SkillMarketDesktopPage = lazy(() => import("./index.desktop"))
const SkillMarketMobilePage = lazy(() => import("./index.mobile"))

export default function SkillMarketPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <SkillMarketMobilePage />

	return <SkillMarketDesktopPage />
}
