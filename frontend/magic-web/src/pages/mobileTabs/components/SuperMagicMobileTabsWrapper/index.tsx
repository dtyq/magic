import { useIsMobile } from "@/hooks/useIsMobile"
import { useMount } from "ahooks"
import { useEffect } from "react"
import { useLocation } from "react-router"
import SuperMagicService from "@/pages/superMagic/services"
import { baseHistory } from "@/routes/history"
import { useProjectTitle } from "@/pages/superMagic/hooks/useTopicTitle"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { INIT_DOMAINS } from "@/models/user/stores/initialization.store"
import { createPortal } from "react-dom"
import EditionActivityModal from "@/components/business/EditionActivity/Modal"
import { isPrivateDeployment } from "@/utils/env"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { RoutePathMobile } from "@/constants/routes"

interface SuperMagicMobileTabsWrapperProps {
	children: React.ReactNode
}

// 渲染 MainLayoutMobile 的布局结构，但使用 children 而不是 Outlet
const SuperMagicMobileLayoutContent = observer(function SuperMagicMobileLayoutContent({
	children,
}: {
	children: React.ReactNode
}) {
	return <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
	// return <SuperMagicMobileLayout header={<MainHeader onBackClick={() => { }} />}>
	// 	{children}
	// </SuperMagicMobileLayout>
})

function SuperMagicMobileTabsWrapper({ children }: SuperMagicMobileTabsWrapperProps) {
	const isMobile = useIsMobile()
	const location = useLocation()
	const searchParams = new URLSearchParams(location.search)
	const workspaceId = searchParams.get("workspaceId") || undefined
	const projectId = searchParams.get("projectId") || undefined
	const topicId = searchParams.get("topicId") || undefined

	useProjectTitle()

	useMount(() => {
		// 如果当前用户没有初始化，进行初始化
		if (
			!userStore.initialization.isInitialized({
				magicId: userStore.user.userInfo?.magic_id,
				organizationCode: userStore.user.userInfo?.organization_code,
				domain: INIT_DOMAINS.super,
			})
		) {
			const hasRouteParams = !!(workspaceId || projectId || topicId)
			if (isMobile && hasRouteParams) {
				SuperMagicService.refreshState({
					workspaceId: workspaceId || undefined,
					projectId,
					topicId,
				})
			} else {
				// 初始化超级麦吉状态
				SuperMagicService.initializeState({
					workspaceId: workspaceId || undefined,
					projectId,
					topicId,
				})
			}
		}
	})

	// // 监听组织切换，重置 SuperMagic 状态, 仅在移动端生效
	// useEffect(() => {
	// 	const currentOrgCode = userStore.user.userInfo?.organization_code

	// 	// 如果组织代码发生变化（且不是首次加载），重置状态
	// 	if (
	// 		currentOrgCode &&
	// 		prevOrganizationCodeRef.current &&
	// 		prevOrganizationCodeRef.current !== currentOrgCode &&
	// 		isMobile
	// 	) {
	// 		SuperMagicService.resetState()
	// 	}

	// 	// 更新上一次的组织代码
	// 	prevOrganizationCodeRef.current = currentOrgCode
	// }, [userInfo?.organization_code])

	// Listen to browser back/forward navigation
	useEffect(() => {
		const unsubscribe = baseHistory.listen(({ action, location }) => {
			// Only handle POP action (browser back/forward)
			if (action === "POP") {
				const isStillInMobileTabs = location.pathname.includes("/mobile-tabs")

				if (!isStillInMobileTabs) {
					// POP 导航离开了 mobile-tabs（如回退到了项目详情页路由），
					// 立即 replace 回 ChatPage，阻止用户左滑回退到项目页
					const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
					const wsId = workspaceStore.selectedWorkspace?.id
					const params = new URLSearchParams()
					params.set("tab", MobileTabParam.Super)
					if (wsId) params.set("workspaceId", wsId)
					baseHistory.replace(
						`/${clusterCode}${RoutePathMobile.MobileTabs}?${params.toString()}`,
					)
					return
				}

				// Get route params from location
				const searchParams = new URLSearchParams(location.search)
				const newWorkspaceId = searchParams.get("workspaceId")
				const newProjectId = searchParams.get("projectId")
				const newTopicId = searchParams.get("topicId")

				if (newWorkspaceId || newProjectId || newTopicId) {
					// 立即根据路由参数更新 selectedProject，避免闪烁
					// 如果没有 projectId，立即清空选中的项目，这样 UI 会立即显示工作区名称
					if (!newProjectId) {
						projectStore.setSelectedProject(null)
					}

					if (!newTopicId) {
						topicStore.setSelectedTopic(null)
					}

					SuperMagicService.refreshState({
						workspaceId: newWorkspaceId || undefined,
						projectId: newProjectId || undefined,
						topicId: newTopicId || undefined,
					})
				}
			}
		})

		return () => {
			unsubscribe()
		}
	}, [isMobile])

	return (
		<>
			<SuperMagicMobileLayoutContent>{children}</SuperMagicMobileLayoutContent>
			{!isPrivateDeployment() && createPortal(<EditionActivityModal />, document.body)}
		</>
	)
}

export default SuperMagicMobileTabsWrapper
