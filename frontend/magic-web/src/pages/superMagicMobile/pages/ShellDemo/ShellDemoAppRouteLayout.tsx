import { useCallback, useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Bot, Box, LayoutGrid, MessageCircle, Mic, Sparkles, Trash2 } from "lucide-react"
import { Outlet } from "react-router"
import { useTranslation } from "react-i18next"

import {
	MobileShellAppLayout,
	type MobileShellMenuNavItem,
	type MobileShellMenuRecentItem,
} from "@/pages/superMagicMobile/components/MobileShell"
import { useMobileAppearanceToggle } from "@/pages/superMagicMobile/hooks/useMobileAppearanceToggle"

import ShellDemoSidebar from "./components/ShellDemoSidebar"
import type { ShellDemoOutletContext } from "./shellDemoOutletContext"
import type { ShellDemoView } from "./types"

interface NavItem {
	key: Exclude<ShellDemoView, "home">
	icon: LucideIcon
}

// TODO(mobile-refactor-cleanup): remove this temporary shell validation layout
// after WP01 shell lands in the real mobile routes.

const RECENT_ITEMS: MobileShellMenuRecentItem[] = [
	{
		id: "summer-campaign",
		title: "Summer Campaign",
		inProgress: false,
		isPinned: false,
		isShared: false,
		isLinked: false,
		isChatProject: false,
	},
	{
		id: "brand-strategy",
		title: "Brand Strategy Review",
		inProgress: false,
		isPinned: false,
		isShared: false,
		isLinked: false,
		isChatProject: false,
	},
	{
		id: "seo-optimization",
		title: "SEO Optimization",
		inProgress: false,
		isPinned: false,
		isShared: false,
		isLinked: false,
		isChatProject: false,
	},
	{
		id: "email-newsletter",
		title: "Email Newsletter Revamp",
		inProgress: false,
		isPinned: false,
		isShared: false,
		isLinked: false,
		isChatProject: false,
	},
]

/**
 * ShellDemo 路由父级：挂载 `MobileShellAppLayout` + 侧栏；子路由（index）只渲染面板。
 */
export default function ShellDemoAppRouteLayout() {
	const { t } = useTranslation("sidebar")
	const appearance = useMobileAppearanceToggle()
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [activeView, setActiveView] = useState<ShellDemoView>("home")

	useEffect(() => {
		console.warn("[mobile-shell-demo] mounted")

		return () => {
			console.warn("[mobile-shell-demo] unmounted")
		}
	}, [])

	const navItems = useMemo<NavItem[]>(
		() => [
			{ key: "chats", icon: MessageCircle },
			{ key: "workspaces", icon: Box },
			{ key: "recording", icon: Mic },
			{ key: "myCrew", icon: Bot },
			{ key: "magiClaw", icon: Sparkles },
			{ key: "apps", icon: LayoutGrid },
			{ key: "trash", icon: Trash2 },
		],
		[],
	)

	const viewLabelMap = useMemo<Record<ShellDemoView, string>>(
		() => ({
			home: t("shellDemo.appName"),
			chats: t("shellDemo.nav.chats"),
			workspaces: t("shellDemo.nav.workspaces"),
			recording: t("shellDemo.nav.recording"),
			myCrew: t("shellDemo.nav.myCrew"),
			magiClaw: t("shellDemo.nav.magiClaw"),
			apps: t("shellDemo.nav.apps"),
			trash: t("shellDemo.nav.trash"),
		}),
		[t],
	)

	const sidebarNavItems = useMemo<MobileShellMenuNavItem[]>(
		() =>
			navItems.map(({ key, icon }) => ({
				key,
				icon,
				label: viewLabelMap[key],
			})),
		[navItems, viewLabelMap],
	)

	const handleNavigate = useCallback((view: string) => {
		setActiveView(view as ShellDemoView)
		setIsSidebarOpen(false)
	}, [])

	const handleGoHome = useCallback(() => {
		setActiveView("home")
		setIsSidebarOpen(false)
	}, [])

	const menuContextValue = useMemo(
		() => ({
			activeView,
			navItems: sidebarNavItems,
			recentItems: RECENT_ITEMS,
			onNavigate: handleNavigate,
			onGoHome: handleGoHome,
			// Shell demo 仅验证壳层样式，最近使用点击维持回首页的占位行为即可。
			onRecentNavigate: handleGoHome,
		}),
		[activeView, handleGoHome, handleNavigate, sidebarNavItems],
	)

	const outletContext = useMemo<ShellDemoOutletContext>(
		() => ({
			activeView,
			setActiveView,
			viewLabelMap,
			isSidebarOpen,
			setIsSidebarOpen,
		}),
		[activeView, isSidebarOpen, viewLabelMap],
	)

	const sidebar = (
		<ShellDemoSidebar
			appName={t("shellDemo.appName")}
			accountName={t("shellDemo.accountName")}
			recentlyUsedLabel={t("shellDemo.recentlyUsed")}
			upgradeLabel={t("shellDemo.upgrade")}
			themeToggleDisabled={appearance.isToggleDisabled}
			isDarkAppearance={appearance.isDarkAppearance}
			onThemeToggle={appearance.toggleAppearance}
		/>
	)

	return (
		<MobileShellAppLayout
			testIdPrefix="mobile-shell-demo"
			closeSidebarAriaLabel={t("shellDemo.closeSidebar")}
			isSidebarOpen={isSidebarOpen}
			onCloseSidebar={() => setIsSidebarOpen(false)}
			menuValue={menuContextValue}
			sidebar={sidebar}
			panel={<Outlet context={outletContext} />}
		/>
	)
}
