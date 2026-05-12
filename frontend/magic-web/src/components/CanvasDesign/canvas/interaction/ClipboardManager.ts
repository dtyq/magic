import type { Canvas } from "../Canvas"
import type { LayerElement, ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import { GenerationStatus } from "../../types.magic"
import { toast } from "sonner"
import {
	getMediaDimensions,
	calculateHorizontalImageLayout,
	calculateElementsRect,
	calculateNodesRect,
	type ElementClipboardMetadata,
	type CanvasClipboardData,
	isVideoFile,
} from "../utils/utils"
import { validateFile } from "../utils/utils"
import { ImageElement as ImageElementClass } from "../element/elements/ImageElement"
import {
	getAllExistingNames,
	regenerateIdsWithUniqueNames,
	filterRedundantElements,
	getCanvasCenter,
	withHistoryManagerAsync,
} from "../utils/elementUtils"
import { parseClipboardContent, type ParseClipboardOptions } from "../utils/clipboard"
import canvasSize from "canvas-size"

const PNG_MIME_TYPE = "image/png"
const PNG_EXTENSION = ".png"

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

	private async readClipboardText(): Promise<string> {
		const clipboard = this.canvas.magicConfigManager.config?.methods?.clipboard
		const readText =
			clipboard?.readText ??
			(navigator.clipboard?.readText
				? navigator.clipboard.readText.bind(navigator.clipboard)
				: undefined)
		if (!readText) {
			return ""
		}
		try {
			return await readText()
		} catch {
			return ""
		}
	}

	private looksLikeClipboardFileNameOnlyText(text: string): boolean {
		const trimmed = text.trim()
		if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
			return false
		}
		return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|mp4|mov|webm|avi|mkv)$/i.test(trimmed)
	}

	private async showPasteShortcutHintIfNeeded(): Promise<boolean> {
		const clipboardText = await this.readClipboardText()
		if (!this.looksLikeClipboardFileNameOnlyText(clipboardText)) {
			return false
		}

		this.showUnreadableClipboardHint()
		return true
	}

	private showUnreadableClipboardHint(): void {
		toast(
			this.canvas.t?.("menu.pasteUseShortcutHint", "系统文件请使用 Ctrl/Cmd+V 粘贴") ||
				"系统文件请使用 Ctrl/Cmd+V 粘贴",
		)
	}

	/**
	 * 将多个元素复制为PNG图片
	 * @param elementIds - 元素ID列表
	 * @returns Promise<boolean> - 复制是否成功
	 */
	public async copyElementsAsPNG(elementIds: string[]): Promise<boolean> {
		try {
			const exportResult = await this.exportElementsAsPNG(elementIds)
			if (!exportResult) {
				return false
			}

			return await this.writePngToClipboard(
				exportResult.blob,
				exportResult.filename,
				exportResult.metadata,
			)
		} catch (error) {
			return false
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
		metadata?: ElementClipboardMetadata
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
						metadata: result.metadata,
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
	 * 创建包含元数据的 ClipboardItem
	 */
	private createClipboardItemWithMetadata(
		file: File,
		metadata: ElementClipboardMetadata,
	): ClipboardItem {
		const metadataJSON = JSON.stringify(metadata)
		const htmlWithMetadata = `<!-- CANVAS_METADATA:${metadataJSON} -->`

		return new ClipboardItem({
			[PNG_MIME_TYPE]: file,
			"text/html": new Blob([htmlWithMetadata], {
				type: "text/html",
			}),
		})
	}

	/**
	 * 获取剪贴板写入方法（优先使用注入的 clipboard，否则降级到 navigator.clipboard）
	 */
	private getClipboardWrite() {
		const clipboard = this.canvas.magicConfigManager.config?.methods?.clipboard
		if (clipboard) {
			return { writeText: clipboard.writeText, write: clipboard.write }
		}
		return {
			writeText: navigator.clipboard.writeText.bind(navigator.clipboard),
			write: navigator.clipboard.write.bind(navigator.clipboard),
		}
	}

	/**
	 * 获取剪贴板解析选项（用于 paste 时读取）
	 */
	private getParseClipboardOptions(): ParseClipboardOptions | undefined {
		const clipboard = this.canvas.magicConfigManager.config?.methods?.clipboard
		if (!clipboard?.read && !clipboard?.readText) return undefined
		return {
			read: clipboard.read,
			readText: clipboard.readText,
		}
	}

	/**
	 * 将 PNG Blob 写入剪贴板
	 */
	private async writePngToClipboard(
		blob: Blob,
		filename: string,
		metadata?: ElementClipboardMetadata,
	): Promise<boolean> {
		try {
			const file = new File([blob], filename, { type: PNG_MIME_TYPE })
			const clipboardItem = metadata
				? this.createClipboardItemWithMetadata(file, metadata)
				: new ClipboardItem({ [PNG_MIME_TYPE]: file })
			const { write } = this.getClipboardWrite()
			await write([clipboardItem])
			toast.success(this.canvas.t?.("menu.copySuccess", "复制成功") || "复制成功")
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
		metadata: ElementClipboardMetadata
	} | null> {
		try {
			// 获取 ImageElement 实例
			const elementInstance = this.canvas.elementManager.getElementInstance(
				element.id,
			) as ImageElementClass | null

			if (!elementInstance) {
				return null
			}

			// 获取资源并从 ossSrc fetch blob（利用浏览器 HTTP 缓存）
			let blob: Blob | null = null
			let imageInfo = null
			if (element.src) {
				const resource = await this.canvas.imageResourceManager.getResource(element.src)
				if (resource) {
					imageInfo = resource.imageInfo
					if (element.crop) {
						blob = await this.renderImageElementToBlob(element, elementInstance)
					} else {
						try {
							const response = await fetch(resource.ossSrc, { cache: "default" })
							if (response.ok) {
								blob = await response.blob()
							}
						} catch {
							// 忽略 fetch 错误
						}
					}
				}
			}

			if (!blob || !imageInfo) {
				return null
			}

			// 创建元数据
			const metadata: ElementClipboardMetadata = {
				data: element,
				filename: imageInfo.filename,
				mimeType: imageInfo.mimeType,
				fileSize: imageInfo.fileSize,
				renderMode: element.crop ? "cropped" : "original",
			}

			return { blob, metadata }
		} catch (error) {
			return null
		}
	}

	/**
	 * 渲染图片元素到 Blob
	 * @param element - 图片元素数据
	 * @param elementInstance - 图片元素实例
	 * @returns Blob 或 null（如果渲染失败）
	 */
	private async renderImageElementToBlob(
		element: ImageElement,
		elementInstance: ImageElementClass,
	): Promise<Blob | null> {
		const width = Math.max(1, Math.round(element.width ?? 0))
		const height = Math.max(1, Math.round(element.height ?? 0))
		const canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height

		const ctx = canvas.getContext("2d")
		if (!ctx) {
			return null
		}

		const rendered = await elementInstance.renderToCanvas(ctx, 0, 0, {
			width,
			height,
			shouldDrawBorder: false,
		})
		if (!rendered) {
			return null
		}

		return new Promise<Blob | null>((resolve) => {
			canvas.toBlob((blob) => {
				resolve(blob || null)
			}, PNG_MIME_TYPE)
		})
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

			// 创建 CanvasClipboardData 格式的数据
			const clipboardData: CanvasClipboardData = {
				elements,
				id: this.canvas.id,
			}

			// 序列化为 JSON 并写入剪贴板
			const jsonText = JSON.stringify(clipboardData)
			const { writeText } = this.getClipboardWrite()
			await writeText(jsonText)
			toast.success(this.canvas.t?.("menu.copySuccess", "复制成功") || "复制成功")
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
	 * 从剪贴板粘贴元素或图片文件
	 * @param clipboardEvent 可选的 ClipboardEvent，如果提供则优先从中获取文件
	 * @param position 可选的位置参数，如果提供则在该位置粘贴（元素中心对齐到该位置），否则在画布中心粘贴
	 */
	public async paste(
		clipboardEvent?: ClipboardEvent,
		position?: { x: number; y: number },
	): Promise<void> {
		try {
			// 解析剪贴板内容（传入注入的 read/readText 以支持 HTTP 兼容）
			const parseResult = await parseClipboardContent(
				clipboardEvent,
				this.getParseClipboardOptions(),
			)

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
				if (!clipboardEvent) {
					await this.showPasteShortcutHintIfNeeded()
				}
				return
			}

			// 检查跨画布粘贴：如果剪贴板数据和当前画布都有 id，则必须匹配
			if (
				parseResult.type === "elements" &&
				!this.canPasteFromClipboardCanvas(parseResult.canvasId)
			) {
				return
			}

			if (parseResult.type === "files") {
				await this.pasteFilesFromClipboard(
					parseResult.files,
					parseResult.metadata,
					position,
				)
				return
			}

			if (parseResult.type === "elements") {
				await this.pasteElementsFromClipboard(parseResult.elements, position)
			}
		} catch (error) {
			// 粘贴失败，静默处理
		}
	}

	/**
	 * 从剪贴板粘贴文件
	 */
	private async pasteFilesFromClipboard(
		files: File[],
		metadataList?: ElementClipboardMetadata[],
		position?: { x: number; y: number },
	): Promise<void> {
		if (metadataList && metadataList.length > 0) {
			await this.pasteImagesWithMetadata(files, metadataList, position)
			return
		}

		if (files.length === 1) {
			await this.pasteCanvasFile(files[0], position)
			return
		}

		const targetPosition = this.getTargetPosition(position)
		await this.pasteMultipleCanvasFiles(files, targetPosition)
	}

	/**
	 * 从剪贴板粘贴图片（带元数据）
	 */
	private async pasteImagesWithMetadata(
		files: File[],
		metadataList: ElementClipboardMetadata[],
		position?: { x: number; y: number },
	): Promise<void> {
		await withHistoryManagerAsync(this.canvas.historyManager, async () => {
			const createdElementIds: string[] = []
			const existingNames = getAllExistingNames(this.canvas.elementManager)
			const currentNames = new Set(existingNames)
			const targetPosition = this.getTargetPosition(position)

			for (let i = 0; i < files.length; i++) {
				const file = files[i]
				const metadata = metadataList[i]

				if (metadata && metadata.data.type === ElementTypeEnum.Image) {
					const elementId = await this.pasteImageFromMetadata(
						file,
						metadata,
						targetPosition,
						currentNames,
						i,
					)
					if (elementId) {
						createdElementIds.push(elementId)
					}
					continue
				}

				const elementId = await this.pasteCanvasFile(file, position, { skipFocus: true })
				if (elementId) {
					createdElementIds.push(elementId)
				}
			}

			// 在上传完成之前就聚焦到所有新创建的元素（此时元素可能处于 processing 状态）
			if (createdElementIds.length > 0) {
				this.focusOnElements(createdElementIds)
			}
		})
	}

	/**
	 * 从剪贴板粘贴图片（带元数据）
	 */
	private async pasteImageFromMetadata(
		file: File,
		metadata: ElementClipboardMetadata,
		targetPosition: { x: number; y: number },
		currentNames: Set<string>,
		index: number,
	): Promise<string | null> {
		const imageElementData = metadata.data as ImageElement
		const elementWithNewIds = regenerateIdsWithUniqueNames(
			imageElementData,
			currentNames,
		) as ImageElement
		const { offsetX, offsetY } = this.getElementCenterOffset(imageElementData, targetPosition)
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()

		// 判断是否可以复用原始资源（避免重复上传）
		// 条件：1. 元素在当前画布中存在  2. 有 src  3. MIME 类型一致  4. 文件名一致
		const originalElementExists = this.canvas.elementManager.getElementData(imageElementData.id)
		const canReuseOriginal =
			originalElementExists &&
			imageElementData.src &&
			(metadata.renderMode === "cropped" ||
				(metadata.mimeType === file.type && metadata.filename === file.name))
		const nextCrop =
			metadata.renderMode === "cropped" && !canReuseOriginal
				? undefined
				: imageElementData.crop

		const commonFinalElement = {
			id: elementWithNewIds.id,
			name: elementWithNewIds.name,
			x: (imageElementData.x ?? 0) + offsetX,
			y: (imageElementData.y ?? 0) + offsetY,
			width: imageElementData.width,
			height: imageElementData.height,
			zIndex: maxZIndex + 1 + index,
			visible: imageElementData.visible,
			locked: imageElementData.locked,
			opacity: imageElementData.opacity,
			scaleX: imageElementData.scaleX,
			scaleY: imageElementData.scaleY,
			crop: nextCrop,
		}

		if (canReuseOriginal) {
			const finalElement: ImageElement = {
				type: ElementTypeEnum.Image,
				src: imageElementData.src,
				status: GenerationStatus.Completed,
				...commonFinalElement,
			}

			this.canvas.elementManager.create(finalElement)
			return finalElement.id
		}

		// 使用画布文件上传管理器上传
		const position = {
			x: (imageElementData.x ?? 0) + offsetX + (imageElementData.width ?? 0) / 2,
			y: (imageElementData.y ?? 0) + offsetY + (imageElementData.height ?? 0) / 2,
		}

		return await this.canvas.canvasFileUploadManager.uploadImageElement({
			file,
			position,
			elementData: commonFinalElement,
			manageHistory: false, // 在批量操作中，由外层的 withHistoryManagerAsync 管理历史记录
		})
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

						const elementId =
							await this.canvas.canvasFileUploadManager.uploadFileElement({
								file,
								position,
								manageHistory: false,
							})
						if (elementId) {
							createdElementIds.push(elementId)
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
		if (this.canvas.readonly) {
			return null
		}

		const validation = validateFile(file)
		if (!validation.valid) {
			return null
		}

		const targetPosition = this.getTargetPosition(position)
		const elementIds = await this.pasteMultipleCanvasFiles([file], targetPosition, options)

		return elementIds.length > 0 ? elementIds[0] : null
	}

	/**
	 * 从剪贴板粘贴元素
	 */
	private async pasteElementsFromClipboard(
		elements: LayerElement[],
		position?: { x: number; y: number },
	): Promise<void> {
		const existingNames = getAllExistingNames(this.canvas.elementManager)

		await withHistoryManagerAsync(this.canvas.historyManager, async () => {
			if (elements.length === 1) {
				this.pasteSingleElementFromClipboard(elements[0], position, existingNames)
				return
			}

			this.pasteMultipleElementsFromClipboard(elements, position, existingNames)
		})
	}

	/**
	 * 从剪贴板粘贴单个元素
	 */
	private pasteSingleElementFromClipboard(
		elementData: LayerElement,
		position: { x: number; y: number } | undefined,
		existingNames: Set<string>,
	): void {
		const currentNames = new Set(existingNames)
		const elementWithNewIds = regenerateIdsWithUniqueNames(elementData, currentNames)
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		const targetPosition = this.getTargetPosition(position)
		const { offsetX, offsetY } = this.getElementCenterOffset(elementData, targetPosition)

		const finalElement = {
			...elementWithNewIds,
			x: (elementData.x ?? 0) + offsetX,
			y: (elementData.y ?? 0) + offsetY,
			zIndex: maxZIndex + 1,
		}

		this.canvas.elementManager.create(finalElement)
		this.canvas.selectionManager.select(finalElement.id)
		this.focusOnElements([finalElement.id])
	}

	/**
	 * 从剪贴板粘贴多个元素
	 */
	private pasteMultipleElementsFromClipboard(
		elements: LayerElement[],
		position: { x: number; y: number } | undefined,
		existingNames: Set<string>,
	): void {
		const sortedElements = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		let nextZIndex = maxZIndex + 1
		const targetPosition = this.getTargetPosition(position)
		const { offsetX, offsetY } = this.getElementsCenterOffset(sortedElements, targetPosition)

		const newElementIds: string[] = []
		const currentNames = new Set(existingNames)
		for (const element of sortedElements) {
			const elementWithNewIds = regenerateIdsWithUniqueNames(element, currentNames)
			const finalElement = {
				...elementWithNewIds,
				x: (element.x ?? 0) + offsetX,
				y: (element.y ?? 0) + offsetY,
				zIndex: nextZIndex++,
			}

			this.canvas.elementManager.create(finalElement)
			newElementIds.push(finalElement.id)
		}

		if (newElementIds.length > 0) {
			this.canvas.selectionManager.selectMultiple(newElementIds)
			this.focusOnElements(newElementIds)
		}
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
