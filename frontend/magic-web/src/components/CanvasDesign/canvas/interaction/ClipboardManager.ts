import type { Canvas } from "../Canvas"
import type { LayerElement, ImageElement, VideoElement, CanvasFileElement } from "../types"
import { ElementTypeEnum } from "../types"
import { GenerationStatus, type UploadFileResponse } from "../../types.magic"
import { toast } from "sonner"
import {
	getMediaDimensions,
	calculateHorizontalImageLayout,
	calculateElementsRect,
	calculateNodesRect,
	isVideoFile,
	validateFile,
} from "../utils/utils"
import {
	getAllExistingNames,
	regenerateIdsWithUniqueNames,
	filterRedundantElements,
	getCanvasCenter,
} from "../utils/elementUtils"
import {
	CanvasElementClipboard,
	type CanvasElementClipboardBrowserOptions,
	type CanvasElementClipboardFile,
	type CanvasElementClipboardNativeExposure,
	type CanvasElementClipboardOperation,
	type CanvasElementClipboardPasteSource,
	type CanvasElementClipboardWriteFile,
	type CanvasElementClipboardPayload,
	type CanvasElementClipboardFileMetadata,
} from "../utils/CanvasElementClipboard"
import { logCanvasElementClipboard } from "../utils/CanvasElementClipboardLogger"
import canvasSize from "canvas-size"

const PNG_MIME_TYPE = "image/png"
const PNG_EXTENSION = ".png"
const DEFAULT_IMAGE_MIME_TYPE = "image/png"
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4"

function cloneSerializable<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
	const result: Omit<T, K> & Partial<Pick<T, K>> = { ...value }
	for (const key of keys) {
		delete result[key]
	}
	return result
}

interface CopyToastHandle {
	success: () => void
	dismiss: () => void
}

interface CanvasFileBlobData {
	blob: Blob
	element: CanvasFileElement
	filename: string
	mimeType: string
	fileSize: number
	sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
}

interface CanvasFileMetadataData {
	element: CanvasFileElement
	filename: string
	mimeType: string
	fileSize: number
	sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
}

interface OriginalFileBlobData {
	blob: Blob
	filename: string
	mimeType: string
	fileSize: number
	sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
}

interface NativeClipboardFile {
	metadata: CanvasElementClipboardFileMetadata
	native: CanvasElementClipboardNativeExposure
}

interface CollectedClipboardFiles {
	metadata: CanvasElementClipboardFileMetadata[]
	files: CanvasElementClipboardWriteFile[]
	native?: CanvasElementClipboardNativeExposure
}

/**
 * ClipboardManager
 * 负责剪贴板操作(复制和粘贴元素)
 */
