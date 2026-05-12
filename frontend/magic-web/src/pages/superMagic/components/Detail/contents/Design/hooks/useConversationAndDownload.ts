import { useCallback } from "react"
import {
	ElementTypeEnum,
	type CanvasFileElement,
	type ImageElement,
} from "@/components/CanvasDesign/canvas/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
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
import { addFileToCurrentChat, addMultipleFilesToNewChat } from "@/pages/superMagic/utils/topics"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { UseDesignDownloadPolicyResult } from "./useDesignDownloadPolicy"
import { CropOptions, ImageFormat, ImageProcessOptions } from "@/utils/image-processing"
import {
	CanvasImageSourceDimensions,
	DownloadImageOptions,
} from "@/components/CanvasDesign/types.magic"

function cropConfigToCropOptions(config: {
	x: number
	y: number
	width: number
	height: number
}): CropOptions {
	const left = Math.max(0, Math.floor(config.x))
	const top = Math.max(0, Math.floor(config.y))
	const right = Math.max(left + 1, Math.ceil(config.x + config.width))
	const bottom = Math.max(top + 1, Math.ceil(config.y + config.height))

	return {
		x: left,
		y: top,
		w: right - left,
		h: bottom - top,
	}
}

function normalizeDimension(value: number | undefined): number {
	if (!Number.isFinite(value) || !value || value <= 0) return 0

	return value
}

function getPersistedSourceCropForDownload(params: {
	crop: NonNullable<ImageElement["crop"]>
	sourceDimensions: CanvasImageSourceDimensions
}) {
	const { crop, sourceDimensions } = params
	const sourceWidth = normalizeDimension(sourceDimensions.width)
	const sourceHeight = normalizeDimension(sourceDimensions.height)
	const left = Math.max(crop.x, 0)
	const top = Math.max(crop.y, 0)
	const right = Math.min(crop.x + normalizeDimension(crop.width), sourceWidth)
	const bottom = Math.min(crop.y + normalizeDimension(crop.height), sourceHeight)

	return {
		x: left,
		y: top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	}
}

function getImageProcessFormat(fileItem: FileItem): ImageFormat {
	const extension =
		fileItem.file_extension ||
		fileItem.file_name?.split(".").pop() ||
		fileItem.display_filename?.split(".").pop() ||
		fileItem.filename?.split(".").pop() ||
		"png"

	const normalized = extension.toLowerCase()

	if (normalized === "jpeg") return "jpg"
	if (normalized === "tif") return "tiff"
	if (normalized === "jpg") return "jpg"
	if (normalized === "png") return "png"
	if (normalized === "webp") return "webp"
	if (normalized === "bmp") return "bmp"
	if (normalized === "gif") return "gif"
	if (normalized === "tiff") return "tiff"

	return "png"
}

function getDownloadFileName(fileItem: FileItem, format?: ImageFormat): string {
	const rawFileName =
		fileItem.file_name ||
		fileItem.display_filename ||
		fileItem.filename ||
		`image_${Date.now()}`

	if (!format) return rawFileName

	const lastDotIndex = rawFileName.lastIndexOf(".")
	if (lastDotIndex === -1) return `${rawFileName}.${format}`

	return `${rawFileName.slice(0, lastDotIndex)}.${format}`
}

function buildImageProcessOptions(params: {
	fileElement: CanvasFileElement
	fileItem: FileItem
	sourceDimensionsByElementId?: Record<string, CanvasImageSourceDimensions>
}): ImageProcessOptions | undefined {
	const { fileElement, fileItem, sourceDimensionsByElementId } = params

	if (fileElement.type !== ElementTypeEnum.Image) return undefined
	const imageElement = fileElement as ImageElement

	if (!imageElement.crop) return undefined

	const sourceDimensions = sourceDimensionsByElementId?.[imageElement.id]
	const sourceCrop = sourceDimensions
		? getPersistedSourceCropForDownload({
				crop: imageElement.crop,
				sourceDimensions,
			})
		: imageElement.crop

	if (sourceCrop.width <= 0 || sourceCrop.height <= 0) return undefined

	return {
		crop: cropConfigToCropOptions(sourceCrop),
		format: getImageProcessFormat(fileItem),
	}
}

