import { useMemo, useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useLocation, useNavigate as useReactRouterNavigate } from "react-router"
import { useTabBarIndicator } from "./hooks"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"

// Icons
import { MessageIcon, ApprovalIcon } from "./icons"
import useChatUnreadCount from "./hooks/useChatUnreadCount"
import { userStore } from "@/models/user"
import SuperIcon from "./icons/SuperIcon"
import MagicrewIcon from "./icons/Magicrew"
import { isInternationalEnv } from "@/utils/env"
import { mobileTabStore } from "@/stores/mobileTab"
import { RoutePathMobile } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { ProfileIcon } from "./icons/ProfileIcon"
import TabBarOverlayGradient from "./TabBarOverlayGradient"
import {
	ROUTE_NAME_TO_TAB_PARAM,
	MobileTabParam,
	MobileTabBarKey,
} from "@/pages/mobileTabs/constants"
import { isMagicAppVersionAtLeast } from "@/utils/devices"
import { RecordingIcon } from "./icons/RecordingIcon"
import { notifyAppTabChange } from "./utils"

type TabBarItem = {
	key: MobileTabBarKey
	icon: React.ReactNode
	title: string
	badge?: number
	className?: string
}

function MobileTabBar() {
	const { t } = useTranslation("interface")
	const [tabBarVisible, setTabBarVisible] = useState(false)
	const location = useLocation()
	const reactRouterNavigate = useReactRouterNavigate()

	// Touch handling for moreHandle swipe down gesture
	const touchState = useRef({
		startY: 0,
		startTime: 0,
		isTracking: false,
	})

	const { isPersonalOrganization } = userStore.user
	const chatUnreadCount = useChatUnreadCount()

	// Get active key from store (cast via unknown for type compatibility)
	const activeKey = mobileTabStore.activeTab

	// Check if we're on MobileTabs route
	const isOnMobileTabsRoute = location.pathname.includes("/mobile-tabs")

	// 使用选中框动画 hook
	const { tabBarRef, renderIndicator } = useTabBarIndicator({
		activeKey: activeKey as string,
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
			} else if (pathname.includes("/contacts")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Contacts)
			} else if (pathname.includes("/super")) {
				mobileTabStore.setActiveTab(MobileTabBarKey.Super)
			}
		}
	}, [isOnMobileTabsRoute, location.pathname])

	// Handle tab change with state management
	const handleTabChange = (targetKey: MobileTabBarKey) => {
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

		if (tabBarVisible) {
			setTabBarVisible(false)
		}
	}

	// Handle touch events for moreHandle swipe down gesture
	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0]
		touchState.current = {
			startY: touch.clientY,
			startTime: Date.now(),
			isTracking: true,
		}
	}

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!touchState.current.isTracking) return

		const touch = e.touches[0]
		const deltaY = touch.clientY - touchState.current.startY

		// Prevent scrolling on small movements
		if (Math.abs(deltaY) > 10) {
			e.preventDefault()
		}
	}

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (!touchState.current.isTracking) return

		const touch = e.changedTouches[0]
		const deltaY = touch.clientY - touchState.current.startY
		const deltaTime = Date.now() - touchState.current.startTime

		// Reset tracking state
		touchState.current.isTracking = false

		// Check if it's a valid swipe down gesture
		// Requirements: downward movement > 50px, duration < 500ms, minimum velocity
		const isSwipeDown = deltaY > 50 && deltaTime < 500 && deltaY / deltaTime > 0.3

		if (isSwipeDown && tabBarVisible) {
			setTabBarVisible(false)
		}
	}

	// Icon size for consistent rendering
	const iconSize = 20
	// Memoize tab items to prevent unnecessary re-renders
	const tabItems = useMemo(() => {
		const SuperTabIcon = isInternationalEnv() ? MagicrewIcon : SuperIcon
		const items = isPersonalOrganization
			? ([
					{
						key: MobileTabBarKey.Super,
						icon: (
							<SuperTabIcon
								active={activeKey === MobileTabBarKey.Super}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.super"),
					},
					...(isMagicAppVersionAtLeast("1.1.0")
						? [
								{
									key: MobileTabBarKey.Recording,
									icon: (
										<RecordingIcon
											active={activeKey === MobileTabBarKey.Recording}
											size={iconSize}
										/>
									),
									title: t("sider.mobileTabBar.recording"),
								},
							]
						: []),
					{
						key: MobileTabBarKey.Profile,
						icon: (
							<ProfileIcon
								active={activeKey === MobileTabBarKey.Profile}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.profile"),
					},
				] as TabBarItem[])
			: ([
					{
						key: MobileTabBarKey.Super,
						icon: (
							<SuperTabIcon
								active={activeKey === MobileTabBarKey.Super}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.super"),
					},
					{
						key: MobileTabBarKey.Chat,
						icon: (
							<MessageIcon
								active={activeKey === MobileTabBarKey.Chat}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.chat"),
						badge: chatUnreadCount,
					},
					...(isMagicAppVersionAtLeast("1.1.0")
						? [
								{
									key: MobileTabBarKey.Recording,
									icon: (
										<RecordingIcon
											active={activeKey === MobileTabBarKey.Recording}
											size={iconSize}
										/>
									),
									title: t("sider.mobileTabBar.recording"),
								},
							]
						: []),
					{
						key: MobileTabBarKey.Approval,
						icon: (
							<ApprovalIcon
								active={activeKey === MobileTabBarKey.Approval}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.approval"),
					},
					{
						key: MobileTabBarKey.Profile,
						icon: (
							<ProfileIcon
								active={activeKey === MobileTabBarKey.Profile}
								size={iconSize}
							/>
						),
						title: t("sider.mobileTabBar.profile"),
					},
				].filter(Boolean) as TabBarItem[])

		return items
	}, [activeKey, chatUnreadCount, isPersonalOrganization, t])

	return (
		<>
			<div
				className={cn(
					"absolute z-[999] mx-2 h-mobile-tabbar rounded-full border bg-background px-1.5",
					"shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop:blur-md",
					"border border-[var(--custom-outline-10-dark-outline-20)]",
				)}
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
					{tabItems.slice(0, 5).map((item) => {
						const isActive = activeKey === item.key
						return (
							<button
								key={item.key}
								data-tab-key={item.key}
								onClick={() => handleTabChange(item.key)}
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
										{item.icon}
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

			{/* More Panel */}
			{tabItems.length > 5 && (
				<div
					className={cn(
						"absolute left-0 right-0 z-[998] rounded-t-[10px] border-t border-border bg-background px-3 pb-5 pt-2 transition-transform duration-300 ease-in-out",
						tabBarVisible ? "translate-y-0" : "translate-y-full",
					)}
					style={{
						bottom: `calc(59px + var(--safe-area-inset-bottom))`,
					}}
				>
					{/* Swipe Handle */}
					<div
						className="box-border h-7 w-full rounded-[27px] after:mx-auto after:block after:h-1 after:w-[30px] after:rounded-[10px] after:bg-muted-foreground/30 after:content-['']"
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					/>

					{/* More Items Grid */}
					<div className="grid grid-cols-5 gap-1">
						{tabItems.slice(5).map((item) => (
							<button
								key={item.key}
								className="flex flex-col items-center gap-1 py-2"
								onClick={() => handleTabChange(item.key)}
							>
								<div className="flex h-8 w-8 items-center justify-center">
									{item.icon}
								</div>
								<span className="text-[10px] leading-[13px] text-muted-foreground">
									{item.title}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			<TabBarOverlayGradient className="z-[997]" />
		</>
	)
}

export default observer(MobileTabBar)
