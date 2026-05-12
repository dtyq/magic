import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CirclePlus, Ellipsis } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { MagicDropdown } from "@/components/base"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import CollapsedWorkspaceProjectRow from "@/layouts/BaseLayout/components/MagicSidebar/CollapsedWorkspaceProjectRow"
import CreateProjectInput from "@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateProjectInput"
import CreateWorkspaceInput from "@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateWorkspaceInput"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import { AnimatePresence, motion } from "framer-motion"
import SuperMagicService from "@/pages/superMagic/services"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import { useWorkspaceActionMenu } from "@/pages/superMagic/hooks/useWorkspaceActionMenu"
import { useWorkspaceDelete } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete"
import { useWorkspaceRename } from "@/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"
import { shouldIgnoreSelectionAfterWorkspaceRename } from "@/pages/superMagic/utils/workspaceRenameSelectionGuard"
import type { ProjectCardDropdownProps } from "./types"

/** 侧栏内打开时父级有 overflow:hidden，用 max-height 压住可视区域，避免底边被裁切（无需 JS 量高） */
const PANEL_MAX_HEIGHT_CLASS = "max-h-[_calc(100dvh-5.0rem)]"

/** 项目 / 工作区切换时共用：标题行 + 分割线 + 主按钮 + 列表，避免高度跳动 */
const DROPDOWN_HEADER_ROW_CLASS = "flex h-10 shrink-0 items-center gap-2 px-1"
const DROPDOWN_TITLE_WRAP_CLASS = "flex min-w-0 flex-1 flex-col justify-center self-stretch"
const DROPDOWN_TITLE_TEXT_CLASS = "line-clamp-1 text-base font-medium leading-6 text-foreground"
const DROPDOWN_PRIMARY_BUTTON_CLASS =
	"h-9 w-full shrink-0 gap-2 bg-primary px-4 py-2 text-primary-foreground shadow-xs"
const SCROLL_AREA_VIEW_CLASS =
	"min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block [&_[data-slot='scroll-area-viewport']>div]:!max-w-full"

/**
 * Dropdown panel for switching/creating projects within a workspace.
 * Renders an overlay and animated expandable panel with project list.
 * Project action handlers are provided by the parent (single useProjectItemActionProps).
 */
