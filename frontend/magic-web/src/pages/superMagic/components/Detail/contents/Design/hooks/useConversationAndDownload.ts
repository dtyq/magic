import { useCallback } from "react"
import type { ImageElement } from "@/components/CanvasDesign/canvas/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	DownloadImageMode,
	type Workspace,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import {
	packAndDownloadFiles,
	getZipFileNameFromFiles,
	findFileBySrc,
	convertFileItemToAttachmentItem,
} from "../utils/utils"
import { useTranslation } from "react-i18next"
import {
	addFileToCurrentChat,
	addMultipleFilesToNewChat,
} from "@/pages/superMagic/utils/topics"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { UseDesignDownloadPolicyResult } from "./useDesignDownloadPolicy"

interface UseConversationAndDownloadOptions {
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 添加文件到 MessageEditor 的回调函数（已废弃，保留以兼容旧代码） */
	onAddFilesToMessageEditor?: (files: File[]) => Promise<void>
	/** 选中的工作区（用于添加到新话题） */
	selectedWorkspace?: Workspace | null
	/** 选中的项目（用于添加到新话题） */
	selectedProject?: ProjectListItem | null
	/** 添加到当前话题后的回调 */
	afterAddFileToCurrentTopic?: () => void
	/** 添加到新话题后的回调 */
	afterAddFileToNewTopic?: () => void
	/** 退出全屏的回调 */
	onExitFullscreen?: () => void | Promise<void>
	/** 下载策略（企业版可覆盖） */
	downloadPolicy: UseDesignDownloadPolicyResult
}

/**
 * 对话和下载功能 Hook
 * 职责：
 * - 实现 addToConversation：将图片添加到 MessageEditor 的引用文件中（参考文件列表实现）
 * - 实现 downloadImage：下载图片（支持有水印/无水印，参考文件列表实现）
 */
