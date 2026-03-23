import type { Canvas } from "../Canvas"
import { GenerationStatus, type UploadImageResponse, type UploadFile } from "../../types.magic"
import type { ImageElement as ImageElementData } from "../types"
import { ElementTypeEnum } from "../types"
import {
	generateElementId,
	generateUniqueElementName,
	getImageDimensions,
	isImageElementInstance,
} from "./utils"
import { getAllExistingNames } from "./elementUtils"
import { ImageElement as ImageElementClass } from "../element/elements/ImageElement"

/**
 * 上传请求
 */
export interface UploadRequest {
	/** 元素 ID（可选，参考图上传时不需要） */
	elementId?: string
	/** 要上传的文件 */
	file: File
	/** 上传完成回调 */
	onUploadComplete: (result: UploadImageResponse) => void
	/** 上传失败回调 */
	onUploadFailed: (error: Error) => void
}

/**
 * 上传图片选项
 */
export interface UploadImageOptions {
	/** 要上传的文件 */
	file: File
	/** 图片位置（图片中心对齐到该位置） */
	position: { x: number; y: number }
	/** 可选的元素初始数据（用于复制粘贴时保留元素属性） */
	elementData?: Partial<ImageElementData>
	/** 是否管理历史记录（默认 true，在批量操作时应设为 false） */
	manageHistory?: boolean
}

/**
 * 图片上传管理器（Canvas 级别）
 * 负责管理所有图片上传流程，支持锁机制来合并并发上传
 *
 * 设计类似 HistoryManager：
 * - lock(): 锁定上传，后续请求加入队列
 * - unlock(): 解锁并批量处理队列中的所有请求
 * - withLock(): 辅助函数，自动处理锁定/解锁
 */
export class ImageUploadManager {
	private canvas: Canvas

	/** 是否已锁定 */
	private isLocked: boolean = false

	/** 上传队列 */
	private uploadQueue: UploadRequest[] = []

	/** 当前参考图列表（用于参考图上传） */
	private currentReferenceImages?: string[]

