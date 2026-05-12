import type { Canvas } from "../Canvas"
import {
	GenerationStatus,
	UploadSubDir,
	type UploadFileResponse,
	type UploadFile,
} from "../../types.magic"
import type { ImageElement as ImageElementData, VideoElement as VideoElementData } from "../types"
import { ElementTypeEnum } from "../types"
import {
	generateElementId,
	generateUniqueElementName,
	getMediaDimensions,
	isVideoFile,
	isAudioFile,
} from "./utils"
import { normalizeUploadFileResponse } from "./pathUtils"
import { getAllExistingNames } from "./elementUtils"
import { ImageElement as ImageElementClass } from "../element/elements/ImageElement"
import { VideoElement as VideoElementClass } from "../element/elements/VideoElement"

/**
 * 上传请求
 */
export interface UploadRequest {
	/** 元素 ID（可选，参考图上传时不需要） */
	elementId?: string
	/** 要上传的文件 */
	file: File
	/** 上传完成回调 */
	onUploadComplete: (result: UploadFileResponse) => void
	/** 上传失败回调 */
	onUploadFailed: (error: Error) => void
}

/**
 * 上传图片元素选项
 */
export interface UploadImageElementOptions {
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
 * 上传文件元素选项
 */
export interface UploadFileElementOptions {
	/** 要上传的文件 */
	file: File
	/** 文件位置（文件中心对齐到该位置） */
	position: { x: number; y: number }
	/** 可选的元素初始数据（用于复制粘贴时保留元素属性） */
	elementData?: Partial<ImageElementData> | Partial<VideoElementData>
	/** 是否管理历史记录（默认 true，在批量操作时应设为 false） */
	manageHistory?: boolean
}

interface PendingUploadBatch {
	id: string
	elementIds: Set<string>
	unresolvedElementIds: Set<string>
}

/**
 * 画布文件上传管理器（Canvas 级别）
 * 负责管理画布文件元素的上传流程，支持锁机制来合并并发上传
 *
 * 设计类似 HistoryManager：
 * - lock(): 锁定上传，后续请求加入队列
 * - unlock(): 解锁并批量处理队列中的所有请求
 * - withLock(): 辅助函数，自动处理锁定/解锁
 */
export class CanvasFileUploadManager {
	private canvas: Canvas

	/** 是否已锁定 */
	private isLocked: boolean = false

	/** 上传队列 */
	private uploadQueue: UploadRequest[] = []

	/** 当前参考图列表（用于参考图上传） */
	private currentReferenceImages?: string[]

	/** 是否正在处理队列 */
	private isProcessingQueue: boolean = false

	/** 待完成上传批次（用于上传中撤销） */
	private pendingUploadBatches: PendingUploadBatch[] = []

	/** 当前批量上传对应的批次 ID */
	private currentPendingBatchId: string | null = null

	/** 临时元素删除监听（用于同步移除待完成上传） */
	private readonly handleTemporaryDeleted = (event: { data: { elementId: string } }) => {
		this.unregisterPendingUploadElement(event.data.elementId)
	}

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		this.canvas.eventEmitter.on("element:temporary:deleted", this.handleTemporaryDeleted)
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
		const previousBatchId = this.currentPendingBatchId
		const batchId = this.beginPendingUploadBatch()
		this.currentPendingBatchId = batchId
		try {
			const result = await callback()
			await this.unlock()
			return result
		} catch (error) {
			await this.unlock()
			throw error
		} finally {
			this.currentPendingBatchId = previousBatchId
			this.cleanupEmptyPendingBatch(batchId)
			// 恢复之前的参考图列表
			this.currentReferenceImages = previousReferenceImages
		}
	}

	/**
	 * 是否存在可取消的上传中批次
	 */
	public hasPendingUploads(): boolean {
		return this.pendingUploadBatches.some((batch) => batch.elementIds.size > 0)
	}

	public getCurrentPendingBatchId(): string | null {
		return this.currentPendingBatchId
	}

	public hasPendingUploadBatch(batchId: string): boolean {
		return this.pendingUploadBatches.some(
			(batch) => batch.id === batchId && batch.elementIds.size > 0,
		)
	}

	public commitPendingUploadBatch(batchId: string): void {
		this.cleanupEmptyPendingBatch(batchId, { force: true })
	}

	/**
	 * 获取上传中的可撤销批次数量
	 */
	public getPendingUndoCount(): number {
		return this.pendingUploadBatches.filter((batch) => batch.elementIds.size > 0).length
	}

