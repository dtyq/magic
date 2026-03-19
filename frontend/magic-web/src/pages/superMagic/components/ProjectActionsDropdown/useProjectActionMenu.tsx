import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ProjectItemLike, ProjectActionHandlers, ProjectActionMenuKey } from "./types"
import { buildProjectActionMenuItems } from "./buildProjectActionMenuItems"

interface UseProjectActionMenuParams<T extends ProjectItemLike> extends ProjectActionHandlers<T> {
	item: T
	inCollaborationPanel: boolean
}

export function useProjectActionMenu<T extends ProjectItemLike>({
	item,
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
	onOpenInNewWindow,
	onCopyCollaborationLink,
	onTransferProject,
}: UseProjectActionMenuParams<T>) {
	const { t } = useTranslation("super")

	const contextMenuItems = useMemo(
		() =>
			buildProjectActionMenuItems({
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
				onOpenInNewWindow,
				onCopyCollaborationLink,
				onTransferProject,
			}),
		[
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
			onOpenInNewWindow,
			onCopyCollaborationLink,
			onTransferProject,
		],
	)

	const handleBuiltInAction = (key: ProjectActionMenuKey) => {
		switch (key) {
			case ProjectActionMenuKey.OpenInNewWindow:
				void onOpenInNewWindow?.(item)
				break
			case ProjectActionMenuKey.CopyCollaborationLink:
				void onCopyCollaborationLink?.(item)
				break
			case ProjectActionMenuKey.Transfer:
				onTransferProject?.(item)
				break
			case ProjectActionMenuKey.Rename:
				onRenameStart?.(item)
				break
			case ProjectActionMenuKey.MoveTo:
				onMoveProject?.(item.id)
				break
			case ProjectActionMenuKey.AddCollaborators:
				onAddCollaborators?.(item)
				break
			case ProjectActionMenuKey.AddWorkspaceShortcut:
				onAddWorkspaceShortcut?.(item)
				break
			case ProjectActionMenuKey.CancelWorkspaceShortcut:
				onCancelWorkspaceShortcut?.(item.id, item?.bind_workspace_id)
				break
			case ProjectActionMenuKey.ShortcutNavigateToWorkspace:
				onShortcutNavigateToWorkspace?.(item)
				break
			case ProjectActionMenuKey.Delete:
				onDeleteProject?.(item)
				break
			case ProjectActionMenuKey.Pin:
				void onPinProject?.(item, !item.is_pinned)
				break
			default:
				break
		}
	}

	return {
		contextMenuItems,
		handleBuiltInAction,
	}
}
