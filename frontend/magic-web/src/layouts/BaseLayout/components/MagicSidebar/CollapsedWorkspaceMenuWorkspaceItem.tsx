import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent,
} from "react"
import {
	ChevronRight,
	CirclePlus,
	Ellipsis,
	Home,
	AppWindow,
	Search,
	Loader2,
	RefreshCw,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { useVirtualProjectList } from "./hooks/useVirtualProjectList"
import { cn } from "@/utils/cn"
import projectStore from "@/pages/superMagic/stores/core/project"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import superMagicService from "@/pages/superMagic/services"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import { MagicDropdown } from "@/components/base"
import { useWorkspaceActionMenu } from "@/pages/superMagic/hooks/useWorkspaceActionMenu"
import { useWorkspaceDelete } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete"
import { useWorkspaceRename } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import CollapsedWorkspaceProjectRow from "./CollapsedWorkspaceProjectRow"
import { toTestIdSegment } from "@/utils/testid"
import SidebarCreateInput from "./components/SidebarCreateInput"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import { getWorkspaceRouteUrl } from "@/pages/superMagic/utils/route"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import { shouldIgnoreSelectionAfterWorkspaceRename } from "@/pages/superMagic/utils/workspaceRenameSelectionGuard"

const PROJECT_ROW_HEIGHT = 36

export interface CollapsedWorkspaceMenuWorkspaceItemProps {
	workspace: Workspace
	isActive: boolean
	onProjectClick: (projectId: string, workspaceId: string) => void
	openProjectMenuId: string | null
	onProjectMenuChange: (workspaceId: string | null) => void
	onRequestCloseAll: () => void
	onOpenManager: () => void
	onBusyChange: (workspaceId: string, busy: boolean) => void
	keepPopoverOpen?: boolean
}

const CollapsedWorkspaceMenuWorkspaceItem = observer(function CollapsedWorkspaceMenuWorkspaceItem({
	workspace,
	isActive,
	onProjectClick,
	openProjectMenuId,
	onProjectMenuChange,
	onRequestCloseAll,
	keepPopoverOpen = false,
	onOpenManager,
	onBusyChange,
}: CollapsedWorkspaceMenuWorkspaceItemProps) {
	const { t } = useTranslation(["super"])
	const workspaceIdSegment = toTestIdSegment(workspace.id)
	const workspaceDisplayName = workspace.name || t("super:workspace.unnamedWorkspace")
	const projectPanelTitle = `${workspaceDisplayName}/${t("super:workspace.projects")}`
	const workspaceNameTestId = `sidebar-collapsed-workspace-name-${workspaceIdSegment}`
	const workspaceMoreTriggerTestId = `sidebar-collapsed-workspace-more-${workspaceIdSegment}`
	const projectPopoverTestId = `sidebar-collapsed-workspace-project-popover-${workspaceIdSegment}`
	const workspaceHomeTestId = `sidebar-collapsed-workspace-home-${workspaceIdSegment}`
	const addProjectTestId = `sidebar-collapsed-workspace-add-project-${workspaceIdSegment}`
	const createProjectInputTestId = `sidebar-collapsed-workspace-create-project-input-${workspaceIdSegment}`
	const projectEmptyTestId = `sidebar-collapsed-workspace-project-empty-${workspaceIdSegment}`
	const projectSearchInputTestId = `sidebar-collapsed-workspace-project-search-input-${workspaceIdSegment}`
	const projectSearchEmptyTestId = `sidebar-collapsed-workspace-project-search-empty-${workspaceIdSegment}`
	const isProjectMenuOpen = openProjectMenuId === workspace.id
	const projects = projectStore.getProjectsByWorkspace(workspace.id)
	const selectedProject = projectStore.selectedProject
	const isWorkspaceHomeSelected = isActive && !selectedProject?.id
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [projectName, setProjectName] = useState("")
	const [projectSearchKeyword, setProjectSearchKeyword] = useState("")
	const [isSubmittingProject, setIsSubmittingProject] = useState(false)
	const [isWorkspaceHovered, setIsWorkspaceHovered] = useState(false)
	const projectMenuContentRef = useRef<HTMLDivElement>(null)
	const suppressWorkspaceItemClickRef = useRef(false)

	const {
		projectModals,
		isProjectModalOpen,
		handleMoveProject,
		handleTransferProject,
		handleDeleteProjectConfirm,
		handleTogglePinProject,
		onAddCollaborators,
		handleCopyCollaborationLink,
		handleCancelWorkspaceShortcutByProject,
		handleRenameProject,
	} = useProjectItemActionProps({
		selectedWorkspace: workspace,
	})

	const { openDeleteModal, renderDeleteModal } = useWorkspaceDelete({
		getDeleteSuccessMessage: () => t("workspace.deleteWorkspaceSuccess"),
		getFallbackWorkspaceName: () => t("workspace.unnamedWorkspace"),
	})

	const { openRenameModal, renderRenameModal } = useWorkspaceRename()

	const { menuProps, nodes } = useWorkspaceActionMenu({
		workspace,
		onDelete: openDeleteModal,
		onRename: openRenameModal,
	})

	useEffect(() => {
		if (!isProjectMenuOpen) return
		if (workspace.id === SHARE_WORKSPACE_ID) return

		void (async () => {
			await projectStore.loadProjectsForWorkspace(workspace.id, true, true)
			if (workspace.id === workspaceStore.selectedWorkspace?.id) {
				await superMagicService.project.updateProjects({ workspaceId: workspace.id })
			}
		})()
	}, [isProjectMenuOpen, workspace.id])

	const page = projectStore.workspacePages.get(workspace.id)
	const loading = projectStore.isLoadingWorkspace(workspace.id)
	const isProjectLoading = loading || !!page?.loadingMore
	// Include the status row in the viewport height so loading and retry actions stay visible.
	const showProjectListStatus = isProjectLoading || !!page?.error
	const loadMore = useCallback(() => {
		void projectStore.loadMoreProjectsForWorkspace(workspace.id)
	}, [workspace.id])
	const unnamedProjectLabel = t("super:project.unnamedProject")
	const normalizedProjectSearchKeyword = projectSearchKeyword.trim().toLowerCase()
	const hasProjectSearchKeyword = normalizedProjectSearchKeyword.length > 0
	const filteredProjects = hasProjectSearchKeyword
		? projects.filter((project) =>
				(project.project_name || unnamedProjectLabel)
					.toLowerCase()
					.includes(normalizedProjectSearchKeyword),
			)
		: projects

	const list = useVirtualProjectList({
		scrollKey: `collapsed-workspace-projects:${workspace.id}:${normalizedProjectSearchKeyword}`,
		projects: filteredProjects,
		rowHeight: PROJECT_ROW_HEIGHT,
		enabled: isProjectMenuOpen,
		hasMore: page?.hasMore,
		loading: isProjectLoading,
		error: page?.error,
		onLoadMore: loadMore,
	})

	const busy = isCreatingProject || list.hasActiveInteraction || isProjectModalOpen
	useEffect(() => {
		onBusyChange(workspace.id, busy)
	}, [workspace.id, busy, onBusyChange])
	useEffect(() => () => onBusyChange(workspace.id, false), [workspace.id, onBusyChange])

	function handleProjectMenuChange(open: boolean) {
		if (!open && (keepPopoverOpen || busy)) return
		if (!open) {
			handleCancelCreateProject()
			setProjectSearchKeyword("")
		}
		onProjectMenuChange(open ? workspace.id : null)
	}

	async function handleCreateProject() {
		const trimmedName = projectName.trim()
		if (!trimmedName || isSubmittingProject) return

		setIsSubmittingProject(true)
		try {
			await superMagicService.handleCreateProjectAndNavigate(workspace.id, trimmedName)
			setIsCreatingProject(false)
			setProjectName("")
			onProjectMenuChange(null)
		} catch (error) {
			console.error("Failed to create project in collapsed workspace menu:", error)
		} finally {
			setIsSubmittingProject(false)
		}
	}

	function handleCancelCreateProject() {
		setIsCreatingProject(false)
		setProjectName("")
	}

	function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
		return (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		)
	}

	function handleWorkspaceHomeClick(event: MouseEvent<HTMLAnchorElement>) {
		if (!shouldHandleAnchorClick(event)) return
		if (shouldIgnoreSelectionAfterWorkspaceRename()) {
			event.preventDefault()
			event.stopPropagation()
			return
		}
		event.preventDefault()
		superMagicService.switchWorkspace(workspace)
		onRequestCloseAll()
	}

	function handleWorkspaceDragStart() {
		suppressWorkspaceItemClickRef.current = true
	}

	function handleWorkspaceDragEnd() {
		window.setTimeout(() => {
			suppressWorkspaceItemClickRef.current = false
		}, 0)
	}

	function handleProjectSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		event.stopPropagation()
		if (event.key !== "Escape") return
		if (!projectSearchKeyword) return
		event.preventDefault()
		setProjectSearchKeyword("")
	}

	const renderProjectList = () =>
		list.rows.map((row) => {
			const project = filteredProjects[row.index]
			return (
				<div
					key={project.id}
					data-index={row.index}
					data-virtual-project-id={project.id}
					ref={list.virtualizer.measureElement}
					className="absolute left-0 top-0 w-full pb-1"
					style={{ transform: `translateY(${row.start}px)` }}
				>
					<CollapsedWorkspaceProjectRow
						onInteractionChange={list.onInteractionChange}
						project={project}
						workspaceId={workspace.id}
						isSelected={isActive && selectedProject?.id === project.id}
						projectMenuContentRef={projectMenuContentRef}
						onOpenInNewWindow={openProjectInNewTab}
						onPinProject={handleTogglePinProject}
						onCopyCollaborationLink={handleCopyCollaborationLink}
						onTransferProject={handleTransferProject}
						onMoveProject={handleMoveProject}
						onAddCollaborators={onAddCollaborators}
						onCancelWorkspaceShortcut={handleCancelWorkspaceShortcutByProject}
						onDeleteProject={handleDeleteProjectConfirm}
						onRenameProject={handleRenameProject}
						onSelectProject={(targetProject) => {
							onProjectClick(targetProject.id, workspace.id)
							onProjectMenuChange(null)
						}}
					/>
				</div>
			)
		})

	return (
		<>
			<MagicDropdown
				menu={{ items: menuProps.items }}
				trigger={["contextMenu"]}
				rootClassName="w-full"
			>
				<Popover
					open={isProjectMenuOpen}
					onOpenChange={handleProjectMenuChange}
					modal={false}
				>
					<PopoverTrigger asChild>
						<span
							className="block w-full"
							data-testid={`sidebar-collapsed-workspace-item-${workspace.id}`}
							draggable
							data-collapsed-sidebar-dnd-source="workspace"
							data-collapsed-sidebar-dnd-workspace-id={workspace.id}
							data-collapsed-sidebar-dnd-label={workspaceDisplayName}
							data-collapsed-sidebar-dnd-drop-type="workspace"
							onDragStart={handleWorkspaceDragStart}
							onDragEnd={handleWorkspaceDragEnd}
							onClick={(event) => {
								if (!suppressWorkspaceItemClickRef.current) return
								event.preventDefault()
								event.stopPropagation()
							}}
						>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 w-full justify-start gap-2 px-2 font-normal [-webkit-tap-highlight-color:transparent]",
									!isActive &&
										"hover:bg-sidebar-accent/50 active:bg-sidebar-accent/50",
									!isActive && !isWorkspaceHovered && "!bg-transparent",
									isActive && "bg-sidebar-accent",
								)}
								onMouseEnter={() => {
									setIsWorkspaceHovered(true)
								}}
								onMouseLeave={() => {
									setIsWorkspaceHovered(false)
								}}
							>
								<NavigationStatusIcon
									itemType="workspace"
									status={workspace.workspace_status}
									className={
										isActive
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground"
									}
								/>
								<span
									className={cn(
										"min-w-0 flex-1 truncate text-left text-sm leading-5",
										isActive
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground",
									)}
									data-testid={workspaceNameTestId}
								>
									{workspace.name || t("super:workspace.unnamedWorkspace")}
								</span>
								<MagicDropdown
									menu={{ items: menuProps.items }}
									trigger={menuProps.trigger}
									placement={menuProps.placement}
									getPopupContainer={() =>
										projectMenuContentRef.current ?? document.body
									}
								>
									<div
										data-testid={workspaceMoreTriggerTestId}
										className={cn(
											"flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity [-webkit-tap-highlight-color:transparent] hover:bg-sidebar-accent",
											isActive
												? "text-sidebar-accent-foreground"
												: "text-sidebar-foreground",
											isWorkspaceHovered
												? "opacity-100"
												: "pointer-events-none opacity-0",
											"no-hover:pointer-events-auto no-hover:opacity-100",
										)}
										onClick={(e) => {
											e.stopPropagation()
										}}
										onPointerDown={(e) => {
											e.stopPropagation()
										}}
										onMouseDown={(e) => {
											e.stopPropagation()
										}}
									>
										<Ellipsis className="h-4 w-4" />
									</div>
								</MagicDropdown>
								<ChevronRight
									className={cn(
										"h-4 w-4 shrink-0",
										isActive
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground",
									)}
								/>
							</Button>
						</span>
					</PopoverTrigger>
					{/* Center beside the trigger and reserve bottom space for browser link previews. */}
					<PopoverContent
						ref={projectMenuContentRef}
						side="right"
						align="center"
						collisionPadding={{ top: 12, right: 12, bottom: 32, left: 12 }}
						className="flex max-h-[min(70vh,640px,var(--radix-popover-content-available-height))] w-[240px] flex-col p-1 shadow-xs supports-[height:100dvh]:max-h-[min(70dvh,640px,var(--radix-popover-content-available-height))] [&>:not([data-project-scroll-container])]:shrink-0"
						sideOffset={8}
						data-testid={projectPopoverTestId}
						onEscapeKeyDown={(e) => {
							if (isCreatingProject || projectSearchKeyword) {
								e.preventDefault()
							}
						}}
					>
						<div className="flex h-8 items-center rounded-md px-2">
							<span
								className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-sidebar-foreground"
								title={projectPanelTitle}
							>
								{projectPanelTitle}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								title={t("projectNavigation.openManager")}
								aria-label={t("projectNavigation.openWorkspaceManager", {
									name: workspaceDisplayName,
								})}
								onClick={onOpenManager}
							>
								<AppWindow size={16} />
							</Button>
						</div>
						<Button
							asChild
							variant="ghost"
							size="sm"
							data-testid={workspaceHomeTestId}
							className={cn(
								"h-8 w-full justify-start gap-2 px-2 text-sm font-normal leading-5 hover:bg-sidebar-accent",
								isWorkspaceHomeSelected && "bg-sidebar-accent",
							)}
						>
							<a
								href={getWorkspaceRouteUrl(workspace.id)}
								className="text-current no-underline [-webkit-tap-highlight-color:transparent]"
								onClick={handleWorkspaceHomeClick}
							>
								<Home
									className={cn(
										"h-4 w-4 shrink-0",
										isWorkspaceHomeSelected
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground",
									)}
								/>
								<span
									className={cn(
										"flex-1 truncate text-left",
										isWorkspaceHomeSelected
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground",
									)}
								>
									{t("super:workspace.home")}
								</span>
							</a>
						</Button>
						<button
							type="button"
							className="flex h-8 w-full items-center gap-2 rounded-md px-2 [-webkit-tap-highlight-color:transparent] hover:bg-sidebar-accent"
							onClick={() => setIsCreatingProject(true)}
							data-testid="sidebar-collapsed-workspace-add-project"
						>
							<CirclePlus className="h-4 w-4 shrink-0 text-sidebar-foreground" />
							<span
								className="flex-1 truncate text-left text-sm leading-5 text-sidebar-foreground"
								data-testid={addProjectTestId}
							>
								{t("super:project.createNewProject")}
							</span>
						</button>
						<div className="my-1 h-px w-full bg-border" />
						<div className="relative mb-1 w-full">
							<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={projectSearchKeyword}
								onChange={(event) => setProjectSearchKeyword(event.target.value)}
								onKeyDown={handleProjectSearchKeyDown}
								placeholder={t("super:project.searchProject")}
								aria-label={t("super:project.searchProject")}
								autoComplete="off"
								className="h-8 w-full pl-7 text-sm"
								data-testid={projectSearchInputTestId}
							/>
						</div>
						{isCreatingProject && (
							<div className="mb-1">
								<SidebarCreateInput
									value={projectName}
									onValueChange={setProjectName}
									onSubmit={handleCreateProject}
									onCancel={handleCancelCreateProject}
									placeholder={t("sidebar:project.enterName")}
									disabled={isSubmittingProject}
									inputTestId={createProjectInputTestId}
									submitButtonTestId={`sidebar-collapsed-workspace-create-project-submit-${workspaceIdSegment}`}
									cancelButtonTestId={`sidebar-collapsed-workspace-create-project-cancel-${workspaceIdSegment}`}
									submitButtonAriaLabel={t("common.confirm")}
									cancelButtonAriaLabel={t("common.cancel")}
									stopKeyboardPropagation
								/>
							</div>
						)}
						{/* Fit short lists to their content and shrink only the list when space is limited. */}
						<div
							ref={list.scrollRef}
							className="min-h-0 w-full overflow-y-auto overscroll-contain"
							style={{
								height:
									list.virtualizer.getTotalSize() +
									(showProjectListStatus ? PROJECT_ROW_HEIGHT : 0),
							}}
							data-project-scroll-container
							onFocusCapture={list.onFocusCapture}
							onBlurCapture={list.onBlurCapture}
						>
							<div
								className="relative w-full"
								style={{ height: list.virtualizer.getTotalSize() }}
								data-collapsed-sidebar-dnd-drop-type="project-list"
								data-collapsed-sidebar-dnd-workspace-id={workspace.id}
							>
								{renderProjectList()}
							</div>
							{showProjectListStatus && (
								<div
									className="flex h-9 w-full items-center justify-center gap-2 py-0.5 text-xs text-muted-foreground"
									role="status"
								>
									{isProjectLoading ? (
										<>
											<Loader2
												className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
												aria-hidden="true"
											/>
											<span>{t("projectNavigation.loading")}</span>
										</>
									) : (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-8 w-full gap-2 px-2 text-xs font-normal text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-foreground focus-visible:ring-0 active:bg-sidebar-foreground/10 dark:hover:bg-sidebar-accent"
											disabled={isProjectLoading}
											onClick={loadMore}
										>
											<RefreshCw className="size-4" aria-hidden="true" />
											{t("projectNavigation.retry")}
										</Button>
									)}
								</div>
							)}
						</div>
						{!showProjectListStatus && filteredProjects.length === 0 && (
							<div
								className="w-full px-2 py-4 text-center text-sm text-muted-foreground"
								data-testid={
									hasProjectSearchKeyword
										? projectSearchEmptyTestId
										: projectEmptyTestId
								}
								data-collapsed-sidebar-dnd-drop-type="project-list"
								data-collapsed-sidebar-dnd-workspace-id={workspace.id}
								data-collapsed-sidebar-dnd-drop-empty={
									hasProjectSearchKeyword ? undefined : "true"
								}
							>
								{hasProjectSearchKeyword
									? t("super:project.noMatchingProjects")
									: t("super:project.noProjects")}
							</div>
						)}
					</PopoverContent>
				</Popover>
			</MagicDropdown>

			{nodes}

			{renderDeleteModal()}

			{renderRenameModal()}

			{projectModals}
		</>
	)
})

export default CollapsedWorkspaceMenuWorkspaceItem
