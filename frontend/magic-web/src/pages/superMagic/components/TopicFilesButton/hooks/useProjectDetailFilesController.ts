import { useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "./types"
import type { PresetFileType } from "../constant"
import { PRESET_FILE_EXTENSION_MAP, PRESET_FILE_INITIAL_CONTENT } from "../filePresetTemplates"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"
import { getParentIdFromPath } from "../utils/getParentIdFromPath"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { useMobileDeleteConfirmSheet } from "./useMobileDeleteConfirmSheet"
import { useUploadWithModal } from "./useUploadWithModal"
import { useMoveFile } from "./useMoveFile"
import { useCopyFileSelector } from "./useCopyFileSelector"
import { getAttachmentKey } from "../utils/getAttachmentKey"
import { normalizeSelectionIdsForShare } from "../utils/normalizeSelectionIdsForShare"
import { buildDeleteConfirmHierarchyFromAttachments } from "../utils/mobileAttachmentTreeSelection"
import { resolveMagicDeleteWarningVariant } from "../utils/magic-system-folder"
import {
	detectCanvasProjectOperationRisk,
	getCanvasProjectOperationImpact,
	hasCanvasProjectInAttachments,
} from "../utils/canvasProjectOperationRisk"

interface UseProjectDetailFilesControllerOptions {
	projectId?: string
	attachments: AttachmentItem[]
	selectedProject?: any
	selectedTopic?: any
	setIsSelectMode: (value: boolean) => void
	onMoveSuccess?: () => void
	onUpdateAttachments?: () => void
}

/**
 * 项目详情文件页 controller：仅负责编排旧能力，避免在新 View 中直接堆业务流程。
 */
export function useProjectDetailFilesController({
	projectId,
	attachments,
	selectedProject,
	selectedTopic,
	setIsSelectMode,
	onMoveSuccess,
	onUpdateAttachments,
}: UseProjectDetailFilesControllerOptions) {
	const { t } = useTranslation("super")
	const [shareModalVisible, setShareModalVisible] = useState(false)
	const [shareFileIds, setShareFileIds] = useState<string[]>([])
	const [selectionResetKey, setSelectionResetKey] = useState(0)
	const { deleteConfirmNode, openDeleteConfirm } = useMobileDeleteConfirmSheet()

	const sharedDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})

	const {
		uploadModalVisible,
		selectedUploadFiles,
		isUploadingFolder,
		handleCustomUploadFile,
		handleCustomUploadFolder,
		handleUploadModalSubmit,
		handleUploadModalClose,
	} = useUploadWithModal({
		projectId,
		selectedProject,
		selectedTopic,
		attachments,
		duplicateFileHandler: sharedDuplicateHandler,
		onUpdateAttachments,
	})

	const moveFileHook = useMoveFile({
		projectId,
		attachments,
		onMoveSuccess: () => {
			setIsSelectMode(false)
			setSelectionResetKey((prev) => prev + 1)
			onMoveSuccess?.()
		},
	})

	const copyFileSelector = useCopyFileSelector({
		projectId,
		attachments,
		onCopySuccess: () => {
			setIsSelectMode(false)
			setSelectionResetKey((prev) => prev + 1)
			onMoveSuccess?.()
		},
	})

	const resolveParentIdFromPath = (parentPath?: string) => {
		return getParentIdFromPath(attachments, parentPath)
	}

	const buildUniqueDefaultName = (baseName: string, parentPath?: string, extension?: string) => {
		let index = 0
		let candidate = extension ? `${baseName}.${extension}` : baseName

		while (checkDuplicateFileName(candidate, attachments, parentPath)) {
			index += 1
			const nextBaseName = `${baseName} (${index})`
			candidate = extension ? `${nextBaseName}.${extension}` : nextBaseName
		}

		return candidate
	}

	/**
	 * Mobile multi-select stores descendant file keys only; collapse fully selected
	 * folder subtrees into folder IDs (same as share/copy/move).
	 */
	const collectOperationFileIds = (selectedKeys: Set<string>) => {
		return normalizeSelectionIdsForShare(attachments, selectedKeys)
	}

	const createFile = async (
		type: PresetFileType,
		parentPath?: string,
		fileNameInput?: string,
	) => {
		if (!projectId) {
			magicToast.error(t("topicFiles.contextMenu.projectRequired"))
			return
		}

		const fileExtension = PRESET_FILE_EXTENSION_MAP[type]
		const baseName = fileNameInput?.trim() || t("topicFiles.contextMenu.newFile.defaultName")
		const fileName = buildUniqueDefaultName(baseName, parentPath, fileExtension)
		const parentId = resolveParentIdFromPath(parentPath)

		try {
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: parentId,
				file_name: fileName,
				is_directory: false,
			})
			const createdFileId = response?.file_id || response?.id

			if (createdFileId) {
				await SuperMagicApi.saveFileContent([
					{
						file_id: createdFileId,
						content: PRESET_FILE_INITIAL_CONTENT[type] || " ",
					},
				])
			}

			onUpdateAttachments?.()
			magicToast.success(t("topicFiles.contextMenu.createFileSuccess"))
			return response
		} catch (error) {
			console.error("创建移动端项目详情文件失败:", error)
			magicToast.error(t("projectDetail.createFileFailed"))
		}
	}

	const createFolder = async (parentPath?: string, folderNameInput?: string) => {
		if (!projectId) {
			magicToast.error(t("topicFiles.contextMenu.projectRequired"))
			return
		}

		const folderName = buildUniqueDefaultName(
			folderNameInput?.trim() || t("topicFiles.contextMenu.newFolder.defaultName"),
			parentPath,
			undefined,
		)
		const parentId = resolveParentIdFromPath(parentPath)

		try {
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: parentId,
				file_name: folderName,
				is_directory: true,
			})

			// Refresh the attachment tree so the newly created folder is visible immediately.
			onUpdateAttachments?.()
			magicToast.success(t("topicFiles.contextMenu.createFolderSuccess"))
			return response
		} catch (error) {
			console.error("创建移动端项目详情文件夹失败:", error)
			magicToast.error(t("projectDetail.createFolderFailed"))
		}
	}

	const batchShare = (selectedKeys: Set<string>) => {
		const fileIds = normalizeSelectionIdsForShare(attachments, selectedKeys)
		if (fileIds.length === 0) return
		setShareFileIds(fileIds)
		setShareModalVisible(true)
	}

	const batchDelete = async (selectedKeys: Set<string>) => {
		const fileIds = collectOperationFileIds(selectedKeys)
		if (fileIds.length === 0) return

		const selectedHierarchy = buildDeleteConfirmHierarchyFromAttachments(
			attachments,
			selectedKeys,
		)
		const magicWarningVariant = resolveMagicDeleteWarningVariant(
			attachments,
			selectedKeys,
			getAttachmentKey,
		)
		const canvasRisk = hasCanvasProjectInAttachments(attachments)
			? await detectCanvasProjectOperationRisk({
					attachments,
					fileIds,
					operation: "delete",
				})
			: { shouldWarn: false, riskTypes: [], affectedProjectNames: [] }
		const canvasImpact = getCanvasProjectOperationImpact(canvasRisk)

		openDeleteConfirm({
			selectedHierarchy,
			magicWarningVariant,
			canvasWarning: canvasRisk.shouldWarn,
			canvasWarningContent: canvasRisk.shouldWarn
				? t(
						canvasImpact === "open-failure"
							? "projectDetail.deleteConfirm.canvasOpenFailureWarning"
							: canvasImpact === "content-loss"
								? "projectDetail.deleteConfirm.canvasContentLossWarning"
								: "projectDetail.deleteConfirm.canvasMixedWarning",
					)
				: undefined,
			testIdPrefix: "project-detail-files-batch-delete-confirm",
			onConfirm: async () => {
				try {
					await SuperMagicApi.deleteFiles({
						file_ids: fileIds,
						project_id: projectId,
					})

					// Reload the server-backed attachment tree before leaving selection mode.
					onUpdateAttachments?.()
					magicToast.success(t("topicFiles.contextMenu.deleteFileSuccess"))
					setIsSelectMode(false)
					setSelectionResetKey((prev) => prev + 1)
				} catch (error) {
					console.error("项目详情移动端批量删除失败:", error)
					magicToast.error(t("topicFiles.error.deleteFileFailed"))
				}
			},
		})
	}

	const resetMobileSelection = () => {
		setSelectionResetKey((prev) => prev + 1)
	}

	const batchMove = (selectedKeys: Set<string>) => {
		const fileIds = collectOperationFileIds(selectedKeys)
		if (fileIds.length === 0) return
		moveFileHook.openBatchMoveByFileIds(fileIds)
	}

	const batchMoveByFileIds = (fileIds: string[]) => {
		if (fileIds.length === 0) return
		moveFileHook.openBatchMoveByFileIds(fileIds)
	}

	const batchCopy = (selectedKeys: Set<string>) => {
		const fileIds = collectOperationFileIds(selectedKeys)
		if (fileIds.length === 0) return
		copyFileSelector.openBatchCopyByFileIds(fileIds)
	}

	return {
		selectionResetKey,
		resetMobileSelection,
		shareModalVisible,
		shareFileIds,
		closeShareModal: () => {
			setShareModalVisible(false)
			setShareFileIds([])
		},
		moveSelectorProps: moveFileHook.selectorConfig,
		copySelectorProps: copyFileSelector.selectorConfig,
		pendingCopyFileIds: copyFileSelector.pendingCopyFileIds,
		notifyCopySuccess: copyFileSelector.notifyCopySuccess,
		sharedDuplicateHandler,
		uploadModalVisible,
		selectedUploadFiles,
		isUploadingFolder,
		handleCustomUploadFile,
		handleCustomUploadFolder,
		handleUploadModalSubmit,
		handleUploadModalClose,
		deleteConfirmNode,
		createFile,
		createFolder,
		batchShare,
		batchMove,
		batchMoveByFileIds,
		batchCopy,
		batchDelete,
	}
}
