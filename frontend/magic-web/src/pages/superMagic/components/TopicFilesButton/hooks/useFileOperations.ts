import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./types"
import { createShareHandler } from "../utils/createShareHandler"
import { getTemporaryDownloadUrl, downloadFileContent } from "../../../utils/api"
import { UploadSource, useFileUpload } from "../../MessageEditor/hooks/useFileUpload"
import { handleShareFunction } from "../../../utils/share"
import { ShareType, ResourceType } from "../../Share/types"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { exportSingleFileToPdf, exportSingleFileToPpt } from "../utils/exportSingleFile"
import { ROOT_FILE_ID } from "../constant"
import { getParentIdFromPath as _getParentIdFromPath } from "../utils/getParentIdFromPath"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import type { BatchSaveInfo } from "@/stores/folderUpload/types"
import { DownloadImageMode, ProjectListItem } from "../../../pages/Workspace/types"
import { useExportProgress } from "./useExportProgress"
import { useFileOpen } from "./useFileOpen"
import { SuperMagicApi } from "@/apis"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { useMemoizedFn } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import { exportPPTX } from "../../../../../../packages/html2pptx/src"
import {
	prepareExportSlides,
	prepareSingleSlideExport,
} from "@/pages/superMagic/services/pptService"

// 工具函数：从attachments中递归删除指定ID的文件/文件夹
const removeItemFromAttachments = (
	attachments: AttachmentItem[],
	targetId: string,
): AttachmentItem[] => {
	return attachments
		.filter((item) => {
			// 如果是目标项目，则过滤掉
			const itemId = item.file_id || (item as any).id
			return itemId !== targetId
		})
		.map((item) => {
			// 如果是文件夹，递归处理children
			if (item.is_directory && "children" in item) {
				return {
					...item,
					children: removeItemFromAttachments(item.children || [], targetId),
				}
			}
			return item
		})
}

// 工具函数：从 attachments 中查找文件
const findFileInAttachments = (
	attachments: AttachmentItem[],
	fileId: string,
): AttachmentItem | null => {
	for (const item of attachments) {
		if (item.file_id === fileId) {
			return item
		}
		if (item.is_directory && "children" in item && item.children) {
			const found = findFileInAttachments(item.children, fileId)
			if (found) return found
		}
	}
	return null
}

// 工具函数：处理 OnlyOffice 文件的 buffer（参考 OnlyOffice/index.tsx 的逻辑）
const processOnlyOfficeBuffer = (fileData: ArrayBuffer, fileExtension?: string): ArrayBuffer => {
	const ext = (fileExtension || "").toLowerCase()

	// CSV 和 TXT 是文本文件，直接返回原始数据
	if (["csv", "txt"].includes(ext)) {
		return fileData
	}

	// 检查 ZIP 文件头（Excel/Docx/PPT 都是 ZIP 格式）
	if (fileData.byteLength >= 4) {
		const view = new DataView(fileData, 0, 4)
		const signature = view.getUint32(0, true)

		// ZIP 文件魔数: 0x504b0304 (PK\x03\x04)
		if (signature === 0x04034b50) {
			return fileData
		} else {
			// 不是 ZIP 文件，尝试 base64 解码（参考 OnlyOffice/index.tsx 的 stringToBuffer）
			try {
				const text = new TextDecoder("utf-8").decode(fileData)
				// 验证是否是有效的 base64 字符串
				const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
				if (base64Regex.test(text.trim())) {
					const binary = atob(text)
					const bytes = new Uint8Array(binary.length)
					for (let i = 0; i < binary.length; i++) {
						bytes[i] = binary.charCodeAt(i)
					}
					return bytes.buffer
				}
			} catch (e) {
				// base64 解码失败，返回原始数据
				console.warn("base64 decode failed, using original data:", e)
			}
			return fileData
		}
	}
	return fileData
}