	/**
	 * 取消最近一次上传中的批次
	 */
	public cancelLatestPendingUpload(): boolean {
		const latestBatch = [...this.pendingUploadBatches]
			.reverse()
			.find((batch) => batch.elementIds.size > 0)
		if (!latestBatch) {
			return false
		}

		const historyManager = this.canvas.historyManager
		const elementIds = Array.from(latestBatch.elementIds)
		let hasCancelled = false

		historyManager.disable()
		try {
			elementIds.forEach((elementId) => {
				if (this.canvas.elementManager.hasElement(elementId)) {
					this.canvas.elementManager.delete(elementId)
					hasCancelled = true
				}
			})
		} finally {
			historyManager.enable()
		}

		this.cleanupEmptyPendingBatch(latestBatch.id, { force: true })
		return hasCancelled
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
			onUploadComplete?: (result: UploadFileResponse, index: number) => void
			onUploadFailed?: (error: Error, index: number) => void
		},
	): Promise<UploadFileResponse[]> {
		// 检查是否有 uploadFiles 方法
		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			throw new Error("uploadFiles method not available")
		}

		// 准备上传文件列表，为每个文件提供回调
		const uploadFiles: UploadFile[] = files.map((file, index) => ({
			file,
			uploadSubDir: this.getUploadSubDir(file),
			overwrite: this.getUploadFileOverwrite(file),
			onUploadComplete: (result) => {
				callbacks?.onUploadComplete?.(normalizeUploadFileResponse(result), index)
			},
			onUploadFailed: (error) => {
				callbacks?.onUploadFailed?.(error, index)
			},
		}))

		// 直接上传
		const uploadResults = await uploadFilesMethod(uploadFiles, referenceImages)

		if (!uploadResults || uploadResults.length === 0) {
			throw new Error("Upload failed: no result returned")
		}

		return uploadResults.map((r) => normalizeUploadFileResponse(r))
	}

	/**
	 * 立即上传单个文件
	 */
	private async uploadSingle(request: UploadRequest): Promise<void> {
		const { file, onUploadComplete, onUploadFailed } = request

		// 检查是否有 uploadFiles 方法
		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			const error = new Error("uploadFiles method not available")
			onUploadFailed(error)
			return
		}

		try {
			// 上传单个文件，传递回调给外部实现
			const uploadFiles: UploadFile[] = [
				{
					file,
					uploadSubDir: this.getUploadSubDir(file),
					overwrite: this.getUploadFileOverwrite(file),
					onUploadComplete: (result) => {
						onUploadComplete(normalizeUploadFileResponse(result))
					},
					onUploadFailed: onUploadFailed,
				},
			]
			await uploadFilesMethod(uploadFiles, this.currentReferenceImages)
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

			// 检查是否有 uploadFiles 方法
			const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
			if (!uploadFilesMethod) {
				const error = new Error("uploadFiles method not available")
				// 所有请求都标记为失败
				for (const request of requests) {
					request.onUploadFailed(error)
				}
				return
			}

			// 准备上传文件列表，传递回调给外部实现
			const uploadFiles: UploadFile[] = requests.map((req) => ({
				file: req.file,
				uploadSubDir: this.getUploadSubDir(req.file),
				overwrite: this.getUploadFileOverwrite(req.file),
				onUploadComplete: (result) => {
					req.onUploadComplete(normalizeUploadFileResponse(result))
				},
				onUploadFailed: req.onUploadFailed,
			}))

			try {
				// 一次性批量上传所有文件
				// 外部实现会在每个文件上传完成时立即调用对应的回调
				await uploadFilesMethod(uploadFiles, this.currentReferenceImages)
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
	 * 获取上传子目录
	 */
	private getUploadSubDir(file: File) {
		if (isVideoFile(file)) return UploadSubDir.Videos
		if (isAudioFile(file)) return UploadSubDir.Audios
		return UploadSubDir.Images
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
	 * 上传单个图片元素（创建元素 + 上传 + 状态转换）
	 * @param options 上传选项
	 * @returns 创建的元素ID，失败返回 null
	 */
	public async uploadImageElement(options: UploadImageElementOptions): Promise<string | null> {
		return this.uploadFileElement(options)
	}

	/**
	 * 上传单个文件元素（创建元素 + 上传 + 状态转换）
	 * @param options 上传选项
	 * @returns 创建的元素ID，失败返回 null
	 */
	public async uploadFileElement(options: UploadFileElementOptions): Promise<string | null> {
		const { file, position, elementData, manageHistory = true } = options

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			return null
		}

		const historyManager = manageHistory ? this.canvas.historyManager : null

		try {
			const dimensions = await getMediaDimensions(file)
			const targetX = position.x - dimensions.width / 2
			const targetY = position.y - dimensions.height / 2
			const existingNames = getAllExistingNames(this.canvas.elementManager)
			const baseName = file.name.replace(/\.[^/.]+$/, "")
			const uniqueName = generateUniqueElementName(baseName, existingNames)
			const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
			const elementId = generateElementId()
			const isVideo = isVideoFile(file)
			const batchId = this.currentPendingBatchId ?? this.beginPendingUploadBatch()

			const canvasFileElement = isVideo
				? ({
						x: targetX,
						y: targetY,
						width: dimensions.width,
						height: dimensions.height,
						status: GenerationStatus.Processing,
						name: uniqueName,
						zIndex: maxZIndex + 1,
						...elementData,
						id: elementId,
						type: ElementTypeEnum.Video,
					} satisfies VideoElementData)
				: ({
						x: targetX,
						y: targetY,
						width: dimensions.width,
						height: dimensions.height,
						status: GenerationStatus.Processing,
						name: uniqueName,
						zIndex: maxZIndex + 1,
						...elementData,
						id: elementId,
						type: ElementTypeEnum.Image,
					} satisfies ImageElementData)

			historyManager?.disable()
			try {
				this.canvas.elementManager.createTemporary(canvasFileElement, {
					uploadFiles: [file],
					onUploadComplete: (elementId) => {
						const hasChanged = this.handleUploadCompleteInternal(elementId)
						if (historyManager && hasChanged) {
							const pendingBatchId = this.findPendingBatchIdByElement(elementId)
							if (pendingBatchId) {
								this.commitPendingUploadBatch(pendingBatchId)
							}
							historyManager.enable()
							historyManager.recordHistoryImmediate()
						}
					},
					onUploadFailed: (elementId, error) => {
						const hasChanged = this.handleUploadFailedInternal(elementId, error)
						if (historyManager && hasChanged) {
							const pendingBatchId = this.findPendingBatchIdByElement(elementId)
							if (pendingBatchId) {
								this.commitPendingUploadBatch(pendingBatchId)
							}
							historyManager.enable()
							historyManager.recordHistoryImmediate()
						}
					},
				})
				this.registerPendingUploadElement(batchId, elementId)
			} finally {
				historyManager?.enable()
				if (!this.currentPendingBatchId) {
					this.cleanupEmptyPendingBatch(batchId)
				}
			}

			return elementId
		} catch (error) {
			return null
		}
	}

	/**
	 * 批量上传图片元素（创建元素 + 上传 + 状态转换）
	 * @param optionsList 上传选项数组
	 * @returns 创建的元素ID数组
	 */
	public async uploadImageElements(optionsList: UploadImageElementOptions[]): Promise<string[]> {
		const createdElementIds: string[] = []
		const historyManager = this.canvas.historyManager
		historyManager.disable()

		try {
			// 使用全局上传管理器的锁机制，合并批量上传
			const pendingBatchId = await this.withLock(async () => {
				const currentBatchId = this.getCurrentPendingBatchId()
				for (const options of optionsList) {
					const elementId = await this.uploadImageElement({
						...options,
						manageHistory: false,
					})
					if (elementId) {
						createdElementIds.push(elementId)
					}
				}
				return currentBatchId
			})

			historyManager.enable()

			if (pendingBatchId && this.hasPendingUploadBatch(pendingBatchId)) {
				historyManager.recordHistoryImmediate()
				this.commitPendingUploadBatch(pendingBatchId)
			}

			return createdElementIds.filter((elementId) =>
				this.canvas.elementManager.hasElement(elementId),
			)
		} catch (error) {
			historyManager.enable()
			throw error
		}
	}

	/**
	 * 处理上传完成（内部方法）
	 */
	private handleUploadCompleteInternal(elementId: string): boolean {
		// 获取元素实例，从中提取 uploadResult
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false

		const uploadResult =
			element instanceof ImageElementClass || element instanceof VideoElementClass
				? element.uploadResult
				: undefined
		if (!uploadResult) return false

		this.canvas.elementManager.convertToPermament(
			elementId,
			{
				src: uploadResult.path,
				status: GenerationStatus.Completed,
			},
			{ silent: true },
		)

		if (element instanceof ImageElementClass) {
			this.canvas.imageResourceManager.primeCache(uploadResult.path, {
				src: uploadResult.src,
				expires_at: uploadResult.expires_at,
			})

			if (typeof element.setOssSrc === "function") {
				element.setOssSrc(uploadResult.src)
			}
		}

		if (element instanceof VideoElementClass) {
			this.canvas.videoResourceManager.primeCache(uploadResult.path, {
				src: uploadResult.src,
				expires_at: uploadResult.expires_at,
			})
		}

		if (element instanceof ImageElementClass || element instanceof VideoElementClass) {
			element.uploadResult = undefined
		}

		this.markPendingUploadElementResolved(elementId)
		return true
	}

	/**
	 * 处理上传失败（内部方法）
	 */
	private handleUploadFailedInternal(elementId: string, error: Error): boolean {
		if (!this.canvas.elementManager.hasElement(elementId)) {
			return false
		}

		// 获取多语言的错误消息
		// 如果 error.message 已经是翻译后的消息（通过 t() 函数生成），直接使用
		// 否则使用默认的翻译 key
		const errorMessage =
			error.message ||
			(this.canvas.t ? this.canvas.t("image.uploadFailed", "文件上传失败") : "文件上传失败")

		// 更新元素状态为失败（使用 silent: true 避免再次记录历史）
		this.canvas.elementManager.update(
			elementId,
			{
				status: GenerationStatus.Failed,
				errorMessage,
			},
			{ silent: true },
		)

		this.markPendingUploadElementResolved(elementId)
		return true
	}

	/**
	 * 创建待完成上传批次
	 */
	private beginPendingUploadBatch(): string {
		const batchId = generateElementId()
		this.pendingUploadBatches.push({
			id: batchId,
			elementIds: new Set(),
			unresolvedElementIds: new Set(),
		})
		this.emitPendingUploadStateChange()
		return batchId
	}

	/**
	 * 注册待完成上传元素
	 */
	private registerPendingUploadElement(batchId: string, elementId: string): void {
		const batch = this.pendingUploadBatches.find((item) => item.id === batchId)
		if (!batch) {
			return
		}
		batch.elementIds.add(elementId)
		batch.unresolvedElementIds.add(elementId)
		this.emitPendingUploadStateChange()
	}

	/**
	 * 标记待完成上传元素已落定（成功或失败）
	 */
	private markPendingUploadElementResolved(elementId: string): void {
		const batch = this.pendingUploadBatches.find((item) =>
			item.unresolvedElementIds.has(elementId),
		)
		if (!batch) {
			return
		}
		batch.unresolvedElementIds.delete(elementId)
	}

	/**
	 * 取消注册待完成上传元素
	 */
	private unregisterPendingUploadElement(elementId: string): void {
		const batch = this.pendingUploadBatches.find((item) => item.elementIds.has(elementId))
		if (!batch) {
			return
		}
		batch.elementIds.delete(elementId)
		batch.unresolvedElementIds.delete(elementId)
		this.cleanupEmptyPendingBatch(batch.id)
	}

	/**
	 * 清理空的待完成上传批次
	 */
	private cleanupEmptyPendingBatch(batchId: string, options?: { force?: boolean }): void {
		const nextBatches = this.pendingUploadBatches.filter((batch) => {
			return !(
				batch.id === batchId &&
				(options?.force === true || batch.elementIds.size === 0)
			)
		})
		if (nextBatches.length !== this.pendingUploadBatches.length) {
			this.pendingUploadBatches = nextBatches
			this.emitPendingUploadStateChange()
		}
	}

	private findPendingBatchIdByElement(elementId: string): string | null {
		return (
			this.pendingUploadBatches.find((batch) => batch.elementIds.has(elementId))?.id ?? null
		)
	}

	/**
	 * 触发上传中可撤销状态变化
	 */
	private emitPendingUploadStateChange(): void {
		this.canvas.eventEmitter.emit({
			type: "upload:pending-change",
			data: {
				pendingUndoCount: this.getPendingUndoCount(),
			},
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.canvas.eventEmitter.off("element:temporary:deleted", this.handleTemporaryDeleted)
		this.pendingUploadBatches = []
		this.currentPendingBatchId = null
	}
}
