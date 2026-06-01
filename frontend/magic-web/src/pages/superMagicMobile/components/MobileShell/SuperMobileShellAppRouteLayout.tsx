import { Outlet, matchPath, useLocation } from "react-router"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { RoutePath } from "@/constants/routes"
import { useIsMobile } from "@/hooks/useIsMobile"

import { SuperMobileShellRouteLayout } from "./SuperMobileShellRouteLayout"

function resolveActiveView(pathname: string): string {
	if (matchPath(`/:clusterCode${RoutePath.SuperChatsList}`, pathname)) {
		return "chats"
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperApps}`, pathname)) {
		return "apps"
	}

	if (matchPath(`/:clusterCode${RoutePath.MyCrew}`, pathname)) {
		return "myCrew"
	}

	if (matchPath(`/:clusterCode${RoutePath.MagiClaw}`, pathname)) {
		return "magiClaw"
	}

	if (matchPath(`/:clusterCode${RoutePath.RecycleBin}`, pathname)) {
		return "trash"
	}

	if (
		matchPath(`/:clusterCode${RoutePath.SuperWorkspacesList}`, pathname) ||
		matchPath(`/:clusterCode${RoutePath.SuperSharedWorkspace}`, pathname) ||
		matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjects}`, pathname)
	) {
		return "workspaces"
	}

	return ""
}

function resolveTestIdPrefix(pathname: string): string {
	if (matchPath(`/:clusterCode${RoutePath.SuperChatsList}`, pathname)) {
		return "mobile-chats-page"
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperApps}`, pathname)) {
		return "super-apps-shell"
	}

	if (matchPath(`/:clusterCode${RoutePath.MyCrew}`, pathname)) {
		return "my-crew-shell"
	}

	if (matchPath(`/:clusterCode${RoutePath.MagiClaw}`, pathname)) {
		return "magi-claw-shell"
	}

	if (matchPath(`/:clusterCode${RoutePath.RecycleBin}`, pathname)) {
		return "mobile-recycle-bin-shell"
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperSharedWorkspace}`, pathname)) {
		return "mobile-shared-workspace-page"
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjects}`, pathname)) {
		return "mobile-workspace-page"
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspacesList}`, pathname)) {
		return "mobile-workspaces-page"
	}

	return "mobile-chat-home-page"
}

/**
 * Super 一级移动端路由父布局：公共 Shell 只在这里挂载一次，子路由仅切换面板内容。
 * 桌面端不挂载 Shell（避免依赖 BaseLayoutMobile 内的 MobileDocumentThemeProvider）；
 * 子页面通过 MobileOnlyRoute 重定向到 /super，回收站等仍走各自 PC 页面。
 */
export default function SuperMobileShellAppRouteLayout() {
	const location = useLocation()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const pathname = location.pathname
	const activeView = useMemo(() => resolveActiveView(pathname), [pathname])
	const testIdPrefix = useMemo(() => resolveTestIdPrefix(pathname), [pathname])

	// Desktop skips mobile shell; child routes handle redirect or PC-specific rendering.
	if (!isMobile) {
		return <Outlet />
	}

	return (
		<SuperMobileShellRouteLayout
			activeView={activeView}
			testIdPrefix={testIdPrefix}
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
		>
			<Outlet />
		</SuperMobileShellRouteLayout>
	)
}
