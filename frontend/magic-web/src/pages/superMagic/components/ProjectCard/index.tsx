import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Ellipsis, ChevronsUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { ProjectCardProps, SeparatorProps } from "./types"
import { IconShare3 } from "@tabler/icons-react"
import { Button } from "@/components/shadcn-ui/button"
import PinnedTag from "../EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "../CollaborationProjectTag"
import { isCollaborationProject } from "../../constants"
import { canManageProject, isReadOnlyProject } from "../../utils/permission"
import ProjectCardDropdown from "./components/ProjectCardDropdown"
import ProjectCardShareSection from "./components/ProjectCardShareSection"
import IconWorkspaceProjectFolder from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import ProjectActionsDropdown from "../ProjectActionsDropdown"
import useProjectItemActionProps from "../EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import useProjectRename from "../../hooks/useProjectRename"
import SidebarCreateInput from "@/layouts/BaseLayout/components/MagicSidebar/components/SidebarCreateInput"
import { useNavigateToSuperHome } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useNavigateToSuperHome"
import { openProjectInNewTab } from "../../utils/project"
import type { CollaborationProjectListItem, ProjectListItem } from "../../pages/Workspace/types"

/**
 * Separator component for dividing sections
 */
function Separator({ orientation = "horizontal", className }: SeparatorProps) {
	return (
		<div
			className={cn(
				"shrink-0 bg-border",
				orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
				className,
			)}
		/>
	)
}

/**
 * ProjectCard component displays project information, collaboration status, and actions
 * Based on Figma design: node-id=436-43761
 */
