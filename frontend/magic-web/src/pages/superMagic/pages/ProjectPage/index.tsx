import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const SuperMagicProjectPageMobile = lazy(
	() => import("@/pages/superMagicMobile/pages/ProjectPage"),
)
const SuperMagicProjectPageDesktop = lazy(
	() => import("@/pages/superMagic/pages/ProjectPage/index.desktop"),
)

export default function SuperMagicProjectPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <SuperMagicProjectPageMobile />
	}

	return <SuperMagicProjectPageDesktop />
}
