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
import {
	isDefaultClipboardFilenameFile,
	type CanvasElementClipboardFileMetadata,
} from "./CanvasElementClipboard"
import { logCanvasElementClipboard } from "./CanvasElementClipboardLogger"

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

/**
 * 上传远程来源文件元素选项。
 *
 * UI 上仍创建上传态临时元素；代码路径上先下载远程资源，再进入标准上传队列。
 */
export interface UploadRemoteFileElementOptions {
	/** 剪贴板文件元数据，必须包含 sourceRef.ossUrl */
	metadata: CanvasElementClipboardFileMetadata
	/** 来源画布 ID，用于目标画布内对跨画布反复粘贴做资源迁移去重 */
	sourceCanvasId?: string
	/** 元素类型，用于在下载前创建正确的临时元素 */
	elementType: ImageElementData["type"] | VideoElementData["type"]
	/** 文件位置（文件中心对齐到该位置） */
	position: { x: number; y: number }
	/** 可选的元素初始数据（用于复制粘贴时保留元素属性） */
	elementData?: Partial<ImageElementData> | Partial<VideoElementData>
	/** 是否管理历史记录（默认 true，在批量操作时应设为 false） */
	manageHistory?: boolean
	/** 远程文件下载失败回调 */
	onDownloadFailed?: (error: Error) => void
}

interface PendingUploadBatch {
	id: string
	elementIds: Set<string>
	unresolvedElementIds: Set<string>
}

type RemoteResourceTransfer =
	| {
			status: "uploading"
			promise: Promise<UploadFileResponse>
	  }
	| {
			status: "completed"
			result: UploadFileResponse
	  }
	| {
			status: "failed"
			error: Error
	  }

interface PersistedRemoteResourceTransferEntry {
	result: UploadFileResponse
	updatedAt: number
}

const REMOTE_RESOURCE_TRANSFER_STORAGE_KEY = "canvas-design:remote-resource-transfers:v1"
const REMOTE_RESOURCE_TRANSFER_TTL = 7 * 24 * 60 * 60 * 1000

function summarizeUploadResult(result: UploadFileResponse) {
	return {
		path: result.path,
		fileName: result.fileName,
		expiresAt: result.expires_at,
		source: result.source,
		hasSrc: Boolean(result.src),
	}
}

