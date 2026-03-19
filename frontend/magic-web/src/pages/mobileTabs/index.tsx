import { observer } from "mobx-react-lite"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { mobileTabStore } from "@/stores/mobileTab"
import { RouteName } from "@/routes/constants"
import { useStyles } from "./styles"
import { Navigate } from "@/routes/components/Navigate"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useLocation } from "react-router"
import SuperMagicMobileTabsWrapper from "./components/SuperMagicMobileTabsWrapper"
import ChatMobileSkeleton from "@/pages/chatNew/lazy/skeleton/ChatMobileSkeleton"
import WorkspacePageMobileSkeleton from "../superMagic/lazy/skeleton/WorkspacePageMobileSkeleton"
import { TAB_PARAM_TO_TAB_KEY, MobileTabBarKey } from "./constants"
import { initializeSuperMagicIfNeeded } from "../superMagic/services/utils"
import { interfaceStore } from "@/stores/interface"
import { notifyAppTabChange } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/utils"

// Lazy load tab pages (只加载一次)
const WorkspacePage = lazy(() => import("@/pages/superMagicMobile/pages/ChatPage"))
const ChatPage = lazy(() => import("@/pages/chatNew"))
const ContactsPage = lazy(() => import("@/pages/contacts/lazy/Contacts"))
const ProfilePage = lazy(() => import("@/pages/user/pages/my/lazy/Profile"))

function MobileTabs() {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const location = useLocation()
	// 跟踪已加载的 tabs，一旦加载过就始终渲染
	const [loadedTabs, setLoadedTabs] = useState<Set<MobileTabBarKey>>(new Set())

	// 根据 URL 查询参数和路径判断当前激活的 Tab
	const activeTabFromRoute = useMemo(() => {
		const pathname = location.pathname
		// 检查是否在 mobile-tabs 路由下
		if (!pathname.includes("/mobile-tabs")) {
			return null
		}

		// 优先从查询参数读取 tab
		const searchParams = new URLSearchParams(location.search)
		const tabParam = searchParams.get("tab")

		// Use mapping to convert tab parameter to RouteName
		if (tabParam && TAB_PARAM_TO_TAB_KEY[tabParam as keyof typeof TAB_PARAM_TO_TAB_KEY]) {
			return TAB_PARAM_TO_TAB_KEY[tabParam as keyof typeof TAB_PARAM_TO_TAB_KEY]
		}

		// 如果没有查询参数，检查是否有 super 相关的 query 参数
		if (searchParams.has("workspaceId")) {
			return MobileTabBarKey.Super
		}
		// 如果是 /mobile-tabs 根路径，默认显示 Super
		if (pathname.match(/\/mobile-tabs\/?$/)) {
			return MobileTabBarKey.Super
		}

		return null
	}, [location.pathname, location.search])

	// 使用路由判断的 activeTab，如果没有则使用 store 的值
	const activeTab = activeTabFromRoute || mobileTabStore.activeTab

	// 同步路由状态到 store（不触发导航）
	useEffect(() => {
		if (activeTabFromRoute && activeTabFromRoute !== mobileTabStore.activeTab) {
			mobileTabStore.setActiveTab(activeTabFromRoute, false)
			// 通知 Magic App 当前 Tab 和 TabBar 高度
			notifyAppTabChange(activeTabFromRoute)
		}
	}, [activeTabFromRoute])

	// 当 activeTab 变化时，标记为已加载
	useEffect(() => {
		if (activeTab) {
			setLoadedTabs((prev) => {
				const next = new Set(prev)
				next.add(activeTab)
				return next
			})
			if (activeTab === MobileTabBarKey.Super) {
				// 获取当前路由参数
				const searchParams = new URLSearchParams(window.location.search)
				const workspaceId = searchParams.get("workspaceId") || undefined
				const projectId = searchParams.get("projectId") || undefined
				const topicId = searchParams.get("topicId") || undefined
				initializeSuperMagicIfNeeded({
					isMobile: interfaceStore.isMobile,
					workspaceId,
					projectId,
					topicId,
				})
			}
		}
	}, [activeTab])

	// PC端重定向到桌面版
	if (!isMobile) {
		return <Navigate name={RouteName.Super} replace />
	}

	return (
		<div className={styles.container}>
			{/* Super Tab - 常驻，支持子路由 */}
			<div
				className={cx(styles.tabContent, {
					[styles.activeTab]: activeTab === MobileTabBarKey.Super,
					[styles.inactiveTab]: activeTab !== MobileTabBarKey.Super,
				})}
			>
				<SuperMagicMobileTabsWrapper>
					{loadedTabs.has(MobileTabBarKey.Super) && (
						<Suspense fallback={<WorkspacePageMobileSkeleton />}>
							<WorkspacePage />
						</Suspense>
					)}
				</SuperMagicMobileTabsWrapper>
			</div>

			{/* Chat Tab - 常驻 */}
			<div
				className={cx(styles.tabContent, {
					[styles.activeTab]: activeTab === MobileTabBarKey.Chat,
					[styles.inactiveTab]: activeTab !== MobileTabBarKey.Chat,
				})}
			>
				{loadedTabs.has(MobileTabBarKey.Chat) && (
					<Suspense fallback={<ChatMobileSkeleton />}>
						<ChatPage />
					</Suspense>
				)}
			</div>

			{/* Contacts Tab - 常驻 */}
			<div
				className={cx(styles.tabContent, {
					[styles.activeTab]: activeTab === MobileTabBarKey.Contacts,
					[styles.inactiveTab]: activeTab !== MobileTabBarKey.Contacts,
				})}
			>
				{loadedTabs.has(MobileTabBarKey.Contacts) && <ContactsPage />}
			</div>

			{/* Profile Tab - 常驻 */}
			<div
				className={cx(styles.tabContent, {
					[styles.activeTab]: activeTab === MobileTabBarKey.Profile,
					[styles.inactiveTab]: activeTab !== MobileTabBarKey.Profile,
				})}
			>
				{loadedTabs.has(MobileTabBarKey.Profile) && <ProfilePage />}
			</div>
		</div>
	)
}

export default observer(MobileTabs)
