import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { Ellipsis } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import SmartTooltip from "@/components/other/SmartTooltip"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import ProjectActionsDropdown from "@/pages/superMagic/components/ProjectActionsDropdown"
import SidebarCreateInput from "./components/SidebarCreateInput"
import useProjectRename from "@/pages/superMagic/hooks/useProjectRename"
import { canManageProject } from "@/pages/superMagic/utils/permission"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import { getWorkspaceProjectRouteUrl } from "@/pages/superMagic/utils/route"
import NavigationStatusIcon from "@/pages/superMagic/components/NavigationStatusIcon"
import ProjectTypeTag, {
	RECENT_PROJECT_LINE_MARK_CLASS_NAME,
	RECENT_PROJECT_MARK_CLASS_NAME,
	RECENT_PROJECT_MARK_SIZE,
} from "@/pages/superMagic/components/ProjectTypeTag"
import { canDragSidebarProject } from "./projectDndUtils"
import { Button } from "@/components/shadcn-ui/button"
import { isAiCanvasProject } from "@/pages/superMagic/utils/isAiCanvasProject"

type ProjectRowActionHandler = (project: ProjectListItem) => void | Promise<void>

interface CollapsedWorkspaceProjectRowProps {
	project: ProjectListItem
	dndDisabled?: boolean
	description?: ReactNode
	tooltipDisabled?: boolean
	/** Collapse the action area until hover/focus so the project content can use the full row width. */
	expandActionsOnHover?: boolean
	workspaceId: string
	isSelected: boolean
	projectMenuContentRef?: React.RefObject<HTMLDivElement | null>
	onSelectProject: (project: ProjectListItem) => void
	onOpenInNewWindow?: ProjectRowActionHandler
	onPinProject?: ProjectRowActionHandler
	onCopyCollaborationLink?: ProjectRowActionHandler
	onTransferProject?: ProjectRowActionHandler
	onMoveProject?: (projectId: string) => void
	onAddCollaborators?: ProjectRowActionHandler
	onCancelWorkspaceShortcut?: ProjectRowActionHandler
	onDeleteProject?: ProjectRowActionHandler
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
	onInteractionChange?: (id: string, active: boolean) => void
	showProjectTypeTag?: boolean
}

