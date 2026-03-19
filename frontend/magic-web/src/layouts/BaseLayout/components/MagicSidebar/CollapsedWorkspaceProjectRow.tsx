import { useRef, useState, type MouseEvent } from "react"
import { Ellipsis, FolderDot } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import {
	isCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import ProjectActionsDropdown from "@/pages/superMagic/components/ProjectActionsDropdown"
import SidebarCreateInput from "./components/SidebarCreateInput"
import useProjectRename from "@/pages/superMagic/hooks/useProjectRename"
import { canManageProject } from "@/pages/superMagic/utils/permission"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import { getWorkspaceProjectRouteUrl } from "@/pages/superMagic/utils/route"

type ProjectRowActionHandler = (project: ProjectListItem) => void | Promise<void>

interface CollapsedWorkspaceProjectRowProps {
	project: ProjectListItem
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
}

function CollapsedWorkspaceProjectRow({
	project,
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
}: CollapsedWorkspaceProjectRowProps) {
	const { t } = useTranslation("super")
	const [isHovered, setIsHovered] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const suppressProjectItemClickRef = useRef(false)

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

	const blockProjectItemClickTemporarily = () => {
		suppressProjectItemClickRef.current = true
		setTimeout(() => {
			suppressProjectItemClickRef.current = false
		}, 80)
	}

	const handleRenameStart = () => {
		if (!canRename) return
		setTimeout(() => {
			setIsEditing(true)
		}, 200)
	}

	const showCollaborationTag =
		isWorkspaceShortcutProject(project) || isCollaborationProject(project)

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
		onMoveProject,
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
		<div
			data-project-more-trigger="true"
			data-workspace-id={workspaceId}
			className={cn(
				"flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:bg-sidebar-accent",
				isSelected ? "text-sidebar-accent-foreground" : "text-sidebar-foreground",
				isHovered || open ? "opacity-100" : "pointer-events-none opacity-0",
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
			<Ellipsis className="h-4 w-4" />
		</div>
	)

	const renderRow = (
		open: boolean,
		triggerContextMenu?: (e: React.MouseEvent<HTMLElement>) => void,
	) => (
		<Button
			asChild
			variant="ghost"
			size="sm"
			data-testid={`sidebar-collapsed-project-row-${project.id}`}
			className={cn(
				"h-8 w-full justify-start gap-2 px-2 text-sm leading-5 hover:bg-sidebar-accent",
				isSelected && "bg-sidebar-accent",
			)}
		>
			<a
				href={getWorkspaceProjectRouteUrl(workspaceId, project.id)}
				className="text-current no-underline"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				onClick={(event) => {
					if (isMenuOpen || suppressProjectItemClickRef.current) {
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
					onSelectProject(project)
				}}
			>
				<FolderDot
					className={cn(
						"h-4 w-4 shrink-0",
						isSelected ? "text-sidebar-accent-foreground" : "text-sidebar-foreground",
					)}
				/>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 max-w-full items-center gap-1.5">
						<span
							className={cn(
								"min-w-0 max-w-full truncate text-left",
								isSelected
									? "text-sidebar-accent-foreground"
									: "text-sidebar-foreground",
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
				{threeDotTrigger(open, triggerContextMenu)}
			</a>
		</Button>
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
