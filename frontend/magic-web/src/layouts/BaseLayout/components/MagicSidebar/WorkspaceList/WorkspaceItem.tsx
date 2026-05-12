import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, Loader2Icon, Plus, EllipsisIcon } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { toTestIdSegment } from "@/utils/testid"
import { getWorkspaceRouteUrl } from "@/pages/superMagic/utils/route"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import { shouldIgnoreSelectionAfterWorkspaceRename } from "@/pages/superMagic/utils/workspaceRenameSelectionGuard"

function WorkspaceItem({ workspace, className }: WorkspaceItemProps) {
	const { t } = useTranslation(["super"])
	const workspaceIdSegment = toTestIdSegment(workspace.id)
	const workspaceNameTestId = `sidebar-workspace-item-name-${workspaceIdSegment}`
	const workspaceToggleTestId = `sidebar-workspace-item-toggle-${workspaceIdSegment}`
	const workspaceLoadingTestId = `sidebar-workspace-item-loading-${workspaceIdSegment}`

	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const isExpanded = sidebarStore.expandedWorkspaces.has(workspace.id)
	const projects = projectStore.getProjectsByWorkspace(workspace.id)
	const isLoading = projectStore.isLoadingWorkspace(workspace.id)
	const isActive = workspaceStore.selectedWorkspace?.id === workspace.id

	const { openDeleteModal, renderDeleteModal } = useWorkspaceDelete({
		getDeleteSuccessMessage: () => t("workspace.deleteWorkspaceSuccess"),
		getFallbackWorkspaceName: () => t("workspace.unnamedWorkspace"),
	})

	const { openRenameModal, renderRenameModal } = useWorkspaceRename()

	const { menuProps, nodes } = useWorkspaceActionMenu({
		workspace,
		onDelete: openDeleteModal,
		onRename: openRenameModal,
		onMenuClose: () => setIsMenuOpen(false),
		onTransferStart: () => setIsHovered(false),
	})

	const { isCreatingProject, handleCreateProject, handleCancelCreate, handleProjectCreated } =
		useProjectCreate({
			workspaceId: workspace.id,
			isExpanded,
		})

	const workspaceHeaderRef = useRef<HTMLDivElement>(null)
	const collapseScrollAnchorRef = useRef<{
		viewport: HTMLElement
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
		pending.viewport.scrollTop += delta
	}, [isExpanded])

	/**
	 * Load projects for workspace when workspace is expanded and projects are not loaded
	 */
	useEffect(() => {
		if (isExpanded && !projectStore.hasLoadedWorkspace(workspace.id)) {
			projectStore.loadProjectsForWorkspace(workspace.id)
		}
	}, [isExpanded, workspace.id])

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
		event.preventDefault()
		event.stopPropagation()
		superMagicService.switchWorkspace(workspace)
		sidebarStore.setActiveWorkspace(workspace.id)
		sidebarStore.setWorkspaceExpanded(workspace.id, true)
	}

	function handleToggle(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault()
		e.stopPropagation()
		if (isExpanded && workspaceHeaderRef.current) {
			const viewport = workspaceHeaderRef.current.closest<HTMLElement>(
				'[data-slot="scroll-area-viewport"]',
			)
			if (viewport) {
				collapseScrollAnchorRef.current = {
					viewport,
					anchorTop: workspaceHeaderRef.current.getBoundingClientRect().top,
				}
			}
		}
		sidebarStore.toggleWorkspaceExpanded(workspace.id)
	}

	function handleCreateProjectClick(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault()
		e.stopPropagation()
		handleCreateProject(e)
	}

	function handleMoreClick(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault()
		e.stopPropagation()
	}

	return (
		<SidebarMenuItem
			className={cn("flex w-full max-w-full shrink-0 flex-col items-center", className)}
			data-testid={`sidebar-workspace-item-${workspace.id}`}
			data-workspace-id-segment={workspaceIdSegment}
			data-workspace-name={workspace.name || t("super:workspace.unnamedWorkspace")}
		>
			{/* Section wraps header + projects so sticky releases when whole block scrolls out */}
			<div className="flex w-full min-w-0 flex-col">
				<div ref={workspaceHeaderRef} className="sticky top-0 z-10 w-full bg-sidebar">
					<MagicDropdown
						menu={{ items: menuProps.items }}
						trigger={["contextMenu"]}
						placement={menuProps.placement}
						rootClassName="w-full"
					>
						<SidebarMenuButton
							asChild
							size="default"
							isActive={isActive}
							className="h-8 gap-2 px-2 text-sidebar-foreground"
							onMouseEnter={() => setIsHovered(true)}
							onMouseLeave={() => setIsHovered(false)}
						>
							<a
								href={getWorkspaceRouteUrl(workspace.id)}
								onClick={handleClick}
								className="text-current no-underline"
							>
								<div
									className="flex items-center justify-center rounded-xl hover:bg-sidebar-accent "
									onClick={handleToggle}
									data-testid={workspaceToggleTestId}
								>
									<ChevronRight
										className={cn(
											"h-4 w-4 shrink-0 transition-transform",
											isExpanded && "rotate-90",
										)}
									/>
								</div>
								<NavigationStatusIcon
									itemType="workspace"
									status={workspace.workspace_status}
								/>
								<span
									className="min-w-0 flex-1 truncate text-left text-sm leading-5"
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
								{(isHovered || isMenuOpen) && (
									<>
										<div
											className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
											onClick={handleCreateProjectClick}
											onPointerDown={(e) => {
												e.stopPropagation()
											}}
											onMouseDown={(e) => {
												e.stopPropagation()
											}}
											data-testid="workspace-item-create-project"
										>
											<Plus className="h-4 w-4" />
										</div>
										<MagicDropdown
											menu={{ items: menuProps.items }}
											trigger={["click"]}
											placement={menuProps.placement}
											onOpenChange={setIsMenuOpen}
										>
											<div
												className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
												onClick={handleMoreClick}
												onPointerDown={(e) => {
													e.stopPropagation()
												}}
												onMouseDown={(e) => {
													e.stopPropagation()
												}}
												data-testid="workspace-item-more"
											>
												<EllipsisIcon className="h-4 w-4" />
											</div>
										</MagicDropdown>
									</>
								)}
							</a>
						</SidebarMenuButton>
					</MagicDropdown>
				</div>

				{isExpanded && (
					<ProjectList
						workspace={workspace}
						projects={projects}
						workspaceId={workspace.id}
						isLoading={isLoading}
						isCreatingProject={isCreatingProject}
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