function ProjectCardDropdown({
	isExpanded,
	enableWorkspaceNavigation = false,
	onClose,
	selectedProject,
	projectOptions,
	showCreateProject,
	actionWorkspace,
	projectMenuContentRef,
	onOpenInNewWindow = openProjectInNewTab,
	onPinProject,
	onCopyCollaborationLink,
	onTransferProject,
	onMoveProject,
	onAddCollaborators,
	onCancelWorkspaceShortcut,
	onDeleteProject,
	onRenameProject,
	handleProjectClick,
}: ProjectCardDropdownProps) {
	const { t } = useTranslation("super")
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [viewMode, setViewMode] = useState<"project" | "workspace">("project")
	const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
	const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false)
	const wasExpandedRef = useRef(false)

	const defaultWorkspace = useMemo(
		() =>
			buildFallbackWorkspace({
				actionWorkspace,
				selectedProject,
				projectCount: projectOptions.length,
			}),
		[actionWorkspace, projectOptions.length, selectedProject],
	)

	const workspaceOptions = useMemo(() => {
		const workspaceMap = new Map<string, Workspace>()

		if (defaultWorkspace?.id) workspaceMap.set(defaultWorkspace.id, defaultWorkspace)

		workspaceStore.workspaces.forEach((workspace) => {
			if (workspace.id) workspaceMap.set(workspace.id, workspace)
		})

		return Array.from(workspaceMap.values())
	}, [defaultWorkspace, workspaceStore.workspaces])

	const currentWorkspaceId = currentWorkspace?.id || defaultWorkspace?.id || ""
	const currentWorkspaceName =
		currentWorkspace?.name ||
		defaultWorkspace?.name ||
		selectedProject.workspace_name ||
		t("workspace.unnamedWorkspace")
	const currentProjectOptions = !currentWorkspaceId
		? []
		: currentWorkspaceId === defaultWorkspace?.id
			? projectOptions
			: projectStore.getProjectsByWorkspace(currentWorkspaceId)
	const shouldLimitProjectListHeight = currentProjectOptions.length > 8
	const isCurrentWorkspaceProjectsLoading =
		!!currentWorkspaceId && currentWorkspaceId !== defaultWorkspace?.id
			? projectStore.isLoadingWorkspace(currentWorkspaceId)
			: false

	const handleSelectProject = useCallback(
		(project: ProjectListItem) => {
			if (shouldIgnoreSelectionAfterWorkspaceRename()) return
			handleProjectClick(project)
			onClose()
		},
		[handleProjectClick, onClose],
	)

	const handleCreateProjectInputShow = useCallback(() => {
		if (!currentWorkspaceId) return
		setIsCreatingProject(true)
	}, [currentWorkspaceId])

	const handleCancelCreateProject = useCallback(() => {
		setIsCreatingProject(false)
	}, [])

	const handleCreateProjectSuccess = useCallback(() => {
		setIsCreatingProject(false)
	}, [])

	const handleCreateWorkspaceInputShow = useCallback(() => {
		setIsCreatingWorkspace(true)
	}, [])

	const handleCancelCreateWorkspace = useCallback(() => {
		setIsCreatingWorkspace(false)
	}, [])

	const handleCreateWorkspaceSuccess = useCallback(() => {
		setIsCreatingWorkspace(false)
	}, [])

	const resetDropdownState = useCallback(() => {
		setViewMode("project")
		setCurrentWorkspace(defaultWorkspace)
		setIsCreatingProject(false)
		setIsCreatingWorkspace(false)
	}, [defaultWorkspace])

	const handleBackToWorkspaceView = useCallback(() => {
		setIsCreatingProject(false)
		setIsCreatingWorkspace(false)
		setViewMode("workspace")
	}, [])

	const handleWorkspaceSelect = useCallback(
		(workspace: Workspace) => {
			if (shouldIgnoreSelectionAfterWorkspaceRename()) return
			setCurrentWorkspace(workspace)
			setIsCreatingProject(false)
			setIsCreatingWorkspace(false)
			setViewMode("project")

			if (workspace.id && workspace.id !== defaultWorkspace?.id)
				void projectStore.loadProjectsForWorkspace(workspace.id)
		},
		[defaultWorkspace?.id],
	)

	useEffect(() => {
		if (isExpanded && !wasExpandedRef.current) {
			wasExpandedRef.current = true
			return
		}
		if (!isExpanded) wasExpandedRef.current = false
		if (!isExpanded) return
		setCurrentWorkspace((previousWorkspace) => {
			if (!previousWorkspace) return defaultWorkspace
			if (!defaultWorkspace) return previousWorkspace
			if (previousWorkspace.id !== defaultWorkspace.id) return previousWorkspace
			if (previousWorkspace.name === defaultWorkspace.name) return previousWorkspace
			return defaultWorkspace
		})
	}, [defaultWorkspace, isExpanded])

	useEffect(() => {
		if (!enableWorkspaceNavigation) {
			resetDropdownState()
			return
		}
		if (!isExpanded) {
			resetDropdownState()
			return
		}

		resetDropdownState()
		setIsLoadingWorkspaces(true)
		void SuperMagicService.workspace
			.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			})
			.finally(() => {
				setIsLoadingWorkspaces(false)
			})
	}, [enableWorkspaceNavigation, isExpanded])

	const renderProjectView = () => {
		return (
			<>
				{enableWorkspaceNavigation && (
					<div
						className={DROPDOWN_HEADER_ROW_CLASS}
						data-testid="project-card-dropdown-project-header"
					>
						<button
							type="button"
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-lg border-0 bg-secondary p-2.5 text-foreground transition-all hover:opacity-80 active:opacity-60",
								"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
							)}
							onClick={handleBackToWorkspaceView}
							aria-label={t("assistant.backToWorkspace")}
							data-testid="project-card-dropdown-back-button"
						>
							<ArrowLeft size={16} className="shrink-0" />
						</button>
						<div className={DROPDOWN_TITLE_WRAP_CLASS}>
							<p className={DROPDOWN_TITLE_TEXT_CLASS}>{currentWorkspaceName}</p>
						</div>
					</div>
				)}
				{showCreateProject && (
					<>
						<div className="h-[1px] w-full shrink-0 bg-border" />
						<Button
							className={DROPDOWN_PRIMARY_BUTTON_CLASS}
							onClick={handleCreateProjectInputShow}
							disabled={isCreatingProject || !currentWorkspaceId}
							data-testid="project-card-dropdown-create-project-button"
						>
							<CirclePlus size={16} />
							<span className="text-sm font-medium">{t("project.addProject")}</span>
						</Button>
					</>
				)}
				<ScrollArea
					className={SCROLL_AREA_VIEW_CLASS}
					data-testid="project-card-dropdown-project-view"
				>
					{showCreateProject && isCreatingProject && (
						<div className="flex h-10 w-full items-center justify-center duration-150 animate-in fade-in slide-in-from-top-2">
							<CreateProjectInput
								workspaceId={currentWorkspaceId}
								onCancel={handleCancelCreateProject}
								onCreated={handleCreateProjectSuccess}
							/>
						</div>
					)}
					{isCurrentWorkspaceProjectsLoading ? (
						<div
							className="h-8 px-2 text-sm leading-8 text-muted-foreground"
							data-testid="project-card-dropdown-projects-loading"
						>
							{t("common.loading")}
						</div>
					) : currentProjectOptions.length > 0 ? (
						<div className="pb-1">
							{currentProjectOptions.map((project, index, array) => {
								const isSelected = project.id === selectedProject.id

								return (
									<div
										key={project.id}
										data-testid={`project-switch-item-${project.id}`}
										className={cn(
											"my-0.5",
											shouldLimitProjectListHeight && "mr-3",
											index === 0 && "mt-1",
											index === array.length - 1 && "mb-1",
										)}
									>
										<CollapsedWorkspaceProjectRow
											project={project}
											workspaceId={currentWorkspaceId}
											isSelected={isSelected}
											projectMenuContentRef={projectMenuContentRef}
											onOpenInNewWindow={onOpenInNewWindow}
											onPinProject={onPinProject}
											onCopyCollaborationLink={onCopyCollaborationLink}
											onTransferProject={onTransferProject}
											onMoveProject={onMoveProject}
											onAddCollaborators={onAddCollaborators}
											onCancelWorkspaceShortcut={onCancelWorkspaceShortcut}
											onDeleteProject={onDeleteProject}
											onRenameProject={onRenameProject}
											onSelectProject={handleSelectProject}
										/>
									</div>
								)
							})}
						</div>
					) : (
						<div
							className="h-8 px-2 text-sm leading-8 text-muted-foreground"
							data-testid="project-card-dropdown-projects-empty"
						>
							{t("project.noProjects")}
						</div>
					)}
				</ScrollArea>
			</>
		)
	}

	const renderWorkspaceView = () => {
		return (
			<>
				<div
					className="flex h-10 shrink-0 items-center pl-2 pr-1"
					data-testid="project-card-dropdown-workspace-header"
				>
					<p className={DROPDOWN_TITLE_TEXT_CLASS}>{t("workspace.allWorkspaceTitle")}</p>
				</div>
				<div className="h-[1px] w-full shrink-0 bg-border" />
				<Button
					className={DROPDOWN_PRIMARY_BUTTON_CLASS}
					onClick={handleCreateWorkspaceInputShow}
					disabled={isCreatingWorkspace}
					data-testid="project-card-dropdown-create-workspace-button"
				>
					<CirclePlus size={16} />
					<span className="text-sm font-medium">{t("workspace.addWorkspace")}</span>
				</Button>
				<ScrollArea
					className={SCROLL_AREA_VIEW_CLASS}
					data-testid="project-card-dropdown-workspace-view"
				>
					{isCreatingWorkspace && (
						<div className="flex h-10 w-full items-center justify-center duration-150 animate-in fade-in slide-in-from-top-2">
							<CreateWorkspaceInput
								onCancel={handleCancelCreateWorkspace}
								onCreated={handleCreateWorkspaceSuccess}
							/>
						</div>
					)}
					{isLoadingWorkspaces ? (
						<div
							className="h-8 px-2 text-sm leading-8 text-muted-foreground"
							data-testid="project-card-dropdown-workspaces-loading"
						>
							{t("common.loading")}
						</div>
					) : workspaceOptions.length > 0 ? (
						<div className="space-y-1 pb-2 pt-1">
							{workspaceOptions.map((workspace) => {
								const isActive = workspace.id === currentWorkspaceId

								return (
									<WorkspaceNavigationItem
										key={workspace.id}
										workspace={workspace}
										isActive={isActive}
										onSelect={handleWorkspaceSelect}
									/>
								)
							})}
						</div>
					) : (
						<div
							className="h-8 px-2 text-sm leading-8 text-muted-foreground"
							data-testid="project-card-dropdown-workspaces-empty"
						>
							{t("workspace.workspaceList")}
						</div>
					)}
				</ScrollArea>
			</>
		)
	}

	return (
		<>
			<AnimatePresence>
				{isExpanded && (
					<>
						<div
							className="fixed inset-0 z-40"
							onClick={(e) => {
								e.stopPropagation()
								onClose()
							}}
						/>
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{
								height: "calc(100vh)",
								opacity: 1,
								transition: {
									height: {
										type: "spring",
										bounce: 0,
										duration: 0.3,
									},
									opacity: {
										duration: 0.2,
									},
								},
							}}
							exit={{
								height: 0,
								opacity: 0,
								transition: {
									height: {
										type: "spring",
										bounce: 0,
										duration: 0.3,
									},
									opacity: {
										duration: 0.1,
									},
								},
							}}
							className={cn(
								"absolute left-[-1px] right-[-1px] top-full z-50 mt-1 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl",
								PANEL_MAX_HEIGHT_CLASS,
							)}
							data-testid="project-card-dropdown-content"
						>
							<div
								className="flex h-full min-h-0 flex-col gap-2 p-2"
								data-testid="project-card-dropdown-root"
							>
								{viewMode === "workspace"
									? renderWorkspaceView()
									: renderProjectView()}
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	)
}

