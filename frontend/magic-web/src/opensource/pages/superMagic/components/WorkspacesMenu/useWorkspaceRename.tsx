import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { WorkspaceRenameDialog } from "@/opensource/pages/superMagic/pages/AgentsPage/components/WorkspaceRenameDialog"
import { workspaceStore } from "../../stores/core"
import type { Workspace } from "../../pages/Workspace/types"

export function useWorkspaceRename() {
	const [renameDialogOpen, setRenameDialogOpen] = useState(false)
	const [renamingWorkspace, setRenamingWorkspace] = useState<Workspace | null>(null)

	const openRenameModal = useMemoizedFn((workspaceId: string) => {
		const workspace = workspaceStore.workspaces.find((ws) => ws.id === workspaceId) ?? null
		setRenamingWorkspace(workspace)
		setRenameDialogOpen(true)
	})

	const closeRenameModal = useMemoizedFn(() => {
		setRenameDialogOpen(false)
		setRenamingWorkspace(null)
	})

	const renderRenameModal = useMemoizedFn(() => (
		<WorkspaceRenameDialog
			open={renameDialogOpen}
			onOpenChange={(open) => {
				if (!open) closeRenameModal()
			}}
			workspace={renamingWorkspace}
		/>
	))

	return {
		openRenameModal,
		closeRenameModal,
		renderRenameModal,
	}
}
