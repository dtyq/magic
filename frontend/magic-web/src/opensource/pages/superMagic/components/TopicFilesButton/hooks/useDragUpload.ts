import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { UploadSource } from "../../MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/opensource/stores/folderUpload"
import type { BatchSaveInfo } from "@/opensource/stores/folderUpload/types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { AttachmentItem } from "./types"
import { pathToDirectoryNames } from "../utils/path-helper"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseDragUploadOptions {
	allowUpload?: boolean
	projectId?: string
	selectedProject?: any
	selectedTopic?: any
	workspaceId?: string
	debug?: boolean
	attachments?: AttachmentItem[]
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
}

interface UseDragUploadReturn {
	handleUploadFiles: (files: File[], targetPath: string, isFolder: boolean) => Promise<void>
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
	selectedProject,
	selectedTopic,
	workspaceId,
	debug = false,
	attachments = [],
	duplicateFileHandler: externalDuplicateHandler,
}: UseDragUploadOptions): UseDragUploadReturn {
	const { t } = useTranslation("super")

	// 实际上传处理函数（用于单个文件上传）
	const processFilesUpload = useCallback(
		async (files: File[], pathStr: string) => {
			// 文件上传：每个文件都创建一个独立的上传任务
			await Promise.all(
				files.map((file) =>
					multiFolderUploadStore.createUploadTask([file], pathStr, {
						projectId: projectId || "",
						workspaceId,
						projectName: selectedProject?.project_name || t("common.untitledProject"),
						topicId: selectedTopic?.id,
						taskId: "",
						storageType: "workspace",
						source: UploadSource.ProjectFile,
						onComplete: (taskId: string) => {
							if (debug) {
								console.log(
									`📄 文件上传任务 ${taskId} 完成（${file.name}），触发附件更新`,
								)
							}
							// 触发文件列表更新
							pubsub.publish(PubSubEvents.Update_Attachments)
						},
						// 每个批次上传完成的回调函数
						onBatchUploadComplete: (batchInfo) => {
							if (debug) {
								console.log(
									`📄 文件批次上传进度: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, 成功: ${batchInfo.batchSuccessCount}, 失败: ${batchInfo.batchFailedCount}`,
								)
							}
							// 当前批次有成功上传的文件时，触发文件列表的局部更新
							if (batchInfo.batchSuccessCount > 0) {
								pubsub.publish(PubSubEvents.Update_Attachments)
							}
						},
						// 每次批量保存完成的回调函数（实时保存机制）
						onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
							if (debug) {
								console.log(
									`💾 文件批量保存完成: ${batchSaveInfo.savedFilesCount} 文件已保存到项目, 总处理: ${batchSaveInfo.totalProcessedFiles}`,
								)
							}
							// 文件保存到项目后立即刷新文件列表，让用户能够实时看到文件出现
							pubsub.publish(PubSubEvents.Update_Attachments)
						},
					}),
				),
			)
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t, debug],
	)

	// 实际上传处理函数（用于文件夹上传）
	const processFolderUpload = useCallback(
		async (files: File[], pathStr: string) => {
			console.log("📁 [processFolderUpload] 开始上传文件夹:")
			console.log("  ↳ pathStr:", pathStr)
			console.log("  ↳ files 详情:")
			files.forEach((file) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const webkitPath = (file as any).webkitRelativePath || ""
				console.log(`    - name="${file.name}", webkitRelativePath="${webkitPath}"`)
			})

			// 文件夹上传：所有文件作为一个上传任务
			await multiFolderUploadStore.createUploadTask(files, pathStr, {
				projectId: projectId || "",
				workspaceId,
				projectName: selectedProject?.project_name || t("common.untitledProject"),
				topicId: selectedTopic?.id,
				taskId: "",
				storageType: "workspace",
				source: UploadSource.ProjectFile,
				onComplete: (taskId: string) => {
					if (debug) {
						console.log(`📁 文件夹上传任务 ${taskId} 完成，触发附件更新`)
					}
					// 触发文件列表更新
					pubsub.publish(PubSubEvents.Update_Attachments)
				},
				// 每个批次上传完成的回调函数
				onBatchUploadComplete: (batchInfo) => {
					if (debug) {
						console.log(
							`📁 文件夹批次上传进度: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, 成功: ${batchInfo.batchSuccessCount}, 失败: ${batchInfo.batchFailedCount}`,
						)
					}
					// 当前批次有成功上传的文件时，触发文件列表的局部更新
					if (batchInfo.batchSuccessCount > 0) {
						pubsub.publish(PubSubEvents.Update_Attachments)
					}
				},
				// 每次批量保存完成的回调函数（实时保存机制）
				onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
					if (debug) {
						console.log(
							`💾 文件夹批量保存完成: ${batchSaveInfo.savedFilesCount} 文件已保存到项目, 总处理: ${batchSaveInfo.totalProcessedFiles}`,
						)
					}
					// 文件保存到项目后立即刷新文件列表，让用户能够实时看到文件出现
					pubsub.publish(PubSubEvents.Update_Attachments)
				},
			})
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t, debug],
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
	 * @param targetPath 目标路径（如 "/" 或 "/folder1/folder2/"）
	 * @param isFolder 是否为文件夹上传
	 */
	const handleUploadFiles = useCallback(
		async (files: File[], targetPath: string, isFolder: boolean) => {
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
				// 将路径转换为目录名数组（用于上传）
				const pathStr = pathToDirectoryNames(targetPath).join("/")

				if (debug) {
					console.log("📤 开始上传文件:", {
						fileCount: files.length,
						targetPath,
						pathStr,
						isFolder,
					})
				}

				// 根据是否为文件夹上传选择不同的处理函数
				const uploadProcessor = isFolder ? processFolderUpload : processFilesUpload

				// 通过同名检测处理上传
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					pathStr,
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
			workspaceId,
			selectedProject,
			selectedTopic,
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
