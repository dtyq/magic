import {
	packAndDownloadFileEntries,
	type PackDownloadFileEntry,
} from "@/pages/superMagic/services/fileBundleDownload"
import { useCallback } from "react"
import {
	ElementTypeEnum,
	type CanvasFileElement,
	type CropConfig,
} from "@/components/CanvasDesign/runtime/document/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	DownloadImageMode,
	type Workspace,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { convertFileItemToAttachmentItem, getDesignDirectoryInfo } from "../utils/utils"
import { resolveDesignCanvasResourceFileItem } from "../utils/designResourceReferenceResolver"
import { useTranslation } from "react-i18next"
import { addFileToCurrentChat, addMultipleFilesToNewChat } from "@/pages/superMagic/utils/topics"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { UseDesignDownloadPolicyResult } from "./useDesignDownloadPolicy"
import { CropOptions, ImageFormat, ImageProcessOptions } from "@/utils/image-processing"
import {
	CanvasImageSourceDimensions,
	DownloadImageOptions,
} from "@/components/CanvasDesign/public/magic-types"
import {
	getActiveImageContent,
	getActiveContent,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import magicToast from "@/components/base/MagicToaster/utils"
import { resolveCanvasMediaDownloadPlan } from "../utils/mediaDownloadPlan"

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
	crop: CropConfig
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

function getFileNameParts(fileName: string): { baseName: string; extension: string } {
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex <= 0) return { baseName: fileName, extension: "" }
	return {
		baseName: fileName.slice(0, lastDotIndex),
		extension: fileName.slice(lastDotIndex),
	}
}

function sanitizeDownloadBaseName(name?: string): string {
	return (name || "")
		.trim()
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.replace(/^\.+|\.+$/g, "")
}

function getElementDownloadFileName(params: {
	element: CanvasFileElement
	fileItem: FileItem
	imageProcess?: ImageProcessOptions
	preferElementName?: boolean
}): string {
	const { element, fileItem, imageProcess, preferElementName } = params
	const sourceFileName = getDownloadFileName(fileItem, imageProcess?.format)
	const { baseName, extension } = getFileNameParts(sourceFileName)
	const elementName = sanitizeDownloadBaseName(element.name)

	if (preferElementName && elementName) {
		if (!extension) return elementName
		const elementBaseName = elementName.toLowerCase().endsWith(extension.toLowerCase())
			? elementName.slice(0, -extension.length)
			: elementName
		return `${elementBaseName}${extension}`
	}
	if (imageProcess) return `${baseName}-crop${extension}`
	return sourceFileName
}

function getMediaArchiveName(params: {
	currentFile?: { id: string; name: string }
	flatAttachments?: FileItem[]
}): string {
	const { currentFile, flatAttachments } = params
	const directoryName =
		currentFile?.id && flatAttachments
			? getDesignDirectoryInfo(currentFile, flatAttachments).name
			: undefined
	const currentFileBaseName = currentFile?.name
		? getFileNameParts(currentFile.name).baseName
		: undefined
	const baseName = sanitizeDownloadBaseName(directoryName || currentFileBaseName) || "design"
	return `${baseName}-media.zip`
}

function getSingleDownloadMode(
	noWatermark: boolean,
	downloadOptions?: DownloadImageOptions,
): DownloadImageMode {
	if (noWatermark) return DownloadImageMode.HighQuality
	if (downloadOptions?.downloadMode === "normal") return DownloadImageMode.NormalDownload
	return DownloadImageMode.Download
}

function getClientZipDownloadMode(
	noWatermark: boolean,
	downloadOptions?: DownloadImageOptions,
): DownloadImageMode | undefined {
	if (noWatermark) return DownloadImageMode.HighQuality
	if (downloadOptions?.downloadMode === "normal") return DownloadImageMode.NormalDownload
	// default 不显式覆盖，让 getTemporaryDownloadUrl 复用项目文件的全局水印偏好。
	return undefined
}

class CanvasMediaDownloadPreflightError extends Error {}

async function retryOnce<T>(task: () => Promise<T>): Promise<T> {
	try {
		return await task()
	} catch {
		return task()
	}
}

