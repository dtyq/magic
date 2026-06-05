import { useCallback, useMemo } from "react"
import { Outlet, matchPath, useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import SuperMagicMobileLayout from "../../components/Layout"
import MainHeader from "./components/MainHeader"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RoutePath } from "@/constants/routes"
import { SuperMobileShellRouteLayout } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"

function resolveEmbeddedShellState(pathname: string): {
	enabled: boolean
	activeView: string
	testIdPrefix: string
} {
	if (matchPath(`/:clusterCode${RoutePath.SuperChatProjectState}`, pathname)) {
		return {
			enabled: true,
			activeView: "chats",
			testIdPrefix: "mobile-chat-detail-page",
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjectState}`, pathname)) {
		return {
			enabled: true,
			activeView: "workspaces",
			testIdPrefix: "mobile-workspace-detail-page",
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjectTopicState}`, pathname)) {
		return {
			enabled: true,
			activeView: "workspaces",
			testIdPrefix: "mobile-workspace-topic-page",
		}
	}

	return {
		enabled: false,
		activeView: "",
		testIdPrefix: "mobile-super-main-layout",
	}
}

/**
 * Mobile SuperMagic layout: header + child routes.
 * Default header back uses history.go(-1); child headers pass fallbackRoute via useNavigate when needed.
 */
export default function SuperMagicMobileMainLayout() {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { t } = useTranslation("super")

	/** Default back: history first; useNavigate falls back to MobileHome when length is insufficient. */
	const onBackClick = useCallback(() => {
		navigate({ delta: -1, viewTransition: false })
	}, [navigate])

	const shellState = useMemo(() => resolveEmbeddedShellState(pathname), [pathname])
	const panel = (
		<SuperMagicMobileLayout header={<MainHeader onBackClick={onBackClick} />}>
			<Outlet />
		</SuperMagicMobileLayout>
	)

	if (!shellState.enabled) {
		return panel
	}

	return (
		<SuperMobileShellRouteLayout
			activeView={shellState.activeView}
			testIdPrefix={shellState.testIdPrefix}
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
		>
			{panel}
		</SuperMobileShellRouteLayout>
	)
}
