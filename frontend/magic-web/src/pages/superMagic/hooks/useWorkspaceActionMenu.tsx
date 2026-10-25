import { useMemo } from "react"
import { MenuProps } from "antd"
import { useTranslation } from "react-i18next"
import { AppWindow, Pencil, Trash2 } from "lucide-react"
import type { Workspace } from "../pages/Workspace/types"
import { suppressSelectionAfterWorkspaceRename } from "@/pages/superMagic/utils/workspaceRenameSelectionGuard"

interface UseWorkspaceActionMenuParams {
	workspace: Workspace | null
	selectedWorkspace?: Workspace | null
	onDelete: (workspaceId: string) => void
	onRename: (workspaceId: string, fallbackWorkspace?: Workspace | null) => void
	onMenuClose?: () => void
	onTransferStart?: () => void
	onOpenManager?: () => void
}

interface UseWorkspaceActionMenuReturn {
	isModalOpen: boolean
	menuItems: MenuProps["items"]
	menuProps: {
		items: MenuProps["items"]
		trigger: ("contextMenu" | "click" | "hover")[]
		placement: "right"
	}
	nodes: React.ReactNode
}

/**
 * Open-source baseline: workspace action menu (rename, delete only).
 * Transfer is available in enterprise overlay.
 */
export function useWorkspaceActionMenu({
	workspace,
	onDelete,
	onRename,
	onMenuClose,
	onOpenManager,
}: UseWorkspaceActionMenuParams): UseWorkspaceActionMenuReturn {
	const { t } = useTranslation("super")

	const menuItems = useMemo<MenuProps["items"]>(() => {
		if (!workspace) return []

		const items: MenuProps["items"] = []

		if (onOpenManager)
			items.push({
				key: "project-manager",
				label: (
					<div className="flex items-center gap-2">
						<AppWindow size={16} />
						<span>{t("projectNavigation.openManager")}</span>
					</div>
				),
				onClick: () => {
					onMenuClose?.()
					onOpenManager()
				},
			})

		items.push({
			key: "rename",
			label: (
				<div
					className="flex items-center gap-2"
					data-testid={`super-workspaces-menu-action-rename-${workspace.id}`}
				>
					<Pencil size={16} />
					<span>{t("workspace.rename")}</span>
				</div>
			),
			onClick: () => {
				// Guard next selection click to avoid rename menu click-through.
				suppressSelectionAfterWorkspaceRename()
				onRename(workspace.id, workspace)
				onMenuClose?.()
			},
		})

		items.push({
			key: "delete",
			label: (
				<div
					className="flex items-center gap-2"
					data-testid={`super-workspaces-menu-action-delete-${workspace.id}`}
				>
					<Trash2 size={16} className="text-destructive" />
					<span>{t("common.delete")}</span>
				</div>
			),
			danger: true,
			onClick: () => {
				onMenuClose?.()
				onDelete(workspace.id)
			},
		})

		return items
	}, [workspace, onDelete, onRename, onMenuClose, onOpenManager, t])

	return {
		isModalOpen: false,
		menuItems,
		menuProps: {
			items: menuItems,
			trigger: ["click"],
			placement: "right",
		},
		nodes: null,
	}
}
