import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Box, LayoutGrid, MessageCircle, Mic, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { hasOrganizationAppsShortcuts } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"
import { userStore } from "@/models/user"
import SuperMagicService from "@/pages/superMagic/services"
import { getNativePort } from "@/platform/native"
import { MagiClawNavIcon } from "@/pages/superMagicMobile/components/icons/MagiClawNavIcon"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { MobileSettingsPanel } from "@/layouts/BaseLayoutMobile/components/MobileSettings"
import { useMobileDocumentThemeControl } from "@/pages/superMagicMobile/components/MobileDocumentTheme"
import { MobileSettingsProvider } from "@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext"
import { isMagicApp } from "@/utils/devices"

import { MobileShellAppLayout } from "./MobileShellAppLayout"
import MobileShellSidebar from "./MobileShellSidebar"
import type { MobileShellMenuNavItem, MobileShellMenuRecentItem } from "./MobileShellMenuContext"
import { useRecentProjectsForMenu } from "./useRecentProjectsForMenu"

export interface SuperMobileShellOutletContext {
	isSidebarOpen: boolean
	openSidebar: () => void
	closeSidebar: () => void
}

const SuperMobileShellOutletContext = createContext<SuperMobileShellOutletContext | null>(null)

function openNativeRecordingPage() {
	void getNativePort().navigation.changeBottomTab({
		tab: "ai_recording",
		bottomTabHeight: 0,
	})
}

/**
 * 部分移动端页面在过渡态或独立渲染场景下会先于父级 Shell 挂载；这里提供非抛错探针，
 * 由页面自行决定是否补一层壳，而保留 useSuperMobileShellOutlet 的严格约束用于常规消费方。
 */
export function useOptionalSuperMobileShellOutlet(): SuperMobileShellOutletContext | null {
	return useContext(SuperMobileShellOutletContext)
}

export function useSuperMobileShellOutlet(): SuperMobileShellOutletContext {
	const ctx = useOptionalSuperMobileShellOutlet()
	if (!ctx) {
		throw new Error("useSuperMobileShellOutlet must be used under SuperMobileShellRouteLayout")
	}
	return ctx
}

export interface SuperMobileShellRouteLayoutProps {
	/** 侧栏主导航当前高亮项，与 `MobileShellMenuContext` 的 `activeView` 一致 */
	activeView: string
	/** 默认使用共享 `MobileShellSidebar`；只有特殊实验页才需要覆盖。 */
	sidebar?: ReactNode
	closeSidebarAriaLabel: string
	testIdPrefix?: string
	/** 主面板区：直接传入页面根节点，或 `<Outlet />` */
	children: ReactNode
}

/**
 * Super 移动端全屏壳：主导航跳转、侧栏开关、`MobileShellAppLayout` 只挂载一次。
 * `children` 为面板内容；侧栏菜单按钮通过 `useSuperMobileShellOutlet().openSidebar` 打开抽屉。
 */