function ProjectCard({
	project: selectedProject,
	workspaceName,
	collaborators: collaboratorText,
	onWorkspaceHomeClick,
	onShareClick,
	onDropdownClick,
	onInviteClick,
	projectOptions = [],
	showCreateProject = true,
	enableWorkspaceNavigation = false,
	onProjectMenuOpenChange,
	actionWorkspace,
	className,
}: ProjectCardProps) {
	const { t } = useTranslation("super")
	const collaboratorContent = collaboratorText ?? t("collaborators.empty")
	const projectMenuContentRef = useRef<HTMLDivElement>(null)
	const [isExpanded, setIsExpanded] = useState(false)
	const [isWorkspaceHomeHovered, setIsWorkspaceHomeHovered] = useState(false)
	const suppressProjectSelectorClickRef = useRef(false)

	const isCollaborationProjectStatus = isCollaborationProject(selectedProject)
	const canShare = !isReadOnlyProject(selectedProject?.user_role)
	const canManage = canManageProject(selectedProject?.user_role)
	const { superRouteUrl } = useNavigateToSuperHome()
	const projectName = selectedProject.project_name || t("project.unnamedProject")
	const projectTitle = isWorkspaceHomeHovered ? t("assistant.backToWorkspace") : projectName

	const {
		handleProjectClick,
		handleMoveProject,
		handleTransferProject,
		handleDeleteProjectConfirm,
		handleTogglePinProject,
		handlePinProject,
		onAddCollaborators,
		handleCopyCollaborationLink,
		handleCancelWorkspaceShortcutByProject,
		handleRenameProject,
		projectModals,
	} = useProjectItemActionProps({
		selectedWorkspace: actionWorkspace,
	})

	const canRename = canManage && !!handleRenameProject

	const {
		isEditing,
		setIsEditing,
		editingProjectName,
		handleProjectNameChange,
		handleProjectNameBlur,
	} = useProjectRename({
		item: selectedProject,
		onRenameProject: canRename ? handleRenameProject : undefined,
	})

	const blockSelectorClickTemporarily = useCallback(() => {
		suppressProjectSelectorClickRef.current = true
		setTimeout(() => {
			suppressProjectSelectorClickRef.current = false
		}, 0)
	}, [])

	const handleRenameStart = useCallback(() => {
		if (!canRename) return
		setTimeout(() => setIsEditing(true), 200)
	}, [canRename, setIsEditing])

	const cancelShortcutFn = handleCancelWorkspaceShortcutByProject as
		| ((project: ProjectListItem | CollaborationProjectListItem) => void | Promise<void>)
		| undefined

	const handleCancelWorkspaceShortcutForMenu = cancelShortcutFn
		? (projectId: string, workspaceId?: string) => {
				void cancelShortcutFn({
					...selectedProject,
					id: projectId,
					bind_workspace_id: workspaceId ?? selectedProject.bind_workspace_id,
				})
			}
		: undefined

	useEffect(() => {
		onProjectMenuOpenChange?.(isExpanded)
	}, [isExpanded, onProjectMenuOpenChange])

	const handleDropdownClose = useCallback(() => {
		setIsExpanded(false)
		onDropdownClick?.()
	}, [onDropdownClick])

	const handleToggleExpand = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			setIsExpanded((prev) => !prev)
			onDropdownClick?.()
		},
		[onDropdownClick],
	)

	const handleWorkspaceHomeMouseEnter = useCallback(() => {
		setIsWorkspaceHomeHovered(true)
	}, [])

	const handleWorkspaceHomeMouseLeave = useCallback(() => {
		setIsWorkspaceHomeHovered(false)
	}, [])

	const handleProjectSelectorClick = useCallback(
		(event: React.MouseEvent<HTMLAnchorElement>) => {
			event.preventDefault()
			if (suppressProjectSelectorClickRef.current || isEditing) return
			onWorkspaceHomeClick?.()
		},
		[isEditing, onWorkspaceHomeClick],
	)

	if (isEditing) {
		return (
			<div
				className={cn(
					"relative flex w-full flex-col items-center rounded-lg border border-border bg-background transition-all duration-300",
					className,
				)}
				data-testid="project-card"
			>
				<div className="w-full p-2" data-testid="project-card-rename">
					<SidebarCreateInput
						value={editingProjectName}
						onValueChange={(v) =>
							handleProjectNameChange({
								target: { value: v },
							} as React.ChangeEvent<HTMLInputElement>)
						}
						onSubmit={async () => {
							await handleProjectNameBlur()
						}}
						onCancel={() => setIsEditing(false)}
						placeholder={t("project.unnamedProject")}
						inputTestId="project-card-rename-input"
						submitButtonTestId="project-card-rename-submit"
						cancelButtonTestId="project-card-rename-cancel"
						submitButtonAriaLabel={t("common.confirm")}
						cancelButtonAriaLabel={t("common.cancel")}
						stopKeyboardPropagation
					/>
				</div>
				{projectModals}
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative flex w-full flex-col items-center rounded-lg border border-border bg-background transition-all duration-300",
				!isExpanded && "overflow-hidden",
				isExpanded && "z-20",
				className,
			)}
			data-testid="project-card"
		>
			{/* Project Selector Section */}
			<div
				className={cn(
					"flex w-full shrink-0 items-center gap-2 overflow-hidden p-2",
					isExpanded && "relative z-50 mb-1 rounded-lg bg-background",
				)}
			>
				<a
					href={superRouteUrl}
					className="flex min-w-0 grow items-center gap-2 overflow-hidden rounded-md p-0 text-left"
					onClick={handleProjectSelectorClick}
					onMouseEnter={handleWorkspaceHomeMouseEnter}
					onMouseLeave={handleWorkspaceHomeMouseLeave}
					onFocus={handleWorkspaceHomeMouseEnter}
					onBlur={handleWorkspaceHomeMouseLeave}
					data-testid="project-selector"
				>
					<div
						className={cn(
							"flex size-8 shrink-0 items-center justify-center rounded-lg p-2.5 transition-colors",
							isWorkspaceHomeHovered
								? "bg-secondary text-foreground"
								: "bg-yellow-300/20",
						)}
					>
						{isWorkspaceHomeHovered ? (
							<ArrowLeft size={16} className="shrink-0" />
						) : (
							<IconWorkspaceProjectFolder size={16} isHovered={false} />
						)}
					</div>

					<div className="flex min-w-0 grow flex-col items-start justify-center gap-0.5 rounded-md transition-colors">
						<div className="flex w-full items-center gap-1">
							<p className="truncate text-sm font-medium leading-5 text-foreground">
								{projectTitle}
							</p>
							{!isWorkspaceHomeHovered && selectedProject.is_pinned && <PinnedTag />}
							{!isWorkspaceHomeHovered && (
								<CollaborationProjectTag
									visible={isCollaborationProjectStatus}
									project={selectedProject}
									showText={false}
								/>
							)}
						</div>

						<p className="truncate text-xs leading-4 text-muted-foreground">
							{workspaceName}
						</p>
					</div>
				</a>

				{/* Action Icons */}
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="outline"
						size="icon"
						className="h-7 w-7 shadow-xs"
						onClick={handleToggleExpand}
						data-testid="dropdown-button"
					>
						<ChevronsUpDown size={16} className="text-foreground" />
					</Button>

					{/* Share Icon */}
					{canShare && (
						<Button
							variant="outline"
							size="icon"
							className="h-7 w-7 shadow-xs"
							onClick={onShareClick}
							data-testid="share-button"
						>
							<IconShare3 size={16} className="text-foreground" />
						</Button>
					)}

					<ProjectActionsDropdown
						item={selectedProject}
						inCollaborationPanel={false}
						trigger={["click"]}
						placement="bottomRight"
						onOpenChange={(open) => {
							if (open) blockSelectorClickTemporarily()
						}}
						onBeforeAction={blockSelectorClickTemporarily}
						onOpenInNewWindow={openProjectInNewTab}
						onPinProject={handlePinProject}
						onCopyCollaborationLink={handleCopyCollaborationLink}
						onTransferProject={handleTransferProject}
						onMoveProject={handleMoveProject}
						onAddCollaborators={onAddCollaborators}
						onCancelWorkspaceShortcut={handleCancelWorkspaceShortcutForMenu}
						onDeleteProject={handleDeleteProjectConfirm}
						onRenameStart={canRename ? handleRenameStart : undefined}
						onRenameProject={canRename ? handleRenameProject : undefined}
					>
						<span>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="h-7 w-7 shadow-xs"
								aria-label={t("common.moreActions")}
								data-testid="project-card-more-button"
							>
								<Ellipsis size={16} className="text-foreground" />
							</Button>
						</span>
					</ProjectActionsDropdown>
				</div>
			</div>

			<ProjectCardDropdown
				isExpanded={isExpanded}
				enableWorkspaceNavigation={enableWorkspaceNavigation}
				onClose={handleDropdownClose}
				selectedProject={selectedProject}
				projectOptions={projectOptions}
				showCreateProject={showCreateProject}
				actionWorkspace={actionWorkspace}
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
				handleProjectClick={handleProjectClick}
			/>

			{canManage && !isExpanded && (
				<ProjectCardShareSection
					collaboratorContent={collaboratorContent}
					onInviteClick={onInviteClick}
				/>
			)}

			{projectModals}
		</div>
	)
}

export default ProjectCard
export { Separator }
export type { ProjectCardProps, SeparatorProps }
