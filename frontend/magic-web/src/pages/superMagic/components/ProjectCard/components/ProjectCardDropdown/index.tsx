import { useCallback, useState } from "react"
import { CirclePlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import CollapsedWorkspaceProjectRow from "@/layouts/BaseLayout/components/MagicSidebar/CollapsedWorkspaceProjectRow"
import CreateProjectInput from "@/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/CreateProjectInput"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import { AnimatePresence, motion } from "framer-motion"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { ProjectCardDropdownProps } from "./types"

/**
 * Dropdown panel for switching/creating projects within a workspace.
 * Renders an overlay and animated expandable panel with project list.
 * Uses useProjectItemActionProps internally for all project actions.
 */
function ProjectCardDropdown({
	isExpanded,
	onClose,
	selectedProject,
	projectOptions,
	showCreateProject,
	actionWorkspace,
	projectMenuContentRef,
}: ProjectCardDropdownProps) {
	const { t } = useTranslation("super")
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const workspaceId = actionWorkspace?.id || ""
	const shouldLimitProjectListHeight = projectOptions.length > 8

	const {
		projectModals,
		handleProjectClick,
		handleMoveProject,
		handleTransferProject,
		handleDeleteProjectConfirm,
		handleTogglePinProject,
		onAddCollaborators,
		handleCopyCollaborationLink,
		handleCancelWorkspaceShortcutByProject,
		handleRenameProject,
	} = useProjectItemActionProps({
		selectedWorkspace: actionWorkspace,
	})

	const handleSelectProject = useCallback(
		(project: ProjectListItem) => {
			handleProjectClick(project)
			onClose()
		},
		[handleProjectClick, onClose],
	)

	const handleCreateProjectInputShow = useCallback(() => {
		if (!workspaceId) return
		setIsCreatingProject(true)
	}, [workspaceId])

	const handleCancelCreateProject = useCallback(() => {
		setIsCreatingProject(false)
	}, [])

	const handleCreateProjectSuccess = useCallback(() => {
		setIsCreatingProject(false)
	}, [])

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
								height: "calc(100vh - 72px)",
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
							className="absolute left-[-1px] right-[-1px] top-[55px] z-50 flex flex-col overflow-hidden rounded-b-lg border border-t-0 border-border bg-background"
						>
							<div className="flex h-full flex-col gap-2 p-2">
								{showCreateProject && (
									<>
										<Button
											className="w-full bg-primary p-2 text-primary-foreground"
											onClick={handleCreateProjectInputShow}
											disabled={isCreatingProject}
										>
											<CirclePlus size={16} />
											<span className="text-sm font-medium">
												{t("project.addProject")}
											</span>
										</Button>
										<div className="h-[1px] w-full shrink-0 bg-border" />
									</>
								)}
								<ScrollArea
									className={cn(
										showCreateProject
											? "h-[calc(100%-76px)] flex-1"
											: "h-full flex-1",
									)}
								>
									{showCreateProject && isCreatingProject && (
										<div className="flex h-10 w-full items-center justify-center duration-150 animate-in fade-in slide-in-from-top-2">
											<CreateProjectInput
												workspaceId={workspaceId}
												onCancel={handleCancelCreateProject}
												onCreated={handleCreateProjectSuccess}
											/>
										</div>
									)}
									{projectOptions.length > 0 ? (
										projectOptions.map((project, index, array) => {
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
														workspaceId={workspaceId}
														isSelected={isSelected}
														projectMenuContentRef={
															projectMenuContentRef
														}
														onOpenInNewWindow={openProjectInNewTab}
														onPinProject={handleTogglePinProject}
														onCopyCollaborationLink={
															handleCopyCollaborationLink
														}
														onTransferProject={handleTransferProject}
														onMoveProject={handleMoveProject}
														onAddCollaborators={onAddCollaborators}
														onCancelWorkspaceShortcut={
															handleCancelWorkspaceShortcutByProject
														}
														onDeleteProject={handleDeleteProjectConfirm}
														onRenameProject={handleRenameProject}
														onSelectProject={handleSelectProject}
													/>
												</div>
											)
										})
									) : (
										<div className="h-8 px-2 text-sm leading-8 text-muted-foreground">
											{t("project.noProjects")}
										</div>
									)}
								</ScrollArea>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
			{projectModals}
		</>
	)
}

export default ProjectCardDropdown
export type { ProjectCardDropdownProps }
