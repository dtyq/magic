import { lazy } from "react"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

const SuperMagicProjectPageMobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/ProjectPage"),
)
const SuperMagicProjectPageDesktop = lazy(
	() => import("@/opensource/pages/superMagic/pages/ProjectPage/index.desktop"),
)

export default function SuperMagicProjectPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <SuperMagicProjectPageMobile />
	}

	return <SuperMagicProjectPageDesktop />
}
