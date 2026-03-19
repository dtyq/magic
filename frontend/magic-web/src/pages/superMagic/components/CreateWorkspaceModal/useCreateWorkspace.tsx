import { useState, lazy, Suspense, useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import { message } from "antd"
import { useTranslation } from "react-i18next"
import SuperMagicService from "../../services"

const CreateWorkspaceModal = lazy(() => import("./index"))

interface UseCreateWorkspaceOptions {
	onSuccess?: (workspaceName: string) => void
	onError?: (error: unknown) => void
}

export function useCreateWorkspace(options?: UseCreateWorkspaceOptions) {
	const { t } = useTranslation("super")
	const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false)

	// Handle workspace creation
	const handleCreateWorkspace = useMemoizedFn(async (workspaceName: string) => {
		try {
			await SuperMagicService.createWorkspace(workspaceName)
			message.success(t("workspace.createWorkspaceSuccess"))
			options?.onSuccess?.(workspaceName)
		} catch (error) {
			console.log("创建工作区失败,失败原因:", error)
			options?.onError?.(error)
		}
	})

	// Open modal
	const openCreateWorkspaceModal = useCallback(() => {
		setCreateWorkspaceModalOpen(true)
	}, [])

	// Close modal
	const closeCreateWorkspaceModal = useCallback(() => {
		setCreateWorkspaceModalOpen(false)
	}, [])

	// Render modal component
	const renderCreateWorkspaceModal = () => {
		if (!createWorkspaceModalOpen) return null

		return (
			<Suspense fallback={null}>
				<CreateWorkspaceModal
					open={createWorkspaceModalOpen}
					onOpenChange={setCreateWorkspaceModalOpen}
					onCreate={handleCreateWorkspace}
				/>
			</Suspense>
		)
	}

	return {
		createWorkspaceModalOpen,
		openCreateWorkspaceModal,
		closeCreateWorkspaceModal,
		handleCreateWorkspace,
		renderCreateWorkspaceModal,
	}
}
