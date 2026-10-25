import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./index"
import type { ProjectListItem, Workspace } from "../../../pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import { detectDuplicateFilesForMove } from "../utils/moveOrCopyDuplicateHandler"
import { detectFolderConflictsForMove } from "../utils/folderConflictHandler"
import { useMoveOrCopyDuplicateHandler } from "./useMoveOrCopyDuplicateHandler"
import { useFolderConflictHandler } from "./useFolderConflictHandler"
import magicToast from "@/components/base/MagicToaster/utils"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import type { ConfirmFileOperation } from "./types"

interface UseImportFromOtherProjectOptions {
	isCurrent?: () => boolean
	confirmOperation?: ConfirmFileOperation
	projectId?: string
	selectedWorkspace: Workspace | null
	selectedProject: ProjectListItem | null
	workspaces: Workspace[]
	attachments: AttachmentItem[]
	onSuccess?: () => void
}

export function useImportFromOtherProject(options: UseImportFromOtherProjectOptions) {
	const { projectId, attachments, onSuccess, confirmOperation } = options
	const { t } = useTranslation("super")

	const [visible, setVisible] = useState(false)
	const [targetPath, setTargetPath] = useState<AttachmentItem[]>([])
	const [isOperating, setIsOperating] = useState(false)
	const [operationProgress, setOperationProgress] = useState(0)

	// 集成同名检测 Hook
	const duplicateHandler = useMoveOrCopyDuplicateHandler()
	const folderConflictHandler = useFolderConflictHandler()

	const openImportModal = useCallback((path?: AttachmentItem[]) => {
		setTargetPath(path || [])
		setVisible(true)
	}, [])

	const closeModal = useCallback(() => {
		setVisible(false)
		setTargetPath([])
		setOperationProgress(0)
	}, [])

	const handleMultipleBatchOperationPolling = useCallback(
		(batchKeys: string[]) => {
			const completionStatus = new Map(batchKeys.map((key) => [key, false]))

			const timer = setInterval(async () => {
				try {
					const checkPromises = batchKeys.map((key) =>
						SuperMagicApi.checkBatchOperationStatus(key),
					)
					const results = await Promise.all(checkPromises)

					let allCompleted = true
					let anyFailed = false
					let totalProgress = 0

					results.forEach((checkData, index) => {
						const batchKey = batchKeys[index]

						if (checkData.status === "processing") {
							allCompleted = false
							const progress = checkData.progress ? parseInt(checkData.progress) : 0
							totalProgress += progress
						} else if (checkData.status === "success") {
							completionStatus.set(batchKey, true)
							totalProgress += 100
						} else if (checkData.status === "failed") {
							anyFailed = true
						}
					})

					const avgProgress = Math.floor(totalProgress / batchKeys.length)
					setOperationProgress(avgProgress)

					if (anyFailed) {
						magicToast.error(t("topicFiles.error.importFileFailed"))
						clearInterval(timer)
						setIsOperating(false)
						setOperationProgress(0)
					} else if (allCompleted) {
						setOperationProgress(100)
						magicToast.success(t("topicFiles.success.fileImported"))
						clearInterval(timer)
						setTimeout(() => {
							setIsOperating(false)
							setOperationProgress(0)
							closeModal()
							onSuccess?.()
						}, 500)
					}
				} catch (error) {
					console.error("检查导入状态失败:", error)
					magicToast.error(t("topicFiles.error.importFileFailed"))
					clearInterval(timer)
					setIsOperating(false)
					setOperationProgress(0)
				}
			}, 2000)
		},
		[closeModal, onSuccess, t],
	)

	const executeImportOperation = useCallback(
		async (data: {
			filesByProject: Array<{
				sourceProjectId: string
				selectedFileIds: string[]
				selectedFiles: AttachmentItem[]
			}>
		}) => {
			if (!projectId || data.filesByProject.length === 0) return
			const identity = getFileReferenceIdentityKey()
			const isCurrent = () =>
				!confirmOperation ||
				(identity === getFileReferenceIdentityKey() && (options.isCurrent?.() ?? true))

			setIsOperating(true)
			setOperationProgress(0)

			try {
				const targetParentId =
					targetPath.length > 0 ? targetPath[targetPath.length - 1].file_id || "" : ""

				const totalProjects = data.filesByProject.length
				let completedProjects = 0
				const batchKeys: string[] = []
				const prepared: Array<{
					group: (typeof data.filesByProject)[number]
					keepBothIds: string[]
				}> = []
				const copyGroup = async (
					projectGroup: (typeof data.filesByProject)[number],
					keepBothIds: string[],
				) => {
					if (!isCurrent()) throw new DOMException("Import cancelled", "AbortError")
					const result = await SuperMagicApi.copyFiles({
						file_ids: projectGroup.selectedFileIds,
						project_id: projectGroup.sourceProjectId,
						target_project_id: projectId,
						target_parent_id: targetParentId,
						pre_file_id: "",
						keep_both_file_ids: keepBothIds,
					})
					if (result.status === "processing" && result.batch_key)
						batchKeys.push(result.batch_key)
					else if (result.status === "success") {
						completedProjects++
						setOperationProgress(Math.floor((completedProjects / totalProjects) * 100))
					}
				}

				// 按项目分组处理
				for (const projectGroup of data.filesByProject) {
					let keepBothIds: string[] = []
					const folderConflicts = detectFolderConflictsForMove(
						projectGroup.selectedFileIds,
						projectGroup.selectedFiles,
						attachments,
						targetPath,
					)
					if (folderConflicts.size > 0) {
						const folderChoice =
							await folderConflictHandler.checkConflicts(folderConflicts)
						if (!folderChoice.shouldProceed) {
							setIsOperating(false)
							setOperationProgress(0)
							return
						}
						keepBothIds = folderChoice.keepBothIds
					}

					// 1. Check duplicates. "Keep both" renames the top folder, so skip inner paths.
					const duplicateDetectionIds = projectGroup.selectedFileIds.filter(
						(id) => !keepBothIds.includes(id),
					)
					const duplicates = detectDuplicateFilesForMove(
						duplicateDetectionIds,
						projectGroup.selectedFiles,
						attachments,
						targetPath,
					)

					if (duplicates.size > 0) {
						const userChoice = await duplicateHandler.checkDuplicates(duplicates)
						if (!userChoice.shouldProceed) {
							setIsOperating(false)
							setOperationProgress(0)
							return
						}
						keepBothIds = [...keepBothIds, ...userChoice.keepBothIds]
					}

					// 2. Call the batch-copy API.
					if (confirmOperation) prepared.push({ group: projectGroup, keepBothIds })
					else await copyGroup(projectGroup, keepBothIds)
				}
				// 管理器先准备全部来源，再确认一次；取消时任何来源都尚未写入。
				if (confirmOperation) {
					if (
						!(await confirmOperation({
							operation: "import",
							fileIds: prepared.flatMap(({ group }) => group.selectedFileIds),
							sourceAttachments: prepared.flatMap(({ group }) => group.selectedFiles),
							sourceName: t("fileManager.confirmation.importSource"),
							targetPath,
						}))
					) {
						setIsOperating(false)
						setOperationProgress(0)
						return
					}
					for (const { group, keepBothIds } of prepared)
						await copyGroup(group, keepBothIds)
				}

				// 4. 轮询检查所有批量操作状态
				if (batchKeys.length > 0) {
					handleMultipleBatchOperationPolling(batchKeys)
				} else if (completedProjects === totalProjects) {
					setOperationProgress(100)
					magicToast.success(t("topicFiles.success.fileImported"))
					setTimeout(() => {
						setIsOperating(false)
						setOperationProgress(0)
						closeModal()
						onSuccess?.()
					}, 500)
				}
			} catch (error) {
				if (!isCurrent()) {
					setIsOperating(false)
					return
				}
				console.error("导入文件失败:", error)
				magicToast.error(t("topicFiles.error.importFileFailed"))
				setIsOperating(false)
				setOperationProgress(0)
			}
		},
		[
			projectId,
			options.isCurrent,
			confirmOperation,
			attachments,
			targetPath,
			closeModal,
			onSuccess,
			t,
			duplicateHandler,
			folderConflictHandler,
			handleMultipleBatchOperationPolling,
		],
	)

	return {
		visible,
		targetPath,
		isOperating,
		operationProgress,
		openImportModal,
		closeModal,
		executeImportOperation,
		// 导出同名检测 Modal 状态
		duplicateModalVisible: duplicateHandler.modalVisible,
		currentDuplicateFileName: duplicateHandler.currentFileName,
		totalDuplicates: duplicateHandler.totalDuplicates,
		handleDuplicateReplace: duplicateHandler.handleReplace,
		handleDuplicateKeepBoth: duplicateHandler.handleKeepBoth,
		handleDuplicateCancel: duplicateHandler.handleCancel,
		folderConflictModalVisible: folderConflictHandler.modalVisible,
		currentFolderConflictName: folderConflictHandler.currentFolderName,
		totalFolderConflicts: folderConflictHandler.totalConflicts,
		canMergeFolderConflict: folderConflictHandler.canMerge,
		handleFolderConflictKeepBoth: folderConflictHandler.handleKeepBoth,
		handleFolderConflictMerge: folderConflictHandler.handleMerge,
		handleFolderConflictCancel: folderConflictHandler.handleCancel,
	}
}
