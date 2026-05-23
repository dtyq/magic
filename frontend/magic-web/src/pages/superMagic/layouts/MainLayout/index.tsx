import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense, useEffect } from "react"
import SuperMagicService from "../../services"
import { resolveSuperPopRefreshParams } from "../../utils/resolve-super-pop-refresh-params"
import GuideTourWrapper from "../../components/LazyGuideTour"
import { useProjectTitle } from "../../hooks/useTopicTitle"
import { baseHistory } from "@/routes/history"
import { useInterFont } from "@/styles/font"
import { isPrivateDeployment } from "@/utils/env"
import SketchWithoutLayout from "@/layouts/BaseLayout/components/Sketch/withoutLayout"
import { useFeaturedModeListRefreshOnDocumentVisible } from "../../hooks/useFeaturedModeListRefresh"
import EditionActivityModal from "@/components/business/EditionActivity/Modal"
import { MobileImagePreviewProvider } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MobileImagePreview"

const MainLayoutDesktop = lazy(() => import("./index.desktop"))
const MainLayoutMobile = lazy(() => import("@/pages/superMagicMobile/layout/MainLayout"))

function MainLayout() {
	useInterFont() // Load Inter font for font-weight 600/700 rendering
	useFeaturedModeListRefreshOnDocumentVisible()

	const isMobile = useIsMobile()

	useProjectTitle()

	// 暂时注释掉，因为 appInitPromise 会在 app 初始化完成后自动触发
	// 后续需要再恢复
	// // Ensure Super state is ready on route entry.
	// useMount(() => {
	// 	if (!appStore.appInitPromise) return
	// 	appStore.appInitPromise?.then(() => {
	// 		initializeSuperMagicIfNeeded({
	// 			isMobile,
	// 			workspaceId,
	// 			projectId,
	// 			topicId,
	// 		})
	// 	})
	// })

	// Listen to browser back/forward navigation
	useEffect(() => {
		const unsubscribe = baseHistory.listen(({ action, location }) => {
			// Only handle POP action (browser back/forward)
			if (action === "POP") {
				const stateParams = resolveSuperPopRefreshParams(location.pathname)
				if (!stateParams) return

				if (isMobile) {
					SuperMagicService.refreshState(stateParams)
				} else {
					SuperMagicService.initializeState(stateParams)
				}
			}
		})

		return () => {
			unsubscribe()
		}
	}, [isMobile])

	const Content = isMobile ? MainLayoutMobile : MainLayoutDesktop

	return (
		<>
			<Suspense fallback={<SketchWithoutLayout />}>
				<Content />
			</Suspense>
			{isMobile && <MobileImagePreviewProvider />}
			{/* 新人引导教程 */}
			<GuideTourWrapper isMobile={isMobile} />
			{/* 私有化部署不显示活动弹窗 */}
			{!isPrivateDeployment() && <EditionActivityModal />}
		</>
	)
}

export default MainLayout