export const SuperMobileShellRouteLayout = observer(function SuperMobileShellRouteLayout(
	props: SuperMobileShellRouteLayoutProps,
) {
	const {
		activeView,
		sidebar,
		closeSidebarAriaLabel,
		testIdPrefix = "mobile-super-shell",
		children,
	} = props

	const navigate = useNavigate({
		fallbackRoute: { name: RouteName.MobileHome },
	})
	const { t } = useTranslation("super")
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const pendingNavigationFrameRef = useRef<number[]>([])
	const shouldShowAppsEntry = hasOrganizationAppsShortcuts({
		isPersonalOrganization: userStore.user.isPersonalOrganization,
	})
	const { recentItems, reloadRecentItems, loadMoreRecentItems, hasMore } =
		useRecentProjectsForMenu()
	const { setSidebarOpen: setDocumentThemeSidebarOpen } = useMobileDocumentThemeControl()

	useEffect(() => {
		setDocumentThemeSidebarOpen(isSidebarOpen)
		return () => setDocumentThemeSidebarOpen(false)
	}, [isSidebarOpen, setDocumentThemeSidebarOpen])

	useEffect(() => {
		return () => {
			pendingNavigationFrameRef.current.forEach((frameId) => cancelAnimationFrame(frameId))
			pendingNavigationFrameRef.current = []
		}
	}, [])

	useEffect(() => {
		if (!isSidebarOpen) return

		// Shell 常驻挂载，侧栏再次打开不会重新触发 hook 初始化；这里补一次静默刷新，保证“最近使用”状态及时更新。
		void reloadRecentItems()
	}, [isSidebarOpen, reloadRecentItems])

	const shellOutletContext = useMemo<SuperMobileShellOutletContext>(
		() => ({
			isSidebarOpen,
			openSidebar: () => setIsSidebarOpen(true),
			closeSidebar: () => setIsSidebarOpen(false),
		}),
		[isSidebarOpen],
	)

	const navItems = useMemo<MobileShellMenuNavItem[]>(
		() => [
			{ key: "chats", icon: MessageCircle, label: t("mobile.shell.navChats") },
			{ key: "workspaces", icon: Box, label: t("mobile.shell.navWorkspaces") },
			...(isMagicApp
				? [{ key: "recording", icon: Mic, label: t("mobile.shell.navRecording") }]
				: []),
			{ key: "myCrew", icon: Bot, label: t("mobile.shell.navMyCrew") },
			{
				key: "magiClaw",
				icon: MagiClawNavIcon,
				label: t("mobile.shell.navMagiClaw"),
			},
			...(shouldShowAppsEntry
				? [{ key: "apps", icon: LayoutGrid, label: t("mobile.shell.navApps") }]
				: []),
			{ key: "trash", icon: Trash2, label: t("mobile.shell.navTrash") },
		],
		[shouldShowAppsEntry, t],
	)

	const runAfterSidebarCloseFrame = useCallback((action: () => void) => {
		pendingNavigationFrameRef.current.forEach((frameId) => cancelAnimationFrame(frameId))
		pendingNavigationFrameRef.current = []

		// Let the closed transform commit and paint before route rendering starts; otherwise React may batch both updates and skip the visible close transition.
		const firstFrameId = requestAnimationFrame(() => {
			const secondFrameId = requestAnimationFrame(() => {
				pendingNavigationFrameRef.current = []
				action()
			})
			pendingNavigationFrameRef.current = [secondFrameId]
		})

		pendingNavigationFrameRef.current = [firstFrameId]
	}, [])

	const handleMenuNavigate = useCallback(
		(key: string) => {
			setIsSidebarOpen(false)
			const navigateWithoutViewTransition = (name: RouteName) => {
				// Sidebar close already animates the shell; page View Transition snapshots stack old/new shells and cause multi-shell flicker.
				const navigateToRoute = () => navigate({ name, viewTransition: false })
				if (isSidebarOpen) {
					runAfterSidebarCloseFrame(navigateToRoute)
					return
				}
				navigateToRoute()
			}

			if (key === "trash") {
				// 回收站已是独立路由，侧栏点击应与其他正式导航项保持一致。
				navigateWithoutViewTransition(RouteName.RecycleBin)
				return
			}
			if (key === "chats") {
				navigateWithoutViewTransition(RouteName.SuperChatsList)
				return
			}
			if (key === "recording") {
				openNativeRecordingPage()
				return
			}
			if (key === "magiClaw") {
				navigateWithoutViewTransition(RouteName.MagiClaw)
				return
			}
			if (key === "myCrew") {
				navigateWithoutViewTransition(RouteName.MyCrew)
				return
			}
			if (key === "apps") {
				navigateWithoutViewTransition(RouteName.SuperApps)
				return
			}
			if (key === "workspaces") {
				navigateWithoutViewTransition(RouteName.SuperWorkspacesList)
				return
			}
			navigateWithoutViewTransition(RouteName.MobileHome)
		},
		[isSidebarOpen, navigate, runAfterSidebarCloseFrame],
	)

	/**
	 * 最近项目点击按项目类型分流：
	 * - 对话（isChatProject）→ switchChatProject，进入对话页面
	 * - 普通项目 → switchProjectInMobile，进入项目详情页
	 */
	const handleRecentNavigate = useCallback((item: MobileShellMenuRecentItem) => {
		if (!item.project) {
			setIsSidebarOpen(false)
			return
		}

		setIsSidebarOpen(false)

		if (item.isChatProject) {
			void SuperMagicService.switchChatProject(item.project)
		} else {
			void SuperMagicService.switchProjectInMobile(item.project)
		}
	}, [])

	const menuValue = useMemo(
		() => ({
			activeView,
			navItems,
			recentItems,
			onNavigate: handleMenuNavigate,
			onGoHome: () => {
				setIsSidebarOpen(false)
				// Disable page View Transition so shell close animation does not stack with VT snapshots (multi-sidebar flicker).
				const navigateHome = () =>
					navigate({ name: RouteName.MobileHome, viewTransition: false })
				if (isSidebarOpen) {
					runAfterSidebarCloseFrame(navigateHome)
					return
				}
				navigateHome()
			},
			onRecentNavigate: handleRecentNavigate,
			reloadRecentItems,
			hasMore,
			loadMoreRecentItems,
		}),
		[
			activeView,
			handleMenuNavigate,
			handleRecentNavigate,
			hasMore,
			isSidebarOpen,
			loadMoreRecentItems,
			navItems,
			navigate,
			recentItems,
			reloadRecentItems,
			runAfterSidebarCloseFrame,
		],
	)
	/** 统一默认侧栏，避免业务页重复实现与维护一整份侧栏 JSX。 */
	const resolvedSidebar = useMemo(
		() => sidebar ?? <MobileShellSidebar testIdPrefix={testIdPrefix} />,
		[sidebar, testIdPrefix],
	)
	const mobileSettingsValue = useMemo(
		() => ({
			isSettingsOpen,
			openSettings: () => setIsSettingsOpen(true),
			closeSettings: () => setIsSettingsOpen(false),
			setSettingsOpen: (open: boolean) => setIsSettingsOpen(open),
		}),
		[isSettingsOpen],
	)

	return (
		<SuperMobileShellOutletContext.Provider value={shellOutletContext}>
			<MobileSettingsProvider value={mobileSettingsValue}>
				<MobileShellAppLayout
					testIdPrefix={testIdPrefix}
					closeSidebarAriaLabel={closeSidebarAriaLabel}
					isSidebarOpen={isSidebarOpen}
					onCloseSidebar={() => setIsSidebarOpen(false)}
					menuValue={menuValue}
					sidebar={resolvedSidebar}
					panel={children}
				/>
				{/* 设置浮层与侧栏同层挂载，共享同一份局部开关状态，避免上下文跨布局丢失。 */}
				<MobileSettingsPanel open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
			</MobileSettingsProvider>
		</SuperMobileShellOutletContext.Provider>
	)
})
