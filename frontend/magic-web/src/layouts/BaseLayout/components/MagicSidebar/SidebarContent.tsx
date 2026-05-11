import { Suspense, lazy, useState, type MouseEvent } from "react"
import { useLocation } from "react-router"
import { ChevronRight, Home, LayoutGrid, UsersRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { WorkspaceList } from "./WorkspaceList"
import CollapsedWorkspaceMenu from "./CollapsedWorkspaceMenu"
import type { SidebarContentProps } from "./types"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/shadcn-ui/sidebar"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import SuperMagicService from "@/pages/superMagic/services"
import AppsSubMenu from "./AppsSubMenu"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { getRoutePath, routesPathMatch } from "@/routes/history/helpers"
import Divider from "@/components/other/Divider"
import { useSidebarMarketMenuItems } from "./hooks/useSidebarMarketMenuItems"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { observer } from "mobx-react-lite"
import useResourceStatusPolling from "@/pages/superMagic/hooks/useResourceStatusPolling"
import { useNavigateToSuperHome } from "./hooks/useNavigateToSuperHome"

const CollaborationProjectsPanel = lazy(
	() =>
		import("@/pages/superMagic/components/WorkspacesMenu/components/CollaborationProjectsPanel"),
)

function SidebarContent({ collapsed }: SidebarContentProps) {
	const { t } = useTranslation(["sidebar", "super"])
	useResourceStatusPolling()
	const clawBrandValues = getClawBrandTranslationValues()
	const [shareProjectsPanelOpen, setShareProjectsPanelOpen] = useState(false)
	const location = useLocation()
	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const isShareWorkspaceActive = isCollaborationWorkspace(selectedWorkspace)
	const navigate = useNavigate()
	const sidebarMarketMenuItems = useSidebarMarketMenuItems()
	const { superRouteUrl, handleNavigateToSuperHome } = useNavigateToSuperHome()

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
		if (routesPathMatch(routeName, location.pathname)) return
		navigate({ name: routeName })
	}

	function renderSidebarMarketMenuItem({
		titleKey,
		routeName,
		testId,
		Icon,
	}: (typeof sidebarMarketMenuItems)[number]) {
		const title =
			titleKey === "sidebar:superLobster.title" ? t(titleKey, clawBrandValues) : t(titleKey)

		return (
			<SidebarMenuItem key={routeName}>
				<SidebarMenuButton
					asChild
					tooltip={collapsed ? title : undefined}
					data-testid={testId}
					className="text-sidebar-foreground"
				>
					<a
						href={getRoutePath({ name: routeName }) || "#"}
						onClick={(event) => handleNavigateToRoute(routeName, event)}
						className="text-current no-underline"
					>
						<Icon className="h-4 w-4 shrink-0" />
						<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
							{title}
						</span>
					</a>
				</SidebarMenuButton>
			</SidebarMenuItem>
		)
	}

	return (
		<div
			className="flex min-h-0 w-full flex-1 touch-pan-y flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
			data-testid="sidebar-content-root"
		>
			<SidebarGroup className="w-full shrink-0 p-2" data-testid="sidebar-content-apps-group">
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem key={RouteName.Super}>
							<SidebarMenuButton
								asChild
								tooltip={collapsed ? t("sidebar:home.title") : undefined}
								data-testid="sidebar-content-home-button"
								className="text-sidebar-foreground"
							>
								<a
									href={superRouteUrl}
									onClick={handleNavigateToSuperHome}
									className="text-current no-underline"
								>
									<Home className="h-4 w-4 shrink-0" />
									<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
										{t("sidebar:home.title")}
									</span>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
						{sidebarMarketMenuItems.map(renderSidebarMarketMenuItem)}
						<SidebarMenuItem>
							<AppsSubMenu>
								<SidebarMenuButton
									tooltip={collapsed ? t("appsMenu.apps") : undefined}
									data-testid="sidebar-content-apps-button"
									className="text-sidebar-foreground"
								>
									<LayoutGrid className="h-4 w-4 shrink-0" />
									<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
										{t("appsMenu.apps")}
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

			<Divider direction="horizontal" className="mx-auto !w-[calc(100%-16px)] shrink-0" />

			{collapsed ? (
				<CollapsedWorkspaceMenu />
			) : (
				<div className="flex min-h-40 flex-1 flex-col gap-1 overflow-hidden">
					<WorkspaceList />
					<SidebarGroup
						className="w-full flex-1 shrink-0 px-2 py-0"
						data-testid="sidebar-content-share-workspace-group"
					>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive={isShareWorkspaceActive}
										onClick={() => setShareProjectsPanelOpen(true)}
										data-testid="sidebar-content-share-workspace-button"
										className="text-sidebar-foreground"
									>
										<UsersRound className="ml-6 h-4 w-4 shrink-0" />
										<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
											{t("super:workspace.shareWorkspaceName")}
										</span>
										<ChevronRight className="h-4 w-4 shrink-0 text-sidebar-foreground" />
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</div>
			)}

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

			{shareProjectsPanelOpen && (
				<Suspense fallback={null}>
					<CollaborationProjectsPanel
						open={shareProjectsPanelOpen}
						onClose={() => setShareProjectsPanelOpen(false)}
						onCollaborationProjectClick={(project) =>
							SuperMagicService.switchProjectInDesktop(project)
						}
						workspaces={workspaces}
						selectedWorkspace={selectedWorkspace}
						fetchProjects={(params) => SuperMagicService.project.fetchProjects(params)}
						fetchWorkspaces={(params) =>
							SuperMagicService.workspace.fetchWorkspaces(params)
						}
					/>
				</Suspense>
			)}
		</div>
	)
}

export default observer(SidebarContent)
