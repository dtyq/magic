import { useCallback, useEffect, useRef, useState } from "react"
import { Folder, ChevronsUpDown } from "lucide-react"
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
	onProjectClick,
	onShareClick,
	onDropdownClick,
	onInviteClick,
	projectOptions = [],
	showCreateProject = true,
	onProjectMenuOpenChange,
	actionWorkspace,
	className,
}: ProjectCardProps) {
	const { t } = useTranslation("super")
	const collaboratorContent = collaboratorText ?? t("collaborators.empty")
	const projectMenuContentRef = useRef<HTMLDivElement>(null)
	const [isExpanded, setIsExpanded] = useState(false)
	const isCollaborationProjectStatus = isCollaborationProject(selectedProject)
	const canShare = !isReadOnlyProject(selectedProject?.user_role)
	const canManage = canManageProject(selectedProject?.user_role)

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

	return (
		<div
			className={cn(
				"relative flex w-full flex-col items-center rounded-lg border border-border bg-background transition-all duration-300",
				!isExpanded && "overflow-hidden",
				isExpanded && "z-20 rounded-b-none",
				className,
			)}
		>
			{/* Project Selector Section */}
			<div
				className={cn(
					"flex w-full shrink-0 cursor-pointer items-center gap-2 overflow-hidden p-2 hover:bg-accent",
					isExpanded && "relative z-50 rounded-t-lg bg-background",
				)}
				onClick={(e) => {
					onProjectClick?.()
					handleToggleExpand(e)
				}}
				data-testid="project-selector"
			>
				{/* Project Icon - dark container in both modes for icon contrast */}
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#171717] p-2.5 dark:bg-neutral-700">
					<Folder size={16} className="flex-shrink-0 text-white" />
				</div>

				{/* Project Info Stack */}
				<div className="flex min-w-0 grow flex-col items-start justify-center gap-0.5">
					{/* Project Header Row */}
					<div className="flex w-full items-center gap-1">
						<p className="truncate text-sm font-medium leading-5 text-foreground">
							{selectedProject.project_name || t("project.unnamedProject")}
						</p>
						{selectedProject.is_pinned && <PinnedTag />}
						<CollaborationProjectTag
							visible={isCollaborationProjectStatus}
							project={selectedProject}
							showText={false}
						/>
					</div>

					{/* Workspace Name */}
					<p className="truncate text-xs leading-4 text-muted-foreground">
						{workspaceName}
					</p>
				</div>

				{/* Action Icons */}
				<div className="flex shrink-0 items-center gap-2">
					{/* Share Icon */}
					{canShare && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onPointerDown={(e) => {
								e.stopPropagation()
							}}
							onClick={(e) => {
								e.stopPropagation()
								onShareClick?.()
							}}
							data-testid="share-button"
						>
							<IconShare3 size={16} className="text-foreground" />
						</Button>
					)}

					{/* Dropdown Icon */}
					<button
						type="button"
						className="flex size-4 items-center justify-center hover:opacity-70"
						onClick={handleToggleExpand}
						data-testid="dropdown-button"
					>
						<ChevronsUpDown size={16} className="text-foreground" />
					</button>
				</div>
			</div>

			<ProjectCardDropdown
				isExpanded={isExpanded}
				onClose={handleDropdownClose}
				selectedProject={selectedProject}
				projectOptions={projectOptions}
				showCreateProject={showCreateProject}
				actionWorkspace={actionWorkspace}
				projectMenuContentRef={projectMenuContentRef}
			/>

			{canManage && (
				<ProjectCardShareSection
					collaboratorContent={collaboratorContent}
					onInviteClick={onInviteClick}
				/>
			)}
		</div>
	)
}

export default ProjectCard
export { Separator }
export type { ProjectCardProps, SeparatorProps }