function buildImageProcessOptions(params: {
	fileElement: CanvasFileElement
	fileItem: FileItem
	sourceDimensionsByElementId?: Record<string, CanvasImageSourceDimensions>
}): ImageProcessOptions | undefined {
	const { fileElement, fileItem, sourceDimensionsByElementId } = params

	if (fileElement.type !== ElementTypeEnum.Image) return undefined
	const activeContent = getActiveImageContent(fileElement)

	if (!activeContent.crop) return undefined

	const sourceDimensions = sourceDimensionsByElementId?.[fileElement.id]
	const sourceCrop = sourceDimensions
		? getPersistedSourceCropForDownload({
				crop: activeContent.crop,
				sourceDimensions,
			})
		: activeContent.crop

	if (sourceCrop.width <= 0 || sourceCrop.height <= 0) return undefined

	return {
		crop: cropConfigToCropOptions(sourceCrop),
		format: getImageProcessFormat(fileItem),
	}
}

interface UseConversationAndDownloadOptions {
	/** 将元素投影到当前 Canvas 会话的 effective Content（只读预览时不写回文档） */
	getContentViewElement?: (element: CanvasFileElement) => CanvasFileElement
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
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
	projectId?: string
	currentFile?: { id: string; name: string }
}

/**
 * 对话和下载功能 Hook
 * 职责：
 * - 实现 addToConversation：将图片添加到 MessageEditor 的引用文件中（参考文件列表实现）
 * - 实现 downloadFiles：下载文件（支持有水印/无水印，参考文件列表实现）
 */
