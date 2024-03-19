import { normalizePath } from "./utils"
import { createImageSourceFromBlob, closeImageSource, type ImageSource } from "./imageSourceUtils"
import { parseExpiresAt, isOssExpired } from "./ossExpiryUtils"
import type { Canvas } from "../Canvas"
import { ImageElement } from "../element/elements/ImageElement"
import { ElementTypeEnum } from "../types"
import type { ImageElement as ImageElementData } from "../types"
import type {
	ImageResourceWorkerRequest,
	ImageResourceWorkerResponse,
} from "./imageResource.worker"

export type { ImageSource }

/**
 * 图片信息接口
 */
export interface ImageInfo {
	naturalWidth: number
	naturalHeight: number
	fileSize: number
	mimeType: string
	filename: string
}

/** 缩略图级别 */
export type ThumbnailType = "small"

/** 缩略图数据（异步按需生成，不占用主进程） */
export interface ThumbnailData {
	/** 小图 */
	small: string
}

/**
 * 已加载的图片资源（getResource 的返回类型）
 */
export interface LoadedResource {
	/** OSS 地址，用于 fetch、复制等 */
	ossSrc: string
	/** 加载好的图片对象 */
	image: ImageSource
	/** 图片元信息 */
	imageInfo: ImageInfo
	/** 缩略图（与主图一并加载） */
	thumbnail: ThumbnailData
}

/**
 * 图片资源接口
 */
interface ImageResource {
	/** 加载好的图片对象（优先 ImageBitmap，降级 HTMLImageElement） */
	image: ImageSource
	/** 图片信息 */
	imageInfo: ImageInfo
	/** 缩略图（由 Worker 与主图一并返回） */
	thumbnailData: ThumbnailData
}

/**
 * 资源条目接口（统一管理 src(path) 相关的所有状态）
 */
interface ResourceEntry {
	/** 换取到的 ossSrc（可能为 null，表示换取失败或还未换取） */
	ossSrc: string | null
	/** ossSrc 过期时间戳（毫秒），null 表示永不过期 */
	expiresAt: number | null
	/** 正在换取 ossSrc 的 Promise（避免重复请求） */
	exchangePromise: Promise<string | null> | null
	/** 正在加载图片的 Promise（避免重复请求） */
	loadingPromise: Promise<LoadedResource | null> | null
	/** 已加载的资源（如果已加载完成） */
	resource: ImageResource | null
}

/**
 * 图片资源管理器
 * 负责管理图片资源的完整生命周期：src(path) -> ossSrc -> ImageSource (ImageBitmap | HTMLImageElement)
 * 提供跨元素的资源共享和自动释放功能，优先 ImageBitmap 以降低内存占用
 * 每个 Canvas 实例拥有独立的 ImageResourceManager 实例（一对一关系）
 */
export class ImageResourceManager {
	private canvas: Canvas

	// src(path) -> ResourceEntry 的统一映射缓存
	private entries: Map<string, ResourceEntry> = new Map()

	// Worker 实例（延迟创建）
	private worker: Worker | null = null

	// 请求 ID 到 resolve/reject 的映射
	private pendingRequests = new Map<
		string,
		{
			resolve: (result: ImageResourceWorkerResponse) => void
			reject: (err: Error) => void
		}
	>()

	private requestIdCounter = 0

	// 防抖定时器
	private cleanupTimer: ReturnType<typeof setTimeout> | null = null

	// 防抖延迟时间（毫秒）
	private readonly CLEANUP_DEBOUNCE_DELAY = 100

	// 事件监听器回调（保存引用以便销毁时移除）
	private readonly handleElementDeleted = () => {
		this.scheduleCleanup()
	}

	private readonly handleBatchDeleted = () => {
		this.checkAndCleanupResources()
	}

