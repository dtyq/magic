import type { Canvas } from "../../core/Canvas"
import { getMediaResourcePathKind } from "../../resources/media-common/mediaResourcePathKind"
import {
	areAllFilesImages,
	areAllFilesVideos,
	isAllowedFileType,
	isAudioFile,
	isImageFile,
	isVideoFile,
	validateFile,
	generateElementId,
	validateCanvasFilePath,
} from "../../shared/ids"
import {
	buildAssetResourcePath,
	getCanvasResourceFileName,
	isAssetResourceScheme,
	parseAssetResourcePath,
} from "../../shared/path/canvasResourcePath"
import type { AudioElement, ImageElement, VideoElement } from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import { updateContent } from "../../document/elementContent"
import { AUDIO_CONFIG } from "../../elements/audio/AudioElement.config"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { toast } from "sonner"
import { resolveGridPlacements } from "../../shared/placement/placementEngine"

/**
 * 拖拽类型
 */
type DragType = "Files" | "text/plain"

const DEFAULT_IMAGE_DROP_DIMENSIONS = { width: 1024, height: 1024 } as const
const DEFAULT_VIDEO_DROP_DIMENSIONS = { width: 1280, height: 720 } as const
const DEFAULT_AUDIO_DROP_DIMENSIONS = {
	width: AUDIO_CONFIG.DEFAULT_WIDTH,
	height: AUDIO_CONFIG.DEFAULT_HEIGHT,
} as const

type CustomDropMediaType = "image" | "video" | "audio"

interface PreparedCustomDropResource {
	filePath: string
	fileInfo: CustomDropFileInfo
	mediaType: CustomDropMediaType
	dimensions: { width: number; height: number }
}

interface CustomDropFileInfo {
	src: string
	fileName: string
	expires_at?: string
}

interface ResolvedCustomDropResource {
	fileInfo: CustomDropFileInfo
	mediaType: CustomDropMediaType
	isAsset: boolean
}

/**
 * DropOverlayManager
 * 负责管理拖拽文件到画布时的遮罩层显示
 */
export class DropOverlayManager {
	private canvas: Canvas
	private overlayElement?: HTMLDivElement
	private dragCounter: number = 0 // 用于跟踪 dragenter/dragleave 的嵌套

	// 进度遮罩相关
	private progressOverlayElement?: HTMLDivElement

	// 拖放事件处理函数引用（用于移除事件监听）
	private handleDragEnterBound: ((e: DragEvent) => void) | null = null
	private handleDragLeaveBound: ((e: DragEvent) => void) | null = null
	private handleDragOverBound: ((e: DragEvent) => void) | null = null
	private handleDropBound: ((e: DragEvent) => Promise<void>) | null = null
	private dragEventHost?: HTMLElement

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas

