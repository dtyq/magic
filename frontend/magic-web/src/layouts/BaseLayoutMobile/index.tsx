import { ConfigProvider } from "antd-mobile"
import { RoutePathMobile } from "@/constants/routes"
import { useMemoizedFn } from "ahooks"
import MemberCardStore from "@/stores/display/MemberCardStore"
import { KeepAliveRoute } from "@/constants/keepAliveRoutes"
import { useKeepAlive } from "@/hooks/router/useKeepAlive"
import { useStyles } from "./styles"
import useNavigate from "@/routes/hooks/useNavigate"
import { OrganizationSwitchPanel } from "./components/OrganizationSwitch"
import { lazy, Suspense, useMemo } from "react"
import { useLocation } from "react-router"
import { useNativeBack } from "./hooks"
import GlobalSafeArea from "./components/GlobalSafeArea"
import { RouteName } from "@/routes/constants"
import { routesPathMatch } from "@/routes/history/helpers"
import { observer } from "mobx-react-lite"
import { MultiFolderUploadToast } from "@/components/global/MultiFolderUploadToast"
import { useGlobalSafeArea } from "@/hooks/useGlobalSafeArea"
import { interfaceStore } from "@/stores/interface"
import NavigatePopup from "./components/NavigatePopup"
import { shouldDisableGlobalSafeArea } from "./components/GlobalSafeArea/utils"
import {
	MobileDocumentThemeProvider,
	MobileDocumentThemeSync,
} from "@/pages/superMagicMobile/components/MobileDocumentTheme"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"

const MobileTabBar = lazy(() => import("./components/MobileTabBar"))

const ShareManagementContainer = lazy(
	() => import("@/pages/superMagic/components/ShareManagement/ShareManagementContainer"),
)

const keepAliveRoutes: KeepAliveRoute[] = [RoutePathMobile.MobileTabs]

const BaseLayoutMobile = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { styles, cx } = useStyles()

	// Sync document.title from route meta, same as BaseLayoutPc (chat, contacts, Super Shell, etc.).
	useMetaSet()

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
		// 只在仍属于旧移动端 tab 信息架构的页面上显示底部 TabBar。
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

	const hasVisibleTabBar = shouldShowTabBar && interfaceStore.mobileTabBarVisible

	return (
		<ConfigProvider>
			<MobileDocumentThemeProvider>
				<MobileDocumentThemeSync />
				<div className={styles.root}>
					<GlobalSafeArea direction="top" />
					<div
						className={cx(styles.container, {
							[styles.view]: hasVisibleTabBar,
							[styles.noGlobalSafeAreaWithoutTabBar]:
								(!shouldShowTabBar || !interfaceStore.mobileTabBarVisible) &&
								isNoGlobalSafeArea,
							[styles.noGlobalSafeAreaWithTabBar]:
								hasVisibleTabBar && isNoGlobalSafeArea,
						})}
						onClick={handleClick}
					>
						{Content}
					</div>
					{hasVisibleTabBar && (
						<Suspense fallback={null}>
							<MobileTabBar />
						</Suspense>
					)}
					<GlobalSafeArea direction="bottom" />
				</div>
				{/* <ComponentRender componentName={DefaultComponents.GlobalMobileSidebar} /> */}
				<OrganizationSwitchPanel />
				{/* 全局文件夹上传进度组件 */}
				<MultiFolderUploadToast />
				{/* 导航菜单弹层 */}
				<NavigatePopup />
				<ShareManagementContainer />
			</MobileDocumentThemeProvider>
		</ConfigProvider>
	)
}

export default observer(BaseLayoutMobile)