	private readonly handleReferenceImagesChanged = () => {
		this.scheduleCleanup()
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		// 监听单个元素删除事件，使用防抖避免频繁检查
		this.canvas.eventEmitter.on("element:deleted", this.handleElementDeleted)
		// 监听批量删除完成事件，立即检查（批量删除时不需要防抖）
		this.canvas.eventEmitter.on("element:batchdeleted", this.handleBatchDeleted)
		// 监听参考图增删（编辑器 delete @ 提及等），触发资源回收
		this.canvas.eventEmitter.on("referenceImages:changed", this.handleReferenceImagesChanged)
	}

	/**
	 * 获取或创建 Worker
	 */
	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL("./imageResource.worker.ts", import.meta.url), {
				type: "module",
			})
			this.worker.onmessage = (e: MessageEvent<ImageResourceWorkerResponse>) => {
				const { requestId } = e.data
				const pending = this.pendingRequests.get(requestId)
				if (pending) {
					this.pendingRequests.delete(requestId)
					pending.resolve(e.data)
				}
			}
			this.worker.onerror = (err) => {
				this.pendingRequests.forEach((pending) => {
					pending.reject(new Error(err.message || "Worker error"))
				})
				this.pendingRequests.clear()
			}
		}
		return this.worker
	}

	/**
	 * 向 Worker 发送请求
	 */
	private sendToWorker(
		request: ImageResourceWorkerRequest,
	): Promise<ImageResourceWorkerResponse> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(request.requestId, { resolve, reject })
			this.getWorker().postMessage(request)
		})
	}

	/**
	 * 从 entry 构建 LoadedResource
	 */
	private buildLoadedResource(entry: ResourceEntry): LoadedResource | null {
		if (!entry.ossSrc || !entry.resource) return null
		return {
			ossSrc: entry.ossSrc,
			image: entry.resource.image,
			imageInfo: entry.resource.imageInfo,
			thumbnail: entry.resource.thumbnailData,
		}
	}

	/**
	 * 加载图片（内部方法）
	 * @param path 路径（path）
	 * @returns Promise<LoadedResource | null>
	 */
	private async loadImageInternal(path: string): Promise<LoadedResource | null> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo

		if (!getFileInfo) {
			return null
		}

		// 规范化路径
		const normalizedSrc = normalizePath(path)

		// 获取或创建资源条目
		let entry = this.entries.get(normalizedSrc)
		if (!entry) {
			entry = {
				ossSrc: null,
				expiresAt: null,
				exchangePromise: null,
				loadingPromise: null,
				resource: null,
			}
			this.entries.set(normalizedSrc, entry)
		}

		// 检查 ossSrc 是否过期，过期则清除
		this.clearExpiredOssSrc(entry)

		// 换取 ossSrc
		let ossSrc: string | null = entry.ossSrc
		if (!ossSrc) {
			ossSrc = await this.exchangeOssSrc(path, entry)
			if (!ossSrc) {
				this.canvas.eventEmitter.emit({
					type: "resource:image:load-failed",
					data: { path: normalizedSrc },
				})
				return null
			}
		}

		// 检查缓存
		if (entry.resource) {
			return this.buildLoadedResource(entry)
		}

		// 检查是否正在加载中，避免重复请求
		if (entry.loadingPromise) {
			const result = await entry.loadingPromise
			if (!result) {
				this.canvas.eventEmitter.emit({
					type: "resource:image:load-failed",
					data: { path: normalizedSrc },
				})
			}
			return result
		}

		// 创建新的加载 Promise
		const promise = this.loadImageResource(normalizedSrc, ossSrc, entry)

		// 记录加载中的 Promise
		entry.loadingPromise = promise

		try {
			const result = await promise
			if (!result) {
				this.canvas.eventEmitter.emit({
					type: "resource:image:load-failed",
					data: { path: normalizedSrc },
				})
			}
			return result
		} finally {
			// 加载完成后清除 Promise 缓存
			entry.loadingPromise = null
		}
	}

	/**
	 * 触发资源加载（不等待，通过 resource:image:loaded 事件获取完成通知）
	 * @param path 路径（path）
	 */
	public loadResource(path: string): void {
		this.loadImageInternal(path).catch(() => {
			// 静默吞掉错误，调用方通过事件或 getResource 感知失败
		})
	}

	/**
	 * 获取资源（如未加载则触发加载并等待）
	 * @param path 路径（path）
	 * @returns Promise<LoadedResource | null>
	 */
	public async getResource(path: string): Promise<LoadedResource | null> {
		return this.loadImageInternal(path)
	}

	/**
	 * 清除过期的 ossSrc（保留 resource，仅清除 URL 以便重新换取）
	 */
	private clearExpiredOssSrc(entry: ResourceEntry): void {
		if (entry.ossSrc && isOssExpired(entry.expiresAt)) {
			entry.ossSrc = null
			entry.expiresAt = null
		}
	}

	/**
	 * 换取 ossSrc（内部方法）
	 * @param path 路径（path）
	 * @param entry 资源条目
	 * @returns Promise<string | null> ossSrc 或 null
	 */
	private async exchangeOssSrc(path: string, entry: ResourceEntry): Promise<string | null> {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo

		if (!getFileInfo) {
			return null
		}

		// 检查是否正在换取中，避免重复请求
		if (entry.exchangePromise) {
			return entry.exchangePromise
		}

		// 创建新的换取 Promise
		const promise = (async () => {
			try {
				const fileInfo = await getFileInfo(path)
				if (fileInfo?.src) {
					entry.ossSrc = fileInfo.src
					entry.expiresAt = parseExpiresAt(fileInfo.expires_at)
					return fileInfo.src
				}
				return null
			} catch (error) {
				return null
			}
		})()

		// 记录换取中的 Promise
		entry.exchangePromise = promise

		try {
			const result = await promise
			return result
		} finally {
			// 换取完成后清除 Promise 缓存
			entry.exchangePromise = null
		}
	}

	/**
	 * 加载图片资源（通过 Worker 获取 ImageBitmap 或 Blob）
	 * - 优先：Worker 返回 ImageBitmap，通过 transferable 实现零拷贝传输
	 * - 降级：Worker 返回 Blob，主线程使用 createImageSourceFromBlob 创建 ImageSource（会降级到 HTMLImageElement）
	 * @param path 路径（path，已规范化）
	 * @param ossSrc OSS 路径
	 * @param entry 资源条目
	 */
	private async loadImageResource(
		path: string,
		ossSrc: string,
		entry: ResourceEntry,
	): Promise<LoadedResource | null> {
		const requestId = `img-${++this.requestIdCounter}-${Date.now()}`
		try {
			const result = await this.sendToWorker({
				ossSrc,
				requestId,
			})

			// 403/401 时重新换取 ossSrc 并重试
			if (result?.needsReExchange) {
				entry.ossSrc = null
				entry.expiresAt = null
				const newOssSrc = await this.exchangeOssSrc(path, entry)
				if (newOssSrc) {
					return this.loadImageResource(path, newOssSrc, entry)
				}
				return null
			}

			if (!result?.imageInfo || !result?.thumbnails) {
				return null
			}

			let image: ImageSource | null = null

			if (result.imageSource) {
				// 优先：直接使用从 Worker 传递过来的 ImageBitmap（已通过 transferable 零拷贝传输）
				image = result.imageSource
			} else if (result.blob) {
				// 降级：Worker 不支持 ImageBitmap，返回了 Blob
				// 使用 createImageSourceFromBlob 创建 ImageSource（会优先尝试 ImageBitmap，失败则降级到 HTMLImageElement）
				image = await createImageSourceFromBlob(result.blob)
				if (!image) {
					return null
				}
			} else {
				return null
			}

			const resource: ImageResource = {
				image,
				imageInfo: result.imageInfo,
				thumbnailData: result.thumbnails,
			}
			entry.resource = resource

			const loadedResource: LoadedResource = {
				ossSrc,
				image,
				imageInfo: result.imageInfo,
				thumbnail: result.thumbnails,
			}

			this.canvas.eventEmitter.emit({
				type: "resource:image:loaded",
				data: { path, resource: loadedResource },
			})

			return loadedResource
		} catch (error) {
			return null
		}
	}

	/**
	 * 预填充缓存（用于上传等已有 ossSrc 的场景，避免重复换取）
	 * @param path 路径（path）
	 * @param fileInfo 文件信息
	 */
	public primeCache(path: string, fileInfo: { src: string; expires_at?: string }): void {
		const normalizedSrc = normalizePath(path)
		let entry = this.entries.get(normalizedSrc)
		if (!entry) {
			entry = {
				ossSrc: null,
				expiresAt: null,
				exchangePromise: null,
				loadingPromise: null,
				resource: null,
			}
			this.entries.set(normalizedSrc, entry)
		}
		entry.ossSrc = fileInfo.src
		entry.expiresAt = parseExpiresAt(fileInfo.expires_at)
	}

	/**
	 * 调度资源清理（防抖版本）
	 * 在短时间内多次调用时，只执行最后一次
	 */
	private scheduleCleanup(): void {
		// 清除之前的定时器
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
		}

		// 设置新的定时器
		this.cleanupTimer = setTimeout(() => {
			this.checkAndCleanupResources()
			this.cleanupTimer = null
		}, this.CLEANUP_DEBOUNCE_DELAY)
	}

	/**
	 * 检查并清理未使用的资源
	 * 遍历所有元素，收集所有使用的图片路径，然后检查资源是否仍在使用
	 */
	private checkAndCleanupResources(): void {
		// 清除防抖定时器（如果存在）
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}
		// 获取所有存在的元素
		const elementsDict = this.canvas.elementManager.getElementsDict()

		// 收集所有正在使用的图片路径（包括主图片和参考图）
		const usedPaths = new Set<string>()

		for (const elementData of Object.values(elementsDict)) {
			if (elementData.type === ElementTypeEnum.Image) {
				const imageElement = elementData as ImageElementData

				// 添加主图片路径
				if (imageElement.src) {
					usedPaths.add(normalizePath(imageElement.src))
				}

				// 添加参考图路径
				const elementInstance = this.canvas.elementManager.getElementInstance(
					elementData.id,
				)
				if (elementInstance && elementInstance instanceof ImageElement) {
					const referenceImageInfos = elementInstance.getReferenceImageInfos()
					referenceImageInfos.forEach((info) => {
						usedPaths.add(normalizePath(info.path))
					})
				}
			}
		}

		// 遍历所有资源条目，检查是否仍在使用
		this.entries.forEach((entry, src) => {
			if (!entry.resource) {
				return
			}

			// 如果资源路径不在使用的路径集合中，则释放资源
			if (!usedPaths.has(src)) {
				closeImageSource(entry.resource.image)
				entry.resource = null
				this.canvas.eventEmitter.emit({
					type: "resource:released",
					data: { path: src },
				})
			}
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.pendingRequests.forEach((p) => p.reject(new Error("ImageResourceManager destroyed")))
		this.pendingRequests.clear()
		// 释放所有 ImageBitmap 资源
		this.entries.forEach((entry) => {
			if (entry.resource) {
				closeImageSource(entry.resource.image)
			}
		})
		this.entries.clear()
		if (this.worker) {
			this.worker.terminate()
			this.worker = null
		}
		this.canvas.eventEmitter.off("element:deleted", this.handleElementDeleted)
		this.canvas.eventEmitter.off("element:batchdeleted", this.handleBatchDeleted)
		this.canvas.eventEmitter.off("referenceImages:changed", this.handleReferenceImagesChanged)
	}
}
