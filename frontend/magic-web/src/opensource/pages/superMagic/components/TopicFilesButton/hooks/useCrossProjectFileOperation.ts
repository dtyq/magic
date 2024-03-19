import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./index"
import type { ProjectListItem, Workspace } from "../../../pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"
import { detectDuplicateFilesForMove } from "../utils/moveOrCopyDuplicateHandler"
import { useMoveOrCopyDuplicateHandler } from "./useMoveOrCopyDuplicateHandler"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseCrossProjectFileOperationOptions {
	projectId?: string
	selectedWorkspace: Workspace | null
	selectedProject: ProjectListItem | null
	projects: ProjectListItem[]
	onSuccess?: () => void
}

export function useCrossProjectFileOperation(options: UseCrossProjectFileOperationOptions) {
	const { projectId, onSuccess } = options
	const { t } = useTranslation("super")

	const [visible, setVisible] = useState(false)
	const [operationType, setOperationType] = useState<"move" | "copy">("move")
	const [fileIds, setFileIds] = useState<string[]>([])
	const [initialPath, setInitialPath] = useState<AttachmentItem[]>([])
	const [isOperating, setIsOperating] = useState(false)
	const [operationProgress, setOperationProgress] = useState(0)

	// 集成同名检测 Hook
	const duplicateHandler = useMoveOrCopyDuplicateHandler()

	const openMoveModal = useCallback((ids: string[], path?: AttachmentItem[]) => {
		setFileIds(ids)
		setOperationType("move")
		setInitialPath(path || [])
		setVisible(true)
	}, [])

	const openCopyModal = useCallback((ids: string[], path?: AttachmentItem[]) => {
		setFileIds(ids)
		setOperationType("copy")
		setInitialPath(path || [])
		setVisible(true)
	}, [])

	const closeModal = useCallback(() => {
		setVisible(false)
		setFileIds([])
		setOperationProgress(0)
	}, [])

	const handleOperationPolling = useCallback(
		(batchKey: string, operationType: "move" | "copy") => {
			const timer = setInterval(async () => {
				try {
					const checkData = await SuperMagicApi.checkBatchOperationStatus(batchKey)

					if (checkData.status === "processing") {
						const progress = checkData.progress ? parseInt(checkData.progress) : 0
						setOperationProgress(progress)
					} else if (checkData.status === "success") {
						setOperationProgress(100)
						magicToast.success(
							operationType === "move"
								? t("topicFiles.success.fileMoved")
								: t("topicFiles.success.fileCopied"),
						)
						clearInterval(timer)
						setTimeout(() => {
							setIsOperating(false)
							setOperationProgress(0)
							closeModal()
							onSuccess?.()
						}, 500)
					} else if (checkData.status === "failed") {
						magicToast.error(
							checkData.message ||
								(operationType === "move"
									? t("topicFiles.error.moveFileFailed")
									: t("topicFiles.error.copyFileFailed")),
						)
						clearInterval(timer)
						setIsOperating(false)
						setOperationProgress(0)
					} else {
						clearInterval(timer)
						setIsOperating(false)
						setOperationProgress(0)
					}
				} catch (error) {
					console.error("检查操作状态失败:", error)
					magicToast.error(
						operationType === "move"
							? t("topicFiles.error.moveFileFailed")
							: t("topicFiles.error.copyFileFailed"),
					)
					clearInterval(timer)
					setIsOperating(false)
					setOperationProgress(0)
				}
			}, 2000)
		},
		[closeModal, onSuccess, t],
	)

	const executeMoveOperation = useCallback(
		async (data: {
			targetProjectId: string
			targetPath: AttachmentItem[]
			targetAttachments: AttachmentItem[]
			sourceAttachments: AttachmentItem[]
		}) => {
			if (!projectId || fileIds.length === 0) return

			// 1. 检测同名文件（递归检测文件夹内所有子文件）
			const duplicates = detectDuplicateFilesForMove(
				fileIds,
				data.sourceAttachments,
				data.targetAttachments,
				data.targetPath,
			)

			// 2. 如果有同名，显示 Modal 并等待用户选择
			let keepBothIds: string[] = []
			if (duplicates.size > 0) {
				const userChoice = await duplicateHandler.checkDuplicates(duplicates)
				if (!userChoice.shouldProceed) {
					return // 用户取消
				}
				keepBothIds = userChoice.keepBothIds
			}

			// 3. 执行移动操作
			setIsOperating(true)
			setOperationProgress(0)

			try {
				const targetParentId =
					data.targetPath.length > 0
						? data.targetPath[data.targetPath.length - 1].file_id || ""
						: ""

				let result

				// 区分单文件移动和批量移动
				if (fileIds.length === 1) {
					// 使用单文件移动接口（moveFile）
					result = await SuperMagicApi.moveFile({
						file_id: fileIds[0],
						target_parent_id: targetParentId,
						project_id: projectId,
						target_project_id: data.targetProjectId,
						keep_both_file_ids: keepBothIds,
					})
				} else {
					// 使用批量移动接口（moveFiles）
					result = await SuperMagicApi.moveFiles({
						file_ids: fileIds,
						project_id: projectId,
						target_project_id: data.targetProjectId,
						target_parent_id: targetParentId,
						pre_file_id: "",
						keep_both_file_ids: keepBothIds,
					})
				}

				if (result.status === "success") {
					setOperationProgress(100)
					magicToast.success(t("topicFiles.success.fileMoved"))
					setTimeout(() => {
						setIsOperating(false)
						setOperationProgress(0)
						closeModal()
						onSuccess?.()
					}, 500)
					return
				}

				if (result.status === "processing" && result.batch_key) {
					handleOperationPolling(result.batch_key, "move")
				}
			} catch (error) {
				console.error("移动文件失败:", error)
				magicToast.error(t("topicFiles.error.moveFileFailed"))
				setIsOperating(false)
				setOperationProgress(0)
			}
		},
		[fileIds, projectId, closeModal, onSuccess, t, handleOperationPolling, duplicateHandler],
	)

	const executeCopyOperation = useCallback(
		async (data: {
			targetProjectId: string
			targetPath: AttachmentItem[]
			targetAttachments: AttachmentItem[]
			sourceAttachments: AttachmentItem[]
		}) => {
			if (!projectId || fileIds.length === 0) return

			// 辅助函数：在文件树中查找指定 ID 的项目
			const findItemById = (
				id: string,
				attachments: AttachmentItem[],
			): AttachmentItem | null => {
				for (const item of attachments) {
					if (item.file_id === id) return item
					if (item.children) {
						const found = findItemById(id, item.children)
						if (found) return found
					}
				}
				return null
			}

			// 检查 fileIds 中是否都是文件夹
			const areAllFolders = fileIds.every((id) => {
				const item = findItemById(id, data.sourceAttachments)
				return item?.is_directory === true
			})

			// 1. 检测同名文件（如果是文件夹，跳过冲突检测）
			let duplicates = new Map<string, { fileName: string; relativePath: string }>()
			if (!areAllFolders) {
				// 只有包含文件时才进行冲突检测
				duplicates = detectDuplicateFilesForMove(
					fileIds,
					data.sourceAttachments,
					data.targetAttachments,
					data.targetPath,
				)
			}

			// 2. 如果有同名，显示 Modal 并等待用户选择
			let keepBothIds: string[] = []
			if (duplicates.size > 0) {
				const userChoice = await duplicateHandler.checkDuplicates(duplicates)
				if (!userChoice.shouldProceed) {
					return // 用户取消
				}
				keepBothIds = userChoice.keepBothIds
			}

			// 3. 如果是文件夹，将文件夹ID添加到 keepBothIds 中
			const folderIds = fileIds.filter((id) => {
				const item = findItemById(id, data.sourceAttachments)
				return item?.is_directory === true
			})
			if (folderIds.length > 0) {
				keepBothIds = [...keepBothIds, ...folderIds]
			}

			// 4. 执行复制操作
			setIsOperating(true)
			setOperationProgress(0)

			try {
				const targetParentId =
					data.targetPath.length > 0
						? data.targetPath[data.targetPath.length - 1].file_id || ""
						: ""

				const result = await SuperMagicApi.copyFiles({
					file_ids: fileIds,
					project_id: projectId,
					target_project_id: data.targetProjectId,
					target_parent_id: targetParentId,
					pre_file_id: "",
					keep_both_file_ids: keepBothIds,
				})

				if (result.status === "success") {
					setOperationProgress(100)
					magicToast.success(t("topicFiles.success.fileCopied"))
					setTimeout(() => {
						setIsOperating(false)
						setOperationProgress(0)
						closeModal()
						onSuccess?.()
					}, 500)
					return
				}

				if (result.status === "processing" && result.batch_key) {
					handleOperationPolling(result.batch_key, "copy")
				}
			} catch (error) {
				console.error("复制文件失败:", error)
				magicToast.error(t("topicFiles.error.copyFileFailed"))
				setIsOperating(false)
				setOperationProgress(0)
			}
		},
		[fileIds, projectId, closeModal, onSuccess, t, handleOperationPolling, duplicateHandler],
	)

	return {
		visible,
		operationType,
		fileIds,
		initialPath,
		isOperating,
		operationProgress,
		openMoveModal,
		openCopyModal,
		executeMoveOperation,
		executeCopyOperation,
		closeModal,
		// 导出同名检测 Modal 状态
		duplicateModalVisible: duplicateHandler.modalVisible,
		currentDuplicateFileName: duplicateHandler.currentFileName,
		totalDuplicates: duplicateHandler.totalDuplicates,
		handleDuplicateReplace: duplicateHandler.handleReplace,
		handleDuplicateKeepBoth: duplicateHandler.handleKeepBoth,
		handleDuplicateCancel: duplicateHandler.handleCancel,
	}
}
