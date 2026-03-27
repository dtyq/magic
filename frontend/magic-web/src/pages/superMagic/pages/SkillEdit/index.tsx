import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const SkillEditDesktopPage = lazy(() => import("./index.desktop"))
const SkillEditMobilePage = lazy(() => import("./index.mobile"))

export default function SkillEditPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <SkillEditMobilePage />

	return <SkillEditDesktopPage />
}
