import type { Canvas } from "../Canvas"
import type { TFunction } from "../../context/I18nContext"
import { getImageSourceDimensions } from "../utils/imageSourceUtils"
import {
	areAllFilesImages,
	isAllowedFileType,
	validateFile,
	generateElementId,
	generateUniqueElementName,
	calculateHorizontalImageLayout,
	validateImageFilePath,
} from "../utils/utils"
import { getAllExistingNames } from "../utils/elementUtils"
import type { ImageElement } from "../types"
import { ElementTypeEnum } from "../types"

/**
 * 拖拽类型
 */
type DragType = "Files" | "text/plain"

/**
 * DropOverlayManager
 * 负责管理拖拽文件到画布时的遮罩层显示
 */
export class DropOverlayManager {
	private canvas: Canvas
	private overlayElement?: HTMLDivElement
	private dragCounter: number = 0 // 用于跟踪 dragenter/dragleave 的嵌套
	private t?: TFunction

	// 拖放事件处理函数引用（用于移除事件监听）
	private handleDragEnterBound: ((e: DragEvent) => void) | null = null
	private handleDragLeaveBound: ((e: DragEvent) => void) | null = null
	private handleDragOverBound: ((e: DragEvent) => void) | null = null
	private handleDropBound: ((e: DragEvent) => Promise<void>) | null = null

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.t = this.canvas.t