function CollapsedWorkspaceProjectRow({
	project,
	dndDisabled,
	description,
	tooltipDisabled = false,
	expandActionsOnHover = false,
	workspaceId,
	isSelected,
	projectMenuContentRef,
	onSelectProject,
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
	showProjectTypeTag = false,
}: CollapsedWorkspaceProjectRowProps) {
	const { t } = useTranslation("super")
	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isRenamePending, setIsRenamePending] = useState(false)
	const suppressProjectItemClickRef = useRef(false)

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

	const blockProjectItemClickTemporarily = () => {
		suppressProjectItemClickRef.current = true
		setTimeout(() => {
			suppressProjectItemClickRef.current = false
		}, 80)
	}

	const handleRenameStart = () => {
		if (!canRename) return
		setIsRenamePending(true)
		setTimeout(() => {
			setIsEditing(true)
			setIsRenamePending(false)
		}, 200)
	}

	const showCollaborationTag =
		isWorkspaceShortcutProject(project) || isCollaborationProject(project)
	const hideNameTooltip = tooltipDisabled || isMenuOpen || isEditing || isRenamePending
	// Recent rows (the only ones with type marks) use one 14px size for every mark; the collapsed
	// workspace menu keeps its 12px marks.
	const markClassName = showProjectTypeTag
		? RECENT_PROJECT_MARK_CLASS_NAME
		: "h-3 w-3 border-0 bg-transparent p-0"
	const lineMarkClassName = showProjectTypeTag
		? RECENT_PROJECT_LINE_MARK_CLASS_NAME
		: "h-3 w-3 border-0 bg-transparent p-0"
	const projectName = project.project_name || t("project.unnamedProject")

	function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
		return (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		)
	}

	const dropdownProps = {
		item: project,
		open: isMenuOpen,
		inCollaborationPanel: false,
		onOpenChange: (open: boolean) => {
			setIsMenuOpen(open)
			if (open) blockProjectItemClickTemporarily()
		},
		onBeforeAction: blockProjectItemClickTemporarily,
		onOpenInNewWindow,
		onPinProject: (targetProject: ProjectListItem) => {
			void onPinProject?.(targetProject)
		},
		onCopyCollaborationLink,
		onTransferProject,
		// AI canvas projects must stay in their dedicated workspace, so they offer no move action.
		onMoveProject: isAiCanvasProject(project) ? undefined : onMoveProject,
		onAddCollaborators,
		onCancelWorkspaceShortcut: (projectId: string, workspaceId?: string) => {
			void onCancelWorkspaceShortcut?.({
				...project,
				id: projectId,
				bind_workspace_id: workspaceId ?? project.bind_workspace_id,
			})
		},
		onDeleteProject,
		placement: "bottomRight" as const,
		getPopupContainer: () => projectMenuContentRef?.current ?? document.body,
	}

	const threeDotTrigger = (
		open: boolean,
		triggerContextMenu?: (e: React.MouseEvent<HTMLElement>) => void,
	) => (
		// Keep the action mounted for coarse pointer desktop layouts so the first tap can open the menu.
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={t("common.moreActions")}
			aria-haspopup="menu"
			aria-expanded={open}
			data-state={open ? "open" : "closed"}
			data-project-more-trigger="true"
			data-workspace-id={workspaceId}
			draggable={false}
			className={cn(
				expandActionsOnHover
					? "relative h-7 w-0 shrink-0 overflow-hidden bg-transparent p-0 transition-[width] before:absolute before:inset-0.5 before:rounded-md before:transition-colors group-focus-within/project-row:pointer-events-auto group-focus-within/project-row:w-7 no-hover:pointer-events-auto no-hover:w-7"
					: "relative size-8 shrink-0 bg-transparent p-0 before:absolute before:inset-0.5 before:rounded-md before:transition-colors",
				"hover:bg-transparent hover:before:bg-sidebar-foreground/10 focus-visible:ring-0 focus-visible:before:bg-sidebar-foreground/10 active:before:bg-sidebar-foreground/15 dark:hover:bg-transparent",
				"data-[state=open]:before:bg-sidebar-foreground/10",
				expandActionsOnHover && (isHovered || open) && "w-7",
				isSelected ? "text-sidebar-accent-foreground" : "text-sidebar-foreground",
			)}
			onClick={(e) => {
				blockProjectItemClickTemporarily()
				e.preventDefault()
				e.stopPropagation()
				triggerContextMenu?.(e)
			}}
			onPointerDown={(e) => {
				blockProjectItemClickTemporarily()
				e.stopPropagation()
			}}
			onMouseDown={(e) => {
				blockProjectItemClickTemporarily()
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
	)

	const renderRow = (
		open: boolean,
		triggerContextMenu?: (e: React.MouseEvent<HTMLElement>) => void,
	) => (
		<div
			className={cn(
				"group/project-row flex min-w-0 items-center focus-within:bg-sidebar-accent hover:bg-sidebar-accent",
				description ? "h-12 w-full rounded-md" : "h-8 w-full rounded-md",
				(isSelected || open) && "bg-sidebar-accent",
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			draggable={canDrag}
			data-collapsed-sidebar-dnd-source={canDrag ? "project" : undefined}
			data-collapsed-sidebar-dnd-workspace-id={workspaceId}
			data-collapsed-sidebar-dnd-project-id={project.id}
			data-collapsed-sidebar-dnd-label={
				canDrag ? project.project_name || t("project.unnamedProject") : undefined
			}
			data-collapsed-sidebar-dnd-drop-type="project"
			onDragStart={blockProjectItemClickTemporarily}
			onDragEnd={blockProjectItemClickTemporarily}
		>
			<a
				href={getWorkspaceProjectRouteUrl(workspaceId, project.id)}
				draggable={false}
				data-testid={`sidebar-collapsed-project-row-${project.id}`}
				className="relative inline-flex h-full min-w-0 flex-1 items-center justify-start gap-0 rounded-md px-2 text-[13px] font-normal leading-[18px] text-current no-underline outline-none [-webkit-tap-highlight-color:transparent] hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
				onClick={(event) => {
					if (isMenuOpen || suppressProjectItemClickRef.current) {
						event.preventDefault()
						event.stopPropagation()
						return
					}
					if (!shouldHandleAnchorClick(event)) return
					event.preventDefault()
					onSelectProject(project)
				}}
			>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<span
							className={cn(
								"min-w-0 max-w-full shrink truncate text-left",
								isSelected
									? "text-sidebar-accent-foreground"
									: "text-sidebar-foreground",
							)}
						>
							{hideNameTooltip ? (
								projectName
							) : (
								<SmartTooltip
									elementType="span"
									className="block text-[13px] leading-[18px]"
								>
									{projectName}
								</SmartTooltip>
							)}
						</span>
						{/* 状态只在运行时显示在名称后，普通项目不再占用一列文件夹图标。 */}
						<NavigationStatusIcon
							itemType="project"
							status={project.project_status}
							showDefaultIcon={false}
						/>
						{showProjectTypeTag && (
							<ProjectTypeTag
								projectMode={project.project_mode}
								tooltipDisabled={hideNameTooltip}
								size={RECENT_PROJECT_MARK_SIZE}
								uniformStroke
							/>
						)}
						{project.is_pinned && <PinnedTag className={markClassName} />}
						{showCollaborationTag && (
							<CollaborationProjectTag
								visible={showCollaborationTag}
								project={project}
								showText={false}
								className={lineMarkClassName}
							/>
						)}
					</div>
					{description && (
						<div className="mt-0.5 min-w-0 text-[11px] leading-4 text-muted-foreground">
							{description}
						</div>
					)}
				</div>
			</a>
			{/* 菜单区与链接并列并始终占位，避免图标出现时移动文字或让点击穿透。 */}
			{threeDotTrigger(open, triggerContextMenu)}
		</div>
	)

	if (isEditing && canRename) {
		return (
			<div
				className="w-full px-2 py-0.5"
				data-testid={`sidebar-collapsed-project-rename-${project.id}`}
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
					inputTestId={`sidebar-collapsed-project-rename-input-${project.id}`}
					submitButtonTestId={`sidebar-collapsed-project-rename-submit-${project.id}`}
					cancelButtonTestId={`sidebar-collapsed-project-rename-cancel-${project.id}`}
					submitButtonAriaLabel={t("common.confirm")}
					cancelButtonAriaLabel={t("common.cancel")}
					stopKeyboardPropagation
				/>
			</div>
		)
	}

	return (
		<ProjectActionsDropdown
			{...dropdownProps}
			trigger={["contextMenu"]}
			rootClassName="w-full"
			onRenameStart={canRename ? handleRenameStart : undefined}
			onRenameProject={canRename ? onRenameProject : undefined}
		>
			{({ open, triggerContextMenu }) => renderRow(open, triggerContextMenu)}
		</ProjectActionsDropdown>
	)
}

export default CollapsedWorkspaceProjectRow
