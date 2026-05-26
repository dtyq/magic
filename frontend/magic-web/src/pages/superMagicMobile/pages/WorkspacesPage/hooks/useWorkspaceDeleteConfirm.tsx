import { useMemoizedFn } from "ahooks"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import MobileDeleteConfirmPopup from "@/pages/superMagicMobile/components/MobileDeleteConfirmPopup"

interface UseWorkspaceDeleteConfirmOptions {
	/** Executes the actual workspace delete after the user confirms */
	onDeleteWorkspace: (id: string) => Promise<void>
}

/**
 * Manages workspace delete confirmation state and renders the shared confirm sheet.
 */
export function useWorkspaceDeleteConfirm({ onDeleteWorkspace }: UseWorkspaceDeleteConfirmOptions) {
	const { t } = useTranslation("super")
	const [workspacePendingDelete, setWorkspacePendingDelete] = useState<Workspace | null>(null)

	/** Show delete confirmation for the given workspace (swipe or more menu). */
	const requestDeleteWorkspace = useMemoizedFn((workspace: Workspace) => {
		setWorkspacePendingDelete(workspace)
	})

	/** Dismiss delete confirmation without deleting. */
	const cancelDeleteWorkspace = useMemoizedFn(() => {
		setWorkspacePendingDelete(null)
	})

	/** Run delete API after user confirms in the bottom sheet. */
	const confirmDeleteWorkspace = useMemoizedFn(async () => {
		if (!workspacePendingDelete?.id) return
		try {
			await onDeleteWorkspace(workspacePendingDelete.id)
			setWorkspacePendingDelete(null)
		} catch {
			// Keep the sheet open; parent hook handles error toast.
		}
	})

	const deleteConfirmNode = (
		<MobileDeleteConfirmPopup
			visible={Boolean(workspacePendingDelete)}
			onClose={cancelDeleteWorkspace}
			title={t("workspace.deleteWorkspace")}
			entityName={workspacePendingDelete?.name || t("workspace.unnamedWorkspace")}
			descriptionSuffix={t("ui.deleteWorkspaceDescriptionWithoutName")}
			onConfirm={confirmDeleteWorkspace}
			cancelAriaLabel={t("common.cancel")}
			confirmAriaLabel={t("common.confirm")}
			testIdPrefix="mobile-workspace-delete-confirm"
		/>
	)

	return {
		workspacePendingDelete,
		requestDeleteWorkspace,
		cancelDeleteWorkspace,
		confirmDeleteWorkspace,
		deleteConfirmNode,
	}
}
