import { useIsMobile } from "@/hooks/useIsMobile"
import { useMount } from "ahooks"
import { lazy, Suspense, useEffect } from "react"
import { useParams } from "react-router"
import SuperMagicService from "../../services"
import GuideTourWrapper from "../../components/LazyGuideTour"
import { useProjectTitle } from "../../hooks/useTopicTitle"
import { baseHistory } from "@/routes/history"
import { useInterFont } from "@/styles/font"
import { RoutePathMobile } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { isPrivateDeployment } from "@/utils/env"
import SketchWithoutLayout from "@/layouts/BaseLayout/components/Sketch/withoutLayout"
import { initializeSuperMagicIfNeeded } from "../../services/utils"
import EditionActivityModal from "@/components/business/EditionActivity/Modal"

const MainLayoutDesktop = lazy(() => import("./index.desktop"))
const MainLayoutMobile = lazy(() => import("@/pages/superMagicMobile/layout/MainLayout"))

function MainLayout() {
	useInterFont() // Load Inter font for font-weight 600/700 rendering

	const isMobile = useIsMobile()
	const { projectId, topicId } = useParams()

	useProjectTitle()

	// 移动端首次进入 /super 根路径时，自动跳转到 /mobile-tabs?tab=super （兼容处理，后续可能去掉）
	useEffect(() => {
		// 只在移动端且没有子路径参数时进行跳转
		if (isMobile && !projectId && !topicId) {
			const currentPath = baseHistory.location.pathname
			// 检查当前路径是否是 /super 根路径（格式：/{clusterCode}/super 或 /{clusterCode}/super/）
			const isSuperRootPath = /^\/[^/]+\/super\/?$/.test(currentPath)
			// 检查是否已经在 mobile-tabs 路由下，避免循环跳转
			if (isSuperRootPath && !currentPath.includes("/mobile-tabs")) {
				// 使用全局配置的集群编码，而不是从路径解析（避免错误注入集群编码）
				const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
				const targetPath = `/${clusterCode}${RoutePathMobile.MobileTabs}?tab=super`
				baseHistory.replace(targetPath)
			}
		}
	}, [isMobile, projectId, topicId])

	useMount(() => {
		initializeSuperMagicIfNeeded({
			isMobile,
			projectId,
			topicId,
		})
	})

	// Listen to browser back/forward navigation
	useEffect(() => {
		const unsubscribe = baseHistory.listen(({ action, location }) => {
			// Only handle POP action (browser back/forward)
			if (action === "POP") {
				// Get route params from location
				const pathParts = location.pathname.split("/").filter(Boolean)
				const superIndex = pathParts.indexOf("super")

				if (superIndex !== -1) {
					const seg1 = pathParts[superIndex + 1]
					const seg2 = pathParts[superIndex + 2]

					let newWorkspaceId: string | undefined
					let newProjectId: string | undefined
					let newTopicId: string | undefined

					if (seg1 === "workspace") {
						newWorkspaceId = seg2
					} else {
						newProjectId = seg1
						newTopicId = seg2
					}

					const stateParams = {
						workspaceId: newWorkspaceId,
						projectId: newProjectId,
						topicId: newTopicId,
					}

					if (isMobile) {
						SuperMagicService.refreshState(stateParams)
					} else {
						SuperMagicService.initializeState(stateParams)
					}
				}
			}
		})

		return () => {
			unsubscribe()
		}
	}, [])

	const Content = isMobile ? MainLayoutMobile : MainLayoutDesktop

	return (
		<>
			<Suspense fallback={<SketchWithoutLayout />}>
				<Content />
			</Suspense>
			{/* 新人引导教程 */}
			<GuideTourWrapper isMobile={isMobile} />
			{/* 私有化部署不显示活动弹窗 */}
			{!isPrivateDeployment() && <EditionActivityModal />}
		</>
	)
}

export default MainLayout