		this.setupDragAndDropHandlers()
	}

	/**
	 * 获取翻译文本
	 */
	private getText(key: string, fallback: string): string {
		const t = this.canvas.t
		if (t) return t(key, fallback)
		return fallback
	}

	private isNestedResourceDropSurfaceEvent(e: DragEvent): boolean {
		const target = e.target
		return (
			target instanceof Element &&
			target.closest("[data-canvas-resource-drop-surface]") !== null
		)
	}

	private yieldToNestedResourceDropSurface(e: DragEvent): boolean {
		if (!this.isNestedResourceDropSurfaceEvent(e)) return false
		this.dragCounter = 0
		this.hideOverlay()
		return true
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
	 * 检测文件类型（是否为视频）
	 * @param dataTransfer DataTransfer 对象
	 * @returns 是否为视频类型
	 */
	private isVideoType(dataTransfer: DataTransfer): boolean {
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
				return fileTypes.every((type) => type.startsWith("video/"))
			}
		}

		const files = dataTransfer.files
		if (files && files.length > 0) {
			return areAllFilesVideos(files)
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

		if (this.isVideoType(dataTransfer)) {
			return this.getText("dropOverlay.releaseToUpload", "松开以上传文件")
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
		if (this.yieldToNestedResourceDropSurface(e)) return

		e.preventDefault()
		e.stopPropagation()

		// 检查只读模式
		if (!this.canvas.permissionManager.can("document.write")) {
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
		if (this.isNestedResourceDropSurfaceEvent(e)) return

		e.preventDefault()
		e.stopPropagation()

		this.dragCounter = Math.max(0, this.dragCounter - 1)

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
		if (this.yieldToNestedResourceDropSurface(e)) return

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
		if (this.yieldToNestedResourceDropSurface(e)) return

		e.preventDefault()
		e.stopPropagation()

		// 重置计数器
		this.dragCounter = 0

		// 检查只读模式
		if (!this.canvas.permissionManager.can("document.write")) {
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
		if (
			getDataTransferFileInfo &&
			e.dataTransfer &&
			e.dataTransfer.types.includes("text/plain")
		) {
			// 资源准备可能包含跨目录复制，必须在等待宿主解析期间就给出反馈。
			this.hideOverlay()
			const loadingText =
				this.canvas.t?.("dropOverlay.preparingMedia", "正在添加媒体文件，请稍候...") ||
				"正在添加媒体文件，请稍候..."
			const loadingToastId = toast.loading(loadingText)

			try {
				const filePaths = await getDataTransferFileInfo(e.dataTransfer)
				// 过滤有效的图片/视频/音频文件路径
				const validFilePaths = filePaths.flatMap((filePath) => {
					const assetId = parseAssetResourcePath(filePath)
					if (assetId !== undefined) return [buildAssetResourcePath(assetId)]
					if (isAssetResourceScheme(filePath)) return []
					return validateCanvasFilePath(filePath).valid ? [filePath] : []
				})
				if (validFilePaths.length > 0) {
					await this.handleCustomDragData(validFilePaths, canvasPos, loadingToastId)
					return
				}

				toast.dismiss(loadingToastId)
			} catch (error) {
				console.warn("[DropOverlayManager] 准备拖拽资源失败:", error)
				toast.error(
					this.canvas.t?.("dropOverlay.mediaLoadFailed", "媒体文件加载失败，请重试") ||
						"媒体文件加载失败，请重试",
					{ id: loadingToastId },
				)
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
		const eventHost = this.getOverlayHostElement()
		this.dragEventHost = eventHost

		// 绑定事件处理函数
		this.handleDragEnterBound = this.handleDragEnter.bind(this)
		this.handleDragLeaveBound = this.handleDragLeave.bind(this)
		this.handleDragOverBound = this.handleDragOver.bind(this)
		this.handleDropBound = this.handleDrop.bind(this)

		// 添加事件监听
		eventHost.addEventListener("dragenter", this.handleDragEnterBound)
		eventHost.addEventListener("dragleave", this.handleDragLeaveBound)
		eventHost.addEventListener("dragover", this.handleDragOverBound)
		eventHost.addEventListener("drop", this.handleDropBound)
	}

	/**
	 * 计算画布区域的中心点坐标
	 * @returns 中心点坐标
	 */
	private getCanvasAreaCenter(): { x: number; y: number } {
		const container = this.canvas.container
		const {
			left: leftOffset,
			right: rightOffset,
			top: topOffset,
			bottom: bottomOffset,
		} = this.canvas.viewportController.getResolvedDefaultViewportPadding(
			container.offsetWidth,
			container.offsetHeight,
		)

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
	 * 获取拖拽遮罩的宿主层。
	 *
	 * canvasContainer 自身是 z-index: 1 的 stacking context，元素工具栏在其
	 * 同级的更高层。遮罩挂到父级后，才能真正覆盖工具栏；悬停遮罩本身会
	 * 关闭 pointer-events，避免影响画布的 drop 事件。
	 */
	private getOverlayHostElement(): HTMLElement {
		return this.canvas.container.parentElement ?? this.canvas.container
	}

	private ensureOverlayHostPosition(host: HTMLElement): void {
		if (window.getComputedStyle(host).position === "static") {
			host.style.position = "relative"
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
		overlayElement.style.pointerEvents = "none"

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

		const container = this.getOverlayHostElement()
		const center = this.getCanvasAreaCenter()
		const text = this.getDropText(dataTransfer, dragType)

		// 创建遮罩层
		this.overlayElement = this.createOverlayElement(text, center.x, center.y)

		// 确保 container 有相对定位
		this.ensureOverlayHostPosition(container)

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
			const container = this.getOverlayHostElement()
			const center = this.getCanvasAreaCenter()
			this.overlayElement = this.createOverlayElement("", center.x, center.y)

			// 确保 container 有相对定位
			this.ensureOverlayHostPosition(container)

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

	// ─── 进度遮罩 ─────────────────────────────────────────────

	/**
	 * 显示批量处理进度遮罩
	 */
	public showProgressOverlay(current: number, total: number): void {
		const container = this.getOverlayHostElement()

		if (!this.progressOverlayElement) {
			this.progressOverlayElement = this.createProgressOverlayElement(current, total)

			this.ensureOverlayHostPosition(container)
			container.appendChild(this.progressOverlayElement)
		} else {
			this.updateProgressOverlay(current, total)
		}
	}

	/**
	 * 更新进度遮罩的进度
	 */
	public updateProgressOverlay(current: number, total: number): void {
		if (!this.progressOverlayElement) return

		const textEl = this.progressOverlayElement.querySelector(
			"[data-progress-text]",
		) as HTMLElement
		if (textEl) {
			textEl.textContent = this.getProgressText(current, total)
		}

		const barEl = this.progressOverlayElement.querySelector(
			"[data-progress-bar]",
		) as HTMLElement
		if (barEl) {
			const percent = Math.round((current / total) * 100)
			barEl.style.width = `${percent}%`
		}

		const countEl = this.progressOverlayElement.querySelector(
			"[data-progress-count]",
		) as HTMLElement
		if (countEl) {
			countEl.textContent = `${current}/${total}`
		}
	}

	/**
	 * 隐藏进度遮罩
	 */
	public hideProgressOverlay(): void {
		if (this.progressOverlayElement) {
			this.progressOverlayElement.remove()
			this.progressOverlayElement = undefined
		}
	}

	/**
	 * 获取进度文本
	 */
	private getProgressText(current: number, total: number): string {
		const t = this.canvas.t
		const fallback = `正在处理 ${current}/${total}`
		if (t) {
			const template = t("dropOverlay.processing", fallback)
			return template
				.replace("{{current}}", String(current))
				.replace("{{total}}", String(total))
		}
		return fallback
	}

	/**
	 * 创建进度遮罩 DOM 元素
	 */
	private createProgressOverlayElement(current: number, total: number): HTMLDivElement {
		const overlay = document.createElement("div")
		overlay.setAttribute("data-progress-overlay", "")

		// 全屏遮罩样式
		Object.assign(overlay.style, {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			backgroundColor: "rgba(255, 255, 255, 0.75)",
			zIndex: "9999",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			transition: "all 0.3s ease",
		})

		// 内容卡片
		const card = document.createElement("div")
		card.setAttribute("data-progress-card", "")
		Object.assign(card.style, {
			backgroundColor: "#fff",
			borderRadius: "12px",
			padding: "24px 32px",
			boxShadow: "0 4px 24px rgba(0, 0, 0, 0.12)",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			gap: "16px",
			minWidth: "280px",
			transition: "all 0.3s ease",
		})

		// 进度文字
		const textEl = document.createElement("div")
		textEl.setAttribute("data-progress-text", "")
		textEl.textContent = this.getProgressText(current, total)
		Object.assign(textEl.style, {
			fontSize: "15px",
			fontWeight: "500",
			color: "#1a1a1a",
			fontFamily: "Arial, sans-serif",
		})

		// 进度条容器
		const barContainer = document.createElement("div")
		Object.assign(barContainer.style, {
			width: "100%",
			height: "6px",
			backgroundColor: "#f0f0f0",
			borderRadius: "3px",
			overflow: "hidden",
		})

		// 进度条填充
		const bar = document.createElement("div")
		bar.setAttribute("data-progress-bar", "")
		const percent = total > 0 ? Math.round((current / total) * 100) : 0
		Object.assign(bar.style, {
			width: `${percent}%`,
			height: "100%",
			backgroundColor: "#315CEC",
			borderRadius: "3px",
			transition: "width 0.3s ease",
		})
		barContainer.appendChild(bar)

		// 计数文字
		const countEl = document.createElement("div")
		countEl.setAttribute("data-progress-count", "")
		countEl.textContent = `${current}/${total}`
		Object.assign(countEl.style, {
			fontSize: "12px",
			color: "#999",
			fontFamily: "Arial, sans-serif",
		})

		card.appendChild(textEl)
		card.appendChild(barContainer)
		card.appendChild(countEl)
		overlay.appendChild(card)

		return overlay
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

		const canvasElementFiles = validFiles.filter(
			(file) => isImageFile(file) || isVideoFile(file) || isAudioFile(file),
		)

		if (canvasElementFiles.length > 0) {
			const total = canvasElementFiles.length
			// 多文件时显示进度遮罩
			if (total > 1) {
				this.showProgressOverlay(0, total)
				try {
					await this.canvas.clipboardManager.pasteMultipleCanvasFiles(
						canvasElementFiles,
						canvasPos,
						{
							onProgress: (current) => {
								this.updateProgressOverlay(current, total)
							},
						},
					)
				} finally {
					this.hideProgressOverlay()
				}
			} else {
				await this.canvas.clipboardManager.pasteMultipleCanvasFiles(
					canvasElementFiles,
					canvasPos,
				)
			}
		}
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
		// 使用 preview 资源获取原图元信息，避免仅为尺寸触发 full decode
		const resource = await this.canvas.imageResourceManager.getResource(path, {
			variant: "preview",
		})

		if (!resource?.imageInfo?.naturalWidth || !resource?.imageInfo?.naturalHeight) {
			throw new Error("Failed to load image")
		}

		return {
			width: resource.imageInfo.naturalWidth,
			height: resource.imageInfo.naturalHeight,
		}
	}

	/**
	 * 从 URL 获取视频尺寸
	 * @param src 视频可访问地址
	 * @returns Promise<{width: number, height: number}> 视频的宽度和高度
	 */
	private async getVideoDimensionsFromUrl(
		src: string,
	): Promise<{ width: number; height: number }> {
		return new Promise((resolve, reject) => {
			const video = document.createElement("video")
			video.preload = "metadata"
			video.onloadedmetadata = () => {
				resolve({
					width: video.videoWidth || 1280,
					height: video.videoHeight || 720,
				})
			}
			video.onerror = () => {
				reject(new Error("Failed to load video"))
			}
			video.src = src
		})
	}

	private getCustomDropMediaType(filePath: string): CustomDropMediaType | null {
		const mediaType = getMediaResourcePathKind(filePath)
		if (mediaType === "audio" || mediaType === "video" || mediaType === "image") {
			return mediaType
		}
		return null
	}

	private async resolveCustomDropResource(filePath: string): Promise<ResolvedCustomDropResource> {
		const assetId = parseAssetResourcePath(filePath)
		if (assetId !== undefined) {
			const asset = await this.canvas.assetResourceManager.getResource(assetId)
			const mediaType = getMediaResourcePathKind(filePath, {
				mediaType: asset.mediaType,
			})
			if (
				!asset.fileUrl ||
				(mediaType !== "image" && mediaType !== "video" && mediaType !== "audio")
			) {
				throw new Error("Asset detail does not contain a supported media resource")
			}
			return {
				fileInfo: {
					src: asset.fileUrl,
					fileName:
						asset.fileName || getCanvasResourceFileName(filePath) || `asset-${assetId}`,
				},
				mediaType,
				isAsset: true,
			}
		}
		if (isAssetResourceScheme(filePath)) {
			throw new Error("Invalid asset resource path")
		}

		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			throw new Error("File info provider is unavailable")
		}

		const mediaType = this.getCustomDropMediaType(filePath)
		if (!mediaType) {
			throw new Error("Unsupported custom drop media path")
		}
		const fileInfo = await getFileInfo(filePath, {
			useImageProcess: mediaType === "image",
		})
		if (!fileInfo || !fileInfo.src) {
			throw new Error("File info does not contain a resource URL")
		}
		return { fileInfo, mediaType, isAsset: false }
	}

	private getCustomDropPlaceholderDimensions(mediaType: CustomDropMediaType): {
		width: number
		height: number
	} {
		switch (mediaType) {
			case "audio":
				return { ...DEFAULT_AUDIO_DROP_DIMENSIONS }
			case "video":
				return { ...DEFAULT_VIDEO_DROP_DIMENSIONS }
			default:
				return { ...DEFAULT_IMAGE_DROP_DIMENSIONS }
		}
	}

	private async getCustomDropMediaDimensions(
		filePath: string,
		mediaType: CustomDropMediaType,
		fileInfo: CustomDropFileInfo,
	): Promise<{ width: number; height: number }> {
		if (mediaType === "audio") return { ...DEFAULT_AUDIO_DROP_DIMENSIONS }

		try {
			return mediaType === "video"
				? await this.getVideoDimensionsFromUrl(fileInfo.src)
				: await this.getImageDimensionsFromUrl(filePath)
		} catch (error) {
			console.warn(`[DropOverlayManager] 获取媒体尺寸失败: ${filePath}`, error)
			return this.getCustomDropPlaceholderDimensions(mediaType)
		}
	}

	private async prepareCustomDropResource(filePath: string): Promise<PreparedCustomDropResource> {
		const assetId = parseAssetResourcePath(filePath)
		const normalizedFilePath =
			assetId !== undefined ? buildAssetResourcePath(assetId) : filePath
		const { mediaType, fileInfo, isAsset } =
			await this.resolveCustomDropResource(normalizedFilePath)

		if (!isAsset) {
			switch (mediaType) {
				case "audio":
					this.canvas.audioResourceManager.primeCache(normalizedFilePath, {
						...fileInfo,
						path: normalizedFilePath,
					})
					break
				case "video":
					this.canvas.videoResourceManager.primeCache(normalizedFilePath, fileInfo)
					this.canvas.videoResourceManager.loadResource(normalizedFilePath)
					break
				default:
					this.canvas.imageResourceManager.primeCache(normalizedFilePath, fileInfo)
					this.canvas.imageResourceManager.loadResource(normalizedFilePath)
			}
		} else if (mediaType === "video") {
			// Asset file_url values are session URLs. Let the video resource lifecycle
			// resolve the stable asset path instead of seeding that URL into its cache.
			this.canvas.videoResourceManager.loadResource(normalizedFilePath)
		}

		const dimensions = await this.getCustomDropMediaDimensions(
			normalizedFilePath,
			mediaType,
			fileInfo,
		)
		return { filePath: normalizedFilePath, fileInfo, mediaType, dimensions }
	}

	/**
	 * 创建图片元素
	 * @param filePath 文件路径
	 * @param fileInfo 文件信息
	 * @param dimensions 图片尺寸
	 * @param position 位置
	 * @param zIndex z-index
	 * @returns 创建的元素 ID
	 */
	private createImageElement(
		filePath: string,
		fileInfo: { fileName: string },
		dimensions: { width: number; height: number },
		position: { x: number; y: number },
		zIndex: number,
	): string {
		// 从文件路径提取文件名（去掉扩展名）
		const fileName = fileInfo.fileName || getCanvasResourceFileName(filePath) || "image"
		const baseName = fileName.replace(/\.[^/.]+$/, "")

		// 计算元素位置（图片中心对齐到 position）
		const targetX = position.x - dimensions.width / 2
		const targetY = position.y - dimensions.height / 2

		// 创建图片元素数据
		const elementId = generateElementId()
		const baseElement = ElementFactory.createElementData(
			ElementTypeEnum.Image,
			elementId,
			targetX,
			targetY,
			dimensions.width,
			dimensions.height,
			zIndex,
		) as ImageElement
		const imageElement = updateContent(
			{ ...baseElement, name: baseName },
			baseElement.activeContentId ?? undefined,
			{ src: filePath },
		)

		this.canvas.elementManager.create(imageElement)
		return elementId
	}

	/**
	 * 创建视频元素
	 * @param filePath 文件路径
	 * @param fileInfo 文件信息
	 * @param dimensions 视频尺寸
	 * @param position 位置
	 * @param zIndex z-index
	 * @returns 创建的元素 ID
	 */
	private createVideoElement(
		filePath: string,
		fileInfo: { fileName: string },
		dimensions: { width: number; height: number },
		position: { x: number; y: number },
		zIndex: number,
	): string {
		const fileName = fileInfo.fileName || getCanvasResourceFileName(filePath) || "video"
		const baseName = fileName.replace(/\.[^/.]+$/, "")

		const targetX = position.x - dimensions.width / 2
		const targetY = position.y - dimensions.height / 2

		const elementId = generateElementId()
		const baseElement = ElementFactory.createElementData(
			ElementTypeEnum.Video,
			elementId,
			targetX,
			targetY,
			dimensions.width,
			dimensions.height,
			zIndex,
		) as VideoElement
		const videoElement = updateContent(
			{ ...baseElement, name: baseName },
			baseElement.activeContentId ?? undefined,
			{ src: filePath },
		)

		this.canvas.elementManager.create(videoElement)
		return elementId
	}

	private createAudioElement(
		filePath: string,
		dimensions: { width: number; height: number },
		position: { x: number; y: number },
		zIndex: number,
	): string {
		const elementId = generateElementId()
		const baseElement = ElementFactory.createElementData(
			ElementTypeEnum.Audio,
			elementId,
			position.x - dimensions.width / 2,
			position.y - dimensions.height / 2,
			dimensions.width,
			dimensions.height,
			zIndex,
		) as AudioElement
		const audioElement = updateContent(baseElement, baseElement.activeContentId ?? undefined, {
			src: filePath,
		})

		this.canvas.elementManager.create(audioElement)
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
		loadingToastId?: ReturnType<typeof toast.loading>,
	): Promise<void> {
		if (filePaths.length === 0) return

		const activeLoadingToastId =
			loadingToastId ??
			toast.loading(
				this.canvas.t?.("dropOverlay.preparingMedia", "正在加载媒体文件，请稍候...") ||
					"正在加载媒体文件，请稍候...",
			)

		const preparationResults = await Promise.allSettled(
			filePaths.map((filePath) => this.prepareCustomDropResource(filePath)),
		)
		const preparedResources = preparationResults.flatMap((result) =>
			result.status === "fulfilled" ? [result.value] : [],
		)
		let failedCount = preparationResults.length - preparedResources.length

		if (preparedResources.length === 0) {
			toast.error(
				this.canvas.t?.("dropOverlay.mediaLoadFailed", "媒体文件加载失败，请重试") ||
					"媒体文件加载失败，请重试",
				{ id: activeLoadingToastId },
			)
			return
		}

		const positions = resolveGridPlacements(
			preparedResources.map(({ dimensions }) => dimensions),
			anchorPosition,
		)
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		const createdElementIds: string[] = []

		this.canvas.historyManager.disable()
		try {
			for (let i = 0; i < preparedResources.length; i++) {
				const { filePath, fileInfo, mediaType, dimensions } = preparedResources[i]
				const position = positions[i]
				const zIndex = maxZIndex + 1 + i
				try {
					let elementId: string
					if (mediaType === "video") {
						elementId = this.createVideoElement(
							filePath,
							fileInfo,
							dimensions,
							position,
							zIndex,
						)
					} else if (mediaType === "audio") {
						elementId = this.createAudioElement(filePath, dimensions, position, zIndex)
					} else {
						elementId = this.createImageElement(
							filePath,
							fileInfo,
							dimensions,
							position,
							zIndex,
						)
					}
					createdElementIds.push(elementId)
				} catch (error) {
					failedCount++
					console.warn(`[DropOverlayManager] 创建拖拽资源失败: ${filePath}`, error)
				}
			}
		} finally {
			this.canvas.historyManager.enable()
		}

		if (createdElementIds.length > 0) {
			this.canvas.historyManager.recordHistoryImmediate()
			this.canvas.selectionManager.selectMultiple(createdElementIds)
		}

		if (failedCount >= filePaths.length) {
			toast.error(
				this.canvas.t?.("dropOverlay.mediaLoadFailed", "媒体文件加载失败，请重试") ||
					"媒体文件加载失败，请重试",
				{ id: activeLoadingToastId },
			)
		} else if (failedCount > 0) {
			const failureText =
				this.canvas
					.t?.("dropOverlay.someMediaLoadFailed", "部分媒体文件加载失败")
					?.replace("{{failed}}", String(failedCount)) || "部分媒体文件加载失败"
			toast.warning(failureText, { id: activeLoadingToastId })
		} else {
			toast.dismiss(activeLoadingToastId)
		}
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		const eventHost = this.dragEventHost ?? this.getOverlayHostElement()

		// 移除事件监听
		if (this.handleDragEnterBound) {
			eventHost.removeEventListener("dragenter", this.handleDragEnterBound)
			this.handleDragEnterBound = null
		}
		if (this.handleDragLeaveBound) {
			eventHost.removeEventListener("dragleave", this.handleDragLeaveBound)
			this.handleDragLeaveBound = null
		}
		if (this.handleDragOverBound) {
			eventHost.removeEventListener("dragover", this.handleDragOverBound)
			this.handleDragOverBound = null
		}
		if (this.handleDropBound) {
			eventHost.removeEventListener("drop", this.handleDropBound)
			this.handleDropBound = null
		}
		this.dragEventHost = undefined

		// 清理遮罩层
		this.hideOverlay()
		this.hideProgressOverlay()

		// 重置计数器
		this.dragCounter = 0
	}
}
