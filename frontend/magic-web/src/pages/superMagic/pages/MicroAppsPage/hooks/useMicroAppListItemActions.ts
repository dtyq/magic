import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import magicToast from "@/components/base/MagicToaster/utils"
import { canEditProject } from "@/pages/superMagic/utils/permission"
import { RoutePath } from "@/constants/routes"

interface UseMicroAppListItemActionsProps {
	renameApp: (appId: string, appName: string) => Promise<unknown>
	deleteApp: (appId: string) => Promise<unknown>
}

export function useMicroAppListItemActions({
	renameApp,
	deleteApp,
}: UseMicroAppListItemActionsProps) {
	const { t } = useTranslation("super")
	const [renameTarget, setRenameTarget] = useState<MicroAppListItem | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<MicroAppListItem | null>(null)
	const [renaming, setRenaming] = useState(false)
	const [deleting, setDeleting] = useState(false)

	const openInNewWindow = useCallback((app: MicroAppListItem) => {
		// 发布页是公开路由，使用域名根路径，不沿用编辑页的集群前缀。
		const appPath = RoutePath.MicroAppShare.replace(":appId", encodeURIComponent(app.app_id))
		window.open(appPath, "_blank", "noopener,noreferrer")
	}, [])

	const openRename = useCallback((app: MicroAppListItem) => {
		if (!canEditProject(app.user_role)) return
		setRenameTarget(app)
	}, [])

	const confirmRename = useCallback(
		async (appName: string) => {
			if (!renameTarget || renaming) return
			setRenaming(true)
			try {
				await renameApp(renameTarget.app_id, appName)
				magicToast.success(t("microAppsPage.actions.renameSuccess"))
				setRenameTarget(null)
			} catch (error) {
				console.error("Failed to rename micro app:", error)
				magicToast.error(t("microAppsPage.actions.renameFailed"))
			} finally {
				setRenaming(false)
			}
		},
		[renameApp, renameTarget, renaming, t],
	)

	const confirmDelete = useCallback(async () => {
		if (!deleteTarget || deleting) return
		setDeleting(true)
		try {
			await deleteApp(deleteTarget.app_id)
			magicToast.success(t("microAppsPage.actions.deleteSuccess"))
			setDeleteTarget(null)
		} catch (error) {
			console.error("Failed to delete micro app:", error)
			magicToast.error(t("microAppsPage.actions.deleteFailed"))
		} finally {
			setDeleting(false)
		}
	}, [deleteApp, deleteTarget, deleting, t])

	return {
		renameTarget,
		deleteTarget,
		renaming,
		deleting,
		openInNewWindow,
		openRename,
		openDelete: setDeleteTarget,
		closeRename: () => setRenameTarget(null),
		closeDelete: () => setDeleteTarget(null),
		confirmRename,
		confirmDelete,
	}
}
