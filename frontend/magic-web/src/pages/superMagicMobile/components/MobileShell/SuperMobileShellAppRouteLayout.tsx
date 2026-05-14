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
 * 回收站桌面端仍需保持原有 PC 页面，因此仅在该路径且非移动端时跳过 Shell 包裹。
 */
export default function SuperMobileShellAppRouteLayout() {
	const location = useLocation()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const pathname = location.pathname
	const isRecycleBinRoute = matchPath(`/:clusterCode${RoutePath.RecycleBin}`, pathname) != null
	const activeView = useMemo(() => resolveActiveView(pathname), [pathname])
	const testIdPrefix = useMemo(() => resolveTestIdPrefix(pathname), [pathname])

	if (!isMobile && isRecycleBinRoute) {
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