interface UseConversationAndDownloadOptions {
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	attachmentIndex?: DesignAttachmentIndex | null
	/** 画布目录路径段，解析元素 src 中相对路径（`images/...` 或 `./images/...`） */
	designProjectBasePath?: string
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
 * - 实现 downloadFiles：下载文件（支持有水印/无水印，参考文件列表实现）
 */
export function useConversationAndDownload(options: UseConversationAndDownloadOptions) {
	const {
		flatAttachments,
		attachmentIndex,
		designProjectBasePath,
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
		async (data: CanvasFileElement[], isNewConversation: boolean) => {
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
				const fileItem = findFileBySrc(
					item.src,
					flatAttachments,
					designProjectBasePath,
					attachmentIndex,
				)

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
			attachmentIndex,
			designProjectBasePath,
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
		async (
			data: CanvasFileElement[],
			noWatermark: boolean,
			downloadOptions?: DownloadImageOptions,
		) => {
			if (data.length === 0) {
				throw new Error(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new Error(t("design.errors.fileListEmpty"))
			}

			// 参考文件列表的实现：根据 noWatermark 参数选择下载模式
			const downloadMode = noWatermark
				? DownloadImageMode.HighQuality
				: DownloadImageMode.NormalDownload

			// 收集所有文件 ID
			const fileIds: string[] = []
			const fileItemMap = new Map<string, FileItem>()

			for (const item of data) {
				if (!item.src) {
					throw new Error(t("design.errors.imageSrcEmpty"))
				}

				// 从 flatAttachments 中查找对应的文件
				const fileItem = findFileBySrc(
					item.src,
					flatAttachments,
					designProjectBasePath,
					attachmentIndex,
				)

				if (!fileItem || !fileItem.file_id) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: item.src }))
				}

				fileIds.push(fileItem.file_id)
				fileItemMap.set(fileItem.file_id, fileItem)
			}

			// 如果只有一个文件，直接下载（可带 crop 的图片处理参数，仅单文件时传入 crop）
			if (data.length === 1) {
				const first = data[0]
				const fileItem = fileItemMap.get(fileIds[0])
				if (!fileItem) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: first.src }))
				}

				const xMagicImageProcess = buildImageProcessOptions({
					fileElement: first,
					fileItem,
					sourceDimensionsByElementId: downloadOptions?.sourceDimensionsByElementId,
				})

				const singleDownloadUrls = await getTemporaryDownloadUrl({
					file_ids: [fileIds[0]],
					download_mode: downloadMode,
					options: xMagicImageProcess ? { xMagicImageProcess } : undefined,
				})

				const downloadUrlItem = singleDownloadUrls[0]
				if (!downloadUrlItem?.url) {
					throw new Error(t("design.errors.cannotGetFileUrl"))
				}

				const downloadFile = fileItemMap.get(downloadUrlItem.file_id)
				if (!downloadFile) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: first.src }))
				}

				const fileName = getDownloadFileName(downloadFile, xMagicImageProcess?.format)
				downloadFileWithAnchor(downloadUrlItem.url, fileName)
				return
			}

			// 多个文件时，打包成 zip（复用共用函数；多文件暂不支持按文件传 crop）
			// 收集所有文件
			const imageFiles: FileItem[] = []
			const xMagicImageProcessByFileId: Record<string, ImageProcessOptions> = {}
			for (const fileId of fileIds) {
				const fileItem = fileItemMap.get(fileId)
				if (fileItem) {
					imageFiles.push(fileItem)
				}
			}

			for (const fileElement of data) {
				if (!fileElement.src) continue

				const fileItem = findFileBySrc(
					fileElement.src,
					flatAttachments,
					designProjectBasePath,
					attachmentIndex,
				)
				if (!fileItem?.file_id) continue

				const xMagicImageProcess = buildImageProcessOptions({
					fileElement,
					fileItem,
					sourceDimensionsByElementId: downloadOptions?.sourceDimensionsByElementId,
				})

				if (xMagicImageProcess) {
					xMagicImageProcessByFileId[fileItem.file_id] = xMagicImageProcess
				}
			}

			// 使用共用函数获取 zip 文件名（与 CanvasDesignHeader 保持一致）
			const zipFileName = getZipFileNameFromFiles(imageFiles, flatAttachments)

			// 使用共用函数打包下载
			await packAndDownloadFiles(
				imageFiles,
				downloadMode,
				zipFileName,
				Object.keys(xMagicImageProcessByFileId).length > 0
					? xMagicImageProcessByFileId
					: undefined,
			)
		},
		[flatAttachments, attachmentIndex, designProjectBasePath, t],
	)

	/**
	 * 下载文件
	 * 参考文件列表的实现：使用 handleDownloadOriginal 的逻辑
	 * @param data 文件元素数据数组（图片/视频等）
	 * @param noWatermark 是否无水印，true 为无水印，false 为有水印
	 * @param downloadOptions 下载附加信息
	 */
	const downloadFiles = useCallback(
		async (
			data: CanvasFileElement[],
			noWatermark: boolean,
			skipAgreementCheck = false,
			downloadOptions?: DownloadImageOptions,
		) => {
			if (data.length === 0) {
				throw new Error(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new Error(t("design.errors.fileListEmpty"))
			}

			if (!noWatermark) {
				await executeDownload(data, false, downloadOptions)
				return
			}

			await downloadPolicy.handleHighQualityDownload({
				fileElements: data,
				skipAgreementCheck,
				executeDownload: () => {
					return executeDownload(data, true, downloadOptions).catch((error) => {
						throw error
					})
				},
			})
		},
		[flatAttachments, t, downloadPolicy, executeDownload],
	)

	return {
		addToConversation,
		downloadFiles,
		executeDownload,
	}
}
