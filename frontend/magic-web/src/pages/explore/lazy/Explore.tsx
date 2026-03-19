import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ExploreMobileSkeleton from "./skeleton/ExploreMobileSkeleton"

const FlowExplore = lazy(() => import("@/pages/explore"))

function Explore() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ExploreMobileSkeleton />}>
				<FlowExplore />
			</Suspense>
		)
	}

	// Desktop version handled by FlowExplore itself
	return (
		<Suspense fallback={null}>
			<FlowExplore />
		</Suspense>
	)
}

export default Explore