export function useConversationAndDownload(options: UseConversationAndDownloadOptions) {
	const {
		flatAttachments,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		downloadPolicy,
	} = options
	const { t } = useTranslation("super")

	/**
	 * 添加图片至对话
	 * 参考文件列表的实现：使用文件 ID 和 mention 格式，而不是下载文件再上传
	 */
	const addToConversation = useCallback(
		async (data: ImageElement[], isNewConversation: boolean) => {
			if (data.length === 0) {
				throw new Error(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new Error(t("design.errors.fileListEmpty"))
			}

			const attachmentItems: AttachmentItem[] = []

			// 处理每个图片元素
			for (const item of data) {
				if (!item.src) {
					throw new Error(t("design.errors.imageSrcEmpty"))
				}

				// 从 flatAttachments 中查找对应的文件
				const fileItem = findFileBySrc(item.src, flatAttachments)

				if (!fileItem || !fileItem.file_id) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: item.src }))
				}

				// 将 FileItem 转换为 AttachmentItem 格式
				const attachmentItem = convertFileItemToAttachmentItem(fileItem)
				attachmentItems.push(attachmentItem)
			}
			// 参考文件列表的实现：使用 addFileToCurrentChat 或 addMultipleFilesToNewChat
			if (isNewConversation) {
				// 添加到新话题：一次性添加所有文件
				if (attachmentItems.length > 0) {
					await addMultipleFilesToNewChat({
						fileItems: attachmentItems,
						selectedWorkspace: selectedWorkspace || null,
						selectedProject: selectedProject || null,
						afterAddFileToNewTopic,
						autoFocus: true,
					})
				}
			} else {
				// 添加到当前对话：逐个添加所有文件
				for (const attachmentItem of attachmentItems) {
					addFileToCurrentChat({
						fileItem: attachmentItem,
						isNewTopic: false,
						autoFocus: attachmentItem === attachmentItems[0],
					})
				}
				afterAddFileToCurrentTopic?.()
			}

			// 添加文件成功后退出全屏
			if (onExitFullscreen) {
				try {
					await onExitFullscreen()
				} catch (error) {
					//
				}
			}
		},
		[
			flatAttachments,
			t,
			onExitFullscreen,
			selectedWorkspace,
			selectedProject,
			afterAddFileToNewTopic,
			afterAddFileToCurrentTopic,
		],
	)

	/**
	 * 执行实际的下载逻辑（内部函数，跳过协议检查）
	 */
	const executeDownload = useCallback(
		async (data: ImageElement[], noWatermark: boolean) => {
			if (data.length === 0) {
				throw new Error(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new Error(t("design.errors.fileListEmpty"))
			}

			// 参考文件列表的实现：根据 noWatermark 参数选择下载模式
			const downloadMode = noWatermark ? DownloadImageMode.HighQuality : undefined

			// 收集所有文件 ID
			const fileIds: string[] = []
			const fileItemMap = new Map<string, FileItem>()

			for (const item of data) {
				if (!item.src) {
					throw new Error(t("design.errors.imageSrcEmpty"))
				}

				// 从 flatAttachments 中查找对应的文件
				const fileItem = findFileBySrc(item.src, flatAttachments)

				if (!fileItem || !fileItem.file_id) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: item.src }))
				}

				fileIds.push(fileItem.file_id)
				fileItemMap.set(fileItem.file_id, fileItem)
			}

			// 批量获取文件的临时下载 URL
			const downloadUrls = await getTemporaryDownloadUrl({
				file_ids: fileIds,
				download_mode: downloadMode,
			})

			if (!downloadUrls || downloadUrls.length === 0) {
				throw new Error(t("design.errors.cannotGetFileUrl"))
			}

			// 如果只有一个文件，直接下载
			if (data.length === 1) {
				const downloadUrlItem = downloadUrls[0]
				if (!downloadUrlItem?.url) {
					throw new Error(t("design.errors.cannotGetFileUrl"))
				}

				const fileItem = fileItemMap.get(downloadUrlItem.file_id)
				if (!fileItem) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: data[0].src }))
				}

				// 获取文件名
				const fileName =
					fileItem.file_name ||
					fileItem.display_filename ||
					fileItem.filename ||
					`image_${Date.now()}.png`

				// 使用 downloadFileWithAnchor 下载文件（参考文件列表的实现）
				downloadFileWithAnchor(downloadUrlItem.url, fileName)
				return
			}

			// 多个文件时，打包成 zip（复用共用函数）
			// 收集所有文件
			const imageFiles: FileItem[] = []
			for (const fileId of fileIds) {
				const fileItem = fileItemMap.get(fileId)
				if (fileItem) {
					imageFiles.push(fileItem)
				}
			}

			// 使用共用函数获取 zip 文件名（与 CanvasDesignHeader 保持一致）
			const zipFileName = getZipFileNameFromFiles(imageFiles, flatAttachments)

			// 使用共用函数打包下载
			await packAndDownloadFiles(imageFiles, downloadMode, zipFileName)
		},
		[flatAttachments, t],
	)

	/**
	 * 下载图片
	 * 参考文件列表的实现：使用 handleDownloadOriginal 的逻辑
	 * @param data 图片元素数据数组
	 * @param noWatermark 是否无水印，true 为无水印，false 为有水印
	 * @param skipAgreementCheck 是否跳过协议检查（用于用户已同意协议后的下载）
	 */
	const downloadImage = useCallback(
		async (data: ImageElement[], noWatermark: boolean, skipAgreementCheck = false) => {
			if (data.length === 0) {
				throw new Error(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new Error(t("design.errors.fileListEmpty"))
			}

			if (!noWatermark) {
				await executeDownload(data, false)
				return
			}

			await downloadPolicy.handleHighQualityDownload({
				imageElements: data,
				skipAgreementCheck,
				executeDownload: () => {
					return executeDownload(data, true).catch((error) => {
						throw error
					})
				},
			})
		},
		[flatAttachments, t, downloadPolicy, executeDownload],
	)

	return {
		addToConversation,
		downloadImage,
		executeDownload,
	}
}
