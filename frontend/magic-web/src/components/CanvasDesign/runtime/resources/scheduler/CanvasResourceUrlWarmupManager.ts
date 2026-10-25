import type { Canvas } from "../../core/Canvas"
import { type CanvasDocument, ElementTypeEnum, type LayerElement } from "../../document/types"
import { getActiveContent, getActiveImageContent } from "../../document/elementContent"
import { parseExpiresAt, isOssExpired } from "../offline-cache/ossExpiryUtils"
import {
	getCanvasHostResourceReferenceIdentity,
	isAssetResourcePath,
	isRemoteOrSpecialPath,
	parseAssetResourcePath,
	type CanvasResourceReferenceResolverChangeOptions,
} from "../../shared/path/canvasResourcePath"
import { CanvasAssetResourceError } from "../asset/CanvasAssetResourceManager"
import {
	getFailureReasonFromGetFileInfoError,
	type ResourceLoadFailureReason,
} from "../media-common/resourceLoadFailure"
import type { CanvasResourceTaskPriority } from "./CanvasResourceScheduler"

type WarmupMediaType = "image" | "video"
type WarmupStatus = "idle" | "queued" | "warming" | "ready" | "failed"

interface WarmupResourceRef {
	elementId: string
	path: string
	mediaType: WarmupMediaType
}

interface WarmupEntry {
	key: string
	path: string
	mediaType: WarmupMediaType
	status: WarmupStatus
	lastReason: string
	lastError?: string
	warmedAt?: number
	expiresAt?: string
	resourceVersion?: string
	failedAt?: number
	retryAfterAt?: number
	priority: CanvasResourceTaskPriority
}

export interface CanvasResourceUrlWarmupSnapshot {
	destroyed: boolean
	registeredElementCount: number
	trackedPathCount: number
	queuedCount: number
	warmingCount: number
	readyCount: number
	failedCount: number
	enqueueCount: number
	skippedCount: number
	successCount: number
	failedRequestCount: number
	batchRunCount: number
	lastBatchSize: number
	lastBatchDurationMs: number
	lastBatchPriority: CanvasResourceTaskPriority | null
	lastBatchPiggybackCount: number
	piggybackCount: number
}

const URL_WARMUP_DISPATCH_DELAY_MS = 80
// 这里只限制逻辑 path admission；真正的 get-file-url 仍由宿主 coordinator 按 100 file_id 分块。
// 避免 URL manager 和 API coordinator 双重 100 分批，导致后续资源必须等待前一批完成才入队。
const URL_WARMUP_BATCH_SIZE = 500
const URL_WARMUP_FAILED_RETRY_DELAY_MS = 30 * 1000

function now(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error
		? error.name === "AbortError"
		: typeof error === "object" &&
				error !== null &&
				"name" in error &&
				(error as { name?: unknown }).name === "AbortError"
}

function createAbortError(): Error {
	const error = new Error("Canvas resource URL warmup aborted")
	error.name = "AbortError"
	return error
}

function getPriorityRank(priority: CanvasResourceTaskPriority): number {
	switch (priority) {
		case "critical":
			return 0
		case "visible":
			return 1
		case "near":
			return 2
		case "background":
		default:
			return 3
	}
}

function hasChildren(
	element: LayerElement,
): element is LayerElement & { children: LayerElement[] } {
	return "children" in element && Array.isArray((element as { children?: unknown }).children)
}