	/** 是否正在处理队列 */
	private isProcessingQueue: boolean = false

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
	}

	/**
	 * 添加上传请求
	 * 如果已锁定，加入队列；否则立即上传
	 */
	public queueUpload(request: UploadRequest): void {
		if (this.isLocked) {
			// 锁定状态，加入队列
			this.uploadQueue.push(request)
		} else {
			// 未锁定，立即上传单个文件
			this.uploadSingle(request)
		}
	}

	/**
	 * 锁定上传
	 */
	public lock(): void {
		this.isLocked = true
	}

	/**
	 * 解锁并批量处理队列
	 */
	public async unlock(): Promise<void> {
		this.isLocked = false

		// 如果队列为空或正在处理，直接返回
		if (this.uploadQueue.length === 0 || this.isProcessingQueue) {
			return
		}

		// 处理队列
		await this.processQueue()
	}

	/**
	 * 辅助函数：在锁定状态下执行回调
	 * 类似 withHistoryManagerAsync
	 */
	public async withLock<T>(
		callback: () => Promise<T>,
		options?: { referenceImages?: string[] },
	): Promise<T> {
		// 保存当前参考图列表
		const previousReferenceImages = this.currentReferenceImages
		if (options?.referenceImages) {
			this.currentReferenceImages = options.referenceImages
		}

		this.lock()
		try {
			const result = await callback()
			await this.unlock()
			return result
		} catch (error) {
			await this.unlock()
			throw error
		} finally {
			// 恢复之前的参考图列表
			this.currentReferenceImages = previousReferenceImages
		}
	}

	/**
	 * 直接上传多个文件（不使用队列机制，用于参考图等场景）
	 * @param files 要上传的文件列表
	 * @param referenceImages 可选的参考图列表
	 * @param callbacks 可选的回调函数
	 * @returns 上传结果数组
	 */
	public async uploadDirect(
		files: File[],
		referenceImages?: string[],
		callbacks?: {
			onUploadComplete?: (result: UploadImageResponse, index: number) => void
			onUploadFailed?: (error: Error, index: number) => void
		},
	): Promise<UploadImageResponse[]> {
		// 检查是否有 uploadImages 方法
		const uploadImages = this.canvas.magicConfigManager.config?.methods?.uploadImages
		if (!uploadImages) {
			throw new Error("uploadImages method not available")
		}

		// 准备上传文件列表，为每个文件提供回调
		const uploadFiles: UploadFile[] = files.map((file, index) => ({
			file,
			overwrite: this.getUploadFileOverwrite(file),
			onUploadComplete: (result) => {
				callbacks?.onUploadComplete?.(result, index)
			},
			onUploadFailed: (error) => {
				callbacks?.onUploadFailed?.(error, index)
			},
		}))

		// 直接上传
		const uploadResults = await uploadImages(uploadFiles, referenceImages)

		if (!uploadResults || uploadResults.length === 0) {
			throw new Error("Upload failed: no result returned")
		}

		return uploadResults
	}

	/**
	 * 立即上传单个文件
	 */
	private async uploadSingle(request: UploadRequest): Promise<void> {
		const { file, onUploadComplete, onUploadFailed } = request

		// 检查是否有 uploadImages 方法
		const uploadImages = this.canvas.magicConfigManager.config?.methods?.uploadImages
		if (!uploadImages) {
			const error = new Error("uploadImages method not available")
			onUploadFailed(error)
			return
		}

		try {
			// 上传单个文件，传递回调给外部实现
			const uploadFiles: UploadFile[] = [
				{
					file,
					overwrite: this.getUploadFileOverwrite(file),
					onUploadComplete: onUploadComplete,
					onUploadFailed: onUploadFailed,
				},
			]
			await uploadImages(uploadFiles, this.currentReferenceImages)
		} catch (error) {
			// 上传失败，通知回调
			onUploadFailed(error instanceof Error ? error : new Error("Upload failed"))
		}
	}

	/**
	 * 批量处理队列中的所有上传请求
	 */
	private async processQueue(): Promise<void> {
		if (this.uploadQueue.length === 0) {
			return
		}

		this.isProcessingQueue = true

		try {
			// 取出队列中的所有请求
			const requests = [...this.uploadQueue]
			this.uploadQueue = []

			// 检查是否有 uploadImages 方法
			const uploadImages = this.canvas.magicConfigManager.config?.methods?.uploadImages
			if (!uploadImages) {
				const error = new Error("uploadImages method not available")
				// 所有请求都标记为失败
				for (const request of requests) {
					request.onUploadFailed(error)
				}
				return
			}

			// 准备上传文件列表，传递回调给外部实现
			const uploadFiles: UploadFile[] = requests.map((req) => ({
				file: req.file,
				overwrite: this.getUploadFileOverwrite(req.file),
				onUploadComplete: req.onUploadComplete,
				onUploadFailed: req.onUploadFailed,
			}))

			try {
				// 一次性批量上传所有文件
				// 外部实现会在每个文件上传完成时立即调用对应的回调
				await uploadImages(uploadFiles, this.currentReferenceImages)
			} catch (error) {
				// 上传失败，所有请求都标记为失败
				const errorMessage = error instanceof Error ? error.message : "Upload failed"
				for (const request of requests) {
					request.onUploadFailed(new Error(errorMessage))
				}
			}
		} finally {
			this.isProcessingQueue = false
		}
	}

	/**
	 * 检查是否已锁定
	 */
	public isLock(): boolean {
		return this.isLocked
	}

	/**
	 * 获取队列长度
	 */
	public getQueueLength(): number {
		return this.uploadQueue.length
	}

	/**
	 * 获取上传文件的 overwrite 值
	 * @param fileName 文件名（如 "111.jpg"）
	 * @returns overwrite 值，如果文件名未被使用则返回 true，否则返回 false
	 */
	private getUploadFileOverwrite(file: File): boolean {
		// return !this.isFileNameUsedInCanvas(fileName)
		if (file.name === "image.png") {
			return !this.isFileNameUsedInCanvas(file.name)
		}
		return true
	}

	/**
	 * 检查文件名是否在画布中被使用
	 * @param fileName 文件名（如 "111.jpg"）
	 * @returns true 表示已被使用，false 表示未被使用
	 */
	private isFileNameUsedInCanvas(fileName: string): boolean {
		// 获取所有元素（包括子元素）
		const elementsDict = this.canvas.elementManager.getElementsDict()

		for (const element of Object.values(elementsDict)) {
			// 检查 ImageElement
			if (element.type === "image") {
				const imageElement = element as ImageElementData

				// 1. 检查 src 字段
				if (imageElement.src && this.extractFileName(imageElement.src) === fileName) {
					return true
				}

				// 2. 检查 generateImageRequest.reference_images
				const referenceImages = imageElement.generateImageRequest?.reference_images
				if (referenceImages && Array.isArray(referenceImages)) {
					for (const refImage of referenceImages) {
						if (this.extractFileName(refImage) === fileName) {
							return true
						}
					}
				}
			}
		}

		return false
	}

	/**
	 * 从文件路径中提取文件名
	 * @param filePath 文件路径（如 "/超级画布/images/111.jpg"）
	 * @returns 文件名（如 "111.jpg"）
	 */
	private extractFileName(filePath: string): string {
		return filePath.split("/").pop() || ""
	}

	/**
	 * 上传单个图片（创建元素 + 上传 + 状态转换）
	 * @param options 上传选项
	 * @returns 创建的元素ID，失败返回 null
	 */
	public async uploadImage(options: UploadImageOptions): Promise<string | null> {
		const { file, position, elementData, manageHistory = true } = options

		// 检查是否有 uploadImages 方法
		if (!this.canvas.magicConfigManager.config?.methods?.uploadImages) {
			return null
		}

		// 只有在 manageHistory 为 true 时才管理历史记录
		const historyManager = manageHistory ? this.canvas.historyManager : null
		historyManager?.disable()

		try {
			// 获取图片原始尺寸
			const dimensions = await getImageDimensions(file)

			const targetX = position.x - dimensions.width / 2
			const targetY = position.y - dimensions.height / 2

			// 生成唯一的名称
			const existingNames = getAllExistingNames(this.canvas.elementManager)
			const baseName = file.name.replace(/\.[^/.]+$/, "") // 去掉扩展名
			const uniqueName = generateUniqueElementName(baseName, existingNames)

			// 获取最大 zIndex
			const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()

			// 创建临时图片元素数据
			const elementId = generateElementId()
			const imageElement: ImageElementData = {
				type: ElementTypeEnum.Image,
				x: targetX,
				y: targetY,
				width: dimensions.width,
				height: dimensions.height,
				status: GenerationStatus.Processing, // 上传中状态
				name: uniqueName,
				zIndex: maxZIndex + 1,
				// 合并可选的元素初始数据
				...elementData,
				id: elementId,
			}

			// 使用 ElementManager 创建临时元素
			this.canvas.elementManager.createTemporary(imageElement, {
				uploadFiles: [file],
				onUploadComplete: (elementId) => {
					this.handleUploadCompleteInternal(elementId)
				},
				onUploadFailed: (elementId, error) => {
					this.handleUploadFailedInternal(elementId, error)
				},
			})

			// 重新启用历史记录并立即记录一次（此时元素是临时状态）
			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			return elementId
		} catch (error) {
			// 确保异常情况下也能重新启用历史记录
			historyManager?.enable()
			return null
		}
	}

	/**
	 * 批量上传图片（创建元素 + 上传 + 状态转换）
	 * @param optionsList 上传选项数组
	 * @returns 创建的元素ID数组
	 */
	public async uploadImages(optionsList: UploadImageOptions[]): Promise<string[]> {
		const createdElementIds: string[] = []

		// 使用全局上传管理器的锁机制，合并批量上传
		await this.withLock(async () => {
			for (const options of optionsList) {
				const elementId = await this.uploadImage(options)
				if (elementId) {
					createdElementIds.push(elementId)
				}
			}
		})

		return createdElementIds
	}

	/**
	 * 处理上传完成（内部方法）
	 */
	private handleUploadCompleteInternal(elementId: string): void {
		// 获取元素实例，从中提取 uploadResult
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return

		// 检查是否为 ImageElement 实例
		if (!isImageElementInstance(element)) return

		// 获取上传结果（由全局上传管理器设置）
		const uploadResult = element instanceof ImageElementClass ? element.uploadResult : undefined
		if (!uploadResult) return

		// 将临时元素转为正式元素（使用 silent: true 避免再次记录历史）
		this.canvas.elementManager.convertToPermament(
			elementId,
			{
				src: uploadResult.path,
				status: GenerationStatus.Completed,
			},
			{ silent: true },
		)

		// 预填充 ImageResourceManager 缓存（含 expires_at，避免重复换取）
		this.canvas.imageResourceManager.primeCache(uploadResult.path, {
			src: uploadResult.src,
			expires_at: uploadResult.expires_at,
		})

		// 设置 ossSrc 并启动预加载
		// 注意：这里需要调用 setOssSrc 方法来触发 ossSrcResolve 和 ossSrcReady 事件
		if (element instanceof ImageElementClass && typeof element.setOssSrc === "function") {
			element.setOssSrc(uploadResult.src)
		}

		// 清理上传结果
		if (element instanceof ImageElementClass) {
			element.uploadResult = undefined
		}
	}

	/**
	 * 处理上传失败（内部方法）
	 */
	private handleUploadFailedInternal(elementId: string, error: Error): void {
		// 获取多语言的错误消息
		// 如果 error.message 已经是翻译后的消息（通过 t() 函数生成），直接使用
		// 否则使用默认的翻译 key
		const errorMessage =
			error.message ||
			(this.canvas.t ? this.canvas.t("image.uploadFailed", "图片上传失败") : "图片上传失败")

		// 更新元素状态为失败（使用 silent: true 避免再次记录历史）
		this.canvas.elementManager.update(
			elementId,
			{
				status: GenerationStatus.Failed,
				errorMessage,
			},
			{ silent: true },
		)
	}
}
