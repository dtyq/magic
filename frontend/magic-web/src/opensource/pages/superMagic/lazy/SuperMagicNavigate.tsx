import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import SuperMagicNavigateMobileSkeleton from "./skeleton/SuperMagicNavigateMobileSkeleton"

const SuperMagicNavigateMobile = lazy(
	() => import("@/opensource/pages/superMagicMobile/pages/navigate"),
)

function SuperMagicNavigate() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<SuperMagicNavigateMobileSkeleton />}>
				<SuperMagicNavigateMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default SuperMagicNavigate
