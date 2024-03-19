import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { message } from "antd"
import DeleteDangerModal from "@/opensource/components/business/DeleteDangerModal"
import SuperMagicService from "../../services"
import { workspaceStore } from "../../stores/core"

interface UseWorkspaceDeleteParams {
	onDeleteSuccess?: () => void
	getDeleteSuccessMessage: () => string
	getFallbackWorkspaceName: () => string
}

export function useWorkspaceDelete({
	onDeleteSuccess,
	getDeleteSuccessMessage,
	getFallbackWorkspaceName,
}: UseWorkspaceDeleteParams) {
	const [deleteModalOpen, setDeleteModalOpen] = useState(false)
	const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null)

	const openDeleteModal = useMemoizedFn((workspaceId: string) => {
		setDeletingWorkspaceId(workspaceId)
		setDeleteModalOpen(true)
	})

	const closeDeleteModal = useMemoizedFn(() => {
		setDeleteModalOpen(false)
		setDeletingWorkspaceId(null)
	})

	const handleDeleteConfirm = useMemoizedFn(async () => {
		if (!deletingWorkspaceId) return

		try {
			await SuperMagicService.deleteWorkspace(deletingWorkspaceId)
			message.success(getDeleteSuccessMessage())
			closeDeleteModal()
			onDeleteSuccess?.()
		} catch (error) {
			console.log("删除工作区失败，失败原因：", error)
		}
	})

	const getWorkspaceName = useMemoizedFn((workspaceId: string | null) => {
		if (!workspaceId) return getFallbackWorkspaceName()
		return (
			workspaceStore.workspaces.find((ws) => ws.id === workspaceId)?.name ||
			getFallbackWorkspaceName()
		)
	})

	const renderDeleteModal = useMemoizedFn(() => {
		if (!deleteModalOpen || !deletingWorkspaceId) return null

		return (
			<DeleteDangerModal
				open={deleteModalOpen}
				content={getWorkspaceName(deletingWorkspaceId)}
				needConfirm
				onSubmit={handleDeleteConfirm}
				onCancel={closeDeleteModal}
				onClose={closeDeleteModal}
			/>
		)
	})

	return {
		deleteModalOpen,
		deletingWorkspaceId,
		openDeleteModal,
		closeDeleteModal,
		renderDeleteModal,
	}
}
