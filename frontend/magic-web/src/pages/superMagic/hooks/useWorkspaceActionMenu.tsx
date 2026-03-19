import { useMemo } from "react"
import { MenuProps } from "antd"
import { useTranslation } from "react-i18next"
import { Pencil, Trash2 } from "lucide-react"
import type { Workspace } from "../pages/Workspace/types"

interface UseWorkspaceActionMenuParams {
	workspace: Workspace | null
	selectedWorkspace?: Workspace | null
	onDelete: (workspaceId: string) => void
	onRename: (workspaceId: string) => void
	onMenuClose?: () => void
	onTransferStart?: () => void
}

interface UseWorkspaceActionMenuReturn {
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
}: UseWorkspaceActionMenuParams): UseWorkspaceActionMenuReturn {
	const { t } = useTranslation("super")

	const menuItems = useMemo<MenuProps["items"]>(() => {
		if (!workspace) return []

		const items: MenuProps["items"] = []

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
				onRename(workspace.id)
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
	}, [workspace, onDelete, onRename, onMenuClose, t])

	return {
		menuItems,
		menuProps: {
			items: menuItems,
			trigger: ["click"],
			placement: "right",
		},
		nodes: null,
	}
}
