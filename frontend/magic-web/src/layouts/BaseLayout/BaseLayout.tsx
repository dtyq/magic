import { lazy, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import recordingSummaryStore from "@/stores/recordingSummary"
import BaseLayoutSketch from "./components/Sketch"

const RecordingSummaryFloatPanel = lazy(
	() => import("@/components/business/RecordingSummary/FloatPanel"),
)

const BaseLayoutMobile = lazy(() => import("@/layouts/BaseLayoutMobile"))
const BaseLayoutPc = lazy(() => import("./BaseLayoutPc"))

/** Root layout: PC shell or mobile V1 shell (SuperMobileShell lives inside route-level layouts). */
const BaseLayout = observer(() => {
	const isMobile = useIsMobile()

	return (
		<>
			<Suspense fallback={<BaseLayoutSketch />}>
				{!isMobile ? <BaseLayoutPc /> : <BaseLayoutMobile />}
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
