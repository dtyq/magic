import { ConfigProvider } from "antd-mobile"
import { RoutePathMobile } from "@/constants/routes"
import { useMemoizedFn } from "ahooks"
import MemberCardStore from "@/stores/display/MemberCardStore"
import { KeepAliveRoute } from "@/constants/keepAliveRoutes"
import { useKeepAlive } from "@/hooks/router/useKeepAlive"
import { cn } from "@/utils/cn"
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
import { GlobalSafeAreaSync } from "@/hooks/useGlobalSafeArea"
import { interfaceStore } from "@/stores/interface"
import NavigatePopup from "./components/NavigatePopup"
import { shouldDisableGlobalSafeArea } from "./components/GlobalSafeArea/utils"
import {
	MobileDocumentThemeProvider,
	MobileDocumentThemeSync,
} from "@/pages/superMagicMobile/components/MobileDocumentTheme"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"
import { useAntdMobileLocale } from "@/hooks/useAntdMobileLocale"
import useMonitorSoftKeyboard from "@/hooks/useMonitorSoftKeyboard"
import MaintenanceNotice from "@/components/global/MaintenanceNotice"

const MobileTabBar = lazy(() => import("./components/MobileTabBar"))

const ShareManagementContainer = lazy(
	() => import("@/pages/superMagic/components/ShareManagement/ShareManagementContainer"),
)

const keepAliveRoutes: KeepAliveRoute[] = [RoutePathMobile.MobileTabs]

const BaseLayoutMobile = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const antdMobileLocale = useAntdMobileLocale()
	const { isUp: isSoftKeyboardOpen } = useMonitorSoftKeyboard({
		// Restore the bottom safe area as soon as keyboard dismissal begins to avoid a second layout jump.
		focusOutDelay: 0,
	})

	// Sync document.title from route meta, same as BaseLayoutPc (chat, contacts, Super Shell, etc.).
	useMetaSet()

	useNativeBack()

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
		<ConfigProvider locale={antdMobileLocale}>
			<MobileDocumentThemeProvider>
				<GlobalSafeAreaSync />
				<MobileDocumentThemeSync />
				{/* Match the page and safe-area background to avoid gray seams on mobile. */}
				<div className="flex h-full flex-col overflow-hidden bg-mobile-background">
					<GlobalSafeArea direction="top" />
					<MaintenanceNotice />
					<div
						className={cn("min-h-0 flex-1 bg-mobile-background", {
							"h-full":
								(!shouldShowTabBar || !interfaceStore.mobileTabBarVisible) &&
								isNoGlobalSafeArea,
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
					{/* The docked software keyboard already covers the device bottom safe area. */}
					{!isSoftKeyboardOpen && <GlobalSafeArea direction="bottom" />}
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
