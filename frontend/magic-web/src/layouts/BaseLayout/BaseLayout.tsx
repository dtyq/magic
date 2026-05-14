import { lazy, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { useLocation } from "react-router"
import { useIsMobile } from "@/hooks/useIsMobile"
import recordingSummaryStore from "@/stores/recordingSummary"
import { shouldUseMobileLayoutV2 } from "@/layouts/mobileLayoutV2Routes"
import BaseLayoutSketch from "./components/Sketch"

const RecordingSummaryFloatPanel = lazy(
	() => import("@/components/business/RecordingSummary/FloatPanel"),
)

const BaseLayoutMobile = lazy(() => import("@/layouts/BaseLayoutMobile"))
const BaseLayoutMobileV2 = lazy(() => import("@/layouts/BaseLayoutMobileV2"))
const BaseLayoutPc = lazy(() => import("./BaseLayoutPc"))

const BaseLayout = observer(() => {
	const isMobile = useIsMobile()
	const location = useLocation()
	const useMobileV2 = isMobile && shouldUseMobileLayoutV2(location.pathname)

	return (
		<>
			<Suspense fallback={<BaseLayoutSketch />}>
				{!isMobile ? (
					<BaseLayoutPc />
				) : useMobileV2 ? (
					<BaseLayoutMobileV2 />
				) : (
					<BaseLayoutMobile />
				)}
			</Suspense>
			{(recordingSummaryStore.isFloatPanelLoaded || recordingSummaryStore.isVisible) && (
				<Suspense fallback={null}>
					<RecordingSummaryFloatPanel />
				</Suspense>
			)}
		</>
	)
})

export default BaseLayout