// 工具函数：获取 OnlyOffice 文件的 MIME type
const getOnlyOfficeMimeType = (fileExtension: string): string => {
	const ext = fileExtension.toLowerCase()
	if (["xlsx", "xls"].includes(ext)) {
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	} else if (ext === "csv") {
		return "text/csv"
	} else if (["docx"].includes(ext)) {
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=UTF-8"
	} else if (["pptx", "ppt"].includes(ext)) {
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	}
	return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

// 工具函数：下载 OnlyOffice 文件（通过 file_id 获取 buffer 并下载）
const downloadOnlyOfficeFile = async (
	fileId: string,
	fileExtension: string,
	attachments: AttachmentItem[] | undefined,
	mode?: DownloadImageMode,
): Promise<void> => {
	// 获取文件下载 URL
	const res = await getTemporaryDownloadUrl({
		file_ids: [fileId],
		download_mode: mode,
		is_download: true,
	})
	if (!res[0]?.url) {
		throw new Error("无法获取文件下载地址")
	}

	// 下载文件内容为 ArrayBuffer
	const fileData = await downloadFileContent(res[0].url, {
		responseType: "arrayBuffer",
	})

	if (!(fileData instanceof ArrayBuffer)) {
		throw new Error("文件数据格式错误")
	}

	// 处理 buffer（传递文件扩展名以正确处理 CSV 等文本文件）
	const finalBuffer = processOnlyOfficeBuffer(fileData, fileExtension)

	// 获取 MIME type
	const mimeType = getOnlyOfficeMimeType(fileExtension)

	// 创建 blob URL 并使用 downloadFileWithAnchor 下载
	const blob = new Blob([finalBuffer], { type: mimeType })
	const blobUrl = window.URL.createObjectURL(blob)

	// 从 attachments 中查找文件名
	let fileName: string | undefined
	if (attachments) {
		const fileItem = findFileInAttachments(attachments, fileId)
		fileName = fileItem?.file_name || fileItem?.display_filename || fileItem?.filename
	}

	downloadFileWithAnchor(blobUrl, fileName)

	// 清理 blob URL
	setTimeout(() => {
		window.URL.revokeObjectURL(blobUrl)
	}, 100)
}

export interface UseFileOperationsOptions {
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
	attachments?: AttachmentItem[]
	selectedTopic?: any
	projectId?: string
	getItemId?: (item: AttachmentItem) => string
	onFileDelete?: (fileId: string) => Promise<void>
	// 新增：文件创建成功回调
	onFileCreated?: (fileItem: any) => void
	onUpdateAttachments?: () => void
	// 添加直接更新attachments的回调
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
	selectedProject?: ProjectListItem
	// 外部传入的共享 duplicateFileHandler（可选）
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
	// 新增：用于收集多个选中文件的分享
	selectedItems?: Set<string>
	filteredFiles?: AttachmentItem[]
}

/**
 * useFileOperations - 处理所有文件操作功能
 */
export function useFileOperations(options: UseFileOperationsOptions = {}) {
	const {
		setUserSelectDetail,
		onFileClick,
		attachments,
		selectedTopic,
		projectId,
		getItemId,
		onFileDelete,
		onFileCreated,
		onUpdateAttachments,
		onAttachmentsChange,
		selectedProject,
		duplicateFileHandler: externalDuplicateHandler,
		selectedItems,
		filteredFiles,
	} = options
	const { t } = useTranslation("super")

	// 导出进度管理
	const {
		isExportingPdf,
		pdfExportProgress,
		isExportingPpt,
		pptExportProgress,
		isBatchExportingPdf,
		batchPdfExportProgress,
		isBatchExportingPpt,
		batchPptExportProgress,
		onPdfExportStart,
		onPdfExportProgress,
		onPdfExportEnd,
		onPptExportStart,
		onPptExportProgress,
		onPptExportEnd,
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,
		resetExportProgress,
	} = useExportProgress()

	// 文件打开功能
	const { handleOpenFile } = useFileOpen({
		onFileClick,
		setUserSelectDetail,
		attachments,
	})

	const workspaceId = selectedProject?.workspace_id

	// 分享模态框状态
	const [shareModalVisible, setShareModalVisible] = useState(false)
	const [shareFileInfo, setShareFileInfo] = useState<{
		projectName?: string
		fileIds: string[]
		resourceId?: string
	} | null>(null)

	// 文件导出loading状态
	const [exportingFiles, setExportingFiles] = useState<Set<string>>(new Set())

	// 文件夹下载loading状态
	const [downloadingFolders, setDownloadingFolders] = useState<Set<string>>(new Set())

	// 删除状态管理
	const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set())

	// 文件创建loading状态
	const [creatingFiles, setCreatingFiles] = useState<Set<string>>(new Set())

	// 文件移动loading状态
	const [movingFiles, setMovingFiles] = useState<Set<string>>(new Set())

	// 通用的文件上传处理函数（实际执行上传）- 用于普通文件上传（每个文件一个任务）
	const processFilesUpload = useCallback(
		async (files: File[], targetSuffixDir: string) => {
			// 为每个文件创建单独的任务
			for (const file of files) {
				try {
					// 为单个文件创建任务
					await multiFolderUploadStore.createUploadTask([file], targetSuffixDir, {
						projectId: projectId || "",
						workspaceId: workspaceId,
						projectName: selectedProject?.project_name || t("common.untitledProject"),
						topicId: selectedTopic?.id,
						taskId: "",
						storageType: "workspace",
						source: UploadSource.ProjectFile,
						// 单个文件任务完成时的回调
						onComplete: (taskId: string) => {
							console.log(
								`📄 File upload task ${taskId} for "${file.name}" completed, triggering attachments update`,
							)
							// 触发文件列表更新
							pubsub.publish(PubSubEvents.Update_Attachments)
							onUpdateAttachments?.()
						},
						// 批次上传完成回调（对单文件来说就是文件完成）
						onBatchUploadComplete: (batchInfo) => {
							console.log(
								`📄 File "${file.name}" upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
							)
							if (batchInfo.batchSuccessCount > 0) {
								pubsub.publish(PubSubEvents.Update_Attachments)
								onUpdateAttachments?.()
							}
						},
						// 批量保存完成回调
						onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
							console.log(
								`💾 File "${file.name}" save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
							)
							// 文件保存到项目后立即刷新文件列表
							pubsub.publish(PubSubEvents.Update_Attachments)
							onUpdateAttachments?.()
						},
					})

					console.log(`✅ Successfully created upload task for file: ${file.name}`)
				} catch (error) {
					console.error(`❌ Failed to create upload task for file ${file.name}:`, error)
				}
			}
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t, onUpdateAttachments],
	)

	// 文件夹上传处理函数（所有文件作为一个任务）
	const processFolderUpload = useCallback(
		async (files: File[], targetSuffixDir: string) => {
			try {
				// 所有文件作为一个任务
				await multiFolderUploadStore.createUploadTask(files, targetSuffixDir, {
					projectId: projectId || "",
					workspaceId: workspaceId,
					projectName: selectedProject?.project_name || t("common.untitledProject"),
					topicId: selectedTopic?.id,
					taskId: "",
					storageType: "workspace",
					source: UploadSource.ProjectFile,
					// 文件夹任务完成时的回调
					onComplete: (taskId: string) => {
						console.log(
							`📁 Folder upload task ${taskId} completed, triggering attachments update`,
						)
						// 触发文件列表更新
						pubsub.publish(PubSubEvents.Update_Attachments)
						onUpdateAttachments?.()
					},
					// 批次上传完成回调
					onBatchUploadComplete: (batchInfo) => {
						console.log(
							`📁 Folder upload progress: ${batchInfo.currentBatch}/${batchInfo.totalBatches}, success: ${batchInfo.batchSuccessCount}, failed: ${batchInfo.batchFailedCount}`,
						)
						if (batchInfo.batchSuccessCount > 0) {
							pubsub.publish(PubSubEvents.Update_Attachments)
							onUpdateAttachments?.()
						}
					},
					// 批量保存完成回调
					onBatchSaveComplete: (batchSaveInfo: BatchSaveInfo) => {
						console.log(
							`💾 Folder save completed: ${batchSaveInfo.savedFilesCount} files saved to project, total processed: ${batchSaveInfo.totalProcessedFiles}`,
						)
						// 文件保存到项目后立即刷新文件列表
						pubsub.publish(PubSubEvents.Update_Attachments)
						onUpdateAttachments?.()
					},
				})

				console.log(`✅ Successfully created folder upload task with ${files.length} files`)
			} catch (error) {
				console.error(`❌ Failed to create folder upload task:`, error)
			}
		},
		[projectId, workspaceId, selectedProject, selectedTopic, t, onUpdateAttachments],
	)

	// 同名文件处理 handler（优先使用外部传入的共享 handler）
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})
	const duplicateFileHandler = externalDuplicateHandler || internalDuplicateHandler

	// 集成文件上传功能
	const { uploading, removeFile } = useFileUpload({
		projectId,
		onFileCompleted: () => {
			// 文件上传完成后，触发文件列表更新
			pubsub.publish(PubSubEvents.Update_Attachments)
			onUpdateAttachments?.()
		},
		storageType: "workspace",
		source: UploadSource.ProjectFile,
		needFilterSameFile: false,
		maxUploadCount: 99999,
		maxUploadSize: multiFolderUploadStore.uploadConfig.maxFileSize, // 使用store的配置
	})

	// 获取父文件夹ID - 从路径中解析
	const getParentIdFromPath = useCallback(
		(parentPath?: string): string | number | undefined => {
			return _getParentIdFromPath(attachments || [], parentPath)
		},
		[attachments],
	)

	// 创建文件的实际实现 - 供useVirtualFile调用
	const createFileAndUpload = async (file: File, suffixDir?: string) => {
		if (!projectId) {
			throw new Error("项目ID不能为空")
		}

		const fileKey = `${Date.now()}-${Math.random()}`
		setCreatingFiles((prev) => new Set(prev).add(fileKey))

		try {
			// 获取父文件夹ID
			const parentPath = suffixDir ? `/${suffixDir}` : undefined
			const parent_id = getParentIdFromPath(parentPath)

			console.log("🔵 创建文件:", {
				file_name: file.name,
				project_id: projectId,
				parent_id,
				parentPath,
				suffixDir,
			})

			// 调用新的创建文件API
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id,
				file_name: file.name,
				is_directory: false,
			})

			console.log("✅ 文件创建成功:", response)

			// 触发文件列表更新
			pubsub.publish(PubSubEvents.Update_Attachments, () => {
				// 文件列表更新完成后，自动打开新创建的文件Tab
				if (onFileCreated && response.file_id) {
					console.log("🔵 调用文件创建回调，自动打开Tab:", response.file_id)
					onFileCreated(response)
				}
			})
			onUpdateAttachments?.()

			return response
		} catch (error) {
			console.error("创建文件失败:", error)
			throw error
		} finally {
			setCreatingFiles((prev) => {
				const newSet = new Set(prev)
				newSet.delete(fileKey)
				return newSet
			})
		}
	}

	// 创建文件夹的实际实现 - 供useVirtualFolder调用
	const createFolderAndUpload = async (folderName: string, parentPath?: string) => {
		if (!projectId) {
			throw new Error("项目ID不能为空")
		}

		const folderKey = `${Date.now()}-${Math.random()}`
		setCreatingFiles((prev) => new Set(prev).add(folderKey))

		try {
			// 获取父文件夹ID
			const parent_id = getParentIdFromPath(parentPath)

			console.log("🔵 创建文件夹:", {
				file_name: folderName,
				project_id: projectId,
				parent_id,
				parentPath,
			})

			// 调用新的创建文件夹API
			const response = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id,
				file_name: folderName,
				is_directory: true,
			})

			console.log("✅ 文件夹创建成功:", response)

			// 触发文件列表更新
			pubsub.publish(PubSubEvents.Update_Attachments)
			onUpdateAttachments?.()

			return response
		} catch (error) {
			console.error("创建文件夹失败:", error)
			throw error
		} finally {
			setCreatingFiles((prev) => {
				const newSet = new Set(prev)
				newSet.delete(folderKey)
				return newSet
			})
		}
	}

	// 创建画布项目 - 创建文件夹并在其中创建 magic.project.js 文件
	const createDesignProject = async (folderName: string, parentPath?: string) => {
		if (!projectId) {
			throw new Error("项目ID不能为空")
		}

		const projectKey = `${Date.now()}-${Math.random()}`
		setCreatingFiles((prev) => new Set(prev).add(projectKey))

		try {
			// 获取父文件夹ID
			const parent_id = getParentIdFromPath(parentPath)

			// 直接调用 API 创建文件夹（不触发刷新）
			const folderResponse = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id,
				file_name: folderName,
				is_directory: true,
			})

			if (!folderResponse?.file_id) {
				throw new Error("文件夹创建失败")
			}

			// 在文件夹中创建 magic.project.js 文件
			const fileContent = `window.magicProjectConfig = {
	"version": "1.0.0",
	"type": "design",
	"name": "${folderName}"
}`
			const fileName = "magic.project.js"

			// 直接使用文件夹的 file_id 作为 parent_id 创建文件
			const fileResponse = await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: folderResponse.file_id,
				file_name: fileName,
				is_directory: false,
			})

			if (!fileResponse?.file_id) {
				throw new Error("文件创建失败")
			}

			// 保存文件内容
			await SuperMagicApi.saveFileContent([
				{
					file_id: fileResponse.file_id,
					content: fileContent,
				},
			])

			// 所有操作完成后，统一触发文件列表更新（只刷新一次）
			pubsub.publish(PubSubEvents.Update_Attachments)
			onUpdateAttachments?.()

			magicToast.success(t("topicFiles.contextMenu.createDesignSuccess"))

			return folderResponse
		} catch (error) {
			magicToast.error(t("topicFiles.contextMenu.createDesignFailed"))
			throw error
		} finally {
			setCreatingFiles((prev) => {
				const newSet = new Set(prev)
				newSet.delete(projectKey)
				return newSet
			})
		}
	}

	// 文件上传操作 - 每个文件作为单独任务
	const handleUploadFile = (item?: AttachmentItem) => {
		// 获取上传目标文件夹路径
		const targetPath = item?.is_directory ? item.relative_file_path || item.name : undefined
		// 清理路径：移除前导和尾随斜杠，确保路径格式统一
		const targetSuffixDir = targetPath ? targetPath.replace(/^\/+|\/+$/g, "") : ""

		// 创建隐藏的文件输入框
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = true
		input.style.display = "none"

		// 处理文件选择
		input.onchange = async (e) => {
			const fileList = (e.target as HTMLInputElement).files
			if (fileList && fileList.length > 0) {
				const files = Array.from(fileList)

				console.log("选择的文件:", files)
				console.log("上传目标路径:", targetPath)
				console.log("计算的suffixDir:", targetSuffixDir)

				// 通过同名检测处理文件上传
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					targetSuffixDir,
					processFilesUpload,
				)
			}

			// 清理DOM
			document.body.removeChild(input)
		}

		// 触发文件选择
		document.body.appendChild(input)
		input.click()
	}

	// 文件夹上传操作 - 使用全局多任务上传
	const handleUploadFolder = (item?: AttachmentItem) => {
		// 获取上传目标文件夹路径
		const targetPath = item?.is_directory ? item.relative_file_path || item.name : undefined
		// 清理路径：移除前导和尾随斜杠，确保路径格式统一
		const targetSuffixDir = targetPath ? targetPath.replace(/^\/+|\/+$/g, "") : ""

		// 创建隐藏的文件输入框
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = true
		input.webkitdirectory = true
		input.style.display = "none"

		// 处理文件选择
		input.onchange = async (e) => {
			const fileList = (e.target as HTMLInputElement).files
			if (fileList && fileList.length > 0) {
				const files = Array.from(fileList)

				// 通过同名检测处理文件夹上传（使用 processFolderUpload 创建单个任务）
				await duplicateFileHandler.handleFilesWithDuplicateCheck(
					files,
					targetSuffixDir,
					processFolderUpload,
				)
			}

			// 清理DOM
			document.body.removeChild(input)
		}

		// 触发文件选择
		document.body.appendChild(input)
		input.click()
	}

	// 分享操作
	const handleShareItem = useCallback(
		(item: AttachmentItem) => {
			if (!selectedItems || !filteredFiles) {
				// 如果没有选中项或文件列表，只分享当前文件
				const clickedItemId = item.file_id || ""
				if (clickedItemId) {
					setShareFileInfo({
						projectName: selectedProject?.project_name,
						fileIds: [clickedItemId],
					})
					setShareModalVisible(true)
				}
				return
			}

			if (getItemId) {
				createShareHandler({
					item,
					selectedItems,
					allFiles: filteredFiles,
					getItemId,
					setShareFileInfo,
					setShareModalVisible,
				})
			}
		},
		[selectedItems, filteredFiles, getItemId, selectedProject?.project_name],
	)

	// 处理分享保存
	const handleShareSave = useCallback(
		({ type, extraData }: { type: ShareType; extraData: any }) => {
			// 使用 handleShareFunction 处理分享逻辑
			handleShareFunction({
				type,
				extraData,
				topicId: projectId || "",
				resourceType: ResourceType.Project,
			})
		},
		[projectId],
	)

	// 删除文件或文件夹
	const handleDeleteItem = async (item: AttachmentItem) => {
		// 获取文件ID，优先使用 getItemId，否则使用 file_id
		const fileId = getItemId ? getItemId(item) : item.file_id

		// 如果没有 fileId 且不是文件夹，显示错误信息
		if (!fileId) {
			magicToast.error(t("topicFiles.contextMenu.deleteFileFailed"))
			return
		}

		// 防止重复删除
		if (deletingFileIds.has(fileId)) {
			return
		}

		try {
			// 添加到删除中状态
			setDeletingFileIds((prev) => new Set(prev).add(fileId))

			// 删除当前文件/文件夹
			await SuperMagicApi.deleteFile(fileId)
			removeFile(fileId)

			// 更新 attachments 列表
			const updatedAttachments = removeItemFromAttachments(attachments || [], fileId)
			onAttachmentsChange?.(updatedAttachments)

			// 调用删除回调
			if (onFileDelete) {
				await onFileDelete(fileId)
			}

			// 如果没有本地更新回调，回退到pubsub方式
			if (!onAttachmentsChange) {
				pubsub.publish(PubSubEvents.Update_Attachments)
				onUpdateAttachments?.()
			}

			// 获取文件/文件夹名称
			const itemName =
				item.display_filename || item.file_name || item.filename || item.name || "未知项目"

			magicToast.success(
				item.is_directory
					? t("topicFiles.contextMenu.deleteFolderSuccessWithName", { name: itemName })
					: t("topicFiles.contextMenu.deleteFileSuccessWithName", { name: itemName }),
			)
		} catch (error) {
			console.error("删除失败:", error)
		} finally {
			// 移除删除中状态
			setDeletingFileIds((prev) => {
				const newSet = new Set(prev)
				newSet.delete(fileId)
				return newSet
			})
		}
	}

	// 检查文件是否正在删除中
	const isFileDeleting = (item: AttachmentItem) => {
		const fileId = getItemId ? getItemId(item) : item.file_id

		// 如果有 fileId，检查是否在删除中
		if (fileId) {
			return deletingFileIds.has(fileId)
		}

		// 如果没有 fileId 且是文件夹，检查文件夹删除状态
		if (!fileId && item.is_directory) {
			const folderPath = item.relative_file_path || item.name || ""
			const deleteKey = `folder-${folderPath}`
			return deletingFileIds.has(deleteKey)
		}

		return false
	}

	// 检查文件夹是否正在下载
	const isFolderDownloading = (item: AttachmentItem): boolean => {
		if (item.is_directory && item.file_id) {
			return downloadingFolders.has(item.file_id)
		}
		return false
	}

	// 下载原始文件
	const handleDownloadOriginal = async (item: AttachmentItem, mode?: DownloadImageMode) => {
		if (item.is_directory && item.file_id) {
			// 为文件夹添加下载loading状态
			setDownloadingFolders((prev) => new Set(prev).add(item.file_id || ""))

			try {
				// 文件夹下载：只传文件夹ID，走批量下载路径
				await handleDownloadFile(item.file_id, undefined, undefined, true)
			} finally {
				// 下载完成后移除loading状态
				setDownloadingFolders((prev) => {
					const newSet = new Set(prev)
					newSet.delete(item.file_id || "")
					return newSet
				})
			}
		} else if (item.file_id) {
			await handleDownloadFile(item.file_id, mode, item.file_extension)
		}
	}

	// 下载PDF格式
	const handleDownloadPdf = useCallback(
		(item: AttachmentItem) => {
			if (item.file_id) {
				const onStart = () => {
					setExportingFiles((prev) => new Set(prev).add(item.file_id || ""))
					onPdfExportStart?.()
				}
				const onEnd = () => {
					setExportingFiles((prev) => {
						const newSet = new Set(prev)
						newSet.delete(item.file_id || "")
						return newSet
					})
					onPdfExportEnd?.()
				}
				const onProgress = (progress: number) => {
					onPdfExportProgress?.(progress)
				}
				const onError = () => {
					onPdfExportEnd?.()
				}
				exportSingleFileToPdf({
					fileId: item.file_id,
					projectId,
					t,
					onStart,
					onEnd,
					onProgress,
					onError,
				})
			}
		},
		[projectId, t, onPdfExportStart, onPdfExportProgress, onPdfExportEnd],
	)

	// 下载PPT格式
	const handleDownloadPpt = useCallback(
		(item: AttachmentItem) => {
			if (item.file_id) {
				const onStart = () => {
					setExportingFiles((prev) => new Set(prev).add(item.file_id || ""))
					onPptExportStart?.()
				}
				const onEnd = () => {
					setExportingFiles((prev) => {
						const newSet = new Set(prev)
						newSet.delete(item.file_id || "")
						return newSet
					})
					onPptExportEnd?.()
				}
				const onProgress = (progress: number) => {
					onPptExportProgress?.(progress)
				}
				const onError = () => {
					onPptExportEnd?.()
				}
				exportSingleFileToPpt({
					fileId: item.file_id,
					projectId,
					t,
					onStart,
					onEnd,
					onProgress,
					onError,
				})
			}
		},
		[projectId, t, onPptExportStart, onPptExportProgress, onPptExportEnd],
	)

	// 导出可编辑PPTX（前端 html2pptx，通过 prepareExportSlides 服务准备数据）
	const handleDownloadPptx = useCallback(
		async (item: AttachmentItem, folderChildren?: AttachmentItem[]) => {
			if (!item.file_id) return

			const toastId = crypto.randomUUID()
			const metadata = item.metadata as
				| { name?: string; slides?: string[]; [key: string]: unknown }
				| undefined
			const slidePaths: string[] = metadata?.slides ?? []
			const isSingleFile = !slidePaths.length

			let exportHandle: ReturnType<typeof exportPPTX> | null = null
			setExportingFiles((prev) => new Set(prev).add(item.file_id || ""))

			try {
				magicToast.loading({
					key: toastId,
					content: t("topicFiles.exporting"),
					duration: 0,
				})

				const result = isSingleFile
					? await prepareSingleSlideExport({
							fileId: item.file_id,
							fileName: item.file_name,
							attachmentList: attachments ?? [],
						})
					: await prepareExportSlides({
							slidePaths,
							attachmentList: folderChildren?.length
								? folderChildren
								: (attachments ?? []),
							mainFileId: item.file_id,
							mainFileName: item.file_name,
							metadata,
						})

				if (!result.htmlSlides.some(Boolean)) {
					magicToast.error({
						key: toastId,
						content: t("topicFiles.contextMenu.fileExport.exportFailed"),
						duration: 1000,
					})
					return
				}

				exportHandle = exportPPTX(result.htmlSlides, {
					fileName: result.fileName,
					skipFailedPages: true,
					onSlideProgress: ({ index, total }) => {
						const progress = total > 1 ? ` (${index + 1}/${total})` : ""
						magicToast.loading({
							key: toastId,
							content: `${t("topicFiles.exporting")}${progress}`,
							duration: 0,
						})
					},
				})

				await exportHandle.promise

				magicToast.success({
					key: toastId,
					content: t("topicFiles.exportSuccess"),
					duration: 1000,
				})
			} catch (error: unknown) {
				const isAbort = (error as { name?: string } | null)?.name === "AbortError"
				if (isAbort) {
					magicToast.info({
						key: toastId,
						content: t("topicFiles.exportCancel"),
						duration: 1000,
					})
				} else {
					magicToast.error({
						key: toastId,
						content: t("topicFiles.contextMenu.fileExport.exportFailed"),
						duration: 1000,
					})
					console.error("Export editable PPT failed:", error)
				}
			} finally {
				setExportingFiles((prev) => {
					const newSet = new Set(prev)
					newSet.delete(item.file_id || "")
					return newSet
				})
			}
		},
		[t, attachments],
	)

	// 文件下载功能 - 支持单个文件或多个文件
	const handleDownloadFile = useMemoizedFn(
		async (
			file_id: string | string[],
			mode?: DownloadImageMode,
			fileExtension?: string,
			isFolder?: boolean,
		) => {
			const fileIds = Array.isArray(file_id) ? file_id : [file_id]

			if (fileIds.length === 0) return

			if (fileIds.length === 1 && !isFolder) {
				// 单个文件直接下载
				try {
					// 检查是否为 OnlyOffice 文件
					const ext = (fileExtension || "").toLowerCase()
					const isOnlyOfficeFile = [
						"xlsx",
						"xls",
						"csv",
						"docx",
						"doc",
						"pptx",
						"ppt",
					].includes(ext)

					// 如果是 OnlyOffice 文件，使用专门的下载方法
					if (isOnlyOfficeFile) {
						await downloadOnlyOfficeFile(fileIds[0], ext, attachments, mode)
						return
					}

					// 非 OnlyOffice 文件，使用原来的下载方式
					const res = await getTemporaryDownloadUrl({
						file_ids: fileIds,
						download_mode: mode,
						is_download: true,
					})
					if (res[0]?.url) {
						downloadFileWithAnchor(res[0].url)
					}
				} catch (error) {
					console.error("Download failed:", error)
				}
			} else {
				// 多个文件使用批量下载
				return new Promise<void>((resolve, reject) => {
					SuperMagicApi.createBatchDownload({
						project_id: projectId,
						file_ids: fileIds,
					})
						.then((data) => {
							if (data.status === "ready" && data.download_url) {
								downloadFileWithAnchor(data.download_url)
								resolve()
								return
							}

							if (data.status === "processing") {
								// 轮询批量下载状态
								const timer = setInterval(async () => {
									try {
										const checkData =
											await SuperMagicApi.checkBatchDownloadStatus(
												data.batch_key,
											)
										if (checkData?.status === "ready") {
											clearInterval(timer)
										}
										if (
											checkData.status === "ready" &&
											checkData.download_url
										) {
											downloadFileWithAnchor(checkData.download_url)
											resolve()
										}
										if (checkData?.status === "failed") {
											clearInterval(timer)
											magicToast.error(
												checkData.message || t("interface:ErrorHappened"),
											)
											reject(
												new Error(checkData.message || "Download failed"),
											)
										}
									} catch (error: any) {
										clearInterval(timer)
										console.error("Batch download check failed:", error)
										magicToast.error(
											error?.message || t("interface:ErrorHappened"),
										)
										reject(error)
									}
								}, 2000)
							}
						})
						.catch((error) => {
							console.error("Batch download failed:", error)
							magicToast.error(error?.message || t("interface:ErrorHappened"))
							reject(error)
						})
				})
			}
		},
	)

	// 移动文件或文件夹
	const handleMoveFile = useCallback(
		async (fileId: string, targetParentId: string, preFileId?: string) => {
			if (!fileId) {
				magicToast.error(t("topicFiles.error.moveFileParamsRequired"))
				return false
			}

			setMovingFiles((prev) => new Set(prev).add(fileId))
			let data: any = null

			try {
				// 显示移动进度
				magicToast.loading({ content: t("topicFiles.moving"), duration: 0 })

				data = await SuperMagicApi.moveFile({
					file_id: fileId,
					target_parent_id: targetParentId || ROOT_FILE_ID,
					pre_file_id: preFileId,
				})

				// 如果直接完成
				if (data.status === "success") {
					magicToast.destroy()
					magicToast.success(t("topicFiles.success.fileMoved"))
					// 触发文件列表更新
					pubsub.publish(PubSubEvents.Update_Attachments)
					onUpdateAttachments?.()
					return true
				}

				// 如果需要轮询状态
				if (data.status === "processing" && data.batch_key) {
					// 每2秒轮询批量状态
					const timer = setInterval(async () => {
						try {
							const checkData = await SuperMagicApi.checkBatchOperationStatus(
								data.batch_key,
							)

							// 更新进度显示
							if (checkData.status === "processing") {
								console.log("checkData", checkData?.progress)
							} else if (checkData.status === "success") {
								magicToast.destroy()
								magicToast.success(t("topicFiles.success.fileMoved"))
								// 触发文件列表更新
								pubsub.publish(PubSubEvents.Update_Attachments)
								onUpdateAttachments?.()
								clearInterval(timer)
								// 移除移动状态
								setMovingFiles((prev) => {
									const newSet = new Set(prev)
									newSet.delete(fileId)
									return newSet
								})
							} else if (checkData.status === "failed") {
								magicToast.destroy()
								magicToast.error(
									checkData.message || t("topicFiles.error.moveFileFailed"),
								)
								clearInterval(timer)
								// 移除移动状态
								setMovingFiles((prev) => {
									const newSet = new Set(prev)
									newSet.delete(fileId)
									return newSet
								})
							} else {
								magicToast.destroy()
								clearInterval(timer)
								// 移除移动状态
								setMovingFiles((prev) => {
									const newSet = new Set(prev)
									newSet.delete(fileId)
									return newSet
								})
							}
						} catch (error) {
							console.error("检查文件移动状态失败:", error)
							magicToast.destroy()
							magicToast.error(t("topicFiles.error.moveFileFailed"))
							clearInterval(timer)
							// 移除移动状态
							setMovingFiles((prev) => {
								const newSet = new Set(prev)
								newSet.delete(fileId)
								return newSet
							})
						}
					}, 2000)
					return true
				}

				// 兼容旧的返回格式
				magicToast.destroy()
				magicToast.success(t("topicFiles.success.fileMoved"))
				// 触发文件列表更新
				pubsub.publish(PubSubEvents.Update_Attachments)
				onUpdateAttachments?.()
				return true
			} catch (error) {
				console.error("移动文件失败:", error)
				magicToast.destroy()
				return false
			} finally {
				// 只有在非异步处理的情况下才立即移除移动状态
				if (!data || data.status !== "processing") {
					setMovingFiles((prev) => {
						const newSet = new Set(prev)
						newSet.delete(fileId)
						return newSet
					})
				}
			}
		},
		[t, onUpdateAttachments],
	)

	return {
		// 文件操作
		handleUploadFile,
		handleUploadFolder,
		handleShareItem,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleDownloadPptx,
		handleDownloadFile,
		handleOpenFile,
		handleMoveFile,
		// 分享相关
		shareModalVisible,
		setShareModalVisible,
		shareFileInfo,
		setShareFileInfo,
		handleShareSave,
		selectedTopic,
		// 导出状态
		exportingFiles,
		// 导出进度状态
		isExportingPdf,
		pdfExportProgress,
		isExportingPpt,
		pptExportProgress,
		isBatchExportingPdf,
		batchPdfExportProgress,
		isBatchExportingPpt,
		batchPptExportProgress,
		// 批量导出进度回调
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,
		// 上传状态
		uploading,
		// 删除状态
		deletingFileIds,
		isFileDeleting,
		// 文件夹下载状态
		downloadingFolders,
		isFolderDownloading,
		// 移动状态
		movingFiles,
		// 新增：文件创建回调
		createFileAndUpload,
		// 新增：文件夹创建回调
		createFolderAndUpload,
		// 新增：画布项目创建回调
		createDesignProject,
		// 新增：文件创建loading状态
		creatingFiles,
		// 新增：文件列表更新回调
		onAttachmentsChange,
		// 重置方法
		resetFileOperations: () => {
			resetExportProgress()
		},
		removeFile,
		// 新增：获取父级ID
		getParentIdFromPath,

		// 全局文件夹上传状态（只读）
		globalUploadInfo: multiFolderUploadStore.uploadInfo,
		hasActiveUploads: multiFolderUploadStore.hasActiveTasks,
		globalUploadProgress: multiFolderUploadStore.globalProgress,
		activeUploadTasks: multiFolderUploadStore.activeTasks,

		// 同名文件处理状态（统一处理文件和文件夹上传）
		duplicateFileHandler,
	}
}
