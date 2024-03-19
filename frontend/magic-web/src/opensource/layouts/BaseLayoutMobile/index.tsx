import { ConfigProvider } from "antd-mobile"
import { RoutePathMobile } from "@/opensource/constants/routes"
import { useMemoizedFn } from "ahooks"
import MemberCardStore from "@/opensource/stores/display/MemberCardStore"
import { KeepAliveRoute } from "@/opensource/constants/keepAliveRoutes"
import { useKeepAlive } from "@/opensource/hooks/router/useKeepAlive"
import { useStyles } from "./styles"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { OrganizationSwitchPanel } from "./components/OrganizationSwitch"
import { lazy, Suspense, useMemo } from "react"
import { useLocation } from "react-router"
import { useNativeBack } from "./hooks"
import GlobalSafeArea from "./components/GlobalSafeArea"
import { RouteName } from "@/opensource/routes/constants"
import { routesPathMatch } from "@/opensource/routes/history/helpers"
import { observer } from "mobx-react-lite"
import { MultiFolderUploadToast } from "@/opensource/components/global/MultiFolderUploadToast"
import { useGlobalSafeArea } from "@/opensource/hooks/useGlobalSafeArea"
import { interfaceStore } from "@/opensource/stores/interface"
import NavigatePopup from "./components/NavigatePopup"
import { shouldDisableGlobalSafeArea } from "./components/GlobalSafeArea/utils"

const MobileTabBar = lazy(() => import("./components/MobileTabBar"))

const ShareManagementContainer = lazy(
	() =>
		import("@/opensource/pages/superMagic/components/ShareManagement/ShareManagementContainer"),
)

const keepAliveRoutes: KeepAliveRoute[] = [RoutePathMobile.MobileTabs]

// 单槽位路由：这些路由只允许缓存一个实例，相互替换
// 例如 /super/workspace/:workspaceId、/super/:projectId、/super/:projectId/:topicId
// 不同的参数组合会相互替换缓存，而不是各自缓存
const singleSlotRoutes: KeepAliveRoute[] = [
	// /^(\/global)?\/super\/\d+/, // 匹配所有 super 路由（支持集群前缀）
]

const BaseLayoutMobile = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { styles, cx } = useStyles()

	useNativeBack()

	// 根据路由自动管理安全边距样式
	useGlobalSafeArea()

	const { Content } = useKeepAlive({
		keepAliveRoutes: keepAliveRoutes,
	})

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement
		if (target.closest(`.${MemberCardStore.domClassName}`)) {
			const memberCard = target.closest(`.${MemberCardStore.domClassName}`)
			const uid = MemberCardStore.getUidFromElement(memberCard as HTMLElement)
			if (uid) {
				navigate({
					name: RouteName.UserInfoDetails,
					params: { userId: uid },
					viewTransition: { type: "slide", direction: "left" },
				})
			}
		}
	})

	// Check if current route should show tab bar
	const shouldShowTabBar = useMemo(() => {
		// 添加 MobileTabs 路由到 TabBar 显示列表
		return [
			RouteName.MobileTabs,
			RouteName.Super,
			RouteName.SuperWorkspaceState,
			RouteName.Chat,
			RouteName.Contacts,
			RouteName.MagicApproval,
		].some((route) => routesPathMatch(route, location.pathname))
	}, [location.pathname])

	// 判断是否不使用全局安全边距（直接通过 URL 路径和查询参数判断，避免状态延迟）
	const isNoGlobalSafeArea = useMemo(() => {
		return shouldDisableGlobalSafeArea(location.pathname, location.search)
	}, [location.pathname, location.search])

	return (
		<ConfigProvider>
			<GlobalSafeArea direction="top" />
			<div
				className={cx(styles.container, {
					[styles.view]: shouldShowTabBar && interfaceStore.mobileTabBarVisible,
					[styles.noGlobalSafeAreaWithoutTabBar]:
						(!shouldShowTabBar || !interfaceStore.mobileTabBarVisible) &&
						isNoGlobalSafeArea,
					[styles.noGlobalSafeAreaWithTabBar]:
						shouldShowTabBar &&
						interfaceStore.mobileTabBarVisible &&
						isNoGlobalSafeArea,
				})}
				onClick={handleClick}
			>
				{Content}
			</div>
			{shouldShowTabBar && interfaceStore.mobileTabBarVisible && (
				<Suspense fallback={null}>
					<MobileTabBar />
				</Suspense>
			)}
			<GlobalSafeArea direction="bottom" />
			{/* <ComponentRender componentName={DefaultComponents.GlobalMobileSidebar} /> */}
			<OrganizationSwitchPanel />
			{/* 全局文件夹上传进度组件 */}
			<MultiFolderUploadToast />
			{/* 导航菜单弹层 */}
			<NavigatePopup />
			<ShareManagementContainer />
		</ConfigProvider>
	)
}

export default observer(BaseLayoutMobile)
