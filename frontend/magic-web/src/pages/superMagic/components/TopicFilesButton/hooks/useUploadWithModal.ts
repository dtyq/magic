import { useState, useCallback } from "react"
import { message } from "antd"
import { useTranslation } from "react-i18next"
import { UploadSource } from "../../MessageEditor/hooks/useFileUpload"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import type { BatchSaveInfo } from "@/stores/folderUpload/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { AttachmentItem } from "./types"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"

interface UseUploadWithModalOptions {
	projectId?: string
	selectedProject?: any
	selectedTopic?: any
	attachments?: AttachmentItem[]
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
}

export function useUploadWithModal({
	projectId,
	selectedProject,
	selectedTopic,
	attachments = [],
	duplicateFileHandler: externalDuplicateHandler,
}: UseUploadWithModalOptions) {
	const { t } = useTranslation("super")
	const workspaceId = selectedProject?.workspace_id

	// UploadModal 状态管理
	const [uploadModalVisible, setUploadModalVisible] = useState(false)
	const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([])
	const [isUploadingFolder, setIsUploadingFolder] = useState(false)

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
							console.log(
								`📄 Modal file upload task ${taskId} completed for ${file.name}, triggering attachments update`,
							)
							// 触发文件列表更新
							pubsub.publish(PubSubEvents.Update_Attachments)
						},
						// 每个批次上传完成的回调函数
						onBatchUploadComplete: (batchInfo) => {
							console.log(
								`📄 Modal file batch upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
							)
							// 当前批次有成功上传的文件时，触发文件列表的局部更新
							if (batchInfo.batchSuccessCount > 0) {
								pubsub.publish(PubSubEvents.Update_Attachments)
							}
						},
						// 每次批量保存完成的回调函数（实时保存机制）
						onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
							console.log(
								`💾 Modal file batch save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
							)
							// 文件保存到项目后立即刷新文件列表，让用户能够实时看到文件出现
							pubsub.publish(PubSubEvents.Update_Attachments)
						},
					}),
				),
			)
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t],
	)

	// 实际上传处理函数（用于文件夹上传）
	const processFolderUpload = useCallback(
		async (files: File[], pathStr: string) => {
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
					console.log(
						`📁 Modal folder upload task ${taskId} completed, triggering attachments update`,
					)
					// 触发文件列表更新
					pubsub.publish(PubSubEvents.Update_Attachments)
				},
				// 每个批次上传完成的回调函数
				onBatchUploadComplete: (batchInfo) => {
					console.log(
						`📁 Modal folder batch upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
					)
					// 当前批次有成功上传的文件时，触发文件列表的局部更新
					if (batchInfo.batchSuccessCount > 0) {
						pubsub.publish(PubSubEvents.Update_Attachments)
					}
				},
				// 每次批量保存完成的回调函数（实时保存机制）
				onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
					console.log(
						`💾 Modal folder batch save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
					)
					// 文件保存到项目后立即刷新文件列表，让用户能够实时看到文件出现
					pubsub.publish(PubSubEvents.Update_Attachments)
				},
			})
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t],
	)

	// 同名文件处理 handler（优先使用外部传入的共享 handler）
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments,
	})
	const duplicateFileHandler = externalDuplicateHandler || internalDuplicateHandler

	// 处理文件选择完成后打开 UploadModal
	const handleFilesSelected = useCallback((files: File[], isFolder: boolean = false) => {
		setSelectedUploadFiles(files)
		setIsUploadingFolder(isFolder)
		setUploadModalVisible(true)
	}, [])

	// 自定义上传文件处理函数
	const handleCustomUploadFile = useCallback(() => {
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = true
		input.style.display = "none"

		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files
			if (files && files.length > 0) {
				handleFilesSelected(Array.from(files), false)
			}
			document.body.removeChild(input)
		}

		document.body.appendChild(input)
		input.click()
	}, [handleFilesSelected])

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
				// 将 AttachmentItem[] 转换为路径字符串
				const pathStr = path.map((item) => item.file_name).join("/")

				// 根据是否为文件夹上传选择不同的处理函数
				const uploadProcessor = isUploadingFolder ? processFolderUpload : processFilesUpload

				// 通过同名检测处理上传
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					pathStr,
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
	}
}
