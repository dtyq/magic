import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const CrewEditDesktopPage = lazy(() => import("./index.desktop"))
const CrewEditMobilePage = lazy(() => import("./index.mobile"))

export default function CrewEditPage() {
	const isMobile = useIsMobile()

	// Guard direct links as well as in-app navigation before mounting the desktop editor.
	if (isMobile) return <CrewEditMobilePage />

	return <CrewEditDesktopPage />
}
