import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { Box, ChevronRight, CirclePlus, UsersRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import projectStore from "@/pages/superMagic/stores/core/project"
import superMagicService from "@/pages/superMagic/services"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import SidebarCreateInput from "./components/SidebarCreateInput"
import CollapsedWorkspaceMenuWorkspaceItem from "./CollapsedWorkspaceMenuWorkspaceItem"
import { SidebarMenuButton } from "@/components/shadcn-ui/sidebar"

const CollaborationProjectsPanel = lazy(
	() =>
		import("@/pages/superMagic/components/WorkspacesMenu/components/CollaborationProjectsPanel"),
)

const CollapsedWorkspaceMenu = observer(function CollapsedWorkspaceMenu() {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [workspaceName, setWorkspaceName] = useState("")
	const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false)
	const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null)
	const [shareProjectsPanelOpen, setShareProjectsPanelOpen] = useState(false)
	const workspaceScrollRef = useRef<HTMLDivElement>(null)

	const selectedWorkspace = workspaceStore.selectedWorkspace
	const workspaces = workspaceStore.workspaces
	const isShareWorkspaceActive = isCollaborationWorkspace(selectedWorkspace)

	function handleProjectClick(projectId: string, workspaceId: string) {
		const projects = projectStore.getProjectsByWorkspace(workspaceId)
		const project = projects.find((p) => p.id === projectId)
		if (project) {
			superMagicService.switchProjectInDesktop(project)
			setIsOpen(false)
		}
	}

	useEffect(() => {
		const scrollElement = workspaceScrollRef.current?.querySelector(
			"[data-slot='scroll-area-viewport']",
		) as HTMLElement

		if (!scrollElement) return

		const handleScroll = () => {
			if (openProjectMenuId) {
				setOpenProjectMenuId(null)
			}
		}

		scrollElement.addEventListener("scroll", handleScroll)
		return () => scrollElement.removeEventListener("scroll", handleScroll)
	}, [openProjectMenuId])

	async function handleCreateWorkspace() {
		const trimmedName = workspaceName.trim()
		if (!trimmedName || isSubmittingWorkspace) return

		setIsSubmittingWorkspace(true)
		try {
			await superMagicService.createWorkspace(trimmedName)
			setIsCreatingWorkspace(false)
			setWorkspaceName("")
			setIsOpen(false)
		} catch (error) {
			console.error("Failed to create workspace in collapsed menu:", error)
		} finally {
			setIsSubmittingWorkspace(false)
		}
	}

	function handleCancelCreateWorkspace() {
		setIsCreatingWorkspace(false)
		setWorkspaceName("")
	}

	return (
		<div
			className="flex shrink-0 flex-col items-center p-2"
			data-testid="sidebar-collapsed-workspace-menu"
		>
			<div className="flex w-8 shrink-0 flex-col items-start gap-1">
				<Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
					<PopoverTrigger asChild>
						<span>
							<SidebarMenuButton
								tooltip={t("sidebar:workspace.title")}
								data-testid="sidebar-collapsed-workspace-menu-button"
								className="text-[#0a0a0a] dark:text-[#fafafa]"
							>
								<Box className="h-4 w-4 shrink-0" />
							</SidebarMenuButton>
						</span>
					</PopoverTrigger>
					<PopoverContent
						side="right"
						align="start"
						className="shadow-xs w-[240px] p-1"
						data-testid="sidebar-collapsed-workspace-popover"
						onEscapeKeyDown={(e) => {
							if (isCreatingWorkspace) {
								e.preventDefault()
							}
						}}
					>
						<div className="flex h-8 items-center rounded-md px-2">
							<span className="truncate text-sm font-medium leading-5 text-sidebar-foreground">
								{t("sidebar:workspace.title")}
							</span>
						</div>
						<button
							type="button"
							className="flex h-8 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
							onClick={() => setIsCreatingWorkspace(true)}
							data-testid="sidebar-collapsed-workspace-add"
						>
							<CirclePlus className="h-4 w-4 shrink-0 text-sidebar-foreground" />
							<span className="flex-1 truncate text-left text-sm leading-5 text-sidebar-foreground">
								{t("sidebar:workspace.add")}
							</span>
						</button>
						<div className="my-1 h-px w-full bg-border" />
						{isCreatingWorkspace && (
							<div className="mb-1">
								<SidebarCreateInput
									value={workspaceName}
									onValueChange={setWorkspaceName}
									onSubmit={handleCreateWorkspace}
									onCancel={handleCancelCreateWorkspace}
									placeholder={t("super:workspace.createWorkspaceTip")}
									disabled={isSubmittingWorkspace}
									inputTestId="sidebar-collapsed-workspace-create-input"
									submitButtonTestId="sidebar-collapsed-workspace-create-submit-button"
									cancelButtonTestId="sidebar-collapsed-workspace-create-cancel-button"
									submitButtonAriaLabel={t("common.confirm")}
									cancelButtonAriaLabel={t("common.cancel")}
									stopKeyboardPropagation
								/>
							</div>
						)}
						{workspaces.length > 0 ? (
							workspaces.length > 10 ? (
								<ScrollArea
									ref={workspaceScrollRef}
									className="h-[60vh] max-h-[500px] w-full [&_[data-slot='scroll-area-viewport']>div]:!block"
								>
									<div className="space-y-1">
										{workspaces.map((workspace) => {
											const isActive = selectedWorkspace?.id === workspace.id
											return (
												<CollapsedWorkspaceMenuWorkspaceItem
													key={workspace.id}
													workspace={workspace}
													isActive={isActive}
													onProjectClick={handleProjectClick}
													openProjectMenuId={openProjectMenuId}
													onProjectMenuChange={setOpenProjectMenuId}
												/>
											)
										})}
									</div>
								</ScrollArea>
							) : (
								<div className="space-y-1">
									{workspaces.map((workspace) => {
										const isActive = selectedWorkspace?.id === workspace.id
										return (
											<CollapsedWorkspaceMenuWorkspaceItem
												key={workspace.id}
												workspace={workspace}
												isActive={isActive}
												onProjectClick={handleProjectClick}
												openProjectMenuId={openProjectMenuId}
												onProjectMenuChange={setOpenProjectMenuId}
											/>
										)
									})}
								</div>
							)
						) : (
							<div
								className="px-2 py-1 text-sm leading-none text-[#a3a3a3]"
								data-testid="sidebar-collapsed-workspace-empty"
							>
								{t("super:workspace.noWorkspaces")}
							</div>
						)}
						<div className="mt-1 border-t border-sidebar-border pt-1">
							<Button
								variant={isShareWorkspaceActive ? "secondary" : "ghost"}
								size="sm"
								className="h-[54px] w-full justify-between px-2"
								data-testid="sidebar-collapsed-workspace-share"
								onClick={() => {
									setIsOpen(false)
									setShareProjectsPanelOpen(true)
								}}
							>
								<div className="flex min-w-0 items-center gap-2">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#171717] dark:bg-[#e5e5e5]">
										<UsersRound className="h-4 w-4 text-white dark:text-[#171717]" />
									</div>
									<div className="min-w-0 text-left">
										<div className="truncate text-sm leading-5 text-[#0a0a0a] dark:text-[#fafafa]">
											{t("super:workspace.shareWorkspaceName")}
										</div>
										<div className="mt-1 truncate text-xs leading-4 text-[#737373] dark:text-[#a3a3a3]">
											{t("super:workspace.teamSharedWorkspaceDesc")}
										</div>
									</div>
								</div>
								<ChevronRight className="ml-1 h-4 w-4 shrink-0" />
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{shareProjectsPanelOpen && (
				<Suspense fallback={null}>
					<CollaborationProjectsPanel
						open={shareProjectsPanelOpen}
						onClose={() => setShareProjectsPanelOpen(false)}
						onCollaborationProjectClick={(project) =>
							superMagicService.switchProjectInDesktop(project)
						}
						workspaces={workspaces}
						selectedWorkspace={selectedWorkspace}
						fetchProjects={(params) => superMagicService.project.fetchProjects(params)}
						fetchWorkspaces={(params) =>
							superMagicService.workspace.fetchWorkspaces(params)
						}
					/>
				</Suspense>
			)}
		</div>
	)
})

export default CollapsedWorkspaceMenu
