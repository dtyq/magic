import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { UploadSource } from "../../MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import type { BatchSaveInfo } from "@/stores/folderUpload/types"
import type { AttachmentItem } from "./types"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import magicToast from "@/components/base/MagicToaster/utils"
import { createUploadRefreshCoordinator } from "../utils/uploadRefreshController"
import type { FileScope } from "@/apis/modules/fileScope"

interface UseDragUploadOptions {
	allowUpload?: boolean
	projectId?: string
	/** 文件上传凭证所属的特殊空间。 */
	fileScope?: FileScope
	selectedProject?: any
	selectedTopic?: any
	workspaceId?: string
	debug?: boolean
	attachments?: AttachmentItem[]
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
	onUpdateAttachments?: (sourceProjectId?: string) => void
}

interface UseDragUploadReturn {
	handleUploadFiles: (
		files: File[],
		targetItem: AttachmentItem | undefined,
		isFolder: boolean,
	) => Promise<void>
	duplicateFileHandler: ReturnType<typeof useDuplicateFileHandler>
}

/**
 * 拖拽上传功能 Hook
 *
 * 支持将外部文件直接拖拽上传到指定目录
 *
 * @param options 配置选项
 * @returns 上传方法
 */
export function useDragUpload({
	allowUpload = true,
	projectId,
	fileScope,
	selectedProject,
	selectedTopic,
	workspaceId,
	debug = false,
	attachments = [],
	duplicateFileHandler: externalDuplicateHandler,
	onUpdateAttachments,
}: UseDragUploadOptions): UseDragUploadReturn {
	const { t } = useTranslation("super")

	// 实际上传处理函数（用于单个文件上传）
	const processFilesUpload = useCallback(
		async (files: File[], parentId?: string, parentIdOverride?: string) => {
			const resolvedParentId = parentIdOverride ?? parentId
			const refreshCoordinator = createUploadRefreshCoordinator({
				uploadType: "file",
				projectFiles: attachments,
				uploadFileCount: files.length,
				onUpdateAttachments: () => onUpdateAttachments?.(projectId),
			})

			let firstError: unknown

			// File upload: create one task per file sequentially to avoid Promise spikes.
			for (const file of files) {
				try {
					await multiFolderUploadStore.createUploadTask([file], resolvedParentId, {
						projectId: projectId || "",
						fileScope,
						workspaceId,
						projectName: selectedProject?.project_name || t("common.untitledProject"),
						topicId: selectedTopic?.id,
						taskId: "",
						storageType: "workspace",
						source: UploadSource.ProjectFile,
						onComplete: (taskId: string) => {
							if (debug) {
								console.log(`📄 文件上传任务 ${taskId} 完成（${file.name}）`)
							}
							refreshCoordinator.handleFileTaskComplete(taskId, {
								fileName: file.name,
							})
						},
						onError: (taskId: string) => {
							refreshCoordinator.handleFileTaskError(taskId, {
								fileName: file.name,
							})
						},
						onBatchUploadComplete: (batchInfo) => {
							if (debug) {
								console.log(
									`📄 文件批次上传进度: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, 成功: ${batchInfo.batchSuccessCount}, 失败: ${batchInfo.batchFailedCount}`,
								)
							}
						},
						onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
							if (debug) {
								console.log(
									`💾 文件批量保存完成: ${batchSaveInfo.savedFilesCount} 文件已保存到项目, 总处理: ${batchSaveInfo.totalProcessedFiles}`,
								)
							}
							refreshCoordinator.handleBatchSaveComplete(batchSaveInfo, {
								fileName: file.name,
							})
						},
					})
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
				throw firstError
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
			debug,
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

			if (debug) {
				console.log("📁 [processFolderUpload] 开始上传文件夹:")
				console.log("  ↳ parentId:", resolvedParentId)
				console.log("  ↳ files 详情:")
				files.forEach((file) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const webkitPath = (file as any).webkitRelativePath || ""
					console.log(`    - name="${file.name}", webkitRelativePath="${webkitPath}"`)
				})
			}

			// 文件夹上传：所有文件作为一个上传任务
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
						if (debug) {
							console.log(`📁 文件夹上传任务 ${taskId} 完成`)
						}
						refreshCoordinator.flushDeferredRefresh("taskComplete", { taskId })
					},
					onError: (taskId: string) => {
						refreshCoordinator.flushDeferredRefresh("taskError", { taskId })
					},
					onBatchUploadComplete: (batchInfo) => {
						if (debug) {
							console.log(
								`📁 文件夹批次上传进度: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, 成功: ${batchInfo.batchSuccessCount}, 失败: ${batchInfo.batchFailedCount}`,
							)
						}
					},
					onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
						if (debug) {
							console.log(
								`💾 文件夹批量保存完成: ${batchSaveInfo.savedFilesCount} 文件已保存到项目, 总处理: ${batchSaveInfo.totalProcessedFiles}`,
							)
						}
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
			debug,
		],
	)

	// 同名文件处理 handler（优先使用外部传入的共享 handler）
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})
	const duplicateFileHandler = externalDuplicateHandler || internalDuplicateHandler

	/**
	 * 处理文件上传到指定路径
	 *
	 * @param files 要上传的文件列表
	 * @param targetItem 目标文件夹项（包含 file_id）
	 * @param isFolder 是否为文件夹上传
	 */
	const handleUploadFiles = useCallback(
		async (files: File[], targetItem: AttachmentItem | undefined, isFolder: boolean) => {
			// 权限检查
			if (!allowUpload) {
				magicToast.warning(t("topicFiles.contextMenu.noEditPermission", "没有编辑权限"))
				return
			}

			// 项目检查
			if (!projectId) {
				magicToast.warning(t("topicFiles.contextMenu.projectRequired", "请先选择项目"))
				return
			}

			// 文件检查
			if (!files || files.length === 0) {
				magicToast.warning(t("topicFiles.contextMenu.noFilesSelected", "未选择任何文件"))
				return
			}

			try {
				// 提取 parentId
				const parentId = targetItem?.is_directory ? targetItem.file_id || "" : ""

				if (debug) {
					console.log("📤 开始上传文件:", {
						fileCount: files.length,
						parentId,
						isFolder,
					})
				}

				// 根据是否为文件夹上传选择不同的处理函数
				const uploadProcessor = isFolder ? processFolderUpload : processFilesUpload

				// 通过同名检测处理上传
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					parentId,
					uploadProcessor,
				)

				if (debug) {
					console.log("✅ 上传任务创建成功")
				}
			} catch (error) {
				console.error("上传失败:", error)
				magicToast.error(t("topicFiles.contextMenu.uploadError", "文件上传失败"))
			}
		},
		[
			allowUpload,
			projectId,
			t,
			debug,
			duplicateFileHandler,
			processFilesUpload,
			processFolderUpload,
		],
	)

	return {
		handleUploadFiles,
		// 同名文件处理状态（统一处理文件和文件夹上传）
		duplicateFileHandler,
	}
}
