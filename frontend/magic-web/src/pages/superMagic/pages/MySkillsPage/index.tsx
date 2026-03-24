import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const MySkillsDesktopPage = lazy(() => import("./index.desktop"))
const MySkillsMobilePage = lazy(() => import("@/pages/superMagic/pages/MySkillsPage/index.mobile"))

export default function MySkillsPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <MySkillsMobilePage />

	return <MySkillsDesktopPage />
}
