import { useChatSidebarSelection } from "../hooks/useChatSidebarSelection"
import { useEffect, useRef, useState, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { Ellipsis } from "lucide-react"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import projectStore from "@/pages/superMagic/stores/core/project"
import type { ProjectItemProps } from "./types"
import superMagicService from "@/pages/superMagic/services"
import { SidebarMenuSubButton } from "@/components/shadcn-ui/sidebar"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import ProjectActionsDropdown from "@/pages/superMagic/components/ProjectActionsDropdown"
import SidebarCreateInput from "../components/SidebarCreateInput"
import useProjectRename from "@/pages/superMagic/hooks/useProjectRename"
import { canManageProject } from "@/pages/superMagic/utils/permission"
import { getWorkspaceProjectRouteUrl } from "@/pages/superMagic/utils/route"
import { preloadProjectPage } from "@/pages/superMagic/pages/ProjectPage/utils"
import { preloadTopicPage } from "@/pages/superMagic/pages/TopicPage/utils"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import { canDragSidebarProject } from "../projectDndUtils"
import { Button } from "@/components/shadcn-ui/button"

function ProjectItem({
	project,
	dndDisabled,
	onOpenInNewWindow,
	onPinProject,
	onCopyCollaborationLink,
	onTransferProject,
	onMoveProject,
	onAddCollaborators,
	onCancelWorkspaceShortcut,
	onDeleteProject,
	onRenameProject,
	onInteractionChange,
}: ProjectItemProps) {
	const { t } = useTranslation("super")
	const { isChatRoute } = useChatSidebarSelection()
	const isSelected = !isChatRoute && projectStore.selectedProject?.id === project.id
	const isWorkspaceShortcut = isWorkspaceShortcutProject(project)
	const isCollaborationProjectStatus = isCollaborationProject(project)
	const showCollaborationTag = isWorkspaceShortcut || isCollaborationProjectStatus
	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isRenamePending, setIsRenamePending] = useState(false)
	const suppressItemClickRef = useRef(false)

	const canRename = canManageProject(project.user_role) && !!onRenameProject
	const canDrag = canDragSidebarProject(project, dndDisabled)
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

	useEffect(() => {
		onInteractionChange?.(project.id, isMenuOpen || isEditing || isRenamePending)
	}, [project.id, isMenuOpen, isEditing, isRenamePending, onInteractionChange])
	useEffect(
		() => () => onInteractionChange?.(project.id, false),
		[project.id, onInteractionChange],
	)

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
			event.preventDefault()
			event.stopPropagation()
			return
		}

		if (!shouldHandleAnchorClick(event)) return
		event.preventDefault()
		superMagicService.switchProjectById(project.id)
		// sidebarStore.collapseIfNarrow()
	}

	function handlePreloadPage() {
		void preloadProjectPage()
		void preloadTopicPage()
	}

	const handleRenameStart = () => {
		if (!canRename) return
		setIsRenamePending(true)
		setTimeout(() => {
			setIsEditing(true)
			setIsRenamePending(false)
		}, 200)
	}

	if (isEditing && canRename) {
		return (
			<div className="w-full pr-2" data-testid={`sidebar-project-rename-${project.id}`}>
				<SidebarCreateInput
					inputClassName="px-2"
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
				<div
					className={cn(
						"group/project-row flex h-8 w-full min-w-0 items-center rounded-md focus-within:bg-sidebar-accent hover:bg-sidebar-accent",
						isSelected && "bg-[#f5f5f5] dark:bg-[#262626]",
						open && "bg-sidebar-accent",
					)}
					onMouseEnter={() => {
						setIsHovered(true)
						handlePreloadPage()
					}}
					onMouseLeave={() => setIsHovered(false)}
					draggable={canDrag}
					data-sidebar-dnd-source={canDrag ? "project" : undefined}
					data-sidebar-dnd-workspace-id={canDrag ? project.workspace_id : undefined}
					data-sidebar-dnd-project-id={canDrag ? project.id : undefined}
					data-sidebar-dnd-label={
						canDrag ? project.project_name || t("project.unnamedProject") : undefined
					}
					data-sidebar-drop-type="project"
					data-sidebar-drop-workspace-id={project.workspace_id}
					data-sidebar-drop-project-id={project.id}
					onDragStart={() => {
						suppressItemClickRef.current = true
					}}
					onDragEnd={() => {
						window.setTimeout(() => {
							suppressItemClickRef.current = false
						}, 0)
					}}
				>
					<SidebarMenuSubButton
						asChild
						size="md"
						isActive={isSelected}
						className="relative h-8 min-w-0 flex-1 translate-x-0 px-2 font-normal"
					>
						<a
							href={getWorkspaceProjectRouteUrl(project.workspace_id, project.id)}
							onClick={handleClick}
							draggable={false}
							data-testid={`sidebar-project-item-${project.id}`}
							onFocus={handlePreloadPage}
							className="min-w-0 text-left text-current no-underline [-webkit-tap-highlight-color:transparent]"
						>
							<div className="flex w-full min-w-0 items-center">
								<div className="flex min-w-0 flex-1 items-center gap-1.5">
									<span
										className={cn(
											"min-w-0 max-w-full shrink truncate text-left text-[13px] leading-5",
											isSelected
												? "text-sidebar-accent-foreground"
												: "text-sidebar-foreground",
										)}
									>
										{project.project_name || t("project.unnamedProject")}
									</span>
									{/* 普通项目直接显示名称；运行状态放在名称后，状态变化不移动文字起点。 */}
									<NavigationStatusIcon
										itemType="project"
										status={project.project_status}
										showDefaultIcon={false}
									/>
									{project.is_pinned && (
										<PinnedTag className="h-3 w-3 border-0 bg-transparent p-0" />
									)}
									{showCollaborationTag && (
										<CollaborationProjectTag
											visible={showCollaborationTag}
											project={project}
											showText={false}
											className="h-3 w-3 border-0 bg-transparent p-0"
										/>
									)}
								</div>
							</div>
						</a>
					</SidebarMenuSubButton>
					{/* 默认不占标题宽度；hover、键盘聚焦或菜单打开时再从右侧展开操作按钮。 */}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("common.moreActions")}
						aria-haspopup="menu"
						aria-expanded={open}
						data-state={open ? "open" : "closed"}
						data-project-more-trigger="true"
						draggable={false}
						className={cn(
							"relative h-7 w-0 shrink-0 overflow-hidden bg-transparent p-0 text-sidebar-foreground transition-[width] before:absolute before:inset-0.5 before:rounded-md before:transition-colors group-focus-within/project-row:w-7 no-hover:w-7",
							"hover:bg-transparent hover:before:bg-sidebar-foreground/10 focus-visible:ring-0 focus-visible:before:bg-sidebar-foreground/10 active:before:bg-sidebar-foreground/15 dark:hover:bg-transparent",
							"data-[state=open]:before:bg-sidebar-foreground/10",
							(isHovered || open) && "w-7",
						)}
						onClick={(e) => {
							blockItemClickTemporarily()
							e.preventDefault()
							e.stopPropagation()
							triggerContextMenu(e)
						}}
						onPointerDown={(e) => {
							blockItemClickTemporarily()
							e.stopPropagation()
						}}
						onMouseDown={(e) => {
							blockItemClickTemporarily()
							e.stopPropagation()
						}}
					>
						<Ellipsis
							className={cn(
								"relative h-4 w-4 transition-opacity group-focus-within/project-row:opacity-100 no-hover:opacity-100",
								isHovered || open ? "opacity-100" : "opacity-0",
							)}
						/>
					</Button>
				</div>
			)}
		</ProjectActionsDropdown>
	)
}

export default observer(ProjectItem)