export function useConversationAndDownload(options: UseConversationAndDownloadOptions) {
	const {
		getContentViewElement = (element) => element,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		downloadPolicy,
		projectId,
		currentFile,
	} = options
	const { t } = useTranslation("super")
	const downloadProgress = useDownloadProgress()
	// Canvas download requests must carry the ambient share identity bound at this
	// React boundary; host trees get an unbound client (session default).
	const fileApi = useFileApi()

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
				const contentViewElement = getContentViewElement(item)
				const source =
					contentViewElement.type === ElementTypeEnum.Image
						? getActiveImageContent(contentViewElement)
						: getActiveContent(contentViewElement)
				if (!source?.src) {
					throw new Error(t("design.errors.imageSrcEmpty"))
				}

				// 从 flatAttachments 中查找对应的文件
				const resolvedFile = resolveDesignCanvasResourceFileItem(source.src, {
					flatAttachments,
					attachmentsReady,
					designProjectBasePath,
					attachmentIndex,
				})

				if (!resolvedFile?.file_id) {
					throw new Error(t("design.errors.fileNotFoundBySrc", { src: source.src }))
				}

				// 将 FileItem 转换为 AttachmentItem 格式
				const attachmentItem = convertFileItemToAttachmentItem(resolvedFile)
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
			getContentViewElement,
			flatAttachments,
			attachmentsReady,
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
				throw new CanvasMediaDownloadPreflightError(t("design.errors.imageSrcEmpty"))
			}

			if (!flatAttachments || flatAttachments.length === 0) {
				throw new CanvasMediaDownloadPreflightError(t("design.errors.fileListEmpty"))
			}

			const resolvedEntries: Array<{
				element: CanvasFileElement
				fileItem: FileItem
				imageProcess?: ImageProcessOptions
			}> = []

			// 先完整解析选区；任一元素无法映射到项目文件时，整批不启动。
			for (const element of data) {
				const contentViewElement = getContentViewElement(element)
				const activeImageContent =
					contentViewElement.type === ElementTypeEnum.Image
						? getActiveImageContent(contentViewElement)
						: undefined
				const elementSrc =
					activeImageContent?.src ??
					(contentViewElement.type === ElementTypeEnum.Video
						? getActiveContent(contentViewElement)?.src
						: contentViewElement.type === ElementTypeEnum.Audio
							? getActiveContent(contentViewElement)?.src
							: undefined)
				if (!elementSrc) {
					throw new CanvasMediaDownloadPreflightError(t("design.errors.imageSrcEmpty"))
				}

				const resolvedFile = resolveDesignCanvasResourceFileItem(elementSrc, {
					flatAttachments,
					attachmentsReady,
					designProjectBasePath,
					attachmentIndex,
				})

				if (!resolvedFile?.file_id) {
					throw new CanvasMediaDownloadPreflightError(
						t("design.errors.fileNotFoundBySrc", { src: elementSrc }),
					)
				}

				const imageProcess = buildImageProcessOptions({
					fileElement: contentViewElement,
					fileItem: resolvedFile,
					sourceDimensionsByElementId: downloadOptions?.sourceDimensionsByElementId,
				})
				if (
					contentViewElement.type === ElementTypeEnum.Image &&
					activeImageContent?.crop &&
					!imageProcess
				) {
					throw new CanvasMediaDownloadPreflightError(t("design.errors.invalidImageCrop"))
				}

				resolvedEntries.push({
					element: contentViewElement,
					fileItem: resolvedFile,
					imageProcess,
				})
			}

			if (resolvedEntries.length === 1) {
				const [entry] = resolvedEntries
				const downloadUrlItem = await retryOnce(async () => {
					const singleDownloadUrls = await fileApi.getTemporaryDownloadUrl({
						file_ids: [entry.fileItem.file_id],
						download_mode: getSingleDownloadMode(noWatermark, downloadOptions),
						is_download: true,
						options: entry.imageProcess
							? { xMagicImageProcess: entry.imageProcess }
							: undefined,
						enableErrorMessagePrompt: false,
					})
					const item = singleDownloadUrls[0]
					if (!item?.url) throw new Error(t("design.errors.cannotGetFileUrl"))
					return item
				})

				const fileName = getElementDownloadFileName({
					element: entry.element,
					fileItem: entry.fileItem,
					imageProcess: entry.imageProcess,
					preferElementName: Boolean(entry.imageProcess),
				})
				await downloadFileWithAnchor(downloadUrlItem.url, fileName)
				return
			}

			const fileIds = resolvedEntries.map((entry) => entry.fileItem.file_id)
			const hasImageProcess = resolvedEntries.some((entry) => Boolean(entry.imageProcess))
			const archiveName = getMediaArchiveName({ currentFile, flatAttachments })
			const downloadPlan = resolveCanvasMediaDownloadPlan({
				fileIds,
				hasImageProcess,
				noWatermark,
				downloadMode: downloadOptions?.downloadMode,
			})

			if (downloadPlan.transport === "project-batch") {
				await downloadProgress.startDownload({
					projectId,
					fileIds,
					fileName: archiveName,
					label: t("design.messages.mediaDownloading", { count: resolvedEntries.length }),
					onSuccess: () => {
						magicToast.success(
							t("design.messages.mediaDownloadSuccess", {
								count: resolvedEntries.length,
							}),
						)
					},
					onError: () => {
						magicToast.error(t("design.errors.mediaDownloadFailed"))
					},
					onCancel: () => {
						magicToast.info(t("topicFiles.downloadAbort"))
					},
				})
				return
			}

			const packEntries: PackDownloadFileEntry[] = resolvedEntries.map((entry) => ({
				key: entry.element.id,
				file: entry.fileItem,
				fileName: getElementDownloadFileName({
					element: entry.element,
					fileItem: entry.fileItem,
					imageProcess: entry.imageProcess,
					preferElementName:
						Boolean(entry.imageProcess) ||
						downloadPlan.duplicatedFileIds.has(entry.fileItem.file_id),
				}),
				imageProcess: entry.imageProcess,
			}))

			await downloadProgress.startCustomDownload({
				label: t("design.messages.mediaDownloading", { count: resolvedEntries.length }),
				task: ({ signal, reportProgress }) =>
					packAndDownloadFileEntries(
						packEntries,
						getClientZipDownloadMode(noWatermark, downloadOptions),
						archiveName,
						{ signal, onProgress: reportProgress, retryCount: 1, fileApi },
					),
				onSuccess: ({ successCount, results }) => {
					const failedCount = results.length - successCount
					if (failedCount > 0) {
						magicToast.warning(
							t("design.messages.mediaDownloadPartial", {
								successCount,
								failedCount,
							}),
						)
						return
					}
					magicToast.success(
						t("design.messages.mediaDownloadSuccess", { count: successCount }),
					)
				},
				onError: () => {
					magicToast.error(t("design.errors.mediaDownloadFailed"))
				},
				onCancel: () => {
					magicToast.info(t("topicFiles.downloadAbort"))
				},
			})
		},
		[
			attachmentIndex,
			attachmentsReady,
			currentFile,
			designProjectBasePath,
			downloadProgress,
			fileApi,
			flatAttachments,
			getContentViewElement,
			projectId,
			t,
		],
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
			const runDownload = async () => {
				try {
					await executeDownload(data, noWatermark, downloadOptions)
				} catch (error) {
					magicToast.error(
						error instanceof CanvasMediaDownloadPreflightError
							? error.message || t("design.errors.mediaResolveFailed")
							: t("design.errors.mediaDownloadFailed"),
					)
				}
			}

			if (!noWatermark) {
				await runDownload()
				return
			}

			await downloadPolicy.handleHighQualityDownload({
				fileElements: data,
				skipAgreementCheck,
				executeDownload: runDownload,
			})
		},
		[t, downloadPolicy, executeDownload],
	)

	return {
		addToConversation,
		downloadFiles,
		executeDownload,
	}
}
