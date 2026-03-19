import { isCommercial } from "@/utils/env"
import { IconLink, IconUsersPlus, IconLayersLinked } from "@tabler/icons-react"
import { MenuProps } from "antd"
import { TFunction } from "i18next"
import {
	ExternalLink,
	PinOff,
	Pin,
	PenLine,
	FolderInput,
	UserRoundPlus,
	ArrowRightLeft,
	Trash2,
} from "lucide-react"
import { isCollaborationProject, isWorkspaceShortcutProject } from "../../constants"
import { isOwner, canManageProject } from "../../utils/permission"
import { ProjectItemLike, ProjectActionHandlers, ProjectActionMenuKey } from "./types"
import { normalizeVisibleMenuItems } from "./utils"

interface BuildProjectActionMenuItemsParams<
	T extends ProjectItemLike,
> extends ProjectActionHandlers<T> {
	item: T
	t: TFunction
	inCollaborationPanel: boolean
}

export function buildProjectActionMenuItems<T extends ProjectItemLike>({
	item,
	t,
	inCollaborationPanel,
	onRenameStart,
	onRenameProject,
	onDeleteProject,
	onMoveProject,
	onPinProject,
	onAddCollaborators,
	onAddWorkspaceShortcut,
	onCancelWorkspaceShortcut,
	onShortcutNavigateToWorkspace,
	onCopyCollaborationLink,
	onTransferProject,
}: BuildProjectActionMenuItemsParams<T>): Exclude<MenuProps["items"], undefined> {
	const isCollaborationProjectStatus = isCollaborationProject(item)
	const isOwnerStatus = isOwner(item.user_role)
	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(item)
	const hasBoundWorkspace = Boolean(item.bind_workspace_id && item.bind_workspace_id !== "0")

	return normalizeVisibleMenuItems([
		{
			key: ProjectActionMenuKey.OpenInNewWindow,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-open-new-window"
				>
					<ExternalLink className="text-foreground" />
					<span>{t("project.openInNewWindow")}</span>
				</div>
			),
			visible: true,
		},
		{
			key: ProjectActionMenuKey.Pin,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-pin"
					data-pinned={item.is_pinned}
				>
					{item.is_pinned ? (
						<PinOff className="text-foreground" />
					) : (
						<Pin className="text-foreground" />
					)}
					<span>{item.is_pinned ? t("project.unpin") : t("project.pin")}</span>
				</div>
			),
			visible: !!onPinProject,
		},
		{
			type: "divider",
			visible: true,
		},
		{
			key: ProjectActionMenuKey.Rename,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-rename"
				>
					<PenLine className="text-foreground" />
					<span>{t("project.rename")}</span>
				</div>
			),
			visible: !!onRenameStart && !!onRenameProject && !isWorkspaceShortcutProjectStatus,
		},
		{
			key: ProjectActionMenuKey.MoveTo,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-move-to"
				>
					<FolderInput className="text-foreground" />
					<span>{t("project.moveTo")}</span>
				</div>
			),
			visible: isOwnerStatus && !!onMoveProject,
		},
		{
			key: ProjectActionMenuKey.CopyCollaborationLink,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-copy-link"
				>
					<IconLink size={16} stroke={2} className="text-foreground" />
					<span>{t("project.copyCollaborationLink")}</span>
				</div>
			),
			visible: isCollaborationProjectStatus && !!onCopyCollaborationLink,
		},
		{
			key: ProjectActionMenuKey.AddCollaborators,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-add-collaborators"
				>
					<UserRoundPlus className="text-foreground" />
					<span>{t("project.addCollaborators")}</span>
				</div>
			),
			visible: !!onAddCollaborators && canManageProject(item.user_role),
		},
		{
			key: ProjectActionMenuKey.Transfer,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-transfer"
				>
					<ArrowRightLeft className="text-foreground" />
					<span>{t("project.transfer")}</span>
				</div>
			),
			visible: !!onTransferProject && isOwnerStatus,
		},
		{
			key: ProjectActionMenuKey.AddWorkspaceShortcut,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-add-workspace-shortcut"
				>
					<IconUsersPlus size={16} className="text-foreground" />
					<span>{t("project.addWorkspaceShortcut")}</span>
				</div>
			),
			visible: !item.is_bind_workspace && !!onAddWorkspaceShortcut,
		},
		{
			key: ProjectActionMenuKey.ShortcutNavigateToWorkspace,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-foreground transition-colors hover:bg-muted active:bg-accent [&_svg]:shrink-0"
					data-testid="project-context-navigate-to-workspace"
				>
					<IconLayersLinked size={16} className="text-foreground" />
					<span>{t("project.shortcutNavigateToWorkspace")}</span>
				</div>
			),
			visible:
				isWorkspaceShortcutProjectStatus &&
				(inCollaborationPanel ? hasBoundWorkspace : false) &&
				!!onShortcutNavigateToWorkspace,
		},
		{
			type: "divider",
			visible: true,
		},
		{
			key: ProjectActionMenuKey.CancelWorkspaceShortcut,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/10 [&_svg]:shrink-0"
					data-testid="project-context-cancel-workspace-shortcut"
				>
					<IconLayersLinked size={16} className="text-destructive" />
					<span>{t("project.cancelWorkspaceShortcut")}</span>
				</div>
			),
			visible:
				isWorkspaceShortcutProjectStatus &&
				(inCollaborationPanel ? hasBoundWorkspace : true) &&
				!!onCancelWorkspaceShortcut,
		},
		{
			key: ProjectActionMenuKey.Delete,
			label: (
				<div
					className="flex cursor-pointer items-center gap-1 rounded text-sm font-normal leading-5 text-red-500 transition-colors hover:bg-destructive/10 active:bg-destructive/10 [&_svg]:shrink-0"
					data-testid="project-context-delete"
				>
					<Trash2 size={16} className="text-red-500" />
					<span>{t("project.deleteProject")}</span>
				</div>
			),
			visible: !!onDeleteProject && !isWorkspaceShortcutProjectStatus,
		},
	])
}