function getFileContentSignature(file: File): string {
	return `${file.type}:${file.size}:${file.lastModified}`
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

	/**
	 * 目标画布级远程资源迁移缓存。
	 *
	 * 解决场景：A 画布复制媒体元素，在 B 画布反复 Ctrl+V。
	 * 第一次粘贴负责下载+上传；上传中再次粘贴复用同一个 Promise；完成后再次粘贴直接复用 B 画布资源。
	 */
	private readonly remoteResourceTransfers = new Map<string, RemoteResourceTransfer>()

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

	public getCompletedRemoteResourceTransfer(options: {
		sourceCanvasId?: string
		metadata: CanvasElementClipboardFileMetadata
	}): UploadFileResponse | null {
		const key = this.getRemoteResourceTransferKey(options)
		if (!key) {
			return null
		}

		const transfer = this.remoteResourceTransfers.get(key)
		if (transfer?.status === "completed") {
			return transfer.result
		}

		const persisted = this.getPersistedCompletedRemoteResourceTransfer(key)
		if (persisted) {
			this.remoteResourceTransfers.set(key, {
				status: "completed",
				result: persisted,
			})
			return persisted
		}

		return null
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
			overwrite: this.getUploadFileOverwrite(file, files),
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

		logCanvasElementClipboard("upload-single:start", {
			elementId: request.elementId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			uploadSubDir: this.getUploadSubDir(file),
			overwrite: this.getUploadFileOverwrite(file),
		})

		// 检查是否有 uploadFiles 方法
		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			const error = new Error("uploadFiles method not available")
			logCanvasElementClipboard("upload-single:error", {
				elementId: request.elementId,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				message: error.message,
				error,
			})
			onUploadFailed(error)
			return
		}

		try {
			// 上传单个文件，传递回调给外部实现
			const uploadFiles: UploadFile[] = [
				{
					file,
					uploadSubDir: this.getUploadSubDir(file),
					overwrite: this.getUploadFileOverwrite(file, [file]),
					onUploadComplete: (result) => {
						const normalizedResult = normalizeUploadFileResponse(result)
						logCanvasElementClipboard("upload-single:complete", {
							elementId: request.elementId,
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							result: summarizeUploadResult(normalizedResult),
						})
						onUploadComplete(normalizedResult)
					},
					onUploadFailed: (error) => {
						logCanvasElementClipboard("upload-single:failed", {
							elementId: request.elementId,
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							message: error instanceof Error ? error.message : String(error),
							error,
						})
						onUploadFailed(error)
					},
				},
			]
			await uploadFilesMethod(uploadFiles, this.currentReferenceImages, {
				showSuccessToast: false,
			})
		} catch (error) {
			// 上传失败，通知回调
			const uploadError = error instanceof Error ? error : new Error("Upload failed")
			logCanvasElementClipboard("upload-single:error", {
				elementId: request.elementId,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				message: uploadError.message,
				error,
			})
			onUploadFailed(uploadError)
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
					logCanvasElementClipboard("upload-queue:error", {
						elementId: request.elementId,
						fileName: request.file.name,
						fileType: request.file.type,
						fileSize: request.file.size,
						message: error.message,
						error,
					})
					request.onUploadFailed(error)
				}
				return
			}

			// 准备上传文件列表，传递回调给外部实现
			const requestFiles = requests.map((request) => request.file)
			const uploadFiles: UploadFile[] = requests.map((req) => ({
				file: req.file,
				uploadSubDir: this.getUploadSubDir(req.file),
				overwrite: this.getUploadFileOverwrite(req.file, requestFiles),
				onUploadComplete: (result) => {
					const normalizedResult = normalizeUploadFileResponse(result)
					logCanvasElementClipboard("upload-queue:complete", {
						elementId: req.elementId,
						fileName: req.file.name,
						fileType: req.file.type,
						fileSize: req.file.size,
						result: summarizeUploadResult(normalizedResult),
					})
					req.onUploadComplete(normalizedResult)
				},
				onUploadFailed: (error) => {
					logCanvasElementClipboard("upload-queue:failed", {
						elementId: req.elementId,
						fileName: req.file.name,
						fileType: req.file.type,
						fileSize: req.file.size,
						message: error instanceof Error ? error.message : String(error),
						error,
					})
					req.onUploadFailed(error)
				},
			}))

			logCanvasElementClipboard("upload-queue:start", {
				requestCount: requests.length,
				files: requests.map((request) => ({
					elementId: request.elementId,
					fileName: request.file.name,
					fileType: request.file.type,
					fileSize: request.file.size,
					uploadSubDir: this.getUploadSubDir(request.file),
					overwrite: this.getUploadFileOverwrite(request.file, requestFiles),
				})),
			})

			try {
				// 一次性批量上传所有文件
				// 外部实现会在每个文件上传完成时立即调用对应的回调
				await uploadFilesMethod(uploadFiles, this.currentReferenceImages, {
					showSuccessToast: false,
				})
			} catch (error) {
				// 上传失败，所有请求都标记为失败
				const errorMessage = error instanceof Error ? error.message : "Upload failed"
				for (const request of requests) {
					logCanvasElementClipboard("upload-queue:error", {
						elementId: request.elementId,
						fileName: request.file.name,
						fileType: request.file.type,
						fileSize: request.file.size,
						message: errorMessage,
						error,
					})
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
	 * @param file 上传文件
	 * @returns overwrite 值；剪贴板无法读取原文件名时使用默认文件名，必须禁止覆盖已有同名文件
	 */
	private getUploadFileOverwrite(file: File, batchFiles?: File[]): boolean {
		if (isDefaultClipboardFilenameFile(file)) {
			return false
		}

		if (batchFiles) {
			const sameNameFiles = batchFiles.filter((item) => item.name === file.name)
			if (sameNameFiles.length > 1) {
				const signatures = new Set(sameNameFiles.map(getFileContentSignature))
				// 解决场景：系统拖拽/粘贴同名但内容不同的文件，上传时禁用覆盖并交给宿主侧改名。
				if (signatures.size > 1) {
					return false
				}
			}
		}

		return true
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

		logCanvasElementClipboard("upload-file-element:start", {
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			position,
			hasElementData: Boolean(elementData),
			elementData,
			manageHistory,
		})

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			logCanvasElementClipboard("upload-file-element:skip", {
				reason: "uploadFiles method not available",
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
			})
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

			logCanvasElementClipboard("upload-file-element:prepare", {
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				dimensions,
				position,
				targetX,
				targetY,
				baseName,
				uniqueName,
				elementId,
				elementType: isVideo ? ElementTypeEnum.Video : ElementTypeEnum.Image,
				batchId,
				uploadSubDir: this.getUploadSubDir(file),
				overwrite: this.getUploadFileOverwrite(file),
			})

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
						logCanvasElementClipboard("upload-file-element:upload-complete", {
							elementId,
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							batchId,
						})
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
						logCanvasElementClipboard("upload-file-element:upload-failed", {
							elementId,
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							batchId,
							message: error instanceof Error ? error.message : String(error),
							error,
						})
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
				logCanvasElementClipboard("upload-file-element:created", {
					elementId,
					fileName: file.name,
					fileType: file.type,
					fileSize: file.size,
					batchId,
				})
			} finally {
				historyManager?.enable()
				if (!this.currentPendingBatchId) {
					this.cleanupEmptyPendingBatch(batchId)
				}
			}

			return elementId
		} catch (error) {
			logCanvasElementClipboard("upload-file-element:error", {
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				position,
				hasElementData: Boolean(elementData),
				elementData,
				message: error instanceof Error ? error.message : String(error),
				error,
			})
			return null
		}
	}

	public async uploadRemoteFileElement(
		options: UploadRemoteFileElementOptions,
	): Promise<string | null> {
		const {
			metadata,
			sourceCanvasId,
			elementType,
			position,
			elementData,
			manageHistory = true,
			onDownloadFailed,
		} = options
		const sourceRef = metadata.sourceRef

		logCanvasElementClipboard("upload-remote-file-element:start", {
			elementId: metadata.elementId,
			sourceCanvasId,
			filename: metadata.filename,
			mimeType: metadata.mimeType,
			sourceRef,
			position,
			hasElementData: Boolean(elementData),
			elementData,
			manageHistory,
		})

		if (!sourceRef?.ossUrl) {
			logCanvasElementClipboard("upload-remote-file-element:skip", {
				reason: "missing-source-ref",
				elementId: metadata.elementId,
				filename: metadata.filename,
				mimeType: metadata.mimeType,
			})
			return null
		}

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			logCanvasElementClipboard("upload-remote-file-element:skip", {
				reason: "uploadFiles method not available",
				elementId: metadata.elementId,
				filename: metadata.filename,
				mimeType: metadata.mimeType,
			})
			return null
		}

		const historyManager = manageHistory ? this.canvas.historyManager : null
		const transferKey = this.getRemoteResourceTransferKey({ sourceCanvasId, metadata })
		const width = elementData?.width ?? 100
		const height = elementData?.height ?? 100
		const targetX = elementData?.x ?? position.x - width / 2
		const targetY = elementData?.y ?? position.y - height / 2
		const existingNames = getAllExistingNames(this.canvas.elementManager)
		const baseName = metadata.filename.replace(/\.[^/.]+$/, "")
		const uniqueName = generateUniqueElementName(baseName, existingNames)
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		const elementId = generateElementId()
		const batchId = this.currentPendingBatchId ?? this.beginPendingUploadBatch()

		const canvasFileElement =
			elementType === ElementTypeEnum.Video
				? ({
						x: targetX,
						y: targetY,
						width,
						height,
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
						width,
						height,
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
				uploadFiles: [],
				onUploadComplete: (elementId) => {
					logCanvasElementClipboard("upload-remote-file-element:upload-complete", {
						elementId,
						batchId,
					})
					const hasChanged = this.handleUploadCompleteInternal(elementId)
					if (historyManager && hasChanged) {
						const pendingBatchId = this.findPendingBatchIdByElement(elementId)
						if (pendingBatchId) {
							this.commitPendingUploadBatch(pendingBatchId)
						}
						historyManager.enable()
						historyManager.recordHistoryImmediate()
					} else {
						this.cleanupResolvedPendingBatch(batchId)
					}
				},
				onUploadFailed: (elementId, error) => {
					logCanvasElementClipboard("upload-remote-file-element:upload-failed", {
						elementId,
						batchId,
						message: error instanceof Error ? error.message : String(error),
						error,
					})
					const hasChanged = this.handleUploadFailedInternal(elementId, error)
					if (historyManager && hasChanged) {
						const pendingBatchId = this.findPendingBatchIdByElement(elementId)
						if (pendingBatchId) {
							this.commitPendingUploadBatch(pendingBatchId)
						}
						historyManager.enable()
						historyManager.recordHistoryImmediate()
					} else {
						this.cleanupResolvedPendingBatch(batchId)
					}
				},
			})
			this.registerPendingUploadElement(batchId, elementId)
			logCanvasElementClipboard("upload-remote-file-element:created", {
				elementId,
				sourceElementId: metadata.elementId,
				filename: metadata.filename,
				mimeType: metadata.mimeType,
				batchId,
			})
		} finally {
			historyManager?.enable()
			if (!this.currentPendingBatchId) {
				this.cleanupEmptyPendingBatch(batchId)
			}
		}

		void this.downloadAndQueueRemoteUpload({
			elementId,
			metadata,
			sourceUrl: sourceRef.ossUrl,
			batchId,
			historyManager,
			onDownloadFailed,
			transferKey,
		})

		return elementId
	}

	private async downloadAndQueueRemoteUpload(options: {
		elementId: string
		metadata: CanvasElementClipboardFileMetadata
		sourceUrl: string
		batchId: string
		historyManager: Canvas["historyManager"] | null
		onDownloadFailed?: (error: Error) => void
		transferKey?: string
	}): Promise<void> {
		const {
			elementId,
			metadata,
			sourceUrl,
			batchId,
			historyManager,
			onDownloadFailed,
			transferKey,
		} = options

		const existingTransfer = transferKey
			? this.remoteResourceTransfers.get(transferKey)
			: undefined

		if (existingTransfer?.status === "completed") {
			logCanvasElementClipboard("upload-remote-file-element:reuse-completed", {
				elementId,
				sourceElementId: metadata.elementId,
				transferKey,
				result: summarizeUploadResult(existingTransfer.result),
				batchId,
			})
			this.applyRemoteUploadResult(
				elementId,
				existingTransfer.result,
				batchId,
				historyManager,
			)
			return
		}

		if (existingTransfer?.status === "uploading") {
			logCanvasElementClipboard("upload-remote-file-element:reuse-uploading", {
				elementId,
				sourceElementId: metadata.elementId,
				transferKey,
				batchId,
			})
			this.attachRemoteResourceTransfer({
				elementId,
				metadata,
				batchId,
				historyManager,
				onDownloadFailed,
				promise: existingTransfer.promise,
			})
			return
		}

		if (existingTransfer?.status === "failed" && transferKey) {
			this.remoteResourceTransfers.delete(transferKey)
		}

		const promise = this.createRemoteResourceTransferPromise({
			metadata,
			sourceUrl,
			batchId,
			transferKey,
		})

		if (transferKey) {
			this.remoteResourceTransfers.set(transferKey, {
				status: "uploading",
				promise,
			})
			void promise
				.then((result) => {
					this.remoteResourceTransfers.set(transferKey, {
						status: "completed",
						result,
					})
					this.persistCompletedRemoteResourceTransfer(transferKey, result)
				})
				.catch((error) => {
					this.remoteResourceTransfers.set(transferKey, {
						status: "failed",
						error: error instanceof Error ? error : new Error(String(error)),
					})
				})
		}

		this.attachRemoteResourceTransfer({
			elementId,
			metadata,
			batchId,
			historyManager,
			onDownloadFailed,
			promise,
		})
	}

	private getRemoteResourceTransferKey(options: {
		sourceCanvasId?: string
		metadata: CanvasElementClipboardFileMetadata
	}): string | undefined {
		const sourcePath = options.metadata.sourceRef?.src
		const targetCanvasId = this.canvas.id
		if (!targetCanvasId || !options.sourceCanvasId || !sourcePath) {
			return undefined
		}
		// 解决场景：多 tab / 多窗口在同一目标画布反复粘贴，需要跨页面复用已完成的资源迁移结果。
		return `${targetCanvasId}:${options.sourceCanvasId}:${sourcePath}`
	}

	private async createRemoteResourceTransferPromise(options: {
		metadata: CanvasElementClipboardFileMetadata
		sourceUrl: string
		batchId: string
		transferKey?: string
	}): Promise<UploadFileResponse> {
		const { metadata, sourceUrl, batchId, transferKey } = options

		logCanvasElementClipboard("upload-remote-file-element:download-start", {
			sourceElementId: metadata.elementId,
			filename: metadata.filename,
			mimeType: metadata.mimeType,
			sourceRef: metadata.sourceRef,
			transferKey,
			batchId,
		})

		const response = await fetch(sourceUrl, { cache: "default" })
		if (!response.ok) {
			throw new Error(
				`Remote file download failed: ${response.status} ${response.statusText}`,
			)
		}

		const blob = await response.blob()
		const file = new File([blob], metadata.filename, {
			type: blob.type || metadata.mimeType,
		})

		logCanvasElementClipboard("upload-remote-file-element:download-done", {
			sourceElementId: metadata.elementId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			transferKey,
			batchId,
		})

		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			throw new Error("uploadFiles method not available")
		}

		logCanvasElementClipboard("upload-remote-file-element:upload-start", {
			sourceElementId: metadata.elementId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			uploadSubDir: this.getUploadSubDir(file),
			overwrite: this.getUploadFileOverwrite(file, [file]),
			transferKey,
			batchId,
		})

		const uploadResults = await uploadFilesMethod(
			[
				{
					file,
					uploadSubDir: this.getUploadSubDir(file),
					overwrite: this.getUploadFileOverwrite(file, [file]),
					onUploadComplete: () => {},
					onUploadFailed: () => {},
				},
			],
			this.currentReferenceImages,
			{
				showSuccessToast: false,
			},
		)
		if (!uploadResults?.[0]) {
			throw new Error("Upload failed: no result returned")
		}

		const normalizedResult = normalizeUploadFileResponse(uploadResults[0])
		logCanvasElementClipboard("upload-remote-file-element:upload-done", {
			sourceElementId: metadata.elementId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			result: summarizeUploadResult(normalizedResult),
			transferKey,
			batchId,
		})

		return normalizedResult
	}

	private attachRemoteResourceTransfer(options: {
		elementId: string
		metadata: CanvasElementClipboardFileMetadata
		batchId: string
		historyManager: Canvas["historyManager"] | null
		onDownloadFailed?: (error: Error) => void
		promise: Promise<UploadFileResponse>
	}): void {
		const { elementId, metadata, batchId, historyManager, onDownloadFailed, promise } = options

		void promise
			.then((result) => {
				this.applyRemoteUploadResult(elementId, result, batchId, historyManager)
			})
			.catch((error) => {
				const transferError =
					error instanceof Error ? error : new Error("Remote file transfer failed")
				logCanvasElementClipboard("upload-remote-file-element:transfer-failed", {
					elementId,
					sourceElementId: metadata.elementId,
					filename: metadata.filename,
					mimeType: metadata.mimeType,
					message: transferError.message,
					error: transferError,
					sourceRef: metadata.sourceRef,
					batchId,
				})
				const hasChanged = this.handleUploadFailedInternal(elementId, transferError)
				onDownloadFailed?.(transferError)
				if (historyManager && hasChanged) {
					const pendingBatchId = this.findPendingBatchIdByElement(elementId)
					if (pendingBatchId) {
						this.commitPendingUploadBatch(pendingBatchId)
					}
					historyManager.enable()
					historyManager.recordHistoryImmediate()
				} else {
					this.cleanupResolvedPendingBatch(batchId)
				}
			})
	}

	private applyRemoteUploadResult(
		elementId: string,
		result: UploadFileResponse,
		batchId: string,
		historyManager: Canvas["historyManager"] | null,
	): void {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (element instanceof ImageElementClass || element instanceof VideoElementClass) {
			element.uploadResult = result
		}

		logCanvasElementClipboard("upload-remote-file-element:apply-result", {
			elementId,
			result: summarizeUploadResult(result),
			batchId,
		})
		const hasChanged = this.handleUploadCompleteInternal(elementId)
		if (historyManager && hasChanged) {
			const pendingBatchId = this.findPendingBatchIdByElement(elementId)
			if (pendingBatchId) {
				this.commitPendingUploadBatch(pendingBatchId)
			}
			historyManager.enable()
			historyManager.recordHistoryImmediate()
		} else {
			this.cleanupResolvedPendingBatch(batchId)
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

		if (element instanceof ImageElementClass) {
			this.canvas.imageResourceManager.primeCache(uploadResult.path, {
				src: uploadResult.src,
				expires_at: uploadResult.expires_at,
			})
		}

		if (element instanceof VideoElementClass) {
			this.canvas.videoResourceManager.primeCache(uploadResult.path, {
				src: uploadResult.src,
				expires_at: uploadResult.expires_at,
			})
		}

		this.canvas.elementManager.convertToPermament(
			elementId,
			{
				src: uploadResult.path,
				status: GenerationStatus.Completed,
			},
			{ silent: true },
		)

		if (element instanceof ImageElementClass && typeof element.setOssSrc === "function") {
			element.setOssSrc(uploadResult.src)
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

	private cleanupResolvedPendingBatch(batchId: string): void {
		const batch = this.pendingUploadBatches.find((item) => item.id === batchId)
		if (!batch || batch.unresolvedElementIds.size > 0) {
			return
		}
		this.cleanupEmptyPendingBatch(batchId, { force: true })
	}

	private getPersistedCompletedRemoteResourceTransfer(key: string): UploadFileResponse | null {
		const persistedMap = this.readPersistedRemoteResourceTransfers()
		const entry = persistedMap[key]
		if (!entry) {
			return null
		}

		if (Date.now() - entry.updatedAt > REMOTE_RESOURCE_TRANSFER_TTL) {
			delete persistedMap[key]
			this.writePersistedRemoteResourceTransfers(persistedMap)
			return null
		}

		return entry.result
	}

	private persistCompletedRemoteResourceTransfer(key: string, result: UploadFileResponse): void {
		const persistedMap = this.readPersistedRemoteResourceTransfers()
		persistedMap[key] = {
			result,
			updatedAt: Date.now(),
		}
		this.writePersistedRemoteResourceTransfers(persistedMap)
	}

	private readPersistedRemoteResourceTransfers(): Record<
		string,
		PersistedRemoteResourceTransferEntry
	> {
		if (typeof localStorage === "undefined") {
			return {}
		}

		try {
			const rawValue = localStorage.getItem(REMOTE_RESOURCE_TRANSFER_STORAGE_KEY)
			if (!rawValue) {
				return {}
			}

			const parsed: unknown = JSON.parse(rawValue)
			if (!parsed || typeof parsed !== "object") {
				return {}
			}

			return Object.fromEntries(
				Object.entries(parsed).filter(([, value]) => {
					return (
						value &&
						typeof value === "object" &&
						"updatedAt" in value &&
						typeof value.updatedAt === "number" &&
						"result" in value &&
						value.result &&
						typeof value.result === "object" &&
						"path" in value.result &&
						typeof value.result.path === "string"
					)
				}),
			) as Record<string, PersistedRemoteResourceTransferEntry>
		} catch {
			return {}
		}
	}

	private writePersistedRemoteResourceTransfers(
		persistedMap: Record<string, PersistedRemoteResourceTransferEntry>,
	): void {
		if (typeof localStorage === "undefined") {
			return
		}

		const now = Date.now()
		const prunedMap = Object.fromEntries(
			Object.entries(persistedMap).filter(
				([, value]) => now - value.updatedAt <= REMOTE_RESOURCE_TRANSFER_TTL,
			),
		)

		try {
			localStorage.setItem(REMOTE_RESOURCE_TRANSFER_STORAGE_KEY, JSON.stringify(prunedMap))
		} catch {
			// Ignore storage quota or serialization errors so clipboard flow stays functional.
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