		this.setupDragAndDropHandlers()
	}

	/**
	 * 获取翻译文本
	 */
	private getText(key: string, fallback: string): string {
		if (this.t) {
			return this.t(key, fallback)
		}
		return fallback
	}

	/**
	 * 检测拖拽类型
	 * @param dataTransfer DataTransfer 对象
	 * @returns 拖拽类型，如果无法检测则返回 undefined
	 */
	private detectDragType(dataTransfer?: DataTransfer | null): DragType | undefined {
		if (!dataTransfer) {
			return undefined
		}

		const hasFiles = dataTransfer.types.includes("Files")
		const hasCustomDragData = dataTransfer.types.includes("text/plain")

		if (hasFiles) {
			return "Files"
		}
		if (hasCustomDragData) {
			return "text/plain"
		}

		return undefined
	}

	/**
	 * 检测文件类型（是否为图片）
	 * @param dataTransfer DataTransfer 对象
	 * @returns 是否为图片类型
	 */
	private isImageType(dataTransfer: DataTransfer): boolean {
		// 尝试从 items 中检测文件类型
		const items = dataTransfer.items
		if (items && items.length > 0) {
			const fileTypes: string[] = []
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (item.kind === "file" && item.type) {
					fileTypes.push(item.type)
				}
			}

			if (fileTypes.length > 0) {
				return fileTypes.every((type) => type.startsWith("image/"))
			}
		}

		// 如果无法从 items 检测，尝试从 files 检测
		const files = dataTransfer.files
		if (files && files.length > 0) {
			return areAllFilesImages(files)
		}

		return false
	}

	/**
	 * 检测文件类型（是否为允许的类型）
	 * @param dataTransfer DataTransfer 对象
	 * @returns 是否为允许的文件类型
	 */
	private isAllowedType(dataTransfer: DataTransfer): boolean {
		// 尝试从 items 中检测文件类型
		const items = dataTransfer.items
		if (items && items.length > 0) {
			const fileTypes: string[] = []
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (item.kind === "file" && item.type) {
					fileTypes.push(item.type)
				}
			}

			if (fileTypes.length > 0) {
				return fileTypes.every((type) => isAllowedFileType({ type } as File))
			}
		}

		// 如果无法从 items 检测，尝试从 files 检测
		const files = dataTransfer.files
		if (files && files.length > 0) {
			const fileArray = Array.from(files)
			return fileArray.every((file) => isAllowedFileType(file))
		}

		return false
	}

	/**
	 * 根据拖拽类型和文件类型生成提示文字
	 * @param dataTransfer DataTransfer 对象
	 * @param dragType 拖拽类型
	 * @returns 提示文字
	 */
	private getDropText(dataTransfer?: DataTransfer | null, dragType?: DragType): string {
		// 如果是自定义拖拽数据（从文件列表或Tab拖拽），显示"松开以添加至画布"
		if (dragType === "text/plain") {
			return this.getText("dropOverlay.releaseToAddToCanvas", "松开以添加至画布")
		}

		// 如果是文件系统文件，按照原有逻辑显示
		if (!dataTransfer) {
			return this.getText("dropOverlay.releaseToUpload", "松开以上传文件")
		}

		// 检测是否为图片类型
		if (this.isImageType(dataTransfer)) {
			return this.getText("dropOverlay.releaseToUploadImage", "松开以上传图片")
		}

		// 检测是否为允许的文件类型
		if (this.isAllowedType(dataTransfer)) {
			return this.getText("dropOverlay.releaseToUpload", "松开以上传文件")
		}

		return this.getText("dropOverlay.releaseToUpload", "松开以上传文件")
	}

	/**
	 * 处理拖拽进入事件
	 * @param e 拖拽事件
	 */
	private handleDragEnter(e: DragEvent): void {
		e.preventDefault()
		e.stopPropagation()

		// 检查只读模式
		if (this.canvas.readonly) {
			return
		}

		// 检测拖拽类型
		const dragType = this.detectDragType(e.dataTransfer)
		if (!dragType) {
			return
		}

		this.dragCounter++

		// 只在第一次进入时显示遮罩
		if (this.dragCounter === 1) {
			this.showOverlay(e.dataTransfer, dragType)
		}
	}

	/**
	 * 处理拖拽离开事件
	 * @param e 拖拽事件
	 */
	private handleDragLeave(e: DragEvent): void {
		e.preventDefault()
		e.stopPropagation()

		this.dragCounter--

		// 当完全离开容器时隐藏遮罩
		if (this.dragCounter === 0) {
			this.hideOverlay()
		}
	}

	/**
	 * 处理拖拽悬停事件
	 * @param e 拖拽事件
	 */
	private handleDragOver(e: DragEvent): void {
		e.preventDefault()
		e.stopPropagation()

		if (e.dataTransfer) {
			// 根据 effectAllowed 设置匹配的 dropEffect
			// 优先级：all/move > copy > link > copy（默认）
			const effectAllowed = e.dataTransfer.effectAllowed
			let dropEffect: "copy" | "move" | "link" | "none" = "copy"

			if (["all", "move", "linkMove"].includes(effectAllowed)) {
				dropEffect = "move"
			} else if (["copy", "copyMove", "copyLink"].includes(effectAllowed)) {
				dropEffect = "copy"
			} else if (effectAllowed === "link") {
				dropEffect = "link"
			}

			e.dataTransfer.dropEffect = dropEffect
		}

		// 更新提示文字（如果遮罩已显示）
		if (this.overlayElement && this.dragCounter > 0) {
			const dragType = this.detectDragType(e.dataTransfer)
			this.updateOverlayText(e.dataTransfer, dragType)
		}
	}

	/**
	 * 处理拖拽放下事件
	 * @param e 拖拽事件
	 */
	private async handleDrop(e: DragEvent): Promise<void> {
		e.preventDefault()
		e.stopPropagation()

		// 重置计数器
		this.dragCounter = 0

		// 检查只读模式
		if (this.canvas.readonly) {
			this.hideOverlay()
			return
		}

		// 计算画布坐标
		const canvasPos = this.getCanvasPositionFromEvent(e)
		if (!canvasPos) {
			this.hideOverlay()
			return
		}

		// 检查是否有自定义拖拽数据（从文件列表或Tab拖拽）
		const getDataTransferFileInfo =
			this.canvas.magicConfigManager.config?.methods?.getDataTransferFileInfo
		if (getDataTransferFileInfo && e.dataTransfer) {
			const filePaths = await getDataTransferFileInfo(e.dataTransfer)
			// 使用 validateImageFilePath 过滤有效的图片文件路径
			const validFilePaths = filePaths.filter(
				(filePath) => validateImageFilePath(filePath).valid,
			)
			if (validFilePaths.length > 0) {
				// 显示加载状态遮罩层
				this.showLoadingOverlay()
				try {
					await this.handleCustomDragData(validFilePaths, canvasPos)
				} finally {
					// 加载完成后隐藏遮罩层
					this.hideOverlay()
				}
				return
			}
		}

		// 处理文件系统文件拖拽
		this.hideOverlay()
		await this.handleFileSystemDrop(e.dataTransfer, canvasPos)
	}

	/**
	 * 设置拖放事件处理
	 */
	private setupDragAndDropHandlers(): void {
		const container = this.canvas.container

		// 绑定事件处理函数
		this.handleDragEnterBound = this.handleDragEnter.bind(this)
		this.handleDragLeaveBound = this.handleDragLeave.bind(this)
		this.handleDragOverBound = this.handleDragOver.bind(this)
		this.handleDropBound = this.handleDrop.bind(this)

		// 添加事件监听
		container.addEventListener("dragenter", this.handleDragEnterBound)
		container.addEventListener("dragleave", this.handleDragLeaveBound)
		container.addEventListener("dragover", this.handleDragOverBound)
		container.addEventListener("drop", this.handleDropBound)
	}

	/**
	 * 计算画布区域的中心点坐标
	 * @returns 中心点坐标
	 */
	private getCanvasAreaCenter(): { x: number; y: number } {
		const container = this.canvas.container
		const viewportOffset = this.canvas.viewportController.getDefaultViewportOffset()

		const leftOffset = viewportOffset?.left || 0
		const rightOffset = viewportOffset?.right || 0
		const topOffset = viewportOffset?.top || 0
		const bottomOffset = viewportOffset?.bottom || 0

		const containerWidth = container.offsetWidth
		const containerHeight = container.offsetHeight

		const canvasAreaLeft = leftOffset
		const canvasAreaRight = containerWidth - rightOffset
		const canvasAreaTop = topOffset
		const canvasAreaBottom = containerHeight - bottomOffset

		return {
			x: canvasAreaLeft + (canvasAreaRight - canvasAreaLeft) / 2,
			y: canvasAreaTop + (canvasAreaBottom - canvasAreaTop) / 2,
		}
	}

	/**
	 * 创建遮罩层 DOM 元素
	 * @param text 提示文字
	 * @param centerX 中心点 X 坐标
	 * @param centerY 中心点 Y 坐标
	 * @returns 遮罩层 DOM 元素
	 */
	private createOverlayElement(text: string, centerX: number, centerY: number): HTMLDivElement {
		const overlayElement = document.createElement("div")
		overlayElement.style.position = "absolute"
		overlayElement.style.top = "0"
		overlayElement.style.left = "0"
		overlayElement.style.width = "100%"
		overlayElement.style.height = "100%"
		overlayElement.style.backgroundColor = "rgba(255, 255, 255, 0.6)"
		overlayElement.style.zIndex = "9999"

		const textElement = document.createElement("div")
		textElement.textContent = text
		textElement.style.position = "absolute"
		textElement.style.left = `${centerX}px`
		textElement.style.top = `${centerY}px`
		textElement.style.transform = "translate(-50%, -50%)"
		textElement.style.fontSize = "14px"
		textElement.style.fontFamily = "Arial, sans-serif"
		textElement.style.color = "#0A0A0A"
		textElement.style.textAlign = "center"
		textElement.style.pointerEvents = "none"
		textElement.style.whiteSpace = "nowrap"
		textElement.style.fontWeight = "bold"
		textElement.setAttribute("data-drop-text", "")

		overlayElement.appendChild(textElement)
		return overlayElement
	}

	/**
	 * 显示拖放遮罩层
	 * @param dataTransfer DataTransfer 对象，用于检测文件类型
	 * @param dragType 拖拽类型
	 */
	private showOverlay(dataTransfer?: DataTransfer | null, dragType?: DragType): void {
		// 如果已存在遮罩，先移除
		if (this.overlayElement) {
			this.overlayElement.remove()
			this.overlayElement = undefined
		}

		const container = this.canvas.container
		const center = this.getCanvasAreaCenter()
		const text = this.getDropText(dataTransfer, dragType)

		// 创建遮罩层
		this.overlayElement = this.createOverlayElement(text, center.x, center.y)

		// 确保 container 有相对定位
		const containerPosition = window.getComputedStyle(container).position
		if (containerPosition === "static") {
			container.style.position = "relative"
		}

		// 插入到 container
		container.appendChild(this.overlayElement)
	}

	/**
	 * 更新遮罩层的提示文字
	 * @param dataTransfer DataTransfer 对象，用于检测文件类型
	 * @param dragType 拖拽类型
	 */
	private updateOverlayText(dataTransfer?: DataTransfer | null, dragType?: DragType): void {
		if (!this.overlayElement) {
			return
		}

		const textElement = this.overlayElement.querySelector("[data-drop-text]") as HTMLElement
		if (textElement) {
			textElement.textContent = this.getDropText(dataTransfer, dragType)
		}
	}

	/**
	 * 显示加载状态遮罩层
	 */
	private showLoadingOverlay(): void {
		// 如果遮罩层不存在，先创建它
		if (!this.overlayElement) {
			const container = this.canvas.container
			const center = this.getCanvasAreaCenter()
			this.overlayElement = this.createOverlayElement("", center.x, center.y)

			// 确保 container 有相对定位
			const containerPosition = window.getComputedStyle(container).position
			if (containerPosition === "static") {
				container.style.position = "relative"
			}

			// 插入到 container
			container.appendChild(this.overlayElement)
		}

		// 更新文本为"加载中"
		const textElement = this.overlayElement.querySelector("[data-drop-text]") as HTMLElement
		if (textElement) {
			textElement.textContent = this.getText("dropOverlay.loading", "加载中")
		}
	}

	/**
	 * 隐藏拖放遮罩层
	 */
	private hideOverlay(): void {
		if (this.overlayElement) {
			this.overlayElement.remove()
			this.overlayElement = undefined
		}
	}

	/**
	 * 从拖拽事件获取画布坐标
	 * @param e 拖拽事件
	 * @returns 画布坐标，如果无法计算则返回 null
	 */
	private getCanvasPositionFromEvent(e: DragEvent): { x: number; y: number } | null {
		const stage = this.canvas.stage
		const container = stage.container()

		if (!container) {
			return null
		}

		// 获取 container 相对于页面的位置
		const containerRect = container.getBoundingClientRect()

		// 计算 drop 事件位置相对于 container 的坐标
		const relativeX = e.clientX - containerRect.left
		const relativeY = e.clientY - containerRect.top

		// 转换为画布坐标（考虑viewport的缩放和偏移）
		const transform = stage.getAbsoluteTransform().copy()
		transform.invert()
		return transform.point({ x: relativeX, y: relativeY })
	}

	/**
	 * 处理文件系统文件拖拽
	 * @param dataTransfer DataTransfer 对象
	 * @param canvasPos 画布坐标
	 */
	private async handleFileSystemDrop(
		dataTransfer: DataTransfer | null,
		canvasPos: { x: number; y: number },
	): Promise<void> {
		if (!dataTransfer?.files || dataTransfer.files.length === 0) {
			return
		}

		const files = Array.from(dataTransfer.files)

		// 验证所有文件
		const invalidFiles: { file: File; error: string }[] = []
		const validFiles: File[] = []

		for (const file of files) {
			const validation = validateFile(file)
			if (validation.valid) {
				validFiles.push(file)
			} else {
				invalidFiles.push({ file, error: validation.error || "未知错误" })
			}
		}

		// 如果有无效文件，输出错误信息（暂时只处理有效文件）
		if (invalidFiles.length > 0) {
			console.warn("[DropOverlayManager] 部分文件不符合要求:", invalidFiles)
		}

		// 如果没有有效文件，直接返回
		if (validFiles.length === 0) {
			return
		}

		// 处理所有有效文件
		// 目前只支持图片文件，多个文件时根据宽度并排
		const imageFiles = validFiles.filter((file) => file.type.startsWith("image/"))
		if (imageFiles.length === 0) {
			return
		}

		// 使用统一的多个图片粘贴方法
		// 第一个图片的中心在 drop 位置，其他图片水平排列，无间隙
		await this.canvas.clipboardManager.pasteMultipleImageFiles(imageFiles, canvasPos)
	}

	/**
	 * 从 URL 获取图片尺寸
	 * 使用 ImageResourceManager 加载图片，避免重复下载
	 * @param path 图片路径（path）
	 * @returns Promise<{width: number, height: number}> 图片的宽度和高度
	 */
	private async getImageDimensionsFromUrl(
		path: string,
	): Promise<{ width: number; height: number }> {
		// 使用 ImageResourceManager 加载图片，会自动缓存
		const resource = await this.canvas.imageResourceManager.getResource(path)

		if (!resource?.image) {
			throw new Error("Failed to load image")
		}

		return getImageSourceDimensions(resource.image)
	}

	/**
	 * 获取文件信息列表
	 * @param filePaths 文件路径数组
	 * @returns 有效的文件信息列表
	 */
	private async getFileInfos(filePaths: string[]): Promise<
		Array<{
			filePath: string
			fileInfo: { src: string; fileName: string; expires_at?: string }
		}>
	> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo || filePaths.length === 0) {
			return []
		}

		// 获取所有文件信息
		const fileInfos = await Promise.all(
			filePaths.map(async (filePath) => {
				try {
					const fileInfo = await getFileInfo(filePath)
					return { filePath, fileInfo }
				} catch (error) {
					console.warn(`[DropOverlayManager] 获取文件信息失败: ${filePath}`, error)
					return null
				}
			}),
		)

		// 过滤掉失败的文件
		return fileInfos.filter(
			(
				item,
			): item is {
				filePath: string
				fileInfo: { src: string; fileName: string; expires_at?: string }
			} => item !== null && item.fileInfo?.src !== undefined,
		)
	}

	/**
	 * 获取图片尺寸列表
	 * @param fileInfos 文件信息列表
	 * @returns 图片尺寸列表和对应的临时元素 ID
	 */
	private async getImageDimensions(
		fileInfos: Array<{ filePath: string; fileInfo: { src: string } }>,
	): Promise<Array<{ width: number; height: number; tempElementId: string }>> {
		return Promise.all(
			fileInfos.map(async ({ filePath }) => {
				// 为每个图片生成临时元素 ID，用于资源管理
				const tempElementId = generateElementId()
				try {
					const dimensions = await this.getImageDimensionsFromUrl(filePath)
					return { ...dimensions, tempElementId }
				} catch (error) {
					console.warn(`[DropOverlayManager] 获取图片尺寸失败: ${filePath}`, error)
					// 返回默认尺寸
					return { width: 1024, height: 1024, tempElementId }
				}
			}),
		)
	}

	/**
	 * 创建图片元素
	 * @param filePath 文件路径
	 * @param fileInfo 文件信息
	 * @param dimensions 图片尺寸
	 * @param position 位置
	 * @param zIndex z-index
	 * @param existingNames 已存在的名称集合
	 * @returns 创建的元素 ID
	 */
	private createImageElement(
		filePath: string,
		fileInfo: { fileName: string },
		dimensions: { width: number; height: number },
		position: { x: number; y: number },
		zIndex: number,
		existingNames: Set<string>,
	): string {
		// 从文件路径提取文件名（去掉扩展名）
		const fileName = fileInfo.fileName || filePath.split("/").pop() || "image"
		const baseName = fileName.replace(/\.[^/.]+$/, "")
		const uniqueName = generateUniqueElementName(baseName, existingNames)
		existingNames.add(uniqueName)

		// 计算元素位置（图片中心对齐到 position）
		const targetX = position.x - dimensions.width / 2
		const targetY = position.y - dimensions.height / 2

		// 创建图片元素数据
		const elementId = generateElementId()
		const imageElement: ImageElement = {
			type: ElementTypeEnum.Image,
			id: elementId,
			x: targetX,
			y: targetY,
			width: dimensions.width,
			height: dimensions.height,
			src: filePath, // 使用文件路径作为 src，ImageElement 会自动通过轮询换取 ossSrc
			name: uniqueName,
			zIndex,
		}

		// 创建元素
		this.canvas.elementManager.create(imageElement)
		return elementId
	}

	/**
	 * 处理自定义拖拽数据（从文件列表或Tab拖拽）
	 * @param filePaths 文件路径数组
	 * @param anchorPosition 锚点位置（第一个图片的中心位置）
	 */
	private async handleCustomDragData(
		filePaths: string[],
		anchorPosition: { x: number; y: number },
	): Promise<void> {
		// 禁用历史记录
		this.canvas.historyManager.disable()

		try {
			// 获取所有文件信息
			const validFileInfos = await this.getFileInfos(filePaths)
			if (validFileInfos.length === 0) {
				return
			}

			// 获取所有图片的尺寸（会通过 ImageResourceManager 预加载图片）
			const imageDimensionsWithIds = await this.getImageDimensions(validFileInfos)

			// 提取尺寸信息用于布局计算
			const imageDimensions = imageDimensionsWithIds.map(({ width, height }) => ({
				width,
				height,
			}))

			// 计算布局：使用水平排列，顶部对齐，无间距
			const positions = calculateHorizontalImageLayout(imageDimensions, anchorPosition, 0)

			// 生成唯一的名称
			const existingNames = getAllExistingNames(this.canvas.elementManager)
			const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()

			// 创建图片元素
			const createdElementIds: string[] = []
			for (let i = 0; i < validFileInfos.length; i++) {
				const { filePath, fileInfo } = validFileInfos[i]
				const { width, height } = imageDimensionsWithIds[i]
				const position = positions[i]
				const zIndex = maxZIndex + 1 + i

				// 预填充缓存（含 expires_at，避免 loadImage 时重复换取）
				this.canvas.imageResourceManager.primeCache(filePath, {
					src: fileInfo.src,
					expires_at: fileInfo.expires_at,
				})

				const elementId = this.createImageElement(
					filePath,
					fileInfo,
					{ width, height },
					position,
					zIndex,
					existingNames,
				)
				createdElementIds.push(elementId)

				// 确保资源已加载
				this.canvas.imageResourceManager.loadResource(filePath)
			}

			// 重新启用历史记录并立即记录一次
			this.canvas.historyManager.enable()
			this.canvas.historyManager.recordHistoryImmediate()

			// 聚焦到所有新创建的元素
			if (createdElementIds.length > 0) {
				this.canvas.selectionManager.selectMultiple(createdElementIds)
			}
		} catch (error) {
			// 确保异常情况下也能重新启用历史记录
			this.canvas.historyManager.enable()
			console.error("[DropOverlayManager] 处理自定义拖拽数据失败:", error)
		}
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		const container = this.canvas.container

		// 移除事件监听
		if (this.handleDragEnterBound) {
			container.removeEventListener("dragenter", this.handleDragEnterBound)
			this.handleDragEnterBound = null
		}
		if (this.handleDragLeaveBound) {
			container.removeEventListener("dragleave", this.handleDragLeaveBound)
			this.handleDragLeaveBound = null
		}
		if (this.handleDragOverBound) {
			container.removeEventListener("dragover", this.handleDragOverBound)
			this.handleDragOverBound = null
		}
		if (this.handleDropBound) {
			container.removeEventListener("drop", this.handleDropBound)
			this.handleDropBound = null
		}

		// 清理遮罩层
		this.hideOverlay()

		// 重置计数器
		this.dragCounter = 0
	}
}