export class CanvasResourceUrlWarmupManager {
	private readonly canvas: Canvas
	private readonly entries = new Map<string, WarmupEntry>()
	private readonly queuedKeys = new Set<string>()
	private readonly warmingKeys = new Set<string>()
	private readonly elementPathKeys = new Map<string, Set<string>>()
	private readonly pathRefCounts = new Map<string, number>()
	private readonly unsubscribers: Array<() => void> = []
	private timerId: ReturnType<typeof setTimeout> | null = null
	private warmupAbortController = new AbortController()
	private resolverGeneration = 0
	private destroyed = false
	private statsSnapshot: CanvasResourceUrlWarmupSnapshot = {
		destroyed: false,
		registeredElementCount: 0,
		trackedPathCount: 0,
		queuedCount: 0,
		warmingCount: 0,
		readyCount: 0,
		failedCount: 0,
		enqueueCount: 0,
		skippedCount: 0,
		successCount: 0,
		failedRequestCount: 0,
		batchRunCount: 0,
		lastBatchSize: 0,
		lastBatchDurationMs: 0,
		lastBatchPriority: null,
		lastBatchPiggybackCount: 0,
		piggybackCount: 0,
	}

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.unsubscribers.push(
			this.canvas.eventEmitter.on("element:created", ({ data }) => {
				this.warmupElementById(data.elementId, "element:created")
			}),
			this.canvas.eventEmitter.on("element:updated", ({ data }) => {
				this.registerElement(data.data, "element:updated", "background")
			}),
			this.canvas.eventEmitter.on("element:rerendered", ({ data }) => {
				this.registerElement(data.data, "element:rerendered", "background")
			}),
			this.canvas.eventEmitter.on("element:batchupdated", () => {
				this.warmupCurrentDocument("element:batchupdated")
			}),
			this.canvas.eventEmitter.on("element:temporary:converted", ({ data }) => {
				this.warmupElementById(data.elementId, "element:temporary:converted")
			}),
			this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
				this.unregisterElement(data.elementId)
			}),
			this.canvas.eventEmitter.on("element:batchdeleted", ({ data }) => {
				data.elementIds.forEach((elementId) => this.unregisterElement(elementId))
			}),
		)
	}

	public warmupDocument(doc: CanvasDocument, reason: string): void {
		if (this.destroyed) return
		// DSL 到达后立即建立全量 URL inventory；视口只负责后续提升优先级。
		this.registerElements(doc.elements ?? [], reason, undefined, "background")
		this.refreshSnapshotCounts()
	}

	public warmupCurrentDocument(reason: string): void {
		if (this.destroyed) return
		Object.values(this.canvas.elementManager.getElementsDict()).forEach((element) => {
			this.registerElement(element, reason, "background", false)
		})
		this.refreshSnapshotCounts()
	}

	public getSnapshot(): CanvasResourceUrlWarmupSnapshot {
		this.refreshSnapshotCounts()
		return { ...this.statsSnapshot }
	}

	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (this.destroyed) return
		if (options?.changedResourceIdentities) {
			let affected = false
			this.entries.forEach((entry) => {
				const identity = entry.key.split("\0").slice(1).join("\0")
				if (!options.changedResourceIdentities?.has(identity)) return
				affected = true
				if (entry.status === "warming") return
				this.queuedKeys.delete(entry.key)
				entry.status = "idle"
				entry.lastError = undefined
				entry.failedAt = undefined
				entry.retryAfterAt = undefined
				this.enqueue(entry, "resource-reference-resolver-changed", entry.priority)
			})
			if (affected) this.refreshSnapshotCounts()
			return
		}
		this.resolverGeneration += 1
		this.warmupAbortController.abort()
		this.warmupAbortController = new AbortController()
		if (this.timerId !== null) {
			clearTimeout(this.timerId)
			this.timerId = null
		}
		this.queuedKeys.clear()
		this.warmingKeys.clear()
		this.elementPathKeys.clear()
		this.pathRefCounts.clear()
		this.entries.clear()
		this.warmupCurrentDocument("resource-reference-resolver-changed")
	}

	public destroy(): void {
		this.destroyed = true
		this.resolverGeneration += 1
		this.warmupAbortController.abort()
		if (this.timerId !== null) {
			clearTimeout(this.timerId)
			this.timerId = null
		}
		this.unsubscribers.forEach((unsubscribe) => unsubscribe())
		this.unsubscribers.length = 0
		this.queuedKeys.clear()
		this.warmingKeys.clear()
		this.elementPathKeys.clear()
		this.pathRefCounts.clear()
		this.entries.clear()
		this.refreshSnapshotCounts()
	}

	private warmupElementById(elementId: string, reason: string): void {
		const element = this.canvas.elementManager.getElementData(elementId)
		if (!element) {
			this.unregisterElement(elementId)
			return
		}
		this.registerElement(element, reason, "background")
	}

	private registerElements(
		elements: LayerElement[],
		reason: string,
		priorities?: Map<string, CanvasResourceTaskPriority>,
		defaultPriority?: CanvasResourceTaskPriority,
	): void {
		elements.forEach((element) => {
			this.registerElement(
				element,
				reason,
				priorities?.get(element.id) ?? defaultPriority,
				false,
			)
			if (hasChildren(element)) {
				this.registerElements(element.children, reason, priorities, defaultPriority)
			}
		})
	}

	private registerElement(
		element: LayerElement,
		reason: string,
		priority?: CanvasResourceTaskPriority,
		refreshSnapshot = true,
	): Set<string> {
		if (this.destroyed) return new Set()
		const refs = this.collectResourceRefs(element)
		const nextKeys = new Set<string>()

		refs.forEach((ref) => {
			const entry = this.getOrCreateEntry(ref, reason)
			if (!entry) return
			nextKeys.add(entry.key)
			if (!this.elementPathKeys.get(ref.elementId)?.has(entry.key)) {
				this.incrementPathRefCount(entry.key)
			}
			if (priority) {
				this.enqueue(entry, reason, priority)
			}
		})

		this.replaceElementPathKeys(element.id, nextKeys)
		if (refreshSnapshot) this.refreshSnapshotCounts()
		return nextKeys
	}

	private unregisterElement(elementId: string): void {
		const previousKeys = this.elementPathKeys.get(elementId)
		if (!previousKeys) return
		previousKeys.forEach((key) => this.decrementPathRefCount(key))
		this.elementPathKeys.delete(elementId)
		this.refreshSnapshotCounts()
	}

	private replaceElementPathKeys(elementId: string, nextKeys: Set<string>): void {
		const previousKeys = this.elementPathKeys.get(elementId) ?? new Set<string>()
		previousKeys.forEach((key) => {
			if (!nextKeys.has(key)) {
				this.decrementPathRefCount(key)
			}
		})
		if (nextKeys.size > 0) {
			this.elementPathKeys.set(elementId, nextKeys)
		} else {
			this.elementPathKeys.delete(elementId)
		}
	}

	private incrementPathRefCount(key: string): void {
		this.pathRefCounts.set(key, (this.pathRefCounts.get(key) ?? 0) + 1)
	}

	private decrementPathRefCount(key: string): void {
		const next = (this.pathRefCounts.get(key) ?? 0) - 1
		if (next > 0) {
			this.pathRefCounts.set(key, next)
		} else {
			this.pathRefCounts.delete(key)
			this.queuedKeys.delete(key)
			const entry = this.entries.get(key)
			if (entry?.status !== "warming") {
				this.entries.delete(key)
			}
		}
	}

	private collectResourceRefs(element: LayerElement): WarmupResourceRef[] {
		const refs: WarmupResourceRef[] = []
		const effectiveContent = this.canvas.getEffectiveContent(element.id) as
			{ src?: string } | undefined
		// warmupDocument runs before ElementManager has loaded the document, so the
		// input snapshot is the only available source during initial registration.
		const imageSrc =
			effectiveContent?.src ??
			(element.type === ElementTypeEnum.Image
				? getActiveImageContent(element).src
				: undefined)
		if (element.type === ElementTypeEnum.Image && imageSrc) {
			refs.push({
				elementId: element.id,
				path: imageSrc,
				mediaType: "image",
			})
		}
		if (element.type === ElementTypeEnum.Video) {
			const videoSrc = effectiveContent?.src ?? getActiveContent(element)?.src
			if (!videoSrc) return refs
			refs.push({
				elementId: element.id,
				path: videoSrc,
				mediaType: "video",
			})
		}
		return refs
	}

	private getOrCreateEntry(ref: WarmupResourceRef, reason: string): WarmupEntry | null {
		const path = ref.path.trim()
		if (!path || (isRemoteOrSpecialPath(path) && !isAssetResourcePath(path))) {
			this.statsSnapshot.skippedCount += 1
			return null
		}

		const key = `${ref.mediaType}\0${getCanvasHostResourceReferenceIdentity(this.canvas, path)}`
		let entry = this.entries.get(key)
		if (!entry) {
			entry = {
				key,
				path,
				mediaType: ref.mediaType,
				status: "idle",
				lastReason: reason,
				priority: "background",
			}
			this.entries.set(key, entry)
		} else {
			entry.path = entry.path || path
			entry.lastReason = reason
		}
		return entry
	}

	private enqueue(
		entry: WarmupEntry,
		reason: string,
		priority: CanvasResourceTaskPriority,
	): void {
		if (this.destroyed) return
		if (entry.status === "warming") return
		if (entry.status === "ready" && !this.isReadyEntryExpired(entry)) return
		if (entry.status === "failed" && !this.canRetryFailedEntry(entry)) return
		if (getPriorityRank(priority) < getPriorityRank(entry.priority)) {
			entry.priority = priority
		}
		if (!this.queuedKeys.has(entry.key)) {
			this.queuedKeys.add(entry.key)
			entry.status = "queued"
			entry.lastReason = reason
			entry.lastError = undefined
			entry.failedAt = undefined
			entry.retryAfterAt = undefined
			this.statsSnapshot.enqueueCount += 1
		}
		this.scheduleDispatch()
	}

	private isReadyEntryExpired(entry: WarmupEntry): boolean {
		return isOssExpired(parseExpiresAt(entry.expiresAt))
	}

	private canRetryFailedEntry(entry: WarmupEntry): boolean {
		return entry.retryAfterAt === undefined || Date.now() >= entry.retryAfterAt
	}

	private scheduleDispatch(): void {
		if (this.destroyed || this.timerId !== null) return
		this.timerId = setTimeout(() => {
			this.timerId = null
			void this.dispatchNextBatch()
		}, URL_WARMUP_DISPATCH_DELAY_MS)
	}

	private async dispatchNextBatch(): Promise<void> {
		if (this.destroyed) return
		const resolverGeneration = this.resolverGeneration
		const signal = this.warmupAbortController.signal
		const batchKeys = [...this.queuedKeys]
			.sort((leftKey, rightKey) => {
				const left = this.entries.get(leftKey)
				const right = this.entries.get(rightKey)
				return (
					getPriorityRank(left?.priority ?? "background") -
					getPriorityRank(right?.priority ?? "background")
				)
			})
			.slice(0, URL_WARMUP_BATCH_SIZE)
		batchKeys.forEach((key) => {
			this.queuedKeys.delete(key)
			this.warmingKeys.add(key)
			const entry = this.entries.get(key)
			if (entry) entry.status = "warming"
		})
		if (batchKeys.length === 0) return

		const startedAt = now()
		this.statsSnapshot.batchRunCount += 1
		this.statsSnapshot.lastBatchSize = batchKeys.length
		const batchPriority = this.getHighestPriority(batchKeys)
		const batchPiggybackCount = batchKeys.reduce((count, key) => {
			const entry = this.entries.get(key)
			return entry && getPriorityRank(entry.priority) > getPriorityRank(batchPriority)
				? count + 1
				: count
		}, 0)
		this.statsSnapshot.lastBatchPriority = batchPriority
		this.statsSnapshot.lastBatchPiggybackCount = batchPiggybackCount
		this.statsSnapshot.piggybackCount += batchPiggybackCount
		this.refreshSnapshotCounts()

		// URL 换链是 metadata 网络等待，不应占用 body fetch / decode 的全局资源槽。
		// warmupEntry 共用 manager 生命周期 signal，可在销毁时停止等待。
		await Promise.allSettled(
			batchKeys.map((key) => {
				const entry = this.entries.get(key)
				return entry
					? this.warmupEntry(entry, signal, resolverGeneration)
					: Promise.resolve()
			}),
		)
		if (resolverGeneration !== this.resolverGeneration) return

		this.statsSnapshot.lastBatchDurationMs = now() - startedAt
		this.refreshSnapshotCounts()
		if (this.queuedKeys.size > 0) {
			this.scheduleDispatch()
		}
	}

	private getHighestPriority(keys: string[]): CanvasResourceTaskPriority {
		let highestPriority: CanvasResourceTaskPriority = "background"
		keys.forEach((key) => {
			const entry = this.entries.get(key)
			if (!entry) return
			if (getPriorityRank(entry.priority) < getPriorityRank(highestPriority)) {
				highestPriority = entry.priority
			}
		})
		return highestPriority
	}

	private async warmupEntry(
		entry: WarmupEntry,
		signal: AbortSignal,
		resolverGeneration: number,
	): Promise<void> {
		if (resolverGeneration !== this.resolverGeneration) return
		if (signal.aborted || !this.pathRefCounts.has(entry.key)) {
			this.warmingKeys.delete(entry.key)
			if (!this.pathRefCounts.has(entry.key)) this.entries.delete(entry.key)
			return
		}
		try {
			const assetId = parseAssetResourcePath(entry.path)
			if (assetId !== undefined) {
				const assetInfo = await this.awaitWithAbortSignal(
					this.canvas.assetResourceManager.getResource(assetId, {
						priority: entry.priority,
					}),
					signal,
				)
				if (resolverGeneration !== this.resolverGeneration) return
				if (this.destroyed || signal.aborted || !this.pathRefCounts.has(entry.key)) {
					this.warmingKeys.delete(entry.key)
					if (!this.pathRefCounts.has(entry.key)) this.entries.delete(entry.key)
					return
				}
				this.warmingKeys.delete(entry.key)
				if (!assetInfo.fileUrl) {
					this.markFailed(entry, "asset file URL unavailable", "not-found")
					return
				}
				if (assetInfo.mediaType !== entry.mediaType) {
					this.markFailed(entry, "asset media type mismatch", "load-error")
					return
				}
				this.markReady(entry)
				return
			}

			const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
			if (!getFileInfo) {
				this.markFailed(entry, "getFileInfo unavailable", "load-error")
				return
			}

			const fileInfo = await this.awaitWithAbortSignal(
				getFileInfo(entry.path, {
					useImageProcess: entry.mediaType === "image",
					forceRefresh: false,
					priority: entry.priority,
				}),
				signal,
			)
			if (resolverGeneration !== this.resolverGeneration) return
			if (this.destroyed || signal.aborted || !this.pathRefCounts.has(entry.key)) {
				this.warmingKeys.delete(entry.key)
				if (!this.pathRefCounts.has(entry.key)) this.entries.delete(entry.key)
				return
			}
			this.warmingKeys.delete(entry.key)
			if (!fileInfo?.src) {
				this.markFailed(entry, "empty fileInfo src", "load-error")
				return
			}
			this.markReady(entry, fileInfo.expires_at, fileInfo.resource_version)
		} catch (error) {
			if (resolverGeneration !== this.resolverGeneration) return
			if (isAbortError(error)) {
				this.warmingKeys.delete(entry.key)
				return
			}
			if (this.destroyed) return
			this.statsSnapshot.failedRequestCount += 1
			this.markFailed(
				entry,
				getErrorMessage(error),
				error instanceof CanvasAssetResourceError
					? error.reason
					: getFailureReasonFromGetFileInfoError(error),
			)
		}
	}

	private markReady(entry: WarmupEntry, expiresAt?: string, resourceVersion?: string): void {
		entry.status = "ready"
		entry.lastError = undefined
		entry.failedAt = undefined
		entry.retryAfterAt = undefined
		entry.warmedAt = Date.now()
		entry.expiresAt = expiresAt
		entry.resourceVersion = resourceVersion
		this.statsSnapshot.successCount += 1
	}

	private markFailed(
		entry: WarmupEntry,
		errorMessage: string,
		reason: ResourceLoadFailureReason,
	): void {
		this.warmingKeys.delete(entry.key)
		entry.status = "failed"
		entry.lastError = errorMessage
		entry.failedAt = Date.now()
		entry.retryAfterAt = entry.failedAt + URL_WARMUP_FAILED_RETRY_DELAY_MS
		// warmup 是后台优化，瞬时网络错误不应提前把尚未进入视口的元素切到错误态。
		// 只有附件快照已确认不存在时，才向图片资源层传播失败。
		if (entry.mediaType === "image" && reason === "not-found") {
			this.canvas.imageResourceManager?.markResourceLoadFailed(entry.path, reason)
		}
	}

	private awaitWithAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
		if (signal.aborted) return Promise.reject(createAbortError())
		return new Promise<T>((resolve, reject) => {
			const abort = () => {
				signal.removeEventListener("abort", abort)
				reject(createAbortError())
			}
			signal.addEventListener("abort", abort, { once: true })
			promise.then(
				(value) => {
					signal.removeEventListener("abort", abort)
					resolve(value)
				},
				(error) => {
					signal.removeEventListener("abort", abort)
					reject(error)
				},
			)
		})
	}

	private refreshSnapshotCounts(): void {
		let readyCount = 0
		let failedCount = 0
		this.entries.forEach((entry) => {
			if (entry.status === "ready") readyCount += 1
			if (entry.status === "failed") failedCount += 1
		})
		this.statsSnapshot = {
			...this.statsSnapshot,
			destroyed: this.destroyed,
			registeredElementCount: this.elementPathKeys.size,
			trackedPathCount: this.pathRefCounts.size,
			queuedCount: this.queuedKeys.size,
			warmingCount: this.warmingKeys.size,
			readyCount,
			failedCount,
		}
	}
}
