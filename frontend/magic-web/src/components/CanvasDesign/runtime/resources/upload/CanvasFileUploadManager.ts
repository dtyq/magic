import type { Canvas } from "../../core/Canvas"
import {
	GenerationStatus,
	UploadSubDir,
	type UploadFileResponse,
	type UploadFile,
	type UploadSubDirType,
} from "../../../public/magic-types"
import {
	ElementTypeEnum,
	type AudioElement as AudioElementData,
	type CanvasFileElement,
	type ImageElement as ImageElementData,
	type MediaElementType,
	type VideoElement as VideoElementData,
} from "../../document/types"
import { ElementFactory } from "../../elements/core/ElementFactory"
import {
	generateElementId,
	getMediaDimensions,
	isImageFile,
	isVideoFile,
	isAudioFile,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	validateFile,
} from "../../shared/ids"
import {
	getCanvasHostResourceReferenceIdentity,
	isRemoteOrSpecialPath,
	normalizeCanvasUploadFileResponsePath,
	resolveCanvasStorageResourceReference,
} from "../../shared/path/canvasResourcePath"
import {
	getActiveContent,
	getContentById,
	isImageElementContent,
	updateContent,
	updateImageContent,
} from "../../document/elementContent"
import {
	buildMediaSourceReplacementPatch,
	finalizeMediaSourceReplacement,
	isMediaSourceChanged,
} from "../../document/mediaSourceReplacement"
import { ImageElement as ImageElementClass } from "../../elements/image/ImageElement"
import { VideoElement as VideoElementClass } from "../../elements/video/VideoElement"
import { AudioElement as AudioElementClass } from "../../elements/audio/AudioElement"
import { AUDIO_CONFIG } from "../../elements/audio/AudioElement.config"
import {
	isDefaultClipboardFilenameFile,
	type CanvasElementClipboardFileMetadata,
} from "../clipboard/CanvasElementClipboard"

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
	/** 文件字节上传完成回调（早于保存与元素后处理） */
	onUploadSettled?: () => void
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
	/** 已预先读取的媒体尺寸，批量粘贴时用于避免重复解码文件元数据 */
	dimensions?: { width: number; height: number }
	/** 文件位置（文件中心对齐到该位置） */
	position: { x: number; y: number }
	/** 可选的元素初始数据（用于复制粘贴时保留元素属性） */
	elementData?: Partial<ImageElementData> | Partial<VideoElementData> | Partial<AudioElementData>
	/** 是否管理历史记录（默认 true，在批量操作时应设为 false） */
	manageHistory?: boolean
	/** 上传完成回调（用于外部同步真实上传进度） */
	onUploadComplete?: (elementId: string, result: UploadFileResponse) => void
	/** 上传失败回调（用于外部同步真实上传进度） */
	onUploadFailed?: (elementId: string, error: Error) => void
	/** 文件字节上传完成回调（早于保存与元素后处理） */
	onUploadSettled?: () => void
}

export interface ReplaceAudioElementOptions {
	elementId: string
	file: File
	contentId?: string | null
	onUploadComplete?: () => void
}

export interface ReplaceVideoElementOptions {
	elementId: string
	file: File
	contentId?: string | null
	onUploadComplete?: () => void
}

export interface ReplaceImageElementOptions {
	elementId: string
	file: File
	contentId: string | null
	onUploadComplete?: () => void
}

export interface ReplaceImageElementFromProjectOptions {
	elementId: string
	path: string
	contentId: string | null
}

export interface ReplaceAudioElementFromProjectOptions {
	elementId: string
	path: string
	contentId?: string | null
}

export interface ReplaceVideoElementFromProjectOptions {
	elementId: string
	path: string
	contentId?: string | null
}

export interface ReplaceMediaElementOptions {
	elementId: string
	mediaType: MediaElementType
	file: File
	contentId: string | null
	onUploadComplete?: () => void
}

export interface ReplaceMediaElementFromProjectOptions {
	elementId: string
	mediaType: MediaElementType
	path: string
	contentId: string | null
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
	elementType: ImageElementData["type"] | VideoElementData["type"] | AudioElementData["type"]
	/** 文件位置（文件中心对齐到该位置） */
	position: { x: number; y: number }
	/** 可选的元素初始数据（用于复制粘贴时保留元素属性） */
	elementData?: Partial<ImageElementData> | Partial<VideoElementData> | Partial<AudioElementData>
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

type RemoteResourceTransferPhase = "download" | "upload"

class RemoteResourceTransferError extends Error {
	public readonly phase: RemoteResourceTransferPhase

	constructor(phase: RemoteResourceTransferPhase, message: string) {
		super(message)
		this.name = "RemoteResourceTransferError"
		this.phase = phase
	}
}

const REMOTE_RESOURCE_TRANSFER_STORAGE_KEY = "canvas-design:remote-resource-transfers:v1"
const REMOTE_RESOURCE_TRANSFER_TTL = 7 * 24 * 60 * 60 * 1000

function isRemoteResourceDownloadError(error: Error): boolean {
	return error instanceof RemoteResourceTransferError && error.phase === "download"
}

function getTransferErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback
}

function getFileContentSignature(file: File): string {
	return `${file.type}:${file.size}:${file.lastModified}`
}

