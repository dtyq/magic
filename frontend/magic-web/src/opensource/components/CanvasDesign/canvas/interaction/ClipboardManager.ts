import type { Canvas } from "../Canvas"
import type { LayerElement, ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import { toast } from "sonner"
import {
	getImageDimensions,
	calculateHorizontalImageLayout,
	calculateElementsRect,
	calculateNodesRect,
	type ElementClipboardMetadata,
	type CanvasClipboardData,
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

	/**
	 * 将多个元素复制为PNG图片
	 * @param elementIds - 元素ID列表
	 * @returns Promise<boolean> - 复制是否成功
	 */
	public async copyElementsAsPNG(elementIds: string[]): Promise<boolean> {
		if (elementIds.length === 0) {
			return false
		}

		try {
			// 1. 过滤冗余元素（如果父元素已选中，则子元素无需单独处理）
			const filteredIds = filterRedundantElements(elementIds, this.canvas.elementManager)

			if (filteredIds.length === 0) {
				return false
			}

			// 2. 获取所有元素实例和节点
			const adapter = this.canvas.elementManager.getNodeAdapter()
			const nodes = adapter.getNodesForTransform(filteredIds)

			if (nodes.length === 0) {
				return false
			}

			// 3. 使用 calculateNodesRect 计算总体边界
			const boundingRect = calculateNodesRect(
				nodes,
				this.canvas.stage,
				this.canvas.elementManager,
			)

			if (!boundingRect || boundingRect.width <= 0 || boundingRect.height <= 0) {
				return false
			}

			// 4. 创建Canvas，设置宽高
			const canvas = document.createElement("canvas")
			const ctx = canvas.getContext("2d")

			if (!ctx) {
				return false
			}

			// 获取Canvas最大支持尺寸
			const { width: canvasMaxWidth, height: canvasMaxHeight } = await canvasSize.maxArea({
				usePromise: true,
				useWorker: true,
			})

			// 计算原始Canvas尺寸
			const originalWidth = Math.ceil(boundingRect.width)
			const originalHeight = Math.ceil(boundingRect.height)

			// 检查是否需要按比例压缩
			let canvasWidth = originalWidth
			let canvasHeight = originalHeight
			let scaleRatio = 1

			if (originalWidth > canvasMaxWidth || originalHeight > canvasMaxHeight) {
				// 计算缩放比例，取宽度和高度的缩放比例中的较小值，确保两个方向都不超过最大值
				const widthRatio = canvasMaxWidth / originalWidth
				const heightRatio = canvasMaxHeight / originalHeight
				scaleRatio = Math.min(widthRatio, heightRatio)

				canvasWidth = Math.ceil(originalWidth * scaleRatio)
				canvasHeight = Math.ceil(originalHeight * scaleRatio)
			}

			canvas.width = canvasWidth
			canvas.height = canvasHeight

			// 5. 判断是否需要绘制边框
			// 只有当单选图片元素时，才不绘制边框；其他情况（多个元素，或单个非图片元素）都绘制边框
			const firstElementData =
				filteredIds.length === 1
					? this.canvas.elementManager.getElementData(filteredIds[0])
					: null
			const shouldDrawBorder =
				filteredIds.length !== 1 || firstElementData?.type !== ElementTypeEnum.Image

			// 6. 如果是单个图片元素且不需要边框，直接复用 getImageBlobAndMetadata
			if (
				!shouldDrawBorder &&
				filteredIds.length === 1 &&
				firstElementData?.type === ElementTypeEnum.Image
			) {
				const result = await this.getImageBlobAndMetadata(firstElementData)
				if (result) {
					const pngBlob = await this.convertToPngBlob(result.blob)
					if (pngBlob) {
						const filename = this.getPngFilename(result.metadata.filename)
						const success = await this.writePngToClipboard(
							pngBlob,
							filename,
							result.metadata,
						)
						if (success) {
							return true
						}
					}
				}
				// 如果 getImageBlobAndMetadata 失败，降级到原来的逻辑
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

				// 计算元素在导出Canvas中的位置
				const elementRect = calculateNodesRect(
					[node],
					this.canvas.stage,
					this.canvas.elementManager,
				)

				if (!elementRect) continue

				// 计算相对于boundingRect的偏移量（考虑缩放比例）
				const offsetX = (elementRect.x - boundingRect.x) * scaleRatio
				const offsetY = (elementRect.y - boundingRect.y) * scaleRatio

				// 计算元素的缩放后尺寸
				const elementWidth = elementRect.width * scaleRatio
				const elementHeight = elementRect.height * scaleRatio

				elementsToRender.push({
					elementInstance,
					offsetX,
					offsetY,
					elementWidth,
					elementHeight,
					zIndex: element.zIndex ?? 0,
				})
			}

			// 按 zIndex 排序（zIndex 小的先渲染，zIndex 大的后渲染，确保上层元素覆盖下层元素）
			elementsToRender.sort((a, b) => a.zIndex - b.zIndex)

			// 8. 串行执行 renderToCanvas（避免 Canvas 上下文状态冲突）并检查结果
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
				return false
			}

			// 9. 使用 canvas.toBlob 转换为PNG
			return new Promise<boolean>((resolve) => {
				canvas.toBlob(async (blob) => {
					if (!blob) {
						resolve(false)
						return
					}
					const success = await this.writePngToClipboard(blob, `canvas${PNG_EXTENSION}`)
					resolve(success)
				}, PNG_MIME_TYPE)
			})
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

			// 调用 getHTMLImageElement 获取图片对象
			const htmlImage = await elementInstance.getHTMLImageElement()
			if (!htmlImage) {
				return null
			}

			// 获取资源并从 ossSrc fetch blob（利用浏览器 HTTP 缓存）
			let blob: Blob | null = null
			let imageInfo = null
			if (element.src) {
				const resource = await this.canvas.imageResourceManager.getResource(element.src)
				if (resource) {
					imageInfo = resource.imageInfo
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

			if (!blob || !imageInfo) {
				return null
			}

			// 创建元数据
			const metadata: ElementClipboardMetadata = {
				data: element,
				filename: imageInfo.filename,
				mimeType: imageInfo.mimeType,
				fileSize: imageInfo.fileSize,
			}

			return { blob, metadata }
		} catch (error) {
			return null
		}
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
				return
			}

			// 检查跨画布粘贴：如果剪贴板数据和当前画布都有 id，则必须匹配
			if (
				parseResult.type === "elements" &&
				!this.canPasteFromClipboardCanvas(parseResult.canvasId)
			) {
				return
			}

			if (parseResult.type === "images") {
				await this.pasteImagesFromClipboard(
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
	 * 从剪贴板粘贴图片
	 */
	private async pasteImagesFromClipboard(
		files: File[],
		metadataList?: ElementClipboardMetadata[],
		position?: { x: number; y: number },
	): Promise<void> {
		if (metadataList && metadataList.length > 0) {
			await this.pasteImagesWithMetadata(files, metadataList, position)
			return
		}

		if (files.length === 1) {
			// pasteImageFile 内部会调用 pasteMultipleImageFiles，后者已经处理了 focusOnElements
			await this.pasteImageFile(files[0], position)
			return
		}

		const targetPosition = this.getTargetPosition(position)
		await this.pasteMultipleImageFiles(files, targetPosition)
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

				// 传递 skipFocus: true，避免重复聚焦，统一在最后聚焦所有元素
				const elementId = await this.pasteImageFile(file, position, { skipFocus: true })
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
			metadata.mimeType === file.type &&
			metadata.filename === file.name

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
		}

		if (canReuseOriginal) {
			const finalElement: ImageElement = {
				type: ElementTypeEnum.Image,
				src: imageElementData.src,
				status: "completed",
				...commonFinalElement,
			}

			this.canvas.elementManager.create(finalElement)
			return finalElement.id
		}

		// 使用 ImageUploadManager 上传
		const position = {
			x: (imageElementData.x ?? 0) + offsetX + (imageElementData.width ?? 0) / 2,
			y: (imageElementData.y ?? 0) + offsetY + (imageElementData.height ?? 0) / 2,
		}

		return await this.canvas.imageUploadManager.uploadImage({
			file,
			position,
			elementData: commonFinalElement,
			manageHistory: false, // 在批量操作中，由外层的 withHistoryManagerAsync 管理历史记录
		})
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
		// 禁用历史记录
		this.canvas.historyManager.disable()

		try {
			// 使用全局上传管理器的锁机制，合并批量上传
			const createdElementIds = await this.canvas.imageUploadManager.withLock(async () => {
				// 先获取所有图片的尺寸
				const imageDimensions = await Promise.all(
					files.map((file) => getImageDimensions(file)),
				)

				// 计算布局：使用水平排列，顶部对齐，无间距
				const positions = calculateHorizontalImageLayout(imageDimensions, anchorPosition, 0)

				// 逐个上传图片，收集创建的 elementId
				const createdElementIds: string[] = []
				for (let i = 0; i < files.length; i++) {
					const file = files[i]
					const position = positions[i]

					// 直接调用 uploadImage，传递 manageHistory: false 让外层手动管理历史记录
					const elementId = await this.canvas.imageUploadManager.uploadImage({
						file,
						position,
						manageHistory: false, // 由外层手动管理历史记录
					})
					if (elementId) {
						createdElementIds.push(elementId)
					}
				}

				// 在 withLock 内部，所有临时元素创建完成后立即记录历史
				// 这样可以确保在用户撤销之前就已经记录了包含临时元素的状态
				this.canvas.historyManager.enable()
				this.canvas.historyManager.recordHistoryImmediate()

				// 在上传完成之前就聚焦到所有新创建的元素（此时元素处于 processing 状态）
				if (createdElementIds.length > 0 && !options?.skipFocus) {
					this.focusOnElements(createdElementIds)
				}

				return createdElementIds
			})

			return createdElementIds
		} catch (error) {
			// 确保异常情况下也能重新启用历史记录
			this.canvas.historyManager.enable()
			throw error
		}
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
		// 检查只读模式
		if (this.canvas.readonly) {
			return null
		}

		// 验证文件类型和大小
		const validation = validateFile(file)
		if (!validation.valid) {
			return null
		}

		const targetPosition = this.getTargetPosition(position)

		// 统一使用 pasteMultipleImageFiles 处理，保持行为一致
		const elementIds = await this.pasteMultipleImageFiles([file], targetPosition, options)

		return elementIds.length > 0 ? elementIds[0] : null
	}
}
