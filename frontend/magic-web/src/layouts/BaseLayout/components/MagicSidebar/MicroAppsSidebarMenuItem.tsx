import type { MouseEvent } from "react"
import { useLocation } from "react-router"
import { Boxes } from "lucide-react"
import { useTranslation } from "react-i18next"

import { SidebarMenuButton, SidebarMenuItem } from "@/components/shadcn-ui/sidebar"
import { RouteName } from "@/routes/constants"
import { getRoutePath, routesPathMatch } from "@/routes/history/helpers"
import useNavigate from "@/routes/hooks/useNavigate"
import { isMicroAppEnabled } from "@/services/microAppFeature"

interface MicroAppsSidebarMenuItemProps {
	collapsed: boolean
}

function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
	return (
		event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
	)
}

export function MicroAppsSidebarMenuItem({ collapsed }: MicroAppsSidebarMenuItemProps) {
	const { t } = useTranslation("sidebar")
	const location = useLocation()
	const navigate = useNavigate()
	const routeUrl = getRoutePath({ name: RouteName.MicroApps })

	if (!isMicroAppEnabled()) return null

	function handleNavigate(event: MouseEvent<HTMLAnchorElement>) {
		if (!shouldHandleAnchorClick(event)) return
		event.preventDefault()
		if (routeUrl && location.pathname === routeUrl) return
		navigate({ name: RouteName.MicroApps })
	}

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				tooltip={collapsed ? t("appsMenu.microApps") : undefined}
				data-testid="sidebar-content-micro-apps-button"
				className="text-sidebar-foreground"
				isActive={
					routesPathMatch(RouteName.MicroApps, location.pathname) ||
					routesPathMatch(RouteName.MicroAppsList, location.pathname) ||
					routesPathMatch(RouteName.MicroApp, location.pathname)
				}
			>
				<a
					href={routeUrl || "#"}
					onClick={handleNavigate}
					className="text-current no-underline"
				>
					<Boxes className="h-4 w-4 shrink-0" />
					<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
						{t("appsMenu.microApps")}
					</span>
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}