function buildFallbackWorkspace({
	actionWorkspace,
	selectedProject,
	projectCount,
}: {
	actionWorkspace: Workspace | null
	selectedProject: ProjectListItem
	projectCount: number
}): Workspace | null {
	if (actionWorkspace?.id) return actionWorkspace
	if (!selectedProject.workspace_id) return null

	return {
		id: selectedProject.workspace_id,
		name: selectedProject.workspace_name || "",
		is_archived: 0,
		current_topic_id: selectedProject.current_topic_id || "",
		current_project_id: selectedProject.id,
		workspace_status: WorkspaceStatus.WAITING,
		project_count: projectCount,
	}
}

interface WorkspaceNavigationItemProps {
	workspace: Workspace
	isActive: boolean
	onSelect: (workspace: Workspace) => void
}

function WorkspaceNavigationItem({ workspace, isActive, onSelect }: WorkspaceNavigationItemProps) {
	const { t } = useTranslation("super")
	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)

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
	})
	const shouldShowActions = isActive || isHovered || isMenuOpen

	return (
		<>
			<MagicDropdown
				menu={{ items: menuProps.items }}
				trigger={["contextMenu"]}
				rootClassName="w-full"
			>
				<div
					className={cn(
						"flex h-8 w-full items-center gap-2 rounded-md px-2 transition-colors",
						isActive ? "bg-accent" : "hover:bg-accent/60",
					)}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
				>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-2 text-left"
						onClick={() => onSelect(workspace)}
						data-testid={`project-card-dropdown-workspace-item-${workspace.id}`}
					>
						<NavigationStatusIcon
							itemType="workspace"
							status={workspace.workspace_status}
							className="text-foreground"
						/>
						<p className="min-w-0 flex-1 truncate text-sm leading-none text-foreground">
							{workspace.name || t("workspace.unnamedWorkspace")}
						</p>
					</button>

					<MagicDropdown
						menu={{ items: menuProps.items }}
						trigger={menuProps.trigger}
						placement={menuProps.placement}
						open={isMenuOpen}
						onOpenChange={setIsMenuOpen}
					>
						<button
							type="button"
							className={cn(
								"flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-accent",
								shouldShowActions ? "opacity-100" : "pointer-events-none opacity-0",
							)}
							data-testid={`project-card-dropdown-workspace-action-button-${workspace.id}`}
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
							<Ellipsis size={16} />
						</button>
					</MagicDropdown>
				</div>
			</MagicDropdown>
			{nodes}
			{renderDeleteModal()}
			{renderRenameModal()}
		</>
	)
}

export default observer(ProjectCardDropdown)
export type { ProjectCardDropdownProps, ProjectCardProjectActionHandlers } from "./types"
