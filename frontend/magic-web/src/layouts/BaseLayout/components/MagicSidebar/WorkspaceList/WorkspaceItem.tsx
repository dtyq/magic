import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, Loader2Icon, Plus, EllipsisIcon } from "lucide-react"
import { cn } from "@/utils/cn"
import projectStore from "@/pages/superMagic/stores/core/project"
import { sidebarStore } from "@/stores/layout/SidebarStore"
import ProjectList from "./ProjectList"
import type { WorkspaceItemProps } from "./types"
import { useTranslation } from "react-i18next"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import superMagicService from "@/pages/superMagic/services"
import { useWorkspaceActionMenu } from "@/pages/superMagic/hooks/useWorkspaceActionMenu"
import { useWorkspaceDelete } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete"
import { useWorkspaceRename } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename"
import { useProjectCreate } from "./useProjectCreate"
import { MagicDropdown } from "@/components/base"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/shadcn-ui/sidebar"
import { Button } from "@/components/shadcn-ui/button"
import { toTestIdSegment } from "@/utils/testid"
import { getWorkspaceRouteUrl } from "@/pages/superMagic/utils/route"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import { shouldIgnoreSelectionAfterWorkspaceRename } from "@/pages/superMagic/utils/workspaceRenameSelectionGuard"
import { baseHistory } from "@/routes/history"
import { routesMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import { useChatSidebarSelection } from "../hooks/useChatSidebarSelection"

function WorkspaceItem({
	active,
	workspace,
	className,
	searchProjects,
	dndDisabled,
	scrollRef,
	maxProjectHeight,
	onOpenManager,
	onBusyChange,
}: WorkspaceItemProps) {
	const { t } = useTranslation(["super"])
	const workspaceIdSegment = toTestIdSegment(workspace.id)
	const workspaceNameTestId = `sidebar-workspace-item-name-${workspaceIdSegment}`
	const workspaceToggleTestId = `sidebar-workspace-item-toggle-${workspaceIdSegment}`
	const workspaceLoadingTestId = `sidebar-workspace-item-loading-${workspaceIdSegment}`

	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [projectsBusy, setProjectsBusy] = useState(false)
	const suppressItemClickRef = useRef(false)
	const isExpanded =
		searchProjects !== undefined || sidebarStore.expandedWorkspaces.has(workspace.id)
	const projects = searchProjects ?? projectStore.getProjectsByWorkspace(workspace.id)
	const isLoading = searchProjects === undefined && projectStore.isLoadingWorkspace(workspace.id)
	const { isChatRoute } = useChatSidebarSelection()
	// Keep the task workspace cached, but do not present it as selected on chat pages.
	const isActive = !isChatRoute && workspaceStore.selectedWorkspace?.id === workspace.id
	const { openDeleteModal, renderDeleteModal, deleteModalOpen } = useWorkspaceDelete({
		getDeleteSuccessMessage: () => t("workspace.deleteWorkspaceSuccess"),
		getFallbackWorkspaceName: () => workspace.name || t("workspace.unnamedWorkspace"),
	})

	const { openRenameModal, renderRenameModal, renameDialogOpen } = useWorkspaceRename()

	const { menuProps, nodes, isModalOpen } = useWorkspaceActionMenu({
		workspace,
		onDelete: openDeleteModal,
		onRename: (workspaceId) => openRenameModal(workspaceId, workspace),
		onMenuClose: () => setIsMenuOpen(false),
		onTransferStart: () => setIsHovered(false),
		onOpenManager,
	})

	const { isCreatingProject, handleCreateProject, handleCancelCreate, handleProjectCreated } =
		useProjectCreate({
			workspaceId: workspace.id,
			isExpanded,
		})
	useEffect(() => {
		onBusyChange?.(
			workspace.id,
			isMenuOpen ||
				projectsBusy ||
				isCreatingProject ||
				deleteModalOpen ||
				renameDialogOpen ||
				isModalOpen,
		)
	}, [
		workspace.id,
		isMenuOpen,
		projectsBusy,
		isCreatingProject,
		deleteModalOpen,
		renameDialogOpen,
		isModalOpen,
		onBusyChange,
	])
	useEffect(() => () => onBusyChange?.(workspace.id, false), [workspace.id, onBusyChange])

	const workspaceHeaderRef = useRef<HTMLDivElement>(null)
	const locateOnExpandRef = useRef(false)
	useLayoutEffect(() => {
		const header = workspaceHeaderRef.current
		const viewport = scrollRef.current
		if (!isExpanded || !locateOnExpandRef.current || !header || !viewport) return
		locateOnExpandRef.current = false
		const item = header.closest<HTMLElement>("[data-sidebar-workspace-root]")
		if (!item) return
		viewport.scrollTop +=
			item.getBoundingClientRect().top -
			viewport.getBoundingClientRect().top -
			parseFloat(getComputedStyle(item).scrollMarginTop)
	}, [isExpanded, scrollRef])
	const collapseScrollAnchorRef = useRef<{
		scrollContainer: HTMLElement
		anchorTop: number
	} | null>(null)

	// After collapse, keep workspace header at same viewport Y (sticky / height change)
	useLayoutEffect(() => {
		const pending = collapseScrollAnchorRef.current
		if (!pending || !workspaceHeaderRef.current) return
		collapseScrollAnchorRef.current = null
		const topAfter = workspaceHeaderRef.current.getBoundingClientRect().top
		const delta = topAfter - pending.anchorTop
		if (Math.abs(delta) < 0.5) return
		pending.scrollContainer.scrollTop += delta
	}, [isExpanded])

	/**
	 * Load projects for workspace when workspace is expanded and projects are not loaded
	 */
	useEffect(() => {
		if (
			active &&
			searchProjects === undefined &&
			isExpanded &&
			!projectStore.hasLoadedWorkspace(workspace.id)
		) {
			projectStore.loadProjectsForWorkspace(workspace.id)
		}
	}, [active, isExpanded, searchProjects, workspace.id])

	function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
		return (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		)
	}

	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		if (suppressItemClickRef.current) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		if (!shouldHandleAnchorClick(event)) return
		if (isMenuOpen) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		if (shouldIgnoreSelectionAfterWorkspaceRename()) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		const routeName = routesMatch(baseHistory.location.pathname)?.route.name
		// 首页联动右侧工作区；其他页面只浏览树，不清空当前项目、话题或切换页面。
		if (routeName !== RouteName.Super && routeName !== RouteName.SuperWorkspaceState) {
			handleToggle(event)
			return
		}
		event.preventDefault()
		event.stopPropagation()
		superMagicService.switchWorkspace(workspace)
		sidebarStore.setActiveWorkspace(workspace.id)
		sidebarStore.setWorkspaceExpanded(workspace.id, true)
	}

	function handleToggle(e: MouseEvent<HTMLElement>) {
		e.preventDefault()
		e.stopPropagation()
		if (isExpanded && workspaceHeaderRef.current) {
			const scrollContainer = scrollRef.current
			if (scrollContainer) {
				collapseScrollAnchorRef.current = {
					scrollContainer,
					anchorTop: workspaceHeaderRef.current.getBoundingClientRect().top,
				}
			}
		}
		locateOnExpandRef.current = !isExpanded
		sidebarStore.toggleWorkspaceExpanded(workspace.id)
	}

	function handleCreateProjectClick(e: React.MouseEvent<HTMLButtonElement>) {
		e.preventDefault()
		e.stopPropagation()
		handleCreateProject(e)
	}

	function handleMoreClick(e: React.MouseEvent<HTMLButtonElement>) {
		e.preventDefault()
		e.stopPropagation()
		e.currentTarget.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				clientX: e.clientX,
				clientY: e.clientY,
			}),
		)
	}

	return (
		<SidebarMenuItem
			data-sidebar-drop-type="workspace"
			data-sidebar-drop-workspace-id={workspace.id}
			data-sidebar-workspace-root="true"
			data-workspace-expanded={isExpanded}
			className={cn(
				"relative flex w-full max-w-full shrink-0 flex-col items-center",
				// Selecting a workspace scrolls this item to the top. Reserve the sticky
				// "工作区" header height so the workspace title does not stick downward
				// over the first project.
				"scroll-mt-[var(--workspace-list-sticky-top)]",
				className,
			)}
			data-testid={`sidebar-workspace-item-${workspace.id}`}
			data-workspace-id-segment={workspaceIdSegment}
			data-workspace-name={workspace.name || t("super:workspace.unnamedWorkspace")}
		>
			{/* Section wraps header + projects so sticky releases when whole block scrolls out */}
			<div className="flex w-full min-w-0 flex-col">
				<div
					ref={workspaceHeaderRef}
					draggable={!dndDisabled}
					data-sidebar-dnd-source="workspace"
					data-sidebar-dnd-workspace-id={workspace.id}
					data-sidebar-dnd-label={workspace.name || t("super:workspace.unnamedWorkspace")}
					data-sidebar-workspace-header="true"
					onDragStart={() => {
						suppressItemClickRef.current = true
					}}
					onDragEnd={() => {
						window.setTimeout(() => {
							suppressItemClickRef.current = false
						}, 0)
					}}
					className={cn(
						"sticky top-[var(--workspace-list-sticky-top)] z-10 w-full",
						"bg-sidebar",
					)}
				>
					<MagicDropdown
						menu={{ items: menuProps.items }}
						trigger={["contextMenu"]}
						onOpenChange={setIsMenuOpen}
						placement="bottomRight"
						rootClassName="w-full"
					>
						<div
							className={cn(
								"group/workspace-row flex h-8 w-full min-w-0 items-center rounded-md focus-within:bg-sidebar-accent hover:bg-sidebar-accent",
								isActive && "bg-sidebar-accent",
							)}
							onMouseEnter={() => setIsHovered(true)}
							onMouseLeave={() => setIsHovered(false)}
						>
							<SidebarMenuButton
								asChild
								size="default"
								isActive={isActive}
								className="relative h-8 min-w-0 flex-1 gap-2 px-2 font-normal leading-5 text-sidebar-foreground hover:bg-transparent data-[active=true]:bg-transparent data-[active=true]:font-normal"
							>
								<a
									href={getWorkspaceRouteUrl(workspace.id)}
									onClick={handleClick}
									draggable={false}
									data-sidebar-workspace-link="true"
									className="text-current no-underline [-webkit-tap-highlight-color:transparent]"
								>
									<div
										className="flex size-4 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent"
										onClick={handleToggle}
										data-testid={workspaceToggleTestId}
									>
										<ChevronRight
											strokeWidth={1.5}
											className={cn(
												"h-4 w-4 shrink-0 transition-transform",
												isExpanded && "rotate-90",
											)}
										/>
									</div>
									<NavigationStatusIcon
										itemType="workspace"
										status={workspace.workspace_status}
										className="text-muted-foreground [&_.lucide]:stroke-[1.5]"
									/>
									<span
										className="min-w-0 flex-1 truncate text-left text-[13px] font-normal leading-5"
										data-testid={workspaceNameTestId}
									>
										{workspace.name || t("super:workspace.unnamedWorkspace")}
									</span>
									{isLoading && (
										<Loader2Icon
											className="h-4 w-4 shrink-0 animate-spin text-[#a3a3a3]"
											data-testid={workspaceLoadingTestId}
										/>
									)}
								</a>
							</SidebarMenuButton>
							{/* 默认不占标题宽度；hover、键盘聚焦或触摸设备常显时再从右侧展开操作区。 */}
							<div
								className={cn(
									"ml-auto flex w-0 shrink-0 items-center gap-px overflow-hidden transition-[width,opacity] group-focus-within/workspace-row:pointer-events-auto group-focus-within/workspace-row:w-[57px] group-focus-within/workspace-row:opacity-100 no-hover:pointer-events-auto no-hover:w-[57px] no-hover:opacity-100",
									isHovered || isMenuOpen
										? "w-[57px] opacity-100"
										: "pointer-events-none opacity-0",
								)}
							>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("super:sidebarPanels.createProject")}
									draggable={false}
									className={cn(
										"relative size-7 shrink-0 bg-transparent p-0 text-sidebar-foreground before:absolute before:inset-0.5 before:rounded-md before:transition-colors",
										"hover:bg-transparent hover:before:bg-sidebar-foreground/10 focus-visible:ring-0 focus-visible:before:bg-sidebar-foreground/10 active:before:bg-sidebar-foreground/15 dark:hover:bg-transparent",
									)}
									onClick={handleCreateProjectClick}
									onPointerDown={(e) => {
										e.stopPropagation()
									}}
									onMouseDown={(e) => {
										e.stopPropagation()
									}}
									data-testid="workspace-item-create-project"
								>
									<Plus className="relative h-4 w-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("common.moreActions")}
									aria-haspopup="menu"
									aria-expanded={isMenuOpen}
									data-state={isMenuOpen ? "open" : "closed"}
									draggable={false}
									className={cn(
										"relative size-7 shrink-0 bg-transparent p-0 text-sidebar-foreground before:absolute before:inset-0.5 before:rounded-md before:transition-colors",
										"hover:bg-transparent hover:before:bg-sidebar-foreground/10 focus-visible:ring-0 focus-visible:before:bg-sidebar-foreground/10 active:before:bg-sidebar-foreground/15 dark:hover:bg-transparent",
										"data-[state=open]:before:bg-sidebar-foreground/10",
									)}
									onClick={handleMoreClick}
									onPointerDown={(e) => {
										e.stopPropagation()
									}}
									onMouseDown={(e) => {
										e.stopPropagation()
									}}
									data-testid="workspace-item-more"
								>
									<EllipsisIcon className="relative h-4 w-4" />
								</Button>
							</div>
						</div>
					</MagicDropdown>
				</div>

				{isExpanded && (
					<ProjectList
						isSearchResult={searchProjects !== undefined}
						active={active}
						workspace={workspace}
						maxProjectHeight={maxProjectHeight}
						projects={projects}
						workspaceId={workspace.id}
						isLoading={isLoading}
						isCreatingProject={isCreatingProject}
						onBusyChange={setProjectsBusy}
						dndDisabled={dndDisabled}
						onCancelCreate={handleCancelCreate}
						onProjectCreated={handleProjectCreated}
					/>
				)}
			</div>

			{nodes}

			{renderDeleteModal()}

			{renderRenameModal()}
		</SidebarMenuItem>
	)
}

export default observer(WorkspaceItem)
