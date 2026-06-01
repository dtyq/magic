import { lazy, Suspense } from "react"

import MobileHomePageMobileSkeleton from "./skeleton/MobileHomePageMobileSkeleton"

const MobileHomePageContent = lazy(() => import("@/pages/superMagicMobile/pages/ChatPage"))

/** Mobile-home entry with route-level skeleton while the page chunk loads. */
function MobileHomePage() {
	return (
		<Suspense fallback={<MobileHomePageMobileSkeleton />}>
			<MobileHomePageContent />
		</Suspense>
	)
}

export default MobileHomePage