export class ClipboardManager {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
	}

	/**
	 * 获取目标位置
	 */
	private getTargetPosition(position?: { x: number; y: number }): { x: number; y: number } {
		return position || getCanvasCenter(this.canvas)
	}

	/**
	 * 计算元素中心相对于目标位置的偏移量
	 */
	private getElementCenterOffset(
		element: { x?: number; y?: number; width?: number; height?: number },
		targetPosition: { x: number; y: number },
	): { offsetX: number; offsetY: number } {
		const elementWidth = element.width ?? 0
		const elementHeight = element.height ?? 0
		const elementCenterX = (element.x ?? 0) + elementWidth / 2
		const elementCenterY = (element.y ?? 0) + elementHeight / 2

		return {
			offsetX: targetPosition.x - elementCenterX,
			offsetY: targetPosition.y - elementCenterY,
		}
	}

	/**
	 * 计算多个元素中心相对于目标位置的偏移量
	 */
	private getElementsCenterOffset(
		elements: LayerElement[],
		targetPosition: { x: number; y: number },
	): { offsetX: number; offsetY: number } {
		const elementsRect = calculateElementsRect(elements)
		if (!elementsRect) {
			return { offsetX: 0, offsetY: 0 }
		}

		const elementsCenterX = elementsRect.x + elementsRect.width / 2
		const elementsCenterY = elementsRect.y + elementsRect.height / 2

		return {
			offsetX: targetPosition.x - elementsCenterX,
			offsetY: targetPosition.y - elementsCenterY,
		}
	}

	/**
	 * 判断是否可以粘贴来自其他画布的元素
	 */
	private canPasteFromClipboardCanvas(clipboardCanvasId?: string): boolean {
		const currentCanvasId = this.canvas.id
		if (clipboardCanvasId === undefined || currentCanvasId === undefined) {
			return true
		}
		return clipboardCanvasId === currentCanvasId
	}

	private showUnreadableClipboardHint(): void {
		toast(
			this.canvas.t?.("menu.pasteUseShortcutHint", "系统文件请使用 Ctrl/Cmd+V 粘贴") ||
				"系统文件请使用 Ctrl/Cmd+V 粘贴",
		)
	}

	private showClipboardSourceUnavailableHint(): void {
		toast(
			this.canvas.t?.(
				"menu.clipboardSourceUnavailable",
				"原文件链接已失效或无法访问，请重新复制后再粘贴",
			) || "原文件链接已失效或无法访问，请重新复制后再粘贴",
		)
	}

	/**
	 * 复制链路需要异步获取图片 / 视频来源信息，耗时期间给用户明确反馈。
	 * 这里统一使用 toast.loading，不再走宿主弹窗，避免复制动作阻塞当前画布交互。
	 */
	private showCopyLoadingToast(): CopyToastHandle {
		const content =
			this.canvas.t?.("menu.copyLoadingDescription", "正在准备媒体文件，请稍候...") ||
			"正在准备媒体文件，请稍候..."
		const toastId = toast.loading(content)
		return {
			success: () => {
				toast.success(this.canvas.t?.("menu.copySuccess", "复制成功") || "复制成功", {
					id: toastId,
				})
			},
			dismiss: () => toast.dismiss(toastId),
		}
	}

	/**
	 * 将多个元素复制为PNG图片
	 * @param elementIds - 元素ID列表
	 * @returns Promise<boolean> - 复制是否成功
	 */
	public async copyElementsAsPNG(elementIds: string[]): Promise<boolean> {
		const copyToast = this.showCopyLoadingToast()
		let success = false
		try {
			const exportResult = await this.exportElementsAsPNG(elementIds)
			if (!exportResult) {
				return false
			}
			const sourceElements = elementIds
				.map((id) => this.canvas.elementManager.getElementData(id))
				.filter((element): element is LayerElement => Boolean(element))

			success = await this.writePngToClipboard(
				exportResult.blob,
				exportResult.filename,
				exportResult.sourceFile,
				sourceElements,
			)
			if (success) {
				copyToast.success()
			}
			return success
		} catch (error) {
			return false
		} finally {
			if (!success) {
				copyToast.dismiss()
			}
		}
	}

	/**
	 * 将多个元素导出并下载为 PNG 图片
	 */
	public async downloadElementsAsPNG(elementIds: string[]): Promise<boolean> {
		try {
			const exportResult = await this.exportElementsAsPNG(elementIds)
			if (!exportResult) {
				return false
			}

			this.downloadBlob(exportResult.blob, exportResult.filename)
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * 获取 PNG 文件名
	 */
	private getPngFilename(filename: string): string {
		return filename.toLowerCase().endsWith(PNG_EXTENSION)
			? filename
			: filename.replace(/\.[^/.]+$/, "") + PNG_EXTENSION
	}

	private getMimeTypeFromFilename(filename: string, fallback: string): string {
		const extension = filename.split("?")[0].split(".").pop()?.toLowerCase()
		const extensionMimeTypeMap: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			bmp: "image/bmp",
			svg: "image/svg+xml",
			ico: "image/x-icon",
			mp4: "video/mp4",
			mov: "video/quicktime",
			webm: "video/webm",
			avi: "video/x-msvideo",
			mkv: "video/x-matroska",
		}

		return extension ? (extensionMimeTypeMap[extension] ?? fallback) : fallback
	}

	/**
	 * 获取原始未压缩资源信息。
	 *
	 * 图片展示链路会通过 useImageProcess=true 换取带 format/压缩参数的 URL；
	 * 复制元素只需要 sourceRef，避免为了画布协议提前下载大文件 Blob。
	 */
	private async fetchOriginalFileMetadata(options: {
		src: string
		fallbackFilename: string
		fallbackMimeType: string
	}): Promise<{
		filename: string
		mimeType: string
		fileSize: number
		sourceRef: CanvasElementClipboardFileMetadata["sourceRef"]
	} | null> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			return null
		}

		try {
			const fileInfo = await getFileInfo(options.src, { useImageProcess: false })
			if (!fileInfo?.src) {
				return null
			}

			const filename =
				fileInfo.fileName || this.getFilenameFromPath(options.src, options.fallbackFilename)
			const mimeType = this.getMimeTypeFromFilename(filename, options.fallbackMimeType)

			return {
				filename,
				mimeType,
				fileSize: 0,
				sourceRef: {
					src: options.src,
					ossUrl: fileInfo.src,
					expiresAt: fileInfo.expires_at,
				},
			}
		} catch {
			return null
		}
	}

	/**
	 * 获取原始未压缩资源 Blob。
	 *
	 * 仅在明确需要 native clipboard Blob（外部应用粘贴）或复制为 PNG 时调用。
	 */
	private async fetchOriginalFileBlob(options: {
		src: string
		fallbackFilename: string
		fallbackMimeType: string
	}): Promise<OriginalFileBlobData | null> {
		const metadata = await this.fetchOriginalFileMetadata(options)
		if (!metadata?.sourceRef?.ossUrl) {
			return null
		}

		try {
			const response = await fetch(metadata.sourceRef.ossUrl, { cache: "default" })
			if (!response.ok) {
				return null
			}

			const blob = await response.blob()
			const mimeType = blob.type || metadata.mimeType || options.fallbackMimeType

			return {
				blob,
				filename: metadata.filename,
				mimeType,
				fileSize: blob.size,
				sourceRef: metadata.sourceRef,
			}
		} catch {
			return null
		}
	}

	/**
	 * 将 Blob 转换为 PNG Blob
	 */
	private async convertToPngBlob(blob: Blob): Promise<Blob | null> {
		if (blob.type === PNG_MIME_TYPE) {
			return blob
		}

		try {
			const img = await createImageBitmap(blob)
			const canvas = document.createElement("canvas")
			canvas.width = img.width
			canvas.height = img.height
			const ctx = canvas.getContext("2d")
			if (!ctx) {
				return null
			}
			ctx.drawImage(img, 0, 0)
			return await new Promise<Blob | null>((resolve) => {
				canvas.toBlob((pngBlob) => {
					resolve(pngBlob || null)
				}, PNG_MIME_TYPE)
			})
		} catch (error) {
			return null
		}
	}

	private async exportElementsAsPNG(elementIds: string[]): Promise<{
		blob: Blob
		filename: string
		sourceFile?: CanvasFileBlobData
	} | null> {
		if (elementIds.length === 0) {
			return null
		}

		// 1. 过滤冗余元素（如果父元素已选中，则子元素无需单独处理）
		const filteredIds = filterRedundantElements(elementIds, this.canvas.elementManager)
		if (filteredIds.length === 0) {
			return null
		}

		// 2. 获取所有元素实例和节点
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform(filteredIds)
		if (nodes.length === 0) {
			return null
		}

		// 3. 使用 calculateNodesRect 计算总体边界
		const boundingRect = calculateNodesRect(
			nodes,
			this.canvas.stage,
			this.canvas.elementManager,
		)
		if (!boundingRect || boundingRect.width <= 0 || boundingRect.height <= 0) {
			return null
		}

		// 4. 创建 Canvas，设置宽高
		const exportCanvas = document.createElement("canvas")
		const ctx = exportCanvas.getContext("2d")
		if (!ctx) {
			return null
		}

		// 获取 Canvas 最大支持尺寸
		const { width: canvasMaxWidth, height: canvasMaxHeight } = await canvasSize.maxArea({
			usePromise: true,
			useWorker: true,
		})

		// 计算原始 Canvas 尺寸
		const originalWidth = Math.ceil(boundingRect.width)
		const originalHeight = Math.ceil(boundingRect.height)

		// 检查是否需要按比例压缩
		let canvasWidth = originalWidth
		let canvasHeight = originalHeight
		let scaleRatio = 1

		if (originalWidth > canvasMaxWidth || originalHeight > canvasMaxHeight) {
			const widthRatio = canvasMaxWidth / originalWidth
			const heightRatio = canvasMaxHeight / originalHeight
			scaleRatio = Math.min(widthRatio, heightRatio)

			canvasWidth = Math.ceil(originalWidth * scaleRatio)
			canvasHeight = Math.ceil(originalHeight * scaleRatio)
		}

		exportCanvas.width = canvasWidth
		exportCanvas.height = canvasHeight

		// 5. 判断是否需要绘制边框
		const firstElementData =
			filteredIds.length === 1
				? this.canvas.elementManager.getElementData(filteredIds[0])
				: null
		const shouldDrawBorder = false

		// 6. 单选图片时优先复用原图 blob，避免额外重渲染
		if (
			!shouldDrawBorder &&
			filteredIds.length === 1 &&
			firstElementData?.type === ElementTypeEnum.Image
		) {
			const result = await this.getImageBlobAndMetadata(firstElementData)
			if (result) {
				const pngBlob = await this.convertToPngBlob(result.blob)
				if (pngBlob) {
					return {
						blob: pngBlob,
						filename: this.getPngFilename(result.metadata.filename),
						sourceFile: {
							blob: pngBlob,
							element: result.element,
							filename: this.getPngFilename(result.metadata.filename),
							mimeType: PNG_MIME_TYPE,
							fileSize: pngBlob.size,
							sourceRef: result.metadata.sourceRef,
						},
					}
				}
			}
		}

		// 7. 收集所有需要渲染的元素信息并按 zIndex 排序
		const elementsToRender: Array<{
			elementInstance: {
				renderToCanvas: (
					ctx: CanvasRenderingContext2D,
					offsetX: number,
					offsetY: number,
					options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
				) => Promise<boolean>
			}
			offsetX: number
			offsetY: number
			elementWidth: number
			elementHeight: number
			zIndex: number
		}> = []

		for (const node of nodes) {
			const elementId = node.id()
			if (!elementId) continue

			const element = this.canvas.elementManager.getElementData(elementId)
			if (!element) continue

			const elementInstance = this.canvas.elementManager.getElementInstance(elementId)
			if (!elementInstance || typeof elementInstance.renderToCanvas !== "function") {
				continue
			}

			const elementRect = calculateNodesRect(
				[node],
				this.canvas.stage,
				this.canvas.elementManager,
			)
			if (!elementRect) continue

			elementsToRender.push({
				elementInstance,
				offsetX: (elementRect.x - boundingRect.x) * scaleRatio,
				offsetY: (elementRect.y - boundingRect.y) * scaleRatio,
				elementWidth: elementRect.width * scaleRatio,
				elementHeight: elementRect.height * scaleRatio,
				zIndex: element.zIndex ?? 0,
			})
		}

		elementsToRender.sort((a, b) => a.zIndex - b.zIndex)

		// 8. 串行执行 renderToCanvas，避免 Canvas 上下文状态冲突
		let hasSuccess = false
		for (const {
			elementInstance,
			offsetX,
			offsetY,
			elementWidth,
			elementHeight,
		} of elementsToRender) {
			const result = await elementInstance.renderToCanvas(ctx, offsetX, offsetY, {
				shouldDrawBorder,
				width: elementWidth,
				height: elementHeight,
			})
			if (result) {
				hasSuccess = true
			}
		}

		if (!hasSuccess) {
			return null
		}

		const blob = await this.canvasToBlob(exportCanvas)
		if (!blob) {
			return null
		}

		return {
			blob,
			filename: this.getSelectionPngFilename(filteredIds),
		}
	}

	private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
		return new Promise<Blob | null>((resolve) => {
			canvas.toBlob((blob) => {
				resolve(blob || null)
			}, PNG_MIME_TYPE)
		})
	}

	private getSelectionPngFilename(elementIds: string[]): string {
		if (elementIds.length !== 1) {
			return `canvas${PNG_EXTENSION}`
		}

		const element = this.canvas.elementManager.getElementData(elementIds[0])
		const sanitizedName = element?.name?.trim().replace(/[\\/:*?"<>|]+/g, "-")
		if (sanitizedName) {
			return this.getPngFilename(sanitizedName)
		}

		if (element?.type === ElementTypeEnum.Text) {
			return this.getPngFilename("text")
		}

		return `canvas${PNG_EXTENSION}`
	}

	private downloadBlob(blob: Blob, filename: string): void {
		const downloadUrl = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = downloadUrl
		link.download = filename
		link.style.display = "none"
		document.body.appendChild(link)
		link.click()
		link.remove()
		window.setTimeout(() => {
			URL.revokeObjectURL(downloadUrl)
		}, 0)
	}

	/**
	 * Get the browser clipboard adapter options for CanvasDesign.
	 *
	 * ClipboardManager only forwards host-provided methods. Browser API
	 * fallback, error propagation, MIME rules, and parsing stay in utilities.
	 */
	private getClipboardBrowserOptions(): CanvasElementClipboardBrowserOptions | undefined {
		const clipboard = this.canvas.magicConfigManager.config?.methods?.clipboard
		if (!clipboard) return undefined
		return clipboard
	}

	private getNativeClipboardExposure(options: {
		operation: CanvasElementClipboardOperation
		files: CanvasElementClipboardWriteFile[]
		native?: CanvasElementClipboardNativeExposure
	}): CanvasElementClipboardNativeExposure | undefined {
		const { operation, files, native } = options
		if (native && CanvasElementClipboard.supportsNativeMimeType(native.mimeType)) {
			return native
		}

		if (files.length !== 1) {
			return undefined
		}

		const [file] = files
		if (!file || !CanvasElementClipboard.supportsNativeMimeType(file.metadata.mimeType)) {
			return undefined
		}

		if (operation === "copy-as-png") {
			return {
				mimeType: file.metadata.mimeType,
				blob: file.blob,
			}
		}

		return undefined
	}

	private async writeCanvasElementClipboardWithLog(options: {
		operation: CanvasElementClipboardOperation
		payload: CanvasElementClipboardPayload
		files: CanvasElementClipboardWriteFile[]
		native?: CanvasElementClipboardNativeExposure
	}): Promise<void> {
		const { operation, payload, files } = options
		const native = this.getNativeClipboardExposure({
			operation,
			files,
			native: options.native,
		})
		logCanvasElementClipboard("clipboard-protocol-write:start", {
			operation,
			payload,
			hasNativeExposure: Boolean(native),
			nativeMimeType: native?.mimeType,
			files: files.map((file) => ({
				metadata: file.metadata,
				blobContent: file.blob,
			})),
		})

		try {
			await CanvasElementClipboard.write({
				payload,
				files,
				native,
				clipboard: this.getClipboardBrowserOptions(),
			})
			logCanvasElementClipboard("clipboard-protocol-write:success", {
				operation,
				payload,
				hasNativeExposure: Boolean(native),
				nativeMimeType: native?.mimeType,
				files: files.map((file) => ({
					metadata: file.metadata,
					blobContent: file.blob,
				})),
			})
		} catch (error) {
			logCanvasElementClipboard("clipboard-protocol-write:error", {
				operation,
				message: error instanceof Error ? error.message : String(error),
				error,
				payload,
				hasNativeExposure: Boolean(native),
				nativeMimeType: native?.mimeType,
				files: files.map((file) => ({
					metadata: file.metadata,
					blobContent: file.blob,
				})),
			})
			throw error
		}
	}

	/**
	 * 将 PNG Blob 写入剪贴板。
	 *
	 * 复制为 PNG 也是 CanvasDesign 产出的文件，统一通过 CanvasElementClipboard
	 * 写入私有 payload + PNG Blob。读取时会按普通图片文件粘贴，而不是恢复源元素。
	 */
	private async writePngToClipboard(
		blob: Blob,
		filename: string,
		sourceFile?: CanvasFileBlobData,
		sourceElements: LayerElement[] = sourceFile ? [sourceFile.element] : [],
	): Promise<boolean> {
		try {
			const file = new File([blob], filename, { type: PNG_MIME_TYPE })
			const fileId = sourceFile
				? `${sourceFile.element.id}:png-export`
				: `canvas-png:${Date.now()}`
			const metadata = CanvasElementClipboard.createCanvasExportFileMetadata({
				fileId,
				filename,
				mimeType: PNG_MIME_TYPE,
				fileSize: file.size,
				sourceElements,
				sourceRef: sourceFile?.sourceRef,
			})
			const files: CanvasElementClipboardWriteFile[] = [{ blob: file, metadata }]
			const payload = CanvasElementClipboard.createPayload({
				elements: [],
				canvasId: this.canvas.id,
				files: [metadata],
				operation: "copy-as-png",
			})
			await this.writeCanvasElementClipboardWithLog({
				operation: "copy-as-png",
				payload,
				files,
			})
			return true
		} catch (error) {
			void error
			return false
		}
	}

	/**
	 * 获取图片元素的 blob 和元数据（内部方法，供其他方法复用）
	 * @param element 图片元素数据
	 * @returns blob、文件名和元数据，或 null（如果获取失败）
	 */
	private async getImageBlobAndMetadata(element: ImageElement): Promise<{
		blob: Blob
		element: ImageElement
		metadata: {
			filename: string
			mimeType: string
			fileSize: number
			sourceRef?: CanvasElementClipboardFileMetadata["sourceRef"]
		}
	} | null> {
		if (!element.src) {
			return null
		}

		const originalFile = await this.fetchOriginalFileBlob({
			src: element.src,
			fallbackFilename: `${element.name || "image"}.png`,
			fallbackMimeType: DEFAULT_IMAGE_MIME_TYPE,
		})
		if (!originalFile) {
			return null
		}

		const metadata = {
			filename: originalFile.filename,
			mimeType: originalFile.mimeType,
			fileSize: originalFile.fileSize,
			sourceRef: originalFile.sourceRef,
		}

		return { blob: originalFile.blob, element, metadata }
	}

	private getFilenameFromPath(path: string, fallback: string): string {
		const cleanPath = path.split("?")[0]
		const filename = cleanPath.split("/").pop()
		return filename || fallback
	}

	private async getImageMetadata(element: ImageElement): Promise<CanvasFileMetadataData | null> {
		if (!element.src) {
			return null
		}

		const metadata = await this.fetchOriginalFileMetadata({
			src: element.src,
			fallbackFilename: `${element.name || "image"}.png`,
			fallbackMimeType: DEFAULT_IMAGE_MIME_TYPE,
		})

		return metadata ? { element, ...metadata } : null
	}

	private async getVideoMetadata(element: VideoElement): Promise<CanvasFileMetadataData | null> {
		if (!element.src) {
			return null
		}

		const metadata = await this.fetchOriginalFileMetadata({
			src: element.src,
			fallbackFilename: `${element.name || "video"}.mp4`,
			fallbackMimeType: DEFAULT_VIDEO_MIME_TYPE,
		})

		return metadata ? { element, ...metadata } : null
	}

	private async getCanvasFileMetadata(
		element: CanvasFileElement,
	): Promise<CanvasFileMetadataData | null> {
		if (element.type === ElementTypeEnum.Image) {
			return this.getImageMetadata(element)
		}

		return this.getVideoMetadata(element)
	}

	private shouldExposeNativeFileForElementCopy(options: {
		elementCount: number
		metadata: CanvasElementClipboardFileMetadata
	}): boolean {
		if (options.elementCount !== 1) {
			return false
		}

		return CanvasElementClipboard.supportsNativeMimeType(options.metadata.mimeType)
	}

	private async fetchNativeClipboardFile(
		metadata: CanvasElementClipboardFileMetadata,
	): Promise<NativeClipboardFile | null> {
		if (!metadata.sourceRef?.ossUrl) {
			return null
		}

		try {
			const response = await fetch(metadata.sourceRef.ossUrl, { cache: "default" })
			if (!response.ok) {
				logCanvasElementClipboard("copy:native-fetch-failed", {
					elementId: metadata.elementId,
					filename: metadata.filename,
					mimeType: metadata.mimeType,
					status: response.status,
					statusText: response.statusText,
					sourceRef: metadata.sourceRef,
				})
				return null
			}

			const blob = await response.blob()
			const mimeType = blob.type || metadata.mimeType
			if (!CanvasElementClipboard.supportsNativeMimeType(mimeType)) {
				return null
			}

			const fileMetadata = {
				...metadata,
				mimeType,
				fileSize: blob.size,
			}

			return {
				metadata: fileMetadata,
				native: {
					mimeType,
					blob,
				},
			}
		} catch (error) {
			logCanvasElementClipboard("copy:native-fetch-error", {
				elementId: metadata.elementId,
				filename: metadata.filename,
				mimeType: metadata.mimeType,
				message: error instanceof Error ? error.message : String(error),
				sourceRef: metadata.sourceRef,
			})
			return null
		}
	}

	private async collectClipboardFiles(
		elements: LayerElement[],
	): Promise<CollectedClipboardFiles> {
		const mediaElements = elements.filter(CanvasElementClipboard.isCanvasFileElement)
		const metadataList: CanvasElementClipboardFileMetadata[] = []
		const files: CanvasElementClipboardWriteFile[] = []
		let native: CanvasElementClipboardNativeExposure | undefined

		for (let i = 0; i < mediaElements.length; i++) {
			const element = mediaElements[i]
			const result = await this.getCanvasFileMetadata(element)
			if (!result) {
				continue
			}

			const metadata = CanvasElementClipboard.createFileMetadata({
				element,
				fileId: `${element.id}:${i}`,
				filename: result.filename,
				mimeType: result.mimeType,
				fileSize: result.fileSize,
				sourceRef: result.sourceRef,
			})
			metadataList.push(metadata)

			if (
				this.shouldExposeNativeFileForElementCopy({
					elementCount: elements.length,
					metadata,
				})
			) {
				const nativeFile = await this.fetchNativeClipboardFile(metadata)
				if (nativeFile) {
					metadataList[metadataList.length - 1] = nativeFile.metadata
					native = nativeFile.native
				}
			}
		}

		return { metadata: metadataList, files, native }
	}

	/**
	 * 复制元素到剪贴板
	 * @param elementId - 元素ID（可选，如果不传则复制所有选中的元素）
	 */
	public async copy(elementId?: string): Promise<void> {
		try {
			let elements: LayerElement[]

			if (elementId) {
				// 复制指定元素
				const element = this.canvas.elementManager.getElementData(elementId)
				if (!element) return
				elements = [element]
			} else {
				// 复制所有选中的元素
				const selectedIds = this.canvas.selectionManager.getSelectedIds()
				if (selectedIds.length === 0) {
					return
				}

				// 获取所有选中的元素数据
				elements = selectedIds
					.map((id) => this.canvas.elementManager.getElementData(id))
					.filter((el): el is LayerElement => el !== null && el !== undefined)

				if (elements.length === 0) {
					return
				}
			}

			// 复制元素时会异步获取媒体 sourceRef，先展示 loading 避免用户误以为未响应。
			const copyToast = this.showCopyLoadingToast()
			let success = false
			try {
				const { metadata, files, native } = await this.collectClipboardFiles(elements)
				const payload = CanvasElementClipboard.createPayload({
					elements,
					canvasId: this.canvas.id,
					files: metadata,
					operation: "copy-elements",
				})
				await this.writeCanvasElementClipboardWithLog({
					operation: "copy-elements",
					payload,
					files,
					native,
				})
				success = true
				copyToast.success()
			} finally {
				if (!success) {
					copyToast.dismiss()
				}
			}
		} catch (error) {
			// 复制失败，静默处理
			throw new Error(error instanceof Error ? error.message : "复制失败")
		}
	}

	/**
	 * 聚焦到元素（单个或多个）
	 * @param elementIds 元素ID数组
	 */
	private focusOnElements(elementIds: string[]): void {
		if (elementIds.length === 0) return

		requestAnimationFrame(() => {
			this.canvas.viewportController.focusOnElements(elementIds, { animated: true })
		})
	}

	/**
	 * 从剪贴板粘贴元素或图片文件。
	 *
	 * 调用来源：
	 * - Ctrl/Cmd+V：传入 ClipboardEvent，可在 CanvasElementClipboard 中读取同步文件字节。
	 * - 菜单粘贴：不传 ClipboardEvent，只传 position，只能依赖 Clipboard API read()。
	 *
	 * @param clipboardEvent 可选的 ClipboardEvent，如果提供则可用于补齐文件
	 * @param position 可选的位置参数，如果提供则在该位置粘贴（元素中心对齐到该位置），否则在画布中心粘贴
	 * @param pasteSource 粘贴入口来源，用于日志和问题追踪
	 */
	public async paste(
		clipboardEvent?: ClipboardEvent,
		position?: { x: number; y: number },
		pasteSource: CanvasElementClipboardPasteSource = clipboardEvent ? "keyboard" : "menu",
	): Promise<void> {
		try {
			logCanvasElementClipboard("paste:start", {
				pasteSource,
				hasClipboardEvent: Boolean(clipboardEvent),
				hasPosition: Boolean(position),
				position,
			})
			// 解析细节统一收敛在 CanvasElementClipboard：
			// Ctrl/Cmd+V 会传 clipboardEvent；菜单粘贴传 undefined。
			const parseResult = await CanvasElementClipboard.parseClipboardContent(clipboardEvent, {
				...this.getClipboardBrowserOptions(),
				pasteSource,
			})
			logCanvasElementClipboard("paste:parse-result", {
				pasteSource,
				type: parseResult.type,
				elementCount:
					parseResult.type === "canvas-elements" ? parseResult.elements.length : 0,
				fileCount:
					parseResult.type === "canvas-elements"
						? parseResult.files.length
						: parseResult.type === "files"
							? parseResult.files.length
							: 0,
				reason: parseResult.type === "invalid" ? parseResult.reason : undefined,
			})

			// 根据解析结果执行相应操作
			if (parseResult.type === "empty" || parseResult.type === "invalid") {
				if (
					!clipboardEvent &&
					parseResult.type === "invalid" &&
					parseResult.reason === "clipboard-api-unreadable-items"
				) {
					this.showUnreadableClipboardHint()
					return
				}
				if (
					!clipboardEvent &&
					parseResult.type === "invalid" &&
					parseResult.reason === "clipboard-filename-text-only"
				) {
					this.showUnreadableClipboardHint()
				}
				return
			}

			if (parseResult.type === "canvas-elements") {
				logCanvasElementClipboard("paste:canvas-elements:start", {
					pasteSource,
					elementCount: parseResult.elements.length,
					fileCount: parseResult.files.length,
					canvasId: parseResult.canvasId,
					targetPosition: position,
					elementIds: parseResult.elements.map((element) => element.id),
					fileElementIds: parseResult.files.map(({ metadata }) => metadata.elementId),
					fileMimeTypes: parseResult.files.map(({ file }) => file.type),
				})
				await this.pasteCanvasElementsFromRichClipboard(
					parseResult.elements,
					parseResult.files,
					parseResult.fileMetadata,
					parseResult.canvasId,
					position,
				)
				return
			}

			if (parseResult.type === "files") {
				logCanvasElementClipboard("paste:files:start", {
					pasteSource,
					fileCount: parseResult.files.length,
					fileNames: parseResult.files.map((file) => file.name),
					fileMimeTypes: parseResult.files.map((file) => file.type),
					targetPosition: position,
				})
				await this.pasteFilesFromClipboard(parseResult.files, position)
				return
			}
		} catch (error) {
			logCanvasElementClipboard("paste:error", {
				pasteSource,
				message: error instanceof Error ? error.message : String(error),
				error,
			})
		}
	}

	private getFileElementInitialData(
		element: CanvasFileElement,
		finalElement: LayerElement,
	): Partial<ImageElement> | Partial<VideoElement> {
		const persistedElementData = omitKeys(cloneSerializable(element), [
			"id",
			"type",
			"src",
			"status",
			"errorMessage",
			"name",
			"x",
			"y",
			"width",
			"height",
			"zIndex",
			"visible",
			"locked",
			"opacity",
			"scaleX",
			"scaleY",
			"interactionConfig",
		] as const)

		const commonData = {
			name: finalElement.name,
			x: finalElement.x,
			y: finalElement.y,
			width: finalElement.width,
			height: finalElement.height,
			zIndex: finalElement.zIndex,
			visible: finalElement.visible,
			locked: finalElement.locked,
			opacity: finalElement.opacity,
			scaleX: finalElement.scaleX,
			scaleY: finalElement.scaleY,
			interactionConfig: finalElement.interactionConfig,
		}

		return {
			...persistedElementData,
			...commonData,
		}
	}

	private getFileElementDataWithUploadResult(
		finalElement: CanvasFileElement,
		uploadResult: UploadFileResponse,
	): CanvasFileElement {
		return {
			...finalElement,
			src: uploadResult.path,
			status: GenerationStatus.Completed,
		}
	}

	private primeFileElementResourceCache(
		element: CanvasFileElement,
		uploadResult: UploadFileResponse,
	): void {
		if (!uploadResult.src) {
			return
		}

		if (element.type === ElementTypeEnum.Image) {
			this.canvas.imageResourceManager.primeCache(uploadResult.path, {
				src: uploadResult.src,
				expires_at: uploadResult.expires_at,
			})
			return
		}

		this.canvas.videoResourceManager.primeCache(uploadResult.path, {
			src: uploadResult.src,
			expires_at: uploadResult.expires_at,
		})
	}

	private async pasteCanvasElementsFromRichClipboard(
		elements: LayerElement[],
		files: CanvasElementClipboardFile[],
		fileMetadata: CanvasElementClipboardFileMetadata[],
		canvasId: string | undefined,
		position?: { x: number; y: number },
	): Promise<void> {
		const sortedElements = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
		const fileByElementId = new Map(files.map((item) => [item.metadata.elementId, item.file]))
		const metadataByElementId = new Map(
			fileMetadata.map((metadata) => [metadata.elementId, metadata]),
		)
		const currentNames = new Set(getAllExistingNames(this.canvas.elementManager))
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		const targetPosition = this.getTargetPosition(position)
		const { offsetX, offsetY } =
			sortedElements.length === 1
				? this.getElementCenterOffset(sortedElements[0], targetPosition)
				: this.getElementsCenterOffset(sortedElements, targetPosition)
		const canReuseElementSrc = this.canPasteFromClipboardCanvas(canvasId)
		const createdElementIds: string[] = []
		let sourceReferenceFailureCount = 0
		let hasShownSourceUnavailableHint = false
		let hasPendingFileUploadElements = false

		logCanvasElementClipboard("paste-canvas-elements:start", {
			sourceCanvasId: canvasId,
			currentCanvasId: this.canvas.id,
			elementCount: sortedElements.length,
			fileCount: files.length,
			fileMetadataCount: fileMetadata.length,
			canReuseElementSrc,
			targetPosition,
			offsetX,
			offsetY,
			elements: sortedElements.map((element) => ({
				id: element.id,
				type: element.type,
				name: element.name,
				x: element.x,
				y: element.y,
				width: element.width,
				height: element.height,
				zIndex: element.zIndex,
			})),
			files: files.map(({ metadata, file }) => ({
				metadata,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
			})),
			referenceFiles: fileMetadata
				.filter((metadata) => metadata.sourceRef)
				.map((metadata) => ({
					elementId: metadata.elementId,
					sourceRef: metadata.sourceRef,
				})),
		})

		this.canvas.historyManager.disable()

		try {
			const { pendingBatchId } = await this.canvas.canvasFileUploadManager.withLock(
				async () => {
					const pendingBatchId =
						this.canvas.canvasFileUploadManager.getCurrentPendingBatchId()
					let nextZIndex = maxZIndex + 1

					for (const element of sortedElements) {
						const elementWithNewIds = regenerateIdsWithUniqueNames(
							element,
							currentNames,
						)
						const finalElement = {
							...elementWithNewIds,
							x: (element.x ?? 0) + offsetX,
							y: (element.y ?? 0) + offsetY,
							zIndex: nextZIndex++,
						}

						if (CanvasElementClipboard.isCanvasFileElement(element)) {
							// 同画布复制粘贴是元素实例复制，不是资源迁移：直接复用原 src，避免下载/上传。
							if (canReuseElementSrc) {
								this.canvas.elementManager.create(finalElement)
								createdElementIds.push(finalElement.id)
								logCanvasElementClipboard(
									"paste-canvas-elements:create-same-canvas-file",
									{
										sourceElementId: element.id,
										createdElementId: finalElement.id,
										elementType: finalElement.type,
										reusedSrc: true,
									},
								)
								continue
							}

							const metadata = metadataByElementId.get(element.id)
							if (metadata) {
								const completedTransfer =
									this.canvas.canvasFileUploadManager.getCompletedRemoteResourceTransfer(
										{
											sourceCanvasId: canvasId,
											metadata,
										},
									)
								if (completedTransfer) {
									const cachedFileElement =
										this.getFileElementDataWithUploadResult(
											finalElement as CanvasFileElement,
											completedTransfer,
										)
									// 解决场景：多 tab / 多窗口命中持久化迁移结果后，直接复用目标资源并预热缓存，避免再换链。
									this.primeFileElementResourceCache(
										cachedFileElement,
										completedTransfer,
									)
									this.canvas.elementManager.create(cachedFileElement)
									createdElementIds.push(cachedFileElement.id)
									logCanvasElementClipboard(
										"paste-canvas-elements:create-cached-file",
										{
											sourceElementId: element.id,
											createdElementId: cachedFileElement.id,
											elementType: cachedFileElement.type,
											result: {
												path: completedTransfer.path,
												fileName: completedTransfer.fileName,
												expiresAt: completedTransfer.expires_at,
												source: completedTransfer.source,
												hasSrc: Boolean(completedTransfer.src),
											},
										},
									)
									continue
								}
							}

							const file = fileByElementId.get(element.id)
							if (file) {
								logCanvasElementClipboard("paste-canvas-elements:upload-start", {
									sourceElementId: element.id,
									sourceElementType: element.type,
									targetElementId: finalElement.id,
									fileName: file.name,
									fileType: file.type,
									fileSize: file.size,
									position: {
										x: (finalElement.x ?? 0) + (finalElement.width ?? 0) / 2,
										y: (finalElement.y ?? 0) + (finalElement.height ?? 0) / 2,
									},
									elementData: this.getFileElementInitialData(
										element,
										finalElement,
									),
								})
								const elementId =
									await this.canvas.canvasFileUploadManager.uploadFileElement({
										file,
										position: {
											x:
												(finalElement.x ?? 0) +
												(finalElement.width ?? 0) / 2,
											y:
												(finalElement.y ?? 0) +
												(finalElement.height ?? 0) / 2,
										},
										elementData: this.getFileElementInitialData(
											element,
											finalElement,
										),
										manageHistory: false,
									})
								if (elementId) {
									hasPendingFileUploadElements = true
									createdElementIds.push(elementId)
									logCanvasElementClipboard(
										"paste-canvas-elements:upload-created",
										{
											sourceElementId: element.id,
											createdElementId: elementId,
											fileName: file.name,
											fileType: file.type,
											fileSize: file.size,
										},
									)
								} else {
									logCanvasElementClipboard(
										"paste-canvas-elements:upload-create-failed",
										{
											sourceElementId: element.id,
											targetElementId: finalElement.id,
											fileName: file.name,
											fileType: file.type,
											fileSize: file.size,
										},
									)
								}
								continue
							}

							if (metadata?.sourceRef?.ossUrl) {
								logCanvasElementClipboard(
									"paste-canvas-elements:remote-upload-create",
									{
										sourceElementId: element.id,
										sourceElementType: element.type,
										targetElementId: finalElement.id,
										metadata,
										position: {
											x:
												(finalElement.x ?? 0) +
												(finalElement.width ?? 0) / 2,
											y:
												(finalElement.y ?? 0) +
												(finalElement.height ?? 0) / 2,
										},
										elementData: this.getFileElementInitialData(
											element,
											finalElement,
										),
									},
								)
								const elementId =
									await this.canvas.canvasFileUploadManager.uploadRemoteFileElement(
										{
											metadata,
											sourceCanvasId: canvasId,
											elementType: element.type,
											position: {
												x:
													(finalElement.x ?? 0) +
													(finalElement.width ?? 0) / 2,
												y:
													(finalElement.y ?? 0) +
													(finalElement.height ?? 0) / 2,
											},
											elementData: this.getFileElementInitialData(
												element,
												finalElement,
											),
											manageHistory: false,
											onDownloadFailed: () => {
												if (!hasShownSourceUnavailableHint) {
													hasShownSourceUnavailableHint = true
													this.showClipboardSourceUnavailableHint()
												}
											},
										},
									)
								if (elementId) {
									hasPendingFileUploadElements = true
									createdElementIds.push(elementId)
									logCanvasElementClipboard(
										"paste-canvas-elements:remote-upload-created",
										{
											sourceElementId: element.id,
											createdElementId: elementId,
											metadata,
										},
									)
								} else {
									sourceReferenceFailureCount += 1
									logCanvasElementClipboard(
										"paste-canvas-elements:remote-upload-create-failed",
										{
											sourceElementId: element.id,
											targetElementId: finalElement.id,
											metadata,
										},
									)
								}
								continue
							}

							if (!canReuseElementSrc) {
								logCanvasElementClipboard(
									"paste-canvas-elements:skip-file-element",
									{
										sourceElementId: element.id,
										sourceElementType: element.type,
										reason: "missing-file-and-cross-canvas-src-reuse-disabled",
										hasSourceRef: Boolean(
											metadataByElementId.get(element.id)?.sourceRef?.ossUrl,
										),
									},
								)
								continue
							}
						}

						this.canvas.elementManager.create(finalElement)
						createdElementIds.push(finalElement.id)
						logCanvasElementClipboard("paste-canvas-elements:create-direct", {
							sourceElementId: element.id,
							createdElementId: finalElement.id,
							elementType: finalElement.type,
							reusedSrc: CanvasElementClipboard.isCanvasFileElement(element),
						})
					}

					return { pendingBatchId }
				},
			)

			this.canvas.historyManager.enable()
			if (createdElementIds.length > 0) {
				this.canvas.selectionManager.selectMultiple(createdElementIds)
				this.focusOnElements(createdElementIds)
				this.canvas.historyManager.recordHistoryImmediate()
			}
			if (sourceReferenceFailureCount > 0) {
				this.showClipboardSourceUnavailableHint()
			}
			if (
				!hasPendingFileUploadElements &&
				pendingBatchId &&
				this.canvas.canvasFileUploadManager.hasPendingUploadBatch(pendingBatchId)
			) {
				this.canvas.canvasFileUploadManager.commitPendingUploadBatch(pendingBatchId)
			}
			logCanvasElementClipboard("paste-canvas-elements:done", {
				createdElementIds,
				pendingBatchId,
				sourceReferenceFailureCount,
				hasPendingFileUploadElements,
				hasPendingUploadBatch: pendingBatchId
					? this.canvas.canvasFileUploadManager.hasPendingUploadBatch(pendingBatchId)
					: false,
			})
		} catch (error) {
			this.canvas.historyManager.enable()
			logCanvasElementClipboard("paste-canvas-elements:error", {
				message: error instanceof Error ? error.message : String(error),
				error,
				createdElementIds,
			})
			throw error
		}
	}

	/**
	 * 从剪贴板粘贴文件
	 */
	private async pasteFilesFromClipboard(
		files: File[],
		position?: { x: number; y: number },
	): Promise<void> {
		logCanvasElementClipboard("paste-files:dispatch", {
			fileCount: files.length,
			fileNames: files.map((file) => file.name),
			fileMimeTypes: files.map((file) => file.type),
			position,
		})
		if (files.length === 1) {
			await this.pasteCanvasFile(files[0], position)
			return
		}

		const targetPosition = this.getTargetPosition(position)
		await this.pasteMultipleCanvasFiles(files, targetPosition)
	}

	/**
	 * 粘贴多个文件到画布（支持图片、视频）
	 * @param files 文件数组
	 * @param anchorPosition 锚点位置（第一个文件的中心位置）
	 * @param options 可选配置
	 * @returns 创建的元素 ID 数组
	 */
	public async pasteMultipleCanvasFiles(
		files: File[],
		anchorPosition: { x: number; y: number },
		options?: { skipFocus?: boolean },
	): Promise<string[]> {
		logCanvasElementClipboard("paste-multiple-files:start", {
			fileCount: files.length,
			fileNames: files.map((file) => file.name),
			fileMimeTypes: files.map((file) => file.type),
			fileSizes: files.map((file) => file.size),
			anchorPosition,
			skipFocus: options?.skipFocus,
		})
		this.canvas.historyManager.disable()

		try {
			const { createdElementIds, pendingBatchId } =
				await this.canvas.canvasFileUploadManager.withLock(async () => {
					const pendingBatchId =
						this.canvas.canvasFileUploadManager.getCurrentPendingBatchId()
					const mediaDimensions = await Promise.all(
						files.map((file) => getMediaDimensions(file)),
					)
					const positions = calculateHorizontalImageLayout(
						mediaDimensions,
						anchorPosition,
						0,
					)

					const createdElementIds: string[] = []
					for (let i = 0; i < files.length; i++) {
						const file = files[i]
						const position = positions[i]

						logCanvasElementClipboard("paste-multiple-files:upload-start", {
							index: i,
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							position,
						})
						const elementId =
							await this.canvas.canvasFileUploadManager.uploadFileElement({
								file,
								position,
								manageHistory: false,
							})
						if (elementId) {
							createdElementIds.push(elementId)
							logCanvasElementClipboard("paste-multiple-files:upload-created", {
								index: i,
								elementId,
								fileName: file.name,
								fileType: file.type,
								fileSize: file.size,
							})
						} else {
							logCanvasElementClipboard("paste-multiple-files:upload-create-failed", {
								index: i,
								fileName: file.name,
								fileType: file.type,
								fileSize: file.size,
							})
						}
					}

					if (createdElementIds.length > 0 && !options?.skipFocus) {
						this.focusOnElements(createdElementIds)
					}

					return { createdElementIds, pendingBatchId }
				})

			this.canvas.historyManager.enable()

			if (
				pendingBatchId &&
				this.canvas.canvasFileUploadManager.hasPendingUploadBatch(pendingBatchId)
			) {
				this.canvas.historyManager.recordHistoryImmediate()
				this.canvas.canvasFileUploadManager.commitPendingUploadBatch(pendingBatchId)
			}

			return createdElementIds.filter((elementId) =>
				this.canvas.elementManager.hasElement(elementId),
			)
		} catch (error) {
			this.canvas.historyManager.enable()
			logCanvasElementClipboard("paste-multiple-files:error", {
				message: error instanceof Error ? error.message : String(error),
				error,
				fileCount: files.length,
				fileNames: files.map((file) => file.name),
				fileMimeTypes: files.map((file) => file.type),
			})
			throw error
		}
	}

	/**
	 * 粘贴文件到画布（支持图片、视频）
	 * @param file 文件
	 * @param position 可选的位置参数，如果提供则在该位置创建文件元素
	 * @param options 可选配置
	 * @returns 创建的元素 ID
	 */
	public async pasteCanvasFile(
		file: File,
		position?: { x: number; y: number },
		options?: { skipFocus?: boolean },
	): Promise<string | null> {
		logCanvasElementClipboard("paste-file:start", {
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			position,
			skipFocus: options?.skipFocus,
			readonly: this.canvas.readonly,
		})
		if (this.canvas.readonly) {
			logCanvasElementClipboard("paste-file:skip", {
				reason: "readonly",
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
			})
			return null
		}

		const validation = validateFile(file)
		if (!validation.valid) {
			logCanvasElementClipboard("paste-file:skip", {
				reason: "invalid-file",
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				validation,
			})
			return null
		}

		const targetPosition = this.getTargetPosition(position)
		const elementIds = await this.pasteMultipleCanvasFiles([file], targetPosition, options)

		logCanvasElementClipboard("paste-file:done", {
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			elementIds,
		})
		return elementIds.length > 0 ? elementIds[0] : null
	}

	/**
	 * 粘贴多个图片文件到画布（水平排列，无间隙）
	 * @param files 图片文件数组
	 * @param anchorPosition 锚点位置（第一个图片的中心位置）
	 * @param options 可选配置
	 * @returns 创建的图片元素 ID 数组
	 */
	public async pasteMultipleImageFiles(
		files: File[],
		anchorPosition: { x: number; y: number },
		options?: { skipFocus?: boolean },
	): Promise<string[]> {
		const imageFiles = files.filter((file) => !isVideoFile(file))
		return this.pasteMultipleCanvasFiles(imageFiles, anchorPosition, options)
	}

	/**
	 * 粘贴图片文件到画布
	 * @param file 图片文件
	 * @param position 可选的位置参数，如果提供则在该位置创建图片（图片中心对齐到该位置），否则在画布中心创建
	 * @param options 可选配置
	 * @returns 创建的图片元素 ID
	 */
	public async pasteImageFile(
		file: File,
		position?: { x: number; y: number },
		options?: { skipFocus?: boolean },
	): Promise<string | null> {
		if (isVideoFile(file)) {
			return null
		}
		return this.pasteCanvasFile(file, position, options)
	}
}
