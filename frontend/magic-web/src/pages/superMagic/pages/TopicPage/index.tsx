import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy } from "react"

const TopicDesktopPage = lazy(() => import("./index.desktop"))
const TopicMobilePage = lazy(() => import("@/pages/superMagicMobile/pages/TopicPage"))

function TopicPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <TopicMobilePage />
	}

	return <TopicDesktopPage />
}

export default TopicPage
