import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { UploadSource } from "../../MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import type { BatchSaveInfo } from "@/stores/folderUpload/types"
import type { AttachmentItem } from "./types"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { createUploadRefreshCoordinator } from "../utils/uploadRefreshController"
import type { FileScope } from "@/apis/modules/fileScope"
import magicToast from "@/components/base/MagicToaster/utils"

/** 按目录加载的空间在选择文件后提供真实目标和同名检查数据。 */
export interface UploadTarget {
	parentId: string
	attachments: AttachmentItem[]
	isCurrent: () => boolean
	onTaskCreated: (id: string, cancel: () => Promise<void>) => void
	onTaskFinished: (id: string) => void
	onUpdateAttachments: () => void
}

interface UseUploadWithModalOptions {
	beforeUpload?: (files: File[]) => Promise<boolean>
	projectId?: string
	/** 文件上传凭证所属的特殊空间。 */
	fileScope?: FileScope
	selectedProject?: any
	selectedTopic?: any
	attachments?: AttachmentItem[]
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
	onUpdateAttachments?: (sourceProjectId?: string) => void
	title?: string
	resolveUploadTarget?: () => Promise<UploadTarget>
}

export function useUploadWithModal({
	beforeUpload,
	projectId,
	fileScope,
	selectedProject,
	selectedTopic,
	attachments = [],
	duplicateFileHandler: externalDuplicateHandler,
	onUpdateAttachments,
	title,
	resolveUploadTarget,
}: UseUploadWithModalOptions) {
	const { t } = useTranslation("super")
	const workspaceId = selectedProject?.workspace_id

	// UploadModal 状态管理
	const [uploadModalVisible, setUploadModalVisible] = useState(false)
	const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([])
	const [isUploadingFolder, setIsUploadingFolder] = useState(false)
	const [directUpload, setDirectUpload] = useState<{
		files: File[]
		target: UploadTarget
	} | null>(null)
	const startedUploadRef = useRef<typeof directUpload>(null)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const preparingUploadRef = useRef(false)
	const directTarget = directUpload?.target
	const uploadAttachments = directTarget?.attachments ?? attachments
	const refreshAttachments = directTarget?.onUpdateAttachments ?? onUpdateAttachments
	useEffect(() => () => fileInputRef.current?.remove(), [])

	// 实际上传处理函数（用于单个文件上传）
	const processFilesUpload = useCallback(
		async (files: File[], parentId?: string, parentIdOverride?: string) => {
			if (directTarget && !directTarget.isCurrent()) return
			const resolvedParentId = parentIdOverride ?? parentId
			const refreshCoordinator = createUploadRefreshCoordinator({
				uploadType: "file",
				projectFiles: uploadAttachments,
				uploadFileCount: files.length,
				onUpdateAttachments: () => refreshAttachments?.(projectId),
			})

			let firstError: unknown

			// File upload: create one task per file sequentially to avoid Promise spikes.
			for (const file of files) {
				if (directTarget && !directTarget.isCurrent()) break
				try {
					const taskId = await multiFolderUploadStore.createUploadTask(
						[file],
						resolvedParentId,
						{
							projectId: projectId || "",
							fileScope,
							workspaceId,
							projectName:
								title ||
								selectedProject?.project_name ||
								t("common.untitledProject"),
							topicId: selectedTopic?.id,
							taskId: "",
							storageType: "workspace",
							source: UploadSource.ProjectFile,
							onComplete: (taskId: string) => {
								directTarget?.onTaskFinished(taskId)
								console.log(
									`📄 Modal file upload task ${taskId} completed for ${file.name}`,
								)
								refreshCoordinator.handleFileTaskComplete(taskId, {
									fileName: file.name,
								})
							},
							onError: (taskId: string) => {
								directTarget?.onTaskFinished(taskId)
								refreshCoordinator.handleFileTaskError(taskId, {
									fileName: file.name,
								})
							},
							onBatchUploadComplete: (batchInfo) => {
								console.log(
									`📄 Modal file batch upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
								)
							},
							onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
								console.log(
									`💾 Modal file batch save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
								)
								refreshCoordinator.handleBatchSaveComplete(batchSaveInfo, {
									fileName: file.name,
								})
							},
						},
					)
					if (directTarget && !directTarget.isCurrent()) {
						await multiFolderUploadStore.cancelTask(taskId)
						break
					}
					directTarget?.onTaskCreated(taskId, () =>
						multiFolderUploadStore.cancelTask(taskId),
					)
					refreshCoordinator.markTaskCreated({
						fileName: file.name,
						parentId: resolvedParentId,
					})
				} catch (error) {
					refreshCoordinator.markTaskCreateFailed({
						fileName: file.name,
						parentId: resolvedParentId,
					})
					firstError = firstError || error
				}
			}

			if (firstError) {
				if (!directTarget) throw firstError
				if (directTarget.isCurrent()) magicToast.error(t("userSpace.uploadFailed"))
			}
			if (directTarget?.isCurrent()) setDirectUpload(null)
		},
		[
			directTarget,
			uploadAttachments,
			refreshAttachments,
			title,
			projectId,
			fileScope,
			workspaceId,
			selectedProject,
			selectedTopic,
			t,
		],
	)

	// 实际上传处理函数（用于文件夹上传）
	const processFolderUpload = useCallback(
		async (
			files: File[],
			parentId?: string,
			parentIdOverride?: string,
			displayName?: string,
		) => {
			const resolvedParentId = parentIdOverride ?? parentId
			const refreshCoordinator = createUploadRefreshCoordinator({
				uploadType: "folder",
				projectFiles: attachments,
				uploadFileCount: files.length,
				onUpdateAttachments: () => onUpdateAttachments?.(projectId),
			})

			// Folder upload: all files share one upload task.
			try {
				await multiFolderUploadStore.createUploadTask(files, resolvedParentId, {
					projectId: projectId || "",
					fileScope,
					workspaceId,
					projectName: selectedProject?.project_name || t("common.untitledProject"),
					topicId: selectedTopic?.id,
					taskId: "",
					storageType: "workspace",
					source: UploadSource.ProjectFile,
					displayName,
					onComplete: (taskId: string) => {
						console.log(`📁 Modal folder upload task ${taskId} completed`)
						refreshCoordinator.flushDeferredRefresh("taskComplete", { taskId })
					},
					onError: (taskId: string) => {
						refreshCoordinator.flushDeferredRefresh("taskError", { taskId })
					},
					onBatchUploadComplete: (batchInfo) => {
						console.log(
							`📁 Modal folder batch upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
						)
					},
					onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
						console.log(
							`💾 Modal folder batch save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
						)
						refreshCoordinator.handleBatchSaveComplete(batchSaveInfo)
					},
				})
				refreshCoordinator.markTaskCreated({
					filesCount: files.length,
					parentId: resolvedParentId,
				})
			} catch (error) {
				refreshCoordinator.markTaskCreateFailed({
					filesCount: files.length,
					parentId: resolvedParentId,
				})
				throw error
			}
		},
		[
			attachments,
			onUpdateAttachments,
			projectId,
			fileScope,
			workspaceId,
			selectedProject,
			selectedTopic,
			t,
		],
	)

	// 同名文件处理 handler（优先使用外部传入的共享 handler）
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: uploadAttachments,
	})
	const duplicateFileHandler = externalDuplicateHandler || internalDuplicateHandler
	const directUploadCurrent = directTarget?.isCurrent() ?? true

	// 目标目录准备完成后再检查同名；弹窗与任务创建仍使用既有上传流程。
	useEffect(() => {
		if (!directUpload || directUpload === startedUploadRef.current) return
		startedUploadRef.current = directUpload
		if (!directUpload.target.isCurrent()) return
		void duplicateFileHandler
			.handleFilesWithDuplicateCheck(
				directUpload.files,
				directUpload.target.parentId,
				processFilesUpload,
			)
			.catch(() => {
				if (directUpload.target.isCurrent()) magicToast.error(t("userSpace.uploadFailed"))
			})
	}, [directUpload, duplicateFileHandler, processFilesUpload, t])

	useEffect(() => {
		if (directUploadCurrent) return
		duplicateFileHandler.handleCancel()
		setDirectUpload(null)
	}, [directUploadCurrent, duplicateFileHandler])

	// 处理文件选择完成后打开 UploadModal
	const handleFilesSelected = useCallback(
		async (files: File[], isFolder: boolean = false, confirmed: boolean = false) => {
			if (resolveUploadTarget && !isFolder) {
				if (preparingUploadRef.current || directUpload) return
				preparingUploadRef.current = true
				try {
					// 目标解析可能创建缺失目录，必须在它之前完成上传确认。
					if (!confirmed && beforeUpload && !(await beforeUpload(files))) return
					const target = await resolveUploadTarget()
					if (target.isCurrent()) setDirectUpload({ files, target })
				} catch (error) {
					if (!(error instanceof DOMException && error.name === "AbortError"))
						magicToast.error(t("userSpace.uploadFailed"))
				} finally {
					preparingUploadRef.current = false
				}
				return
			}
			setSelectedUploadFiles(files)
			setIsUploadingFolder(isFolder)
			setUploadModalVisible(true)
		},
		[resolveUploadTarget, directUpload, beforeUpload, t],
	)

	// 自定义上传文件处理函数
	const handleCustomUploadFile = useCallback(() => {
		if (resolveUploadTarget && (preparingUploadRef.current || directUpload)) return
		fileInputRef.current?.remove()
		const input = document.createElement("input")
		fileInputRef.current = input
		input.type = "file"
		input.multiple = true
		input.style.display = "none"
		input.oncancel = () => input.remove()

		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files
			if (files && files.length > 0) {
				handleFilesSelected(Array.from(files), false)
			}
			document.body.removeChild(input)
		}

		document.body.appendChild(input)
		input.click()
	}, [handleFilesSelected, resolveUploadTarget, directUpload])

	// 自定义上传文件夹处理函数
	const handleCustomUploadFolder = useCallback(() => {
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = true
		input.webkitdirectory = true
		input.style.display = "none"

		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files
			if (files && files.length > 0) {
				handleFilesSelected(Array.from(files), true)
			}
			document.body.removeChild(input)
		}

		document.body.appendChild(input)
		input.click()
	}, [handleFilesSelected])

	// 处理 UploadModal 提交
	const handleUploadModalSubmit = useCallback(
		async ({ path, files }: { path: AttachmentItem[]; files: File[] }) => {
			try {
				// 提取最后一个 AttachmentItem 的 file_id 作为 parentId
				const parentId = path.length > 0 ? path[path.length - 1].file_id || "" : ""

				// 根据是否为文件夹上传选择不同的处理函数
				const uploadProcessor = isUploadingFolder ? processFolderUpload : processFilesUpload

				// 通过同名检测处理上传
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					parentId,
					uploadProcessor,
				)
			} catch (error) {
				console.error("Upload failed:", error)
			}
		},
		[duplicateFileHandler, processFilesUpload, processFolderUpload, isUploadingFolder],
	)

	// 处理 UploadModal 关闭
	const handleUploadModalClose = useCallback(() => {
		setUploadModalVisible(false)
		setSelectedUploadFiles([])
		setIsUploadingFolder(false)
	}, [])

	return {
		// 状态
		uploadModalVisible,
		selectedUploadFiles,
		isUploadingFolder,

		// 操作方法
		handleCustomUploadFile,
		handleCustomUploadFolder,
		handleUploadModalSubmit,
		handleUploadModalClose,
		handleFilesSelected,

		// 同名文件处理状态（统一处理文件和文件夹上传）
		duplicateFileHandler,
		cancelDirectUpload: () => {
			duplicateFileHandler.handleCancel()
			setDirectUpload(null)
		},
	}
}
