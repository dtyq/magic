import { lazy, memo, Suspense } from "react"

import { useIsMobile } from "@/hooks/useIsMobile"

const PCRecycleBinPage = lazy(() => import("./index"))
const MobileRecycleBinPanel = lazy(
	() => import("@/pages/superMagicMobile/pages/recycle-bin/v2/MobileRecycleBinPanel"),
)

/** 桌面/移动端分流入口：移动端统一复用 Super 共享壳层。 */
function ResponsiveRecycleBinPage() {
	const isMobile = useIsMobile()

	if (!isMobile) {
		return (
			<Suspense fallback={<div />}>
				<PCRecycleBinPage />
			</Suspense>
		)
	}

	return (
		<Suspense fallback={null}>
			<MobileRecycleBinPanel />
		</Suspense>
	)
}

export default memo(ResponsiveRecycleBinPage)
