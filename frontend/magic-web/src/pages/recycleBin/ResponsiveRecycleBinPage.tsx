import { lazy, memo, Suspense } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

// PC端回收站组件
const PCRecycleBinPage = lazy(() => import("./index"))

// 移动端回收站组件
const MobileRecycleBinPage = lazy(
	() => import("@/pages/superMagicMobile/pages/recycle-bin"),
)

function ResponsiveRecycleBinPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<div>Loading...</div>}>
				<MobileRecycleBinPage />
			</Suspense>
		)
	}

	return (
		<Suspense fallback={<div />}>
			<PCRecycleBinPage />
		</Suspense>
	)
}

export default memo(ResponsiveRecycleBinPage)
