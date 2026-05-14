import { useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { SuperMagicApi } from "@/apis"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import type { AttachmentItem } from "./types"
import type { PresetFileType } from "../constant"
import { PRESET_FILE_EXTENSION_MAP, PRESET_FILE_INITIAL_CONTENT } from "../filePresetTemplates"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"
import { getParentIdFromPath } from "../utils/getParentIdFromPath"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { useMobileDeleteConfirmSheet } from "./useMobileDeleteConfirmSheet"
import { useUploadWithModal } from "./useUploadWithModal"
import { useMoveFile } from "./useMoveFile"

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
			// 项目详情新文件页只认服务端最新树；移动成功后统一刷新附件树，再清理多选态。
			await refreshAttachments?.()
			setIsSelectMode(false)
			setSelectionResetKey((prev) => prev + 1)
		},
	})

	/**
	 * 新文件页只保留路径字符串，因此这里需要在最新 attachments 树上重新解析父目录 ID，
	 * 避免把子目录创建误写到根目录。
	 */
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

	const batchDownload = async (items: AttachmentItem[]) => {
		if (!projectId) return
		const fileIds = items
			.map((item) => item.file_id)
			.filter((itemId): itemId is string => Boolean(itemId))
		if (fileIds.length === 0) return

		try {
			const data = await SuperMagicApi.createBatchDownload({
				project_id: projectId,
				file_ids: fileIds,
			})
			if (data.status === "ready" && data.download_url) {
				downloadFileWithAnchor(data.download_url)
			}
		} catch (error) {
			console.error("项目详情移动端批量下载失败:", error)
			magicToast.error(t("topicFiles.error.downloadFailed"))
		}
	}

	const batchExport = async (items: AttachmentItem[], convertType: "pdf" | "ppt") => {
		if (!projectId) return
		const fileIds = items
			.map((item) => item.file_id)
			.filter((itemId): itemId is string => Boolean(itemId))
		if (fileIds.length === 0) return

		try {
			const data = await SuperMagicApi.exportPdfOrPpt({
				project_id: projectId,
				file_ids: fileIds,
				convert_type: convertType,
			})
			if (data.status === "completed" && data.download_url) {
				downloadFileWithAnchor(data.download_url)
				return
			}

			if (data.status === "processing") {
				const timer = setInterval(async () => {
					try {
						const checkData = await SuperMagicApi.checkExportPdfOrPptStatus(
							data.task_key,
						)
						if (checkData.status === "completed" && checkData.download_url) {
							downloadFileWithAnchor(checkData.download_url)
							clearInterval(timer)
						}
						if (checkData.status === "failed") {
							magicToast.error(
								checkData.message || t("topicFiles.error.downloadFailed"),
							)
							clearInterval(timer)
						}
					} catch (error) {
						console.error("检查批量导出状态失败:", error)
						clearInterval(timer)
					}
				}, 2000)
			}
		} catch (error) {
			console.error("项目详情移动端批量导出失败:", error)
			magicToast.error(t("topicFiles.error.downloadFailed"))
		}
	}

	const batchShare = (items: AttachmentItem[]) => {
		const fileIds = items
			.map((item) => item.file_id)
			.filter((itemId): itemId is string => Boolean(itemId))
		if (fileIds.length === 0) return
		setShareFileIds(fileIds)
		setShareModalVisible(true)
	}

	const batchDelete = async (items: AttachmentItem[]) => {
		const fileIds = items
			.map((item) => item.file_id)
			.filter((itemId): itemId is string => Boolean(itemId))
		if (fileIds.length === 0) return

		const containsFolders = items.some((item) => item.is_directory)
		openDeleteConfirm({
			title: t("topicFiles.contextMenu.deleteBatchTipMobile"),
			emphasisText: t("topicFiles.contextMenu.deleteBatchSubject", {
				count: fileIds.length,
			}),
			descriptionText: t(
				containsFolders
					? "topicFiles.contextMenu.deleteBatchWithFoldersDescription"
					: "topicFiles.contextMenu.deleteBatchDescription",
			),
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

	const batchMove = (items: AttachmentItem[]) => {
		const fileIds = items
			.map((item) => item.file_id)
			.filter((itemId): itemId is string => Boolean(itemId))
		if (fileIds.length === 0) return
		moveFileHook.openBatchMoveByFileIds(fileIds)
	}

	return {
		selectionResetKey,
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
		batchDownload,
		batchExport,
		batchShare,
		batchMove,
		batchDelete,
	}
}
