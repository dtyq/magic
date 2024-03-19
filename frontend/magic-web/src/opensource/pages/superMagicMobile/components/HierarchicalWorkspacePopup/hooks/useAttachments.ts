import { useState, useCallback } from "react"
import { useDownloadAll } from "@/opensource/pages/superMagic/components/TopicFilesButton/useDownloadAll"
import type { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"
import projectFilesStore from "@/opensource/stores/projectFiles"
import { AttachmentDataProcessor } from "@/opensource/pages/superMagic/utils/attachmentDataProcessor"

export function useAttachments() {
	const { workspaceFileTree: attachments, setWorkspaceFileTree: setAttachments } =
		projectFilesStore
	const attachmentList = projectFilesStore.workspaceFilesList
	const [currentProjectId, setCurrentProjectId] = useState<string>()

	const { handleDownloadAll, allLoading } = useDownloadAll({
		projectId: currentProjectId,
	})

	const updateAttachments = useCallback(
		(selectedProject: ProjectListItem, callback?: () => void) => {
			if (!selectedProject?.id) {
				setCurrentProjectId(undefined)
				projectFilesStore.setWorkspaceFileTree([])
				return
			}

			setCurrentProjectId(selectedProject.id)

			try {
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: selectedProject?.id,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window.temporary_token || "",
				}).then((res: any) => {
					// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
					const processedData = AttachmentDataProcessor.processAttachmentData(res)
					// 同步更新 projectFilesStore
					projectFilesStore.setWorkspaceFileTree(processedData.tree)
				})
			} catch (error) {
				console.error("Failed to fetch attachments:", error)
				projectFilesStore.setWorkspaceFileTree([])
			} finally {
				callback?.()
			}
		},
		[],
	)

	const clearAttachments = useCallback(() => {
		setCurrentProjectId(undefined)
		projectFilesStore.setWorkspaceFileTree([])
	}, [])

	// 包装 setAttachments，使其在更新本地状态时也同步更新 projectFilesStore
	const setAttachmentsWithStoreSync = useCallback((tree: any[]) => {
		setAttachments(tree)
		// 同步更新 projectFilesStore
		projectFilesStore.setWorkspaceFileTree(tree)
	}, [])

	// // 包装 setAttachmentList，保持一致性（虽然通常不需要单独更新 list）
	// const setAttachmentListWithStoreSync = useCallback((list: any[]) => {
	// 	setAttachmentList(list)
	// 	// 如果 list 变化，可能需要重新计算 tree，但这里保持简单，只更新 list
	// 	// 注意：projectFilesStore 的 workspaceFilesList 是通过 setWorkspaceFileTree 自动计算的
	// }, [])

	// useEffect(() => {
	// 	return reaction(
	// 		() => [projectFilesStore.workspaceFileTree, projectFilesStore.workspaceFilesList],
	// 		([tree, list]) => {
	// 			setAttachments(tree)
	// 			setAttachmentList(list)
	// 		},
	// 	)
	// }, [])

	return {
		attachments,
		attachmentList,
		setAttachments: setAttachmentsWithStoreSync,
		currentProjectId,
		handleDownloadAll,
		allLoading,
		updateAttachments,
		clearAttachments,
		// setAttachmentList: setAttachmentListWithStoreSync,
	}
}
