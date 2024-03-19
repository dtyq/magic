import { useRef, useState, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { Ellipsis } from "lucide-react"
import { cn } from "@/opensource/lib/utils"
import { useTranslation } from "react-i18next"
import projectStore from "@/opensource/pages/superMagic/stores/core/project"
import type { ProjectItemProps } from "./types"
import superMagicService from "@/opensource/pages/superMagic/services"
import { sidebarStore } from "@/opensource/stores/layout/SidebarStore"
import { SidebarMenuSubButton } from "@/opensource/components/shadcn-ui/sidebar"
import {
	isCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/opensource/pages/superMagic/constants"
import CollaborationProjectTag from "@/opensource/pages/superMagic/components/CollaborationProjectTag"
import PinnedTag from "@/opensource/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import ProjectActionsDropdown from "@/opensource/pages/superMagic/components/ProjectActionsDropdown"
import SidebarCreateInput from "../components/SidebarCreateInput"
import useProjectRename from "@/opensource/pages/superMagic/hooks/useProjectRename"
import { canManageProject } from "@/opensource/pages/superMagic/utils/permission"
import { getWorkspaceProjectRouteUrl } from "@/opensource/pages/superMagic/utils/route"

function ProjectItem({
	project,
	onOpenInNewWindow,
	onPinProject,
	onCopyCollaborationLink,
	onTransferProject,
	onMoveProject,
	onAddCollaborators,
	onCancelWorkspaceShortcut,
	onDeleteProject,
	onRenameProject,
}: ProjectItemProps) {
	const { t } = useTranslation("super")
	const isSelected = projectStore.selectedProject?.id === project.id
	const isWorkspaceShortcut = isWorkspaceShortcutProject(project)
	const isCollaborationProjectStatus = isCollaborationProject(project)
	const showCollaborationTag = isWorkspaceShortcut || isCollaborationProjectStatus
	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const suppressItemClickRef = useRef(false)

	const canRename = canManageProject(project.user_role) && !!onRenameProject

	const {
		isEditing,
		setIsEditing,
		editingProjectName,
		handleProjectNameChange,
		handleProjectNameBlur,
	} = useProjectRename({
		item: project,
		onRenameProject: canRename ? onRenameProject : undefined,
	})

	const blockItemClickTemporarily = () => {
		suppressItemClickRef.current = true
		setTimeout(() => {
			suppressItemClickRef.current = false
		}, 0)
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

	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		if (isMenuOpen || suppressItemClickRef.current || isEditing) {
			event.stopPropagation()
			return
		}

		const target = event.target as HTMLElement
		if (target.closest("[data-project-more-trigger='true']")) {
			event.stopPropagation()
			return
		}

		if (!shouldHandleAnchorClick(event)) return
		event.preventDefault()
		superMagicService.switchProjectById(project.id)
		sidebarStore.collapseIfNarrow()
	}

	const handleRenameStart = () => {
		if (!canRename) return
		setTimeout(() => {
			setIsEditing(true)
		}, 200)
	}

	if (isEditing && canRename) {
		return (
			<div
				className="w-full px-2 py-0.5"
				data-testid={`sidebar-project-rename-${project.id}`}
			>
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
					inputTestId={`sidebar-project-rename-input-${project.id}`}
					submitButtonTestId={`sidebar-project-rename-submit-${project.id}`}
					cancelButtonTestId={`sidebar-project-rename-cancel-${project.id}`}
					submitButtonAriaLabel={t("common.confirm")}
					cancelButtonAriaLabel={t("common.cancel")}
					stopKeyboardPropagation
				/>
			</div>
		)
	}

	return (
		<ProjectActionsDropdown
			item={project}
			open={isMenuOpen}
			inCollaborationPanel={false}
			onOpenChange={(open) => {
				setIsMenuOpen(open)
				if (open) {
					blockItemClickTemporarily()
				}
			}}
			onBeforeAction={blockItemClickTemporarily}
			onOpenInNewWindow={onOpenInNewWindow}
			onPinProject={
				onPinProject
					? (targetProject) => {
							onPinProject(targetProject)
						}
					: undefined
			}
			onCopyCollaborationLink={onCopyCollaborationLink}
			onTransferProject={onTransferProject}
			onMoveProject={onMoveProject}
			onAddCollaborators={onAddCollaborators}
			onCancelWorkspaceShortcut={
				onCancelWorkspaceShortcut
					? (projectId, workspaceId) => {
							onCancelWorkspaceShortcut({
								...project,
								id: projectId,
								bind_workspace_id: workspaceId ?? project.bind_workspace_id,
							})
						}
					: undefined
			}
			onDeleteProject={onDeleteProject}
			onRenameStart={canRename ? handleRenameStart : undefined}
			onRenameProject={canRename ? onRenameProject : undefined}
			trigger={["contextMenu"]}
			placement="bottomRight"
			rootClassName="w-full"
		>
			{({ open, triggerContextMenu }) => (
				<SidebarMenuSubButton
					asChild
					size="md"
					isActive={isSelected}
					className={cn("h-7 px-2", isSelected && "bg-[#f5f5f5] dark:bg-[#262626]")}
				>
					<a
						href={getWorkspaceProjectRouteUrl(project.workspace_id, project.id)}
						onClick={handleClick}
						data-testid={`sidebar-project-item-${project.id}`}
						onMouseEnter={() => setIsHovered(true)}
						onMouseLeave={() => setIsHovered(false)}
						className="w-full min-w-0 text-left text-current no-underline"
					>
						<div className="flex w-full min-w-0 items-center">
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 max-w-full items-center gap-1.5">
									<span
										className={cn(
											"min-w-0 max-w-full truncate text-left text-sm leading-5",
											isSelected
												? "text-[#171717] dark:text-[#f0f0f0]"
												: "text-[#0a0a0a] dark:text-[#fafafa]",
										)}
									>
										{project.project_name || t("project.unnamedProject")}
									</span>
									{project.is_pinned && <PinnedTag />}
									{showCollaborationTag && (
										<CollaborationProjectTag
											visible={showCollaborationTag}
											project={project}
											showText={false}
										/>
									)}
								</div>
							</div>
							<div
								data-project-more-trigger="true"
								className={cn(
									"ml-1 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-sidebar-foreground transition-opacity hover:bg-sidebar-accent",
									isHovered || open
										? "opacity-100"
										: "pointer-events-none opacity-0",
								)}
								onClick={(e) => {
									blockItemClickTemporarily()
									e.preventDefault()
									e.stopPropagation()
									triggerContextMenu(e)
								}}
								onMouseDown={(e) => {
									blockItemClickTemporarily()
									e.stopPropagation()
								}}
							>
								<Ellipsis className="h-4 w-4" />
							</div>
						</div>
					</a>
				</SidebarMenuSubButton>
			)}
		</ProjectActionsDropdown>
	)
}

export default observer(ProjectItem)
