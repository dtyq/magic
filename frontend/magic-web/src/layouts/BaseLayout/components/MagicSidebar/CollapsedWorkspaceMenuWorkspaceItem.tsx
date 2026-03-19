import { useEffect, useRef, useState } from "react"
import { Box, ChevronRight, CirclePlus, Ellipsis } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"
import projectStore from "@/pages/superMagic/stores/core/project"
import superMagicService from "@/pages/superMagic/services"
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

export interface CollapsedWorkspaceMenuWorkspaceItemProps {
	workspace: Workspace
	isActive: boolean
	onProjectClick: (projectId: string, workspaceId: string) => void
	openProjectMenuId: string | null
	onProjectMenuChange: (workspaceId: string | null) => void
}

const CollapsedWorkspaceMenuWorkspaceItem = observer(function CollapsedWorkspaceMenuWorkspaceItem({
	workspace,
	isActive,
	onProjectClick,
	openProjectMenuId,
	onProjectMenuChange,
}: CollapsedWorkspaceMenuWorkspaceItemProps) {
	const { t } = useTranslation(["super"])
	const workspaceIdSegment = toTestIdSegment(workspace.id)
	const workspaceNameTestId = `sidebar-collapsed-workspace-name-${workspaceIdSegment}`
	const workspaceMoreTriggerTestId = `sidebar-collapsed-workspace-more-${workspaceIdSegment}`
	const projectPopoverTestId = `sidebar-collapsed-workspace-project-popover-${workspaceIdSegment}`
	const addProjectTestId = `sidebar-collapsed-workspace-add-project-${workspaceIdSegment}`
	const createProjectInputTestId = `sidebar-collapsed-workspace-create-project-input-${workspaceIdSegment}`
	const projectEmptyTestId = `sidebar-collapsed-workspace-project-empty-${workspaceIdSegment}`
	const isProjectMenuOpen = openProjectMenuId === workspace.id
	const projects = projectStore.getProjectsByWorkspace(workspace.id)
	const selectedProject = projectStore.selectedProject
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [projectName, setProjectName] = useState("")
	const [isSubmittingProject, setIsSubmittingProject] = useState(false)
	const [isWorkspaceHovered, setIsWorkspaceHovered] = useState(false)
	const projectMenuContentRef = useRef<HTMLDivElement>(null)
	const projectScrollRef = useRef<HTMLDivElement>(null)

	const {
		projectModals,
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
		if (isProjectMenuOpen && !projectStore.hasLoadedWorkspace(workspace.id)) {
			projectStore.loadProjectsForWorkspace(workspace.id)
		}
	}, [isProjectMenuOpen, workspace.id])

	useEffect(() => {
		const scrollElement = projectScrollRef.current?.querySelector(
			"[data-slot='scroll-area-viewport']",
		) as HTMLElement

		if (!scrollElement) return

		const handleScroll = (e: Event) => {
			e.stopPropagation()
		}

		scrollElement.addEventListener("scroll", handleScroll)
		return () => scrollElement.removeEventListener("scroll", handleScroll)
	}, [])

	function handleProjectMenuChange(open: boolean) {
		if (!open) {
			handleCancelCreateProject()
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

	const renderProjectList = () =>
		projects.map((project) => (
			<CollapsedWorkspaceProjectRow
				key={project.id}
				project={project}
				workspaceId={workspace.id}
				isSelected={selectedProject?.id === project.id}
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
		))

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
							className="w-full"
							data-testid={`sidebar-collapsed-workspace-item-${workspace.id}`}
						>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 w-full justify-start gap-2 px-2 hover:bg-sidebar-accent",
									isActive && "bg-sidebar-accent",
								)}
								onMouseEnter={() => {
									setIsWorkspaceHovered(true)
								}}
								onMouseLeave={() => {
									setIsWorkspaceHovered(false)
								}}
							>
								<Box
									className={cn(
										"h-4 w-4 shrink-0",
										isActive
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground",
									)}
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
											"flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:bg-sidebar-accent",
											isActive
												? "text-sidebar-accent-foreground"
												: "text-sidebar-foreground",
											isWorkspaceHovered
												? "opacity-100"
												: "pointer-events-none opacity-0",
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
					<PopoverContent
						ref={projectMenuContentRef}
						side="right"
						align="start"
						className="shadow-xs w-[240px] p-1"
						sideOffset={8}
						alignOffset={-4}
						data-testid={projectPopoverTestId}
						onEscapeKeyDown={(e) => {
							if (isCreatingProject) {
								e.preventDefault()
							}
						}}
					>
						<div className="flex h-8 items-center rounded-md px-2">
							<span className="truncate text-sm font-medium leading-5 text-sidebar-foreground">
								{t("super:workspace.projects")}
							</span>
						</div>
						<button
							type="button"
							className="flex h-8 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
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
						{projects.length > 0 ? (
							projects.length > 8 ? (
								<ScrollArea
									ref={projectScrollRef}
									className="h-[300px] w-full [&_[data-slot='scroll-area-scrollbar']]:-mr-1 [&_[data-slot='scroll-area-viewport']>div]:!block [&_[data-slot='scroll-area-viewport']>div]:pr-2"
								>
									<div className="mr-1 w-full space-y-1">
										{renderProjectList()}
									</div>
								</ScrollArea>
							) : (
								<div className="space-y-1">{renderProjectList()}</div>
							)
						) : (
							<div
								className="px-2 py-1 text-sm leading-none text-[#a3a3a3]"
								data-testid={projectEmptyTestId}
							>
								{t("super:project.noProjects")}
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
