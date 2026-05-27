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
import { collectFileIds } from "../utils/collectFileIds"
import { getAttachmentKey } from "../utils/getAttachmentKey"
import { collectSelectedItemIds } from "../utils/collectSelectedItemIds"
import { buildDeleteConfirmHierarchyFromAttachments } from "../utils/mobileAttachmentTreeSelection"
import { resolveMagicDeleteWarningVariant } from "../utils/magic-system-folder"

interface UseProjectDetailFilesControllerOptions {
	projectId?: string
	attachments: AttachmentItem[]
	selectedProject?: any
	selectedTopic?: any
	setIsSelectMode: (value: boolean) => void
	refreshAttachments?: () => Promise<void> | void
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
	refreshAttachments,
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
	})

	const moveFileHook = useMoveFile({
		projectId,
		attachments,
		onMoveSuccess: async () => {
			await refreshAttachments?.()
			setIsSelectMode(false)
			setSelectionResetKey((prev) => prev + 1)
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

	const collectSelectedFileIds = (selectedKeys: Set<string>) => {
		return collectFileIds({
			items: attachments,
			selectedItems: selectedKeys,
			getItemId: getAttachmentKey,
			includeFolderIds: true,
		})
	}

	const collectDirectSelectedFileIds = (selectedKeys: Set<string>) => {
		return collectSelectedItemIds(attachments, selectedKeys, getAttachmentKey)
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

			await refreshAttachments?.()

			magicToast.success(t("topicFiles.contextMenu.createFileSuccess"))
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
			await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: parentId,
				file_name: folderName,
				is_directory: true,
			})

			await refreshAttachments?.()

			magicToast.success(t("topicFiles.contextMenu.createFolderSuccess"))
		} catch (error) {
			console.error("创建移动端项目详情文件夹失败:", error)
			magicToast.error(t("projectDetail.createFolderFailed"))
		}
	}

	const batchShare = (selectedKeys: Set<string>) => {
		const fileIds = collectSelectedFileIds(selectedKeys)
		if (fileIds.length === 0) return
		setShareFileIds(fileIds)
		setShareModalVisible(true)
	}

	const batchDelete = (selectedKeys: Set<string>) => {
		const fileIds = collectSelectedFileIds(selectedKeys)
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

		openDeleteConfirm({
			selectedHierarchy,
			magicWarningVariant,
			testIdPrefix: "project-detail-files-batch-delete-confirm",
			onConfirm: async () => {
				try {
					await SuperMagicApi.deleteFiles({
						file_ids: fileIds,
						project_id: projectId,
					}).catch(() => null)

					await refreshAttachments?.()

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
		const fileIds = collectDirectSelectedFileIds(selectedKeys)
		if (fileIds.length === 0) return
		moveFileHook.openBatchMoveByFileIds(fileIds)
	}

	const batchMoveByFileIds = (fileIds: string[]) => {
		if (fileIds.length === 0) return
		moveFileHook.openBatchMoveByFileIds(fileIds)
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
		batchDelete,
	}
}
