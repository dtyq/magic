import { createElement, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useLocation, useNavigate as useReactRouterNavigate } from "react-router"
import { useTabBarIndicator } from "./hooks"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"

import useChatUnreadCount from "./hooks/useChatUnreadCount"
import { userStore } from "@/models/user"
import { mobileTabStore } from "@/stores/mobileTab"
import { RoutePathMobile } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import TabBarOverlayGradient from "./TabBarOverlayGradient"
import {
	ROUTE_NAME_TO_TAB_PARAM,
	MobileTabParam,
	MobileTabBarKey,
} from "@/pages/mobileTabs/constants"
import { notifyAppTabChange } from "./utils"
import {
	getMobileTabBarItems,
	MOBILE_TAB_BAR_APPS_KEY,
	type MobileTabBarItem,
} from "./constants/tabsConfig"
import { AppsMenu } from "./components/AppsMenu"

const TAB_ICON_SIZE = 20

function MobileTabBar() {
	const { t } = useTranslation("interface")
	const location = useLocation()
	const reactRouterNavigate = useReactRouterNavigate()

	const { isPersonalOrganization } = userStore.user
	const chatUnreadCount = useChatUnreadCount()
	const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false)

	// Get active key from store (cast via unknown for type compatibility)
	const activeKey = mobileTabStore.activeTab
	const visualActiveKey = isAppsMenuOpen ? MOBILE_TAB_BAR_APPS_KEY : activeKey

	// Check if we're on MobileTabs route
	const isOnMobileTabsRoute = location.pathname.includes("/mobile-tabs")

	// 使用选中框动画 hook
	const { tabBarRef, renderIndicator } = useTabBarIndicator({
		activeKey: visualActiveKey as string,
		indicatorClassName:
			"absolute h-12 bg-fill rounded-full transition-[left,width] duration-300 ease-in-out z-0 pointer-events-none",
	})

	// Sync activeTab from route on initial load (for deep links)
	useEffect(() => {
		// Only sync if not on MobileTabs route (e.g., user directly navigated to /chat)
		if (!isOnMobileTabsRoute) {
			const pathname = location.pathname
			if (pathname.includes("/chat")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Chat)
			} else if (pathname.includes("/approval")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Approval)
			} else if (pathname.includes("/magi-claw")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.MagiClaw)
			} else if (pathname.includes("/contacts")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Contacts)
			} else if (pathname.includes("/super")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Super)
			}
		}
	}, [isOnMobileTabsRoute, location.pathname])

	useEffect(() => {
		setIsAppsMenuOpen(false)
	}, [location.pathname, location.search])

	// Handle tab change with state management
	const handleTabChange = (targetKey: MobileTabBarKey) => {
		setIsAppsMenuOpen(false)
		if (targetKey === activeKey) return

		// 震动反馈（在用户交互事件中触发）
		try {
			// 检查浏览器是否支持震动 API
			if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
				// 使用更长的震动时长，确保用户能感受到（iOS 需要至少 10ms，Android 可能需要更长）
				// 使用模式：震动 15ms，停顿 10ms，再震动 10ms（轻微的双击效果）
				navigator.vibrate([15, 10, 10])
			}
		} catch (error) {
			// 静默处理错误，不影响功能
			if (process.env.NODE_ENV === "development") {
				console.warn("Vibration API not supported:", error)
			}
		}

		// Update store state
		mobileTabStore.setActiveTab(targetKey)

		// 通知 Magic App 当前 Tab 和 TabBar 高度
		notifyAppTabChange(targetKey)

		// 检查是否在 mobile-tabs 路由下
		const isOnMobileTabsRoute = location.pathname.includes("/mobile-tabs")

		if (isOnMobileTabsRoute) {
			// 在 mobile-tabs 路由下，通过查询参数切换 tab
			const currentSearchParams = new URLSearchParams(location.search)

			if (targetKey === MobileTabBarKey.Super) {
				// Super tab：如果有子路由，保持子路由；否则设置 tab=super 参数
				const currentPath = location.pathname
				const superMatch = currentPath.match(/\/mobile-tabs\/super(\/[\w/]+)?/)

				if (superMatch && superMatch[1]) {
					// Already on Super Tab with sub-route, keep it
					return
				} else {
					// 设置 tab=super 参数，使用 push 记录到 history 堆栈
					currentSearchParams.set("tab", MobileTabParam.Super)
					const newSearch = currentSearchParams.toString()
					const newPath = `${location.pathname}?${newSearch}`
					reactRouterNavigate(newPath)
				}
			} else {
				// 其他 tab：设置对应的查询参数，使用 push 记录到 history 堆栈
				const tabValue = ROUTE_NAME_TO_TAB_PARAM[targetKey]

				if (tabValue) {
					currentSearchParams.set("tab", tabValue)
					const newSearch = currentSearchParams.toString()
					const newPath = `${location.pathname}?${newSearch}`
					reactRouterNavigate(newPath)
				}
			}
		} else {
			// 不在 mobile-tabs 路由下，导航到 mobile-tabs 并设置查询参数
			// 使用全局配置的集群编码，而不是从路径解析（避免回退时错误注入集群编码）
			const clusterCode = configStore.cluster.clusterCode || defaultClusterCode

			const tabValue = ROUTE_NAME_TO_TAB_PARAM[targetKey]

			const targetPath = tabValue
				? `/${clusterCode}${RoutePathMobile.MobileTabs}?tab=${tabValue}`
				: `/${clusterCode}${RoutePathMobile.MobileTabs}`

			// 使用 push 记录到 history 堆栈
			reactRouterNavigate(targetPath)
		}
	}

	const handleTabItemClick = (item: MobileTabBarItem) => {
		if (item.key === MOBILE_TAB_BAR_APPS_KEY) {
			setIsAppsMenuOpen((prevOpen) => !prevOpen)
			notifyAppTabChange(MOBILE_TAB_BAR_APPS_KEY)
			return
		}

		handleTabChange(item.key)
	}

	// Memoize tab items to prevent unnecessary re-renders
	const tabItems = useMemo<MobileTabBarItem[]>(() => {
		return getMobileTabBarItems({
			activeKey,
			chatUnreadCount,
			iconSize: TAB_ICON_SIZE,
			isPersonalOrganization,
			translate: (key, values) => t(key, values),
		})
	}, [activeKey, chatUnreadCount, isPersonalOrganization, t])

	const appsMenuItems = useMemo(
		() => tabItems.find((item) => item.key === MOBILE_TAB_BAR_APPS_KEY)?.children ?? [],
		[tabItems],
	)

	const handleAppsMenuClose = () => {
		setIsAppsMenuOpen(false)
		notifyAppTabChange(activeKey)
	}

	return (
		<>
			<div
				className={cn(
					"absolute z-[999] mx-2 h-mobile-tabbar rounded-full border bg-background px-1.5",
					"shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop:blur-md",
					"border border-[var(--custom-outline-10-dark-outline-20)]",
				)}
				data-testid="mobile-tab-bar"
				style={{
					bottom: "max(var(--safe-area-inset-bottom), 12px)",
					left: 0,
					right: 0,
				}}
				ref={tabBarRef}
			>
				{/* 注意：这里的 data-tabbar-wrap 是自定义的，已用于精确控制选中框位置，谨慎删改。 */}
				<div
					className="relative flex h-full items-center justify-around gap-1"
					data-tabbar-wrap
				>
					{/* 选中框指示器 */}
					{renderIndicator()}

					{/* Tab Items */}
					{tabItems.map((item) => {
						const isActive =
							item.key === MOBILE_TAB_BAR_APPS_KEY
								? isAppsMenuOpen
								: activeKey === item.key
						return (
							<button
								key={item.key}
								data-tab-key={item.key}
								data-testid={`mobile-tab-bar-${item.testIdSuffix}-${item.children?.length ? "trigger" : "tab"}`}
								aria-expanded={
									item.key === MOBILE_TAB_BAR_APPS_KEY
										? isAppsMenuOpen
										: undefined
								}
								aria-haspopup={
									item.key === MOBILE_TAB_BAR_APPS_KEY ? "dialog" : undefined
								}
								onClick={() => handleTabItemClick(item)}
								className={cn(
									"relative z-[1] flex h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 transition-colors duration-200",
									item.className,
								)}
							>
								{/* Icon with Badge */}
								<div className="relative flex h-5 w-5 items-center justify-center">
									<div
										className={cn(
											"flex items-center justify-center transition-colors duration-200",
											isActive ? "text-primary" : "text-muted-foreground",
										)}
									>
										{item.key === MOBILE_TAB_BAR_APPS_KEY
											? createElement(item.iconComponent, {
													active: isActive,
													size: TAB_ICON_SIZE,
												})
											: item.icon}
									</div>
									{item.badge && item.badge > 0 ? (
										<Badge
											variant="destructive"
											className="absolute -right-1.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-background px-1 text-[10px] font-normal leading-4"
										>
											{item.badge > 99 ? "99+" : item.badge}
										</Badge>
									) : null}
								</div>

								{/* Title */}
								<span
									className={cn(
										"text-nowrap text-[10px] leading-[14px] transition-all duration-200",
										isActive
											? "font-semibold text-primary"
											: "font-normal text-muted-foreground",
									)}
								>
									{item.title}
								</span>
							</button>
						)
					})}
				</div>
			</div>

			<AppsMenu
				open={isAppsMenuOpen}
				title={t("sider.mobileTabBar.apps")}
				items={appsMenuItems}
				emptyText={t("sider.mobileTabBar.noOtherApps")}
				onClose={handleAppsMenuClose}
				onItemClick={handleTabChange}
			/>

			<TabBarOverlayGradient className="z-[997]" />
		</>
	)
}

export default observer(MobileTabBar)
