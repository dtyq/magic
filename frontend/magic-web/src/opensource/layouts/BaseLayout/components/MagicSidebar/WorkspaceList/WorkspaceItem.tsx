import { useEffect, useState, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, Box, Loader2Icon, Plus, EllipsisIcon } from "lucide-react"
import { cn } from "@/opensource/lib/utils"
import projectStore from "@/opensource/pages/superMagic/stores/core/project"
import { sidebarStore } from "@/opensource/stores/layout/SidebarStore"
import ProjectList from "./ProjectList"
import type { WorkspaceItemProps } from "./types"
import { useTranslation } from "react-i18next"
import { workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import superMagicService from "@/opensource/pages/superMagic/services"
import { useWorkspaceActionMenu } from "@/opensource/pages/superMagic/hooks/useWorkspaceActionMenu"
import { useWorkspaceDelete } from "@/opensource/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete"
import { useWorkspaceRename } from "@/opensource/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename"
import { useProjectCreate } from "./useProjectCreate"
import { MagicDropdown } from "@/opensource/components/base"
import { SidebarMenuButton, SidebarMenuItem } from "@/opensource/components/shadcn-ui/sidebar"
import { toTestIdSegment } from "@/opensource/utils/testid"
import { getWorkspaceRouteUrl } from "@/opensource/pages/superMagic/utils/route"

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
		onTransferStart: () => setIsHovered(false),
	})

	const { isCreatingProject, handleCreateProject, handleCancelCreate, handleProjectCreated } =
		useProjectCreate({
			workspaceId: workspace.id,
			isExpanded,
		})

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
		event.preventDefault()
		event.stopPropagation()
		superMagicService.switchWorkspace(workspace)
		sidebarStore.setActiveWorkspace(workspace.id)
		sidebarStore.setWorkspaceExpanded(workspace.id, true)
	}

	function handleToggle(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault()
		e.stopPropagation()
		sidebarStore.toggleWorkspaceExpanded(workspace.id)
	}

	function handleCreateProjectClick(e: React.MouseEvent<HTMLDivElement>) {
		e.preventDefault()
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
					className="h-8 gap-2 px-2 text-[#0a0a0a] dark:text-[#fafafa]"
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
						<Box className="h-4 w-4 shrink-0" />
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

			{nodes}

			{renderDeleteModal()}

			{renderRenameModal()}
		</SidebarMenuItem>
	)
}

export default observer(WorkspaceItem)
