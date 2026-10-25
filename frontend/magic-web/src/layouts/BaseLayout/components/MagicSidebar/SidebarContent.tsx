import { useEffect, useState, type MouseEvent } from "react"
import { useLocation } from "react-router"
import { ChevronRight, LayoutGrid, SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import ProjectNavigation from "./ProjectNavigation"
import { MicroAppsSidebarMenuItem } from "./MicroAppsSidebarMenuItem"
import { SidebarMarketMenuItem } from "./SidebarMarketMenuItem"
import type { SidebarContentProps } from "./types"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/shadcn-ui/sidebar"
import AppsSubMenu from "./AppsSubMenu"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { routesMatch, routesPathMatch } from "@/routes/history/helpers"
import SidebarContentLayout from "./SidebarContentLayout"
import { useSidebarMarketMenuItems } from "./hooks/useSidebarMarketMenuItems"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { observer } from "mobx-react-lite"
import useResourceStatusPolling from "@/pages/superMagic/hooks/useResourceStatusPolling"
import { useNavigateToSuperHome } from "./hooks/useNavigateToSuperHome"
import { isMagicApp } from "@/utils/devices"
import { openAudioRecordingsInMagicApp } from "@/layouts/BaseLayout/utils/magicAppNavigation"
import NewChatSidebarMenuItem from "./NewChatSidebarMenuItem"

function SidebarContent({ collapsed, onBusyChange, onSelect }: SidebarContentProps) {
	const { t } = useTranslation(["sidebar", "super"])
	useResourceStatusPolling()
	const clawBrandValues = getClawBrandTranslationValues()
	const location = useLocation()
	const navigate = useNavigate()
	const sidebarMarketMenuItems = useSidebarMarketMenuItems()
	const { superRouteUrl, handleNavigateToSuperHome } = useNavigateToSuperHome()
	const [projectBusy, setProjectBusy] = useState(false)
	const [appsOpen, setAppsOpen] = useState(false)
	const busy = projectBusy || appsOpen
	const currentRouteName = routesMatch(location.pathname)?.route?.name
	const isSidebarMarketRouteActive = sidebarMarketMenuItems.some((item) =>
		(item.activeRouteNames ?? [item.routeName]).some((routeName) =>
			routesPathMatch(routeName, location.pathname),
		),
	)
	const isMicroAppRouteActive = [
		RouteName.MicroApps,
		RouteName.MicroAppsList,
		RouteName.MicroApp,
	].some((routeName) => routesPathMatch(routeName, location.pathname))
	// The "new task" entry only represents the task home / workspace views. Project and topic
	// detail pages (/super/:projectId[/:topicId]) belong to an existing project, so they must not
	// keep this entry selected; chat routes are likewise excluded.
	const isNewTaskActive =
		[RouteName.Super, RouteName.SuperWorkspaceState].includes(currentRouteName as RouteName) &&
		!isSidebarMarketRouteActive &&
		!isMicroAppRouteActive
	useEffect(() => {
		onBusyChange?.(busy)
	}, [busy, onBusyChange])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])
	function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
		return (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		)
	}

	function handleNavigateToRoute(routeName: RouteName, event: MouseEvent<HTMLAnchorElement>) {
		if (!shouldHandleAnchorClick(event)) return
		event.preventDefault()

		// Magic App should hand audio recordings back to the native recording tab even on desktop UI.
		if (routeName === RouteName.AudioRecordings && isMagicApp) {
			openAudioRecordingsInMagicApp()
			return
		}

		if (routesPathMatch(routeName, location.pathname)) return
		navigate({ name: routeName })
	}

	return (
		<SidebarContentLayout
			home={
				<>
					<SidebarMenuItem key={RouteName.Super}>
						<SidebarMenuButton
							asChild
							tooltip={collapsed ? t("sidebar:home.title") : undefined}
							data-testid="sidebar-content-home-button"
							className="text-sidebar-foreground"
							isActive={isNewTaskActive}
						>
							<a
								href={superRouteUrl}
								onClick={handleNavigateToSuperHome}
								className="text-current no-underline"
							>
								<SquarePen className="h-4 w-4 shrink-0" />
								<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
									{t("sidebar:home.title")}
								</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<NewChatSidebarMenuItem
						collapsed={collapsed}
						isActive={currentRouteName === RouteName.SuperChatHome}
						onSelect={onSelect}
					/>
				</>
			}
		>
			<ProjectNavigation
				apps={
					<SidebarGroup
						className="w-full shrink-0 px-2 pb-1 pt-1"
						data-testid="sidebar-content-apps-group"
						data-guide-anchor="workspace-sidebar"
					>
						<SidebarGroupContent>
							<SidebarMenu>
								{sidebarMarketMenuItems.map((item) => {
									const title =
										item.titleKey === "sidebar:superLobster.title"
											? t(item.titleKey, clawBrandValues)
											: t(item.titleKey)

									return (
										<SidebarMarketMenuItem
											key={item.routeName}
											item={item}
											title={title}
											collapsed={collapsed}
											onNavigate={handleNavigateToRoute}
										/>
									)
								})}
								<MicroAppsSidebarMenuItem collapsed={collapsed} />
								<SidebarMenuItem>
									<AppsSubMenu onOpenChange={setAppsOpen}>
										<SidebarMenuButton
											tooltip={collapsed ? t("appsMenu.more") : undefined}
											data-testid="sidebar-content-apps-button"
											className="text-sidebar-foreground"
										>
											<LayoutGrid className="h-4 w-4 shrink-0" />
											<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
												{t("appsMenu.more")}
											</span>
											{!collapsed && (
												<ChevronRight className="h-4 w-4 shrink-0 text-sidebar-foreground" />
											)}
										</SidebarMenuButton>
									</AppsSubMenu>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				}
				collapsed={collapsed}
				onBusyChange={setProjectBusy}
				onSelect={onSelect}
			/>

			{/* <SidebarGroup className="w-full px-2 py-0">
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip={collapsed ? t("agents.aiChat") : undefined}>
								<MessageCircle className="h-4 w-4 shrink-0" />
								<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5 text-sidebar-foreground">
									{t("agents.aiChat")}
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup> */}
		</SidebarContentLayout>
	)
}

export default observer(SidebarContent)