function createUploadElementData(
	elementType: ImageElementData["type"] | VideoElementData["type"] | AudioElementData["type"],
	elementId: string,
	position: { x: number; y: number },
	size: { width: number; height: number },
	zIndex: number,
	name: string | undefined,
	elementData:
		| Partial<ImageElementData>
		| Partial<VideoElementData>
		| Partial<AudioElementData>
		| undefined,
	contentPatch: Record<string, unknown>,
): ImageElementData | VideoElementData | AudioElementData {
	const base = ElementFactory.createElementData(
		elementType,
		elementId,
		position.x,
		position.y,
		size.width,
		size.height,
		zIndex,
	) as ImageElementData | VideoElementData | AudioElementData
	const {
		contents: _contents,
		activeContentId: _activeContentId,
		mainContentId: _mainContentId,
		src: _src,
		status: _status,
		errorMessage: _errorMessage,
		...elementProps
	} = (elementData ?? {}) as Record<string, unknown>
	const merged = {
		...base,
		...elementProps,
		id: elementId,
		type: elementType,
		...(name !== undefined ? { name } : {}),
	} as typeof base
	return updateContent(
		merged as never,
		merged.activeContentId ?? undefined,
		contentPatch as never,
	) as typeof base
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

	/** 上传完成但宿主附件快照尚未确认的资源路径。 */
	private pendingResourcePaths = new Set<string>()

	/**
	 * 目标画布级远程资源迁移缓存。
	 *
	 * 解决场景：A 画布复制媒体元素，在 B 画布反复 Ctrl+V。
	 * 第一次粘贴负责下载+上传；上传中再次粘贴复用同一个 Promise；完成后再次粘贴直接复用 B 画布资源。
	 */
	private readonly remoteResourceTransfers = new Map<string, RemoteResourceTransfer>()

	/** 跨画布粘贴时，生成请求里的隐藏参考资源正在后台迁移；此期间资源预览应保持 loading，不触发 not-found toast */
	private readonly pendingRemoteResourceLoadDeferrals = new Map<string, number>()

	/** 临时元素删除监听（用于同步移除待完成上传） */
	private readonly handleTemporaryDeleted = (event: { data: { elementId: string } }) => {
		this.unregisterPendingUploadElement(event.data.elementId)
	}

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		this.canvas.eventEmitter.on("element:temporary:deleted", this.handleTemporaryDeleted)
	}

	/** Document replacement is a write boundary even when invoked outside ElementTool. */
	private canWriteDocument(): boolean {
		return this.canvas.permissionManager?.can?.("document.write") ?? true
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

	public getRemoteResourceLoadDeferralKey(path?: string | null): string | null {
		const rawPath = path?.trim()
		if (!rawPath || isRemoteOrSpecialPath(rawPath)) return null
		return getCanvasHostResourceReferenceIdentity(this.canvas, rawPath)
	}

	public shouldDeferRemoteResourceLoad(path: string): boolean {
		const key = this.getRemoteResourceLoadDeferralKey(path)
		return !!key && (this.pendingRemoteResourceLoadDeferrals.get(key) ?? 0) > 0
	}

	public registerPendingRemoteResourceLoadDeferral(path: string): () => void {
		const key = this.getRemoteResourceLoadDeferralKey(path)
		if (!key) {
			return () => undefined
		}

		const currentCount = this.pendingRemoteResourceLoadDeferrals.get(key) ?? 0
		this.pendingRemoteResourceLoadDeferrals.set(key, currentCount + 1)
		let released = false
		return () => {
			if (released) {
				return
			}
			released = true

			const nextCount = (this.pendingRemoteResourceLoadDeferrals.get(key) ?? 0) - 1
			if (nextCount > 0) {
				this.pendingRemoteResourceLoadDeferrals.set(key, nextCount)
				return
			}

			this.pendingRemoteResourceLoadDeferrals.delete(key)
			this.canvas.eventEmitter.emit({
				type: "resource:remote-load-deferral-released",
				data: { path, key },
			})
		}
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

	public async getReusableCompletedRemoteResourceTransfer(options: {
		sourceCanvasId?: string
		metadata: CanvasElementClipboardFileMetadata
		allowFileInfoFallback?: boolean
	}): Promise<UploadFileResponse | null> {
		const key = this.getRemoteResourceTransferKey(options)
		if (!key) {
			return null
		}

		const completedTransfer = this.getCompletedRemoteResourceTransfer(options)
		if (!completedTransfer) {
			return null
		}
		const isUsable = await this.isCompletedRemoteResourceTransferUsable(completedTransfer, {
			allowFileInfoFallback: options.allowFileInfoFallback ?? true,
		})
		if (isUsable) {
			return completedTransfer
		}

		this.forgetCompletedRemoteResourceTransfer(key)
		return null
	}

	public async transferRemoteResource(options: {
		sourceCanvasId?: string
		metadata: CanvasElementClipboardFileMetadata
		onDownloadFailed?: (error: Error) => void
	}): Promise<UploadFileResponse | null> {
		const { sourceCanvasId, metadata, onDownloadFailed } = options
		const sourceRef = metadata.sourceRef
		const batchId = this.currentPendingBatchId ?? "direct-remote-transfer"

		if (!sourceRef?.ossUrl) {
			return null
		}

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			return null
		}

		const completedTransfer = await this.getReusableCompletedRemoteResourceTransfer({
			sourceCanvasId,
			metadata,
			allowFileInfoFallback: metadata.role !== "generation-resource",
		})
		if (completedTransfer) {
			return completedTransfer
		}

		const transferKey = this.getRemoteResourceTransferKey({ sourceCanvasId, metadata })
		const existingTransfer = transferKey
			? this.remoteResourceTransfers.get(transferKey)
			: undefined

		let transferPromise: Promise<UploadFileResponse>
		if (existingTransfer?.status === "uploading") {
			transferPromise = existingTransfer.promise
		} else {
			if (existingTransfer?.status === "failed" && transferKey) {
				this.remoteResourceTransfers.delete(transferKey)
			}

			transferPromise = this.createRemoteResourceTransferPromise({
				metadata,
				sourceUrl: sourceRef.ossUrl,
				batchId,
				transferKey,
			})

			if (transferKey) {
				this.remoteResourceTransfers.set(transferKey, {
					status: "uploading",
					promise: transferPromise,
				})
				void transferPromise
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
		}

		try {
			const result = await transferPromise
			return result
		} catch (error) {
			const transferError =
				error instanceof Error ? error : new Error("Remote file transfer failed")
			if (isRemoteResourceDownloadError(transferError)) {
				onDownloadFailed?.(transferError)
			}
			return null
		}
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
			onUploadProgress?: (progress: number, index: number) => void
		},
		options?: { overwrite?: boolean; uploadSubDir?: UploadSubDirType },
	): Promise<UploadFileResponse[]> {
		// 检查是否有 uploadFiles 方法
		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			throw new Error("uploadFiles method not available")
		}

		// 准备上传文件列表，为每个文件提供回调
		const uploadFiles: UploadFile[] = files.map((file, index) => ({
			file,
			uploadSubDir: options?.uploadSubDir ?? this.getUploadSubDir(file),
			overwrite: options?.overwrite ?? this.getUploadFileOverwrite(file, files),
			onUploadStart: () => callbacks?.onUploadProgress?.(0, index),
			onUploadProgress: (progress) => callbacks?.onUploadProgress?.(progress, index),
			onUploadComplete: (result) => {
				const normalizedResult = normalizeCanvasUploadFileResponsePath(result)
				this.registerPendingResourcePath(normalizedResult.path)
				callbacks?.onUploadComplete?.(normalizedResult, index)
			},
			onUploadFailed: (error) => {
				callbacks?.onUploadFailed?.(error, index)
			},
		}))
		uploadFiles.forEach((uploadFile) => uploadFile.onUploadStart?.())

		// 直接上传
		const uploadResults = await uploadFilesMethod(uploadFiles, referenceImages)

		if (!uploadResults || uploadResults.length === 0) {
			throw new Error("Upload failed: no result returned")
		}

		return uploadResults.map((result) => {
			const normalizedResult = normalizeCanvasUploadFileResponsePath(result)
			// 宿主可以只返回结果而不触发单文件回调；两条成功路径都必须进入 pending 集合。
			this.registerPendingResourcePath(normalizedResult.path)
			return normalizedResult
		})
	}

	/**
	 * 上传回调可能早于宿主附件树刷新；在这段窗口内，mention 不能把旧快照的 not-found 当成删除。
	 */
	public isPendingResourcePath(path: string | undefined): boolean {
		if (!path || this.pendingResourcePaths.size === 0) return false

		const identity = getCanvasHostResourceReferenceIdentity(this.canvas, path)
		return Array.from(this.pendingResourcePaths).some(
			(pendingPath) =>
				pendingPath === path ||
				getCanvasHostResourceReferenceIdentity(this.canvas, pendingPath) === identity,
		)
	}

	/** 在 resolver 快照变化后确认已进入附件树的上传资源。 */
	public reconcilePendingResourcePaths(changedWorkspacePaths?: readonly string[]): void {
		if (this.pendingResourcePaths.size === 0) return
		const resolver = this.canvas.magicConfigManager.config?.methods?.resolveResourceReference
		if (!resolver) return

		const changedIdentities =
			changedWorkspacePaths === undefined || changedWorkspacePaths.length === 0
				? undefined
				: new Set(
						changedWorkspacePaths.map((path) =>
							getCanvasHostResourceReferenceIdentity(this.canvas, path),
						),
					)
		const resolvedPaths: string[] = []

		for (const pendingPath of this.pendingResourcePaths) {
			const resolution = resolveCanvasStorageResourceReference(pendingPath, resolver, {
				requireAttachment: true,
			})
			if (resolution.status !== "resolved") continue
			if (changedIdentities && !changedIdentities.has(resolution.identity)) continue
			this.pendingResourcePaths.delete(pendingPath)
			resolvedPaths.push(pendingPath)
		}

		if (resolvedPaths.length > 0) {
			this.canvas.eventEmitter.emit({
				type: "upload:resource-pending-change",
				data: { paths: resolvedPaths },
			})
		}
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
					overwrite: this.getUploadFileOverwrite(file, [file]),
					onUploadComplete: (result) => {
						const normalizedResult = normalizeCanvasUploadFileResponsePath(result)
						onUploadComplete(normalizedResult)
					},
					onUploadFailed: (error) => {
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
			const settledRequests = new Set<UploadRequest>()
			const progressedRequests = new Set<UploadRequest>()
			const settleUploadComplete = (
				request: UploadRequest,
				result: UploadFileResponse,
			): void => {
				if (settledRequests.has(request)) return
				settledRequests.add(request)
				request.onUploadComplete(result)
			}
			const settleUploadFailed = (request: UploadRequest, error: Error): void => {
				if (settledRequests.has(request)) return
				settledRequests.add(request)
				request.onUploadFailed(error)
			}
			const settleUploadProgress = (request: UploadRequest, progress: number): void => {
				if (progress < 100 || progressedRequests.has(request)) return
				progressedRequests.add(request)
				request.onUploadSettled?.()
			}

			// 检查是否有 uploadFiles 方法
			const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
			if (!uploadFilesMethod) {
				const error = new Error("uploadFiles method not available")
				// 所有请求都标记为失败
				for (const request of requests) {
					settleUploadFailed(request, error)
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
					const normalizedResult = normalizeCanvasUploadFileResponsePath(result)
					settleUploadComplete(req, normalizedResult)
				},
				onUploadFailed: (error) => {
					settleUploadFailed(req, error)
				},
				onUploadProgress: (progress) => {
					settleUploadProgress(req, progress)
				},
			}))

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
					settleUploadFailed(request, new Error(errorMessage))
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
		const {
			file,
			position,
			elementData,
			manageHistory = true,
			onUploadComplete,
			onUploadFailed,
			onUploadSettled,
		} = options

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			return null
		}
		if (isAudioFile(file)) {
			return this.uploadAudioElementWithPlaceholder(options)
		}

		const historyManager = manageHistory ? this.canvas.historyManager : null

		try {
			const dimensions = options.dimensions ?? (await getMediaDimensions(file))
			const targetX = position.x - dimensions.width / 2
			const targetY = position.y - dimensions.height / 2
			const baseName = file.name.replace(/\.[^/.]+$/, "")
			const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
			const elementId = generateElementId()
			const isVideo = isVideoFile(file)
			const batchId = this.currentPendingBatchId ?? this.beginPendingUploadBatch()

			const canvasFileElement = createUploadElementData(
				isVideo ? ElementTypeEnum.Video : ElementTypeEnum.Image,
				elementId,
				{ x: targetX, y: targetY },
				{ width: dimensions.width, height: dimensions.height },
				maxZIndex + 1,
				baseName,
				elementData,
				{ status: GenerationStatus.Processing },
			)
			const targetContentId = canvasFileElement.activeContentId

			historyManager?.disable()
			try {
				this.canvas.elementManager.createTemporary(canvasFileElement, {
					uploadFiles: [file],
					onUploadComplete: (elementId) => {
						const element = this.canvas.elementManager.getElementInstance(elementId)
						const uploadResult =
							element instanceof ImageElementClass ||
							element instanceof VideoElementClass
								? element.uploadResult
								: undefined
						const hasChanged = this.handleUploadCompleteInternal(
							elementId,
							targetContentId,
						)
						if (uploadResult) {
							onUploadComplete?.(elementId, uploadResult)
						}
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
						const hasChanged = this.handleUploadFailedInternal(
							elementId,
							error,
							targetContentId,
						)
						onUploadFailed?.(elementId, error)
						if (historyManager && hasChanged) {
							const pendingBatchId = this.findPendingBatchIdByElement(elementId)
							if (pendingBatchId) {
								this.commitPendingUploadBatch(pendingBatchId)
							}
							historyManager.enable()
							historyManager.recordHistoryImmediate()
						}
					},
					onUploadSettled,
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

	public async replaceImageElement(options: ReplaceImageElementOptions): Promise<boolean> {
		if (!this.canWriteDocument()) return false
		const validation = validateFile(options.file)
		if (!validation.valid || !isImageFile(options.file)) {
			throw new Error(
				validation.error ||
					(this.canvas.t?.("image.replaceUnsupported", "不支持的图片格式") ??
						"不支持的图片格式"),
			)
		}

		const target = this.getReplaceableImageTarget(options.elementId, options.contentId)
		if (!target) return false
		const [uploadResult] = await this.uploadDirect([options.file])
		if (!uploadResult) throw new Error("Upload failed: no result returned")
		if (!this.canWriteDocument()) return false

		this.canvas.imageResourceManager.primeCache(uploadResult.path, uploadResult)
		options.onUploadComplete?.()
		const success = this.applyImageElementSourceReplacement(
			options.elementId,
			uploadResult.path,
			target.contentId,
		)
		if (success && uploadResult.src) {
			const element = this.canvas.elementManager.getElementInstance(options.elementId)
			if (
				element instanceof ImageElementClass &&
				this.isImageReplacementTargetActive(element, target.contentId)
			) {
				element.setOssSrc(uploadResult.src)
			}
		}
		return success
	}

	public replaceImageElementFromProject(options: ReplaceImageElementFromProjectOptions): boolean {
		if (!this.canWriteDocument()) return false
		const lowerPath = options.path.toLowerCase().split(/[?#]/, 1)[0] ?? ""
		if (!SUPPORTED_IMAGE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
			throw new Error(
				this.canvas.t?.("image.replaceUnsupported", "不支持的图片格式") ??
					"不支持的图片格式",
			)
		}
		return this.applyImageElementSourceReplacement(
			options.elementId,
			options.path,
			options.contentId,
		)
	}

	private getReplaceableImageTarget(
		elementId: string,
		targetContentId: string | null,
	): { element: ImageElementClass; contentId: string } | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!(element instanceof ImageElementClass)) return null
		const data = element.getData()
		const contentId = targetContentId ?? data.activeContentId
		if (!contentId) return null
		const content = element.getContentData(contentId)
		if (!content) return null
		const status = content.status
		if (status === GenerationStatus.Pending || status === GenerationStatus.Processing)
			return null
		return { element, contentId }
	}

	private applyImageElementSourceReplacement(
		elementId: string,
		nextPath: string,
		targetContentId: string | null,
	): boolean {
		if (!this.canWriteDocument()) return false
		const target = this.getReplaceableImageTarget(elementId, targetContentId)
		if (!target) return false

		const previousContent = target.element.getContentData(target.contentId)
		const historyManager = this.canvas.historyManager
		let updated = false
		historyManager.disable()
		try {
			// 替换属于当前查看/编辑 Content；保留 Content 指针、其他 Content 和生成配置，只重置新资源不再适用的裁剪与错误态。
			const patch = buildMediaSourceReplacementPatch(previousContent?.src, nextPath, {
				status: GenerationStatus.Completed,
				errorMessage: undefined,
				crop: undefined,
			})
			updated = target.element.updateContentData(target.contentId, patch, { silent: false })
		} finally {
			historyManager.enable()
		}
		if (!updated) return false

		finalizeMediaSourceReplacement(this.canvas, {
			previousSrc: previousContent?.src,
			nextSrc: nextPath,
			previousComplianceCheckId: previousContent?.complianceCheckId,
			previousAssetId: previousContent?.assetId,
		})

		// Marker 坐标绑定旧图片内容；仅在 src 成功写入后清理目标 Content，失败时保持原状。
		this.canvas.markerManager.removeMarkersByImageContent(elementId, target.contentId)
		historyManager.recordHistoryImmediate()
		if (this.isImageReplacementTargetActive(target.element, target.contentId)) {
			this.canvas.visibilityManager.requestImmediateImageLoad(elementId, {
				reason: "image-replaced",
				priority: "critical",
			})
		}
		return true
	}

	private isImageReplacementTargetActive(
		element: ImageElementClass,
		targetContentId: string,
	): boolean {
		const data = element.getData()
		return isImageElementContent(data) && data.activeContentId === targetContentId
	}

	/** 统一媒体替换入口，避免工具栏按媒体类型分叉上传流程。 */
	public replaceMediaElement(options: ReplaceMediaElementOptions): Promise<boolean> {
		switch (options.mediaType) {
			case ElementTypeEnum.Image:
				return this.replaceImageElement(options)
			case ElementTypeEnum.Video:
				return this.replaceVideoElement(options)
			case ElementTypeEnum.Audio:
				return this.replaceAudioElement(options)
		}
	}

	/** 统一项目文件替换入口，供来源菜单复用。 */
	public replaceMediaElementFromProject(options: ReplaceMediaElementFromProjectOptions): boolean {
		switch (options.mediaType) {
			case ElementTypeEnum.Image:
				return this.replaceImageElementFromProject(options)
			case ElementTypeEnum.Video:
				return this.replaceVideoElementFromProject(options)
			case ElementTypeEnum.Audio:
				return this.replaceAudioElementFromProject(options)
		}
	}

	public async replaceAudioElement(options: ReplaceAudioElementOptions): Promise<boolean> {
		if (!this.canWriteDocument()) return false
		const validation = validateFile(options.file)
		if (!validation.valid || !isAudioFile(options.file)) {
			throw new Error(
				validation.error ||
					(this.canvas.t?.("audio.replaceUnsupported", "不支持的音频格式") ??
						"不支持的音频格式"),
			)
		}

		const target = this.getReplaceableMediaTarget(
			options.elementId,
			ElementTypeEnum.Audio,
			options.contentId ?? null,
		)
		if (!target) return false
		const [uploadResult] = await this.uploadDirect([options.file])
		if (!uploadResult) throw new Error("Upload failed: no result returned")
		if (!this.canWriteDocument()) return false

		this.canvas.audioResourceManager.primeCache(uploadResult.path, uploadResult)
		options.onUploadComplete?.()
		return this.applyAudioElementSourceReplacement(
			options.elementId,
			uploadResult.path,
			target.contentId,
		)
	}

	public replaceAudioElementFromProject(options: ReplaceAudioElementFromProjectOptions): boolean {
		if (!this.canWriteDocument()) return false
		const lowerPath = options.path.toLowerCase().split(/[?#]/, 1)[0] ?? ""
		if (!SUPPORTED_AUDIO_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
			throw new Error(
				this.canvas.t?.("audio.replaceUnsupported", "不支持的音频格式") ??
					"不支持的音频格式",
			)
		}
		return this.applyAudioElementSourceReplacement(
			options.elementId,
			options.path,
			options.contentId ?? null,
		)
	}

	public async replaceVideoElement(options: ReplaceVideoElementOptions): Promise<boolean> {
		if (!this.canWriteDocument()) return false
		const validation = validateFile(options.file)
		if (!validation.valid || !isVideoFile(options.file)) {
			throw new Error(
				validation.error ||
					(this.canvas.t?.("video.replaceUnsupported", "不支持的视频格式") ??
						"不支持的视频格式"),
			)
		}

		const target = this.getReplaceableMediaTarget(
			options.elementId,
			ElementTypeEnum.Video,
			options.contentId ?? null,
		)
		if (!target) return false
		const [uploadResult] = await this.uploadDirect([options.file])
		if (!uploadResult) throw new Error("Upload failed: no result returned")
		if (!this.canWriteDocument()) return false

		this.canvas.videoResourceManager.primeCache(uploadResult.path, uploadResult)
		options.onUploadComplete?.()
		return this.applyVideoElementSourceReplacement(
			options.elementId,
			uploadResult.path,
			target.contentId,
		)
	}

	public replaceVideoElementFromProject(options: ReplaceVideoElementFromProjectOptions): boolean {
		if (!this.canWriteDocument()) return false
		const lowerPath = options.path.toLowerCase().split(/[?#]/, 1)[0] ?? ""
		if (!SUPPORTED_VIDEO_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
			throw new Error(
				this.canvas.t?.("video.replaceUnsupported", "不支持的视频格式") ??
					"不支持的视频格式",
			)
		}
		return this.applyVideoElementSourceReplacement(
			options.elementId,
			options.path,
			options.contentId ?? null,
		)
	}

	private applyAudioElementSourceReplacement(
		elementId: string,
		nextPath: string,
		targetContentId: string | null,
	): boolean {
		if (!this.canWriteDocument()) return false
		const target = this.getReplaceableMediaTarget(
			elementId,
			ElementTypeEnum.Audio,
			targetContentId,
		)
		if (!target) return false

		const previousPath = target.previousPath
		if (previousPath && target.isActive) {
			if (
				this.canvas.audioResourceManager.getResourceIdentity(previousPath) ===
				this.canvas.audioResourceManager.getResourceIdentity(nextPath)
			) {
				this.canvas.audioResourceManager.invalidateForReplacement(previousPath)
			} else {
				this.canvas.audioPlaybackManager.release(elementId)
				this.canvas.audioWaveformManager.invalidatePath(previousPath)
				this.canvas.visibilityManager.invalidateAudioLoadRequest(
					previousPath,
					"audio-replaced",
					{ scheduleRefresh: false },
				)
			}
		}

		const previousContent = getContentById(target.data, target.contentId)
		const historyManager = this.canvas.historyManager
		historyManager.disable()
		try {
			// 音频 Content 只有 src/assetId 两个字段，不能写入图片/视频专用的合规字段，
			// 否则 v3 校验会因多余字段拒绝整条元素数据。
			const patch = isMediaSourceChanged(previousContent?.src, nextPath)
				? { src: nextPath, assetId: undefined }
				: {}
			const next = updateContent(
				target.data as never,
				target.contentId,
				patch as never,
			) as CanvasFileElement
			if (next === target.data) return false
			// 直接提交完整 contents，确保异步替换仍写入点击时捕获的 Content。
			this.canvas.elementManager.update(
				elementId,
				{ contents: next.contents },
				{ silent: false },
			)
		} finally {
			historyManager.enable()
		}
		historyManager.recordHistoryImmediate()
		return true
	}

	private applyVideoElementSourceReplacement(
		elementId: string,
		nextPath: string,
		targetContentId: string | null,
	): boolean {
		if (!this.canWriteDocument()) return false
		const target = this.getReplaceableMediaTarget(
			elementId,
			ElementTypeEnum.Video,
			targetContentId,
		)
		if (!target) return false

		const previousContent = getContentById(target.data, target.contentId)
		const historyManager = this.canvas.historyManager
		historyManager.disable()
		try {
			const next = updateContent(
				target.data as never,
				target.contentId,
				buildMediaSourceReplacementPatch(previousContent?.src, nextPath, {
					status: GenerationStatus.Completed,
					errorMessage: undefined,
				}) as never,
			) as CanvasFileElement
			if (next === target.data) return false
			this.canvas.elementManager.update(
				elementId,
				{ contents: next.contents },
				{ silent: false },
			)
		} finally {
			historyManager.enable()
		}
		finalizeMediaSourceReplacement(this.canvas, {
			previousSrc: previousContent?.src,
			nextSrc: nextPath,
			previousComplianceCheckId:
				typeof previousContent?.complianceCheckId === "string"
					? previousContent.complianceCheckId
					: undefined,
			previousAssetId:
				typeof previousContent?.assetId === "string" ? previousContent.assetId : undefined,
		})
		historyManager.recordHistoryImmediate()
		return true
	}

	private getReplaceableMediaTarget(
		elementId: string,
		mediaType: MediaElementType,
		targetContentId: string | null,
	): {
		data: CanvasFileElement
		contentId: string
		isActive: boolean
		previousPath?: string
	} | null {
		const data = this.canvas.elementManager.getElementData(elementId)
		if (
			!data ||
			(data.type !== ElementTypeEnum.Image &&
				data.type !== ElementTypeEnum.Video &&
				data.type !== ElementTypeEnum.Audio) ||
			data.type !== mediaType
		) {
			return null
		}

		const contentId = targetContentId ?? getActiveContent(data)?.contentId
		if (!contentId) return null
		const content = getContentById(data, contentId)
		if (!content) return null
		const status = "status" in content ? content.status : undefined
		if (status === GenerationStatus.Pending || status === GenerationStatus.Processing) {
			return null
		}

		return {
			data,
			contentId,
			isActive: getActiveContent(data)?.contentId === contentId,
			previousPath:
				"src" in content && typeof content.src === "string" ? content.src : undefined,
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

		if (!sourceRef?.ossUrl) {
			return null
		}

		if (!this.canvas.magicConfigManager.config?.methods?.uploadFiles) {
			return null
		}
		if (elementType === ElementTypeEnum.Audio) {
			return this.uploadRemoteAudioElementAfterSuccess(options)
		}

		const historyManager = manageHistory ? this.canvas.historyManager : null
		const transferKey = this.getRemoteResourceTransferKey({ sourceCanvasId, metadata })
		const width = elementData?.width ?? 100
		const height = elementData?.height ?? 100
		const targetX = elementData?.x ?? position.x - width / 2
		const targetY = elementData?.y ?? position.y - height / 2
		const baseName = metadata.filename.replace(/\.[^/.]+$/, "")
		const maxZIndex = this.canvas.elementManager.getMaxZIndexInLevel()
		const elementId = generateElementId()
		const batchId = this.currentPendingBatchId ?? this.beginPendingUploadBatch()

		const canvasFileElement = createUploadElementData(
			elementType,
			elementId,
			{ x: targetX, y: targetY },
			{ width, height },
			maxZIndex + 1,
			baseName,
			elementData,
			{ status: GenerationStatus.Processing },
		)
		const targetContentId = canvasFileElement.activeContentId

		historyManager?.disable()
		try {
			this.canvas.elementManager.createTemporary(canvasFileElement, {
				uploadFiles: [],
				onUploadComplete: (elementId) => {
					const hasChanged = this.handleUploadCompleteInternal(elementId, targetContentId)
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
					const hasChanged = this.handleUploadFailedInternal(
						elementId,
						error,
						targetContentId,
					)
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
		} finally {
			historyManager?.enable()
			if (!this.currentPendingBatchId) {
				this.cleanupEmptyPendingBatch(batchId)
			}
		}

		void this.downloadAndQueueRemoteUpload({
			elementId,
			contentId: targetContentId,
			metadata,
			sourceUrl: sourceRef.ossUrl,
			batchId,
			historyManager,
			onDownloadFailed,
			transferKey,
		})

		return elementId
	}

	private uploadAudioElementWithPlaceholder(options: UploadFileElementOptions): string | null {
		const {
			file,
			position,
			elementData,
			manageHistory = true,
			onUploadComplete,
			onUploadFailed,
			onUploadSettled,
		} = options
		const elementId = generateElementId()
		const width = Math.max(
			(elementData as Partial<AudioElementData> | undefined)?.width ??
				AUDIO_CONFIG.DEFAULT_WIDTH,
			AUDIO_CONFIG.MIN_WIDTH,
		)
		const temporaryElement = createUploadElementData(
			ElementTypeEnum.Audio,
			elementId,
			{ x: position.x - width / 2, y: position.y - AUDIO_CONFIG.DEFAULT_HEIGHT / 2 },
			{ width, height: AUDIO_CONFIG.DEFAULT_HEIGHT },
			this.canvas.elementManager.getMaxZIndexInLevel() + 1,
			undefined,
			elementData,
			{ src: undefined },
		) as AudioElementData
		const targetContentId = temporaryElement.activeContentId
		const historyManager = manageHistory ? this.canvas.historyManager : null
		const batchId = this.currentPendingBatchId ?? this.beginPendingUploadBatch()
		const removePlaceholderWithoutHistory = (targetElementId: string): void => {
			if (!this.canvas.elementManager.hasElement(targetElementId)) return
			historyManager?.disable()
			try {
				this.canvas.elementManager.delete(targetElementId)
			} finally {
				historyManager?.enable()
			}
		}
		const handleUploadComplete = (
			completedElementId: string,
			uploadResult: UploadFileResponse,
		): void => {
			if (
				!this.canvas.elementManager.hasElement(completedElementId) ||
				!this.canvas.elementManager.isTemporary(completedElementId)
			) {
				return
			}

			try {
				this.canvas.audioResourceManager.primeCache(uploadResult.path, uploadResult)
				const latest = this.canvas.elementManager.getElementData(completedElementId)
				if (!latest || latest.type !== ElementTypeEnum.Audio || !targetContentId) {
					throw new Error("Audio Content target not found")
				}
				const next = updateContent(latest, targetContentId, { src: uploadResult.path })
				this.canvas.elementManager.convertToPermament(
					completedElementId,
					{
						contents: next.contents,
						activeContentId: next.activeContentId,
						mainContentId: next.mainContentId,
					},
					{ silent: true },
				)
				this.markPendingUploadElementResolved(completedElementId)
			} catch (error) {
				removePlaceholderWithoutHistory(completedElementId)
				onUploadFailed?.(
					completedElementId,
					error instanceof Error ? error : new Error(String(error)),
				)
				return
			}

			if (historyManager) {
				const pendingBatchId = this.findPendingBatchIdByElement(completedElementId)
				if (pendingBatchId) {
					this.commitPendingUploadBatch(pendingBatchId)
				}
				historyManager.recordHistoryImmediate()
			} else {
				this.cleanupResolvedPendingBatch(batchId)
			}
			onUploadComplete?.(completedElementId, uploadResult)
		}
		const handleUploadFailed = (failedElementId: string, error: Error): void => {
			if (!this.canvas.elementManager.hasElement(failedElementId)) return
			removePlaceholderWithoutHistory(failedElementId)
			onUploadFailed?.(failedElementId, error)
		}

		try {
			historyManager?.disable()
			this.canvas.elementManager.createTemporary(temporaryElement, {
				uploadFiles: [file],
				onUploadComplete: handleUploadComplete,
				onUploadFailed: handleUploadFailed,
				onUploadSettled,
			})
			this.registerPendingUploadElement(batchId, elementId)
		} catch (error) {
			removePlaceholderWithoutHistory(elementId)
			return null
		} finally {
			historyManager?.enable()
			if (!this.currentPendingBatchId) {
				this.cleanupEmptyPendingBatch(batchId)
			}
		}

		return elementId
	}

	private async uploadRemoteAudioElementAfterSuccess(
		options: UploadRemoteFileElementOptions,
	): Promise<string | null> {
		const {
			metadata,
			sourceCanvasId,
			position,
			elementData,
			manageHistory = true,
			onDownloadFailed,
		} = options
		try {
			const uploadResult = await this.transferRemoteResource({ sourceCanvasId, metadata })
			if (!uploadResult) return null

			const audioData = elementData as Partial<AudioElementData> | undefined
			const width = Math.max(
				audioData?.width ?? AUDIO_CONFIG.DEFAULT_WIDTH,
				AUDIO_CONFIG.MIN_WIDTH,
			)
			const elementId = generateElementId()
			const finalElement = createUploadElementData(
				ElementTypeEnum.Audio,
				elementId,
				{
					x: audioData?.x ?? position.x - width / 2,
					y: audioData?.y ?? position.y - AUDIO_CONFIG.DEFAULT_HEIGHT / 2,
				},
				{ width, height: AUDIO_CONFIG.DEFAULT_HEIGHT },
				this.canvas.elementManager.getMaxZIndexInLevel() + 1,
				undefined,
				audioData,
				{ src: uploadResult.path },
			) as AudioElementData
			this.canvas.audioResourceManager.primeCache(uploadResult.path, uploadResult)
			this.canvas.elementManager.create(finalElement)
			if (manageHistory) this.canvas.historyManager.recordHistoryImmediate()
			return elementId
		} catch (error) {
			const transferError = error instanceof Error ? error : new Error(String(error))
			if (isRemoteResourceDownloadError(transferError)) onDownloadFailed?.(transferError)
			return null
		}
	}

	private async downloadAndQueueRemoteUpload(options: {
		elementId: string
		contentId: string | null
		metadata: CanvasElementClipboardFileMetadata
		sourceUrl: string
		batchId: string
		historyManager: Canvas["historyManager"] | null
		onDownloadFailed?: (error: Error) => void
		transferKey?: string
	}): Promise<void> {
		const {
			elementId,
			contentId,
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
			this.applyRemoteUploadResult(
				elementId,
				contentId,
				existingTransfer.result,
				batchId,
				historyManager,
			)
			return
		}

		if (existingTransfer?.status === "uploading") {
			this.attachRemoteResourceTransfer({
				elementId,
				contentId,
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
			contentId,
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
		const sourceResourceKey =
			options.metadata.resourceIdentity || options.metadata.sourceRef?.src
		const targetCanvasId = this.canvas.id
		if (!targetCanvasId || !options.sourceCanvasId || !sourceResourceKey) {
			return undefined
		}
		// 解决场景：多 tab / 多窗口在同一目标画布反复粘贴，需要跨页面复用已完成的资源迁移结果。
		// 源画布 identity 是权威身份，可让 `./images/x` 与 `/画布A/images/x`
		// 在 element-media / generation-resource 之间共用同一次迁移；旧剪贴板数据则回退到原路径。
		return `${targetCanvasId}:${options.sourceCanvasId}:${sourceResourceKey}`
	}

	private async isCompletedRemoteResourceTransferUsable(
		result: UploadFileResponse,
		options: { allowFileInfoFallback: boolean },
	): Promise<boolean> {
		if (!options.allowFileInfoFallback) {
			return true
		}

		const getFileResourceMeta =
			this.canvas.magicConfigManager.config?.methods?.getFileResourceMeta
		if (getFileResourceMeta) {
			try {
				const resourceMeta = await getFileResourceMeta(result.path, {
					useImageProcess: false,
				})
				return resourceMeta.status === "exists"
			} catch {
				return false
			}
		}

		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			return true
		}

		try {
			const fileInfo = await getFileInfo(result.path, {
				useImageProcess: false,
				forceRefresh: true,
			})
			return Boolean(fileInfo?.src)
		} catch {
			return false
		}
	}

	private async createRemoteResourceTransferPromise(options: {
		metadata: CanvasElementClipboardFileMetadata
		sourceUrl: string
		batchId: string
		transferKey?: string
	}): Promise<UploadFileResponse> {
		const { metadata, sourceUrl } = options

		let blob: Blob
		try {
			const response = await fetch(sourceUrl, { cache: "default" })
			if (!response.ok) {
				throw new RemoteResourceTransferError(
					"download",
					`Remote file download failed: ${response.status} ${response.statusText}`,
				)
			}
			blob = await response.blob()
		} catch (error) {
			if (error instanceof RemoteResourceTransferError) {
				throw error
			}
			throw new RemoteResourceTransferError(
				"download",
				getTransferErrorMessage(error, "Remote file download failed"),
			)
		}

		const file = new File([blob], metadata.filename, {
			type: blob.type || metadata.mimeType,
		})

		const uploadFilesMethod = this.canvas.magicConfigManager.config?.methods?.uploadFiles
		if (!uploadFilesMethod) {
			throw new Error("uploadFiles method not available")
		}

		let uploadResults: UploadFileResponse[]
		try {
			uploadResults = await uploadFilesMethod(
				[
					{
						file,
						uploadSubDir: this.getUploadSubDir(file),
						overwrite: this.getUploadFileOverwrite(file, [file]),
						onUploadComplete: () => undefined,
						onUploadFailed: () => undefined,
					},
				],
				this.currentReferenceImages,
				{
					showSuccessToast: false,
				},
			)
		} catch (error) {
			throw new RemoteResourceTransferError(
				"upload",
				getTransferErrorMessage(error, "Remote file upload failed"),
			)
		}
		if (!uploadResults?.[0]) {
			throw new RemoteResourceTransferError("upload", "Upload failed: no result returned")
		}

		const normalizedResult = normalizeCanvasUploadFileResponsePath(uploadResults[0])

		return normalizedResult
	}

	private attachRemoteResourceTransfer(options: {
		elementId: string
		contentId: string | null
		metadata: CanvasElementClipboardFileMetadata
		batchId: string
		historyManager: Canvas["historyManager"] | null
		onDownloadFailed?: (error: Error) => void
		promise: Promise<UploadFileResponse>
	}): void {
		const { elementId, contentId, batchId, historyManager, onDownloadFailed, promise } = options

		void promise
			.then((result) => {
				this.applyRemoteUploadResult(elementId, contentId, result, batchId, historyManager)
			})
			.catch((error) => {
				const transferError =
					error instanceof Error ? error : new Error("Remote file transfer failed")
				const hasChanged = this.handleUploadFailedInternal(
					elementId,
					transferError,
					contentId,
				)
				if (isRemoteResourceDownloadError(transferError)) {
					onDownloadFailed?.(transferError)
				}
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
		contentId: string | null,
		result: UploadFileResponse,
		batchId: string,
		historyManager: Canvas["historyManager"] | null,
	): void {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (element instanceof ImageElementClass || element instanceof VideoElementClass) {
			element.uploadResult = result
		}

		const hasChanged = this.handleUploadCompleteInternal(elementId, contentId)
		if (historyManager && hasChanged) {
			const pendingBatchId = this.findPendingBatchIdByElement(elementId)
			if (pendingBatchId) {
				this.commitPendingUploadBatch(pendingBatchId)
			}
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
	private handleUploadCompleteInternal(
		elementId: string,
		targetContentId: string | null,
	): boolean {
		// 获取元素实例，从中提取 uploadResult
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return false

		const uploadResult =
			element instanceof ImageElementClass || element instanceof VideoElementClass
				? element.uploadResult
				: undefined
		if (!uploadResult) return false

		if (element instanceof ImageElementClass) {
			this.canvas.imageResourceManager.primeCache(uploadResult.path, uploadResult)
		}

		if (element instanceof VideoElementClass) {
			this.canvas.videoResourceManager.primeCache(uploadResult.path, uploadResult)
		}

		const uploadPatch = {
			src: uploadResult.path,
			status: GenerationStatus.Completed,
		}
		if (element instanceof ImageElementClass && isImageElementContent(element.getData())) {
			const data = element.getData()
			if (!targetContentId) return false
			const next = updateImageContent(data, targetContentId, uploadPatch)
			if (!isImageElementContent(next)) return false
			this.canvas.elementManager.convertToPermament(
				elementId,
				{
					contents: next.contents,
					activeContentId: next.activeContentId,
					mainContentId: next.mainContentId,
				},
				{ silent: true },
			)
		} else if (element instanceof VideoElementClass || element instanceof AudioElementClass) {
			const data = element.getData()
			if (!targetContentId) return false
			const next = updateContent(data, targetContentId, uploadPatch)
			this.canvas.elementManager.convertToPermament(
				elementId,
				{
					contents: next.contents,
					activeContentId: next.activeContentId,
					mainContentId: next.mainContentId,
				},
				{ silent: true },
			)
		} else {
			this.canvas.elementManager.convertToPermament(elementId, uploadPatch, { silent: true })
		}

		const latest = this.canvas.elementManager.getElementData(elementId)
		if (
			element instanceof ImageElementClass &&
			targetContentId &&
			latest?.type === ElementTypeEnum.Image &&
			latest.activeContentId === targetContentId &&
			typeof element.setOssSrc === "function"
		) {
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
	private handleUploadFailedInternal(
		elementId: string,
		error: Error,
		targetContentId: string | null,
	): boolean {
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
		const instance = this.canvas.elementManager.getElementInstance(elementId)
		const patch = { status: GenerationStatus.Failed, errorMessage }
		if (
			(instance instanceof ImageElementClass ||
				instance instanceof VideoElementClass ||
				instance instanceof AudioElementClass) &&
			targetContentId
		) {
			const data = instance.getData()
			const next = updateContent(data, targetContentId, patch)
			this.canvas.elementManager.update(
				elementId,
				{
					contents: next.contents,
					activeContentId: next.activeContentId,
					mainContentId: next.mainContentId,
				},
				{ silent: true },
			)
		} else {
			return false
		}

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

	private forgetCompletedRemoteResourceTransfer(key: string): void {
		this.remoteResourceTransfers.delete(key)

		const persistedMap = this.readPersistedRemoteResourceTransfers()
		if (!persistedMap[key]) {
			return
		}

		delete persistedMap[key]
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
	 * 标记一个已写入目标画布、但附件快照尚未确认的资源。
	 * 除直接上传外，跨画布服务端复制也会经历这一窗口。
	 */
	public registerPendingResourcePath(path: string): void {
		if (!path || this.pendingResourcePaths.has(path)) return
		this.pendingResourcePaths.add(path)
		this.canvas.eventEmitter.emit({
			type: "upload:resource-pending-change",
			data: { paths: [path] },
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.canvas.eventEmitter.off("element:temporary:deleted", this.handleTemporaryDeleted)
		this.pendingUploadBatches = []
		this.currentPendingBatchId = null
		this.pendingResourcePaths.clear()
	}
}
