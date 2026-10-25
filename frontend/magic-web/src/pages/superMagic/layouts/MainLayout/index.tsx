import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import { useMemoizedFn } from "ahooks"
import SuperMagicService from "../../services"
import { resolveSuperPopRefreshParams } from "../../utils/resolve-super-pop-refresh-params"
import GuideTourWrapper from "../../components/LazyGuideTour"
import { useProjectTitle } from "../../hooks/useTopicTitle"
import { useInterFont } from "@/styles/font"
import { isPrivateDeployment } from "@/utils/env"
import SketchWithoutLayout from "@/layouts/BaseLayout/components/Sketch/withoutLayout"
import { useFeaturedModeListRefreshOnDocumentVisible } from "../../hooks/useFeaturedModeListRefresh"
import EditionActivityModal from "@/components/business/EditionActivity/Modal"
import { MobileImagePreviewProvider } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MobileImagePreview"
import { projectStore, topicStore, workspaceStore } from "../../stores/core"
import ProjectOrganizationAccessBoundary from "../../components/ProjectOrganizationAccessBoundary"
import SuperMagicDebugMenu from "../../components/SuperMagicDebugMenu"
import type { ProjectRouteRestoreOptions } from "../../hooks/useProjectOrganizationAccessRouteRestore"

const MainLayoutDesktop = lazy(() => import("./index.desktop"))
const MainLayoutMobile = lazy(() => import("@/pages/superMagicMobile/layout/MainLayout"))

function MainLayout() {
	useInterFont() // Load Inter font for font-weight 600/700 rendering
	useFeaturedModeListRefreshOnDocumentVisible()

	const isMobile = useIsMobile()

	useProjectTitle()

	const restoreStateFromPathname = useMemoizedFn(
		(pathname: string, options?: ProjectRouteRestoreOptions) => {
			const stateParams = resolveSuperPopRefreshParams(pathname)
			if (!stateParams) return

			const needsRestore =
				Boolean(!stateParams.projectId && projectStore.selectedProject) ||
				Boolean(!stateParams.projectId && topicStore.selectedTopic) ||
				Boolean(
					stateParams.projectId && !stateParams.topicId && topicStore.selectedTopic,
				) ||
				Boolean(
					stateParams.workspaceId &&
					workspaceStore.selectedWorkspace?.id !== stateParams.workspaceId,
				) ||
				Boolean(
					stateParams.projectId &&
					projectStore.selectedProject?.id !== stateParams.projectId,
				) ||
				Boolean(stateParams.topicId && topicStore.selectedTopic?.id !== stateParams.topicId)

			if (!needsRestore) return

			if (isMobile) {
				void SuperMagicService.refreshState({ ...stateParams, ...options })
			} else {
				void SuperMagicService.initializeState({ ...stateParams, ...options })
			}
		},
	)

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

	const Content = isMobile ? MainLayoutMobile : MainLayoutDesktop

	return (
		<ProjectOrganizationAccessBoundary restoreStateFromPathname={restoreStateFromPathname}>
			<Suspense fallback={<SketchWithoutLayout />}>
				<Content />
			</Suspense>
			{isMobile && <MobileImagePreviewProvider />}
			{/* 新人引导教程 */}
			<GuideTourWrapper isMobile={isMobile} />
			{/* 私有化部署不显示活动弹窗 */}
			{!isPrivateDeployment() && <EditionActivityModal />}
			<SuperMagicDebugMenu />
		</ProjectOrganizationAccessBoundary>
	)
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<MainLayout />
		</FileAccessProvider>
	)
}
