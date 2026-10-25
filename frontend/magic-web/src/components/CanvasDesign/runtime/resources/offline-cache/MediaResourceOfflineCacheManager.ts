import {
	normalizePathSeparators,
	resolveCanvasStorageResourceReference,
	isAssetResourcePath,
} from "../../shared/path/canvasResourcePath"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import {
	CANVAS_MEDIA_CACHE_NAME,
	CANVAS_MEDIA_DB_NAME,
	CANVAS_MEDIA_MAX_ENTRIES,
	CANVAS_MEDIA_MAX_IDLE_AGE_MS,
	CANVAS_MEDIA_MAX_METADATA_BYTES,
	CANVAS_MEDIA_OFFLINE_CACHE_VERSION,
	getCacheKey,
	encodeResourcePathForUrl,
	normalizeResourceNamespaceForStorage,
	normalizeResourcePathForLookup,
	normalizeResourcePathForStorage,
} from "@/workers/service-worker/canvasMediaShared"
import { isAppServiceWorkerFeatureEnabled } from "@/workers/service-worker/register"

/**
 * 画布媒体离线缓存（主线程 IndexedDB + 主 SW Canvas 虚拟资源通道）。
 *
 * 与 SW 配合时的根因备忘：
 * - 虚拟 URL 的每个路径段必须单独编码；SW 从 pathname 解码一次后，再与主线程使用相同的存储路径规范化。
 * - `resolveResourceUrl` / `rememberResolvedResource` / `ensureServiceWorker` 使用 `isOfflineCacheFeatureOn`，
 *   勿仅用 `isEnabled()`（后者含 `isActiveConsumer`），否则 Canvas 销毁后仍在飞行的换链会退回 OSS 直链。
 */

export type MediaResourceOfflineCacheMediaType = "image" | "video" | "audio"

export interface MediaResourceOfflineCacheOptions {
	/** 离线缓存总容量上限，默认 1GB */
	maxBytes?: number
}

export type MediaResourceOfflineCacheConfig = boolean | MediaResourceOfflineCacheOptions | undefined

/** 与 {@link Canvas} 构造时注入的宿主能力对齐，用于离线缓存条目的 path 与换链层一致 */
export interface MediaResourceOfflineCacheManagerOptions {
	/** 将 Canvas storage path 解析为宿主工作区路径，作为跨刷新稳定的离线缓存键。 */
	getResolveResourceReference?: () => ResolveCanvasResourceReference | undefined
	/** 获取宿主注入的虚拟媒体资源 scope，用于隔离工作区/项目上下文 */
	getVirtualResourceScope?: () => string | undefined
}

export interface CachedMediaResource {
	/** 设计项目级命名空间，用于隔离同路径资源 */
	namespace: string
	path: string
	/** Canvas 渲染层使用的同源虚拟 URL */
	url: string
	/** 真实 OSS URL，仅供 Service Worker 内部回源使用 */
	sourceUrl?: string
	cacheKey: string
	mediaType: MediaResourceOfflineCacheMediaType
	expiresAt?: number | null
	size?: number
	contentLength?: number | null
	resourceVersion?: string | null | undefined
	sourceUpdatedAt?: string | null | undefined
	lastAccessedAt: number
}

type StoredCachedMediaResource = {
	id: string
	namespace: string
	path: string
	mediaType: MediaResourceOfflineCacheMediaType
	sourceUrl?: string
	expiresAt?: number | null
	size?: number
	contentLength?: number | null
	resourceVersion?: string | null
	sourceUpdatedAt?: string | null
	lastAccessedAt: number
	pendingBodyToken?: string | null
	pendingBodySize?: number | null
	pendingBodyStartedAt?: number | null
	/** Legacy read fallbacks; new records never write these fields. */
	url?: string
	cacheKey?: string
	originalUrl?: string
	updatedAt?: number
	etag?: string | null
	lastModified?: string | null
	contentType?: string | null
}

interface RememberResourceParams {
	path: string
	url: string
	mediaType: MediaResourceOfflineCacheMediaType
	expiresAt?: number | null
	resourceVersion?: string | null | undefined
	sourceUpdatedAt?: string | null | undefined
	contentLength?: number | null | undefined
}

interface ResolveResourceUrlOptions {
	/** 绕过 SW 虚拟 URL，直接返回真实源地址，用于主线程 fallback */
	bypassVirtualResource?: boolean
	/** 显式使用虚拟 URL。默认首屏渲染走真实源地址。 */
	preferVirtualResource?: boolean
	/** 返回真实源地址时是否登记离线映射，默认 true；只登记 metadata，不下载 body。 */
	registerOfflineResource?: boolean
}

interface RemoveCachedResourceParams {
	path: string
	mediaType: MediaResourceOfflineCacheMediaType
}

interface VirtualResourceHealthState {
	version: number
	unhealthyUntil: number
	lastRepairAt: number
	repairAttempts: number
}

interface EnsureServiceWorkerOptions {
	requireController?: boolean
}

/**
 * Bump this whenever the virtual URL shape, resource id, namespace/scope rules,
 * path normalization, IndexedDB schema, or CacheStorage key semantics change.
 * Versioned names keep new code from reading incompatible local SW cache data.
 */
const STORE_NAME = "resources"
const HEALTH_STORAGE_KEY = `canvas-media-resources-health-v${CANVAS_MEDIA_OFFLINE_CACHE_VERSION}`
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
const VIRTUAL_RESOURCE_FAILURE_WINDOW_MS = 10_000
const VIRTUAL_RESOURCE_FAILURE_THRESHOLD = 3
const VIRTUAL_RESOURCE_FALLBACK_COOLDOWN_MS = 60_000
const VIRTUAL_RESOURCE_REPAIR_THROTTLE_MS = 30_000
const SERVICE_WORKER_READY_TIMEOUT_MS = 1500
const TOUCH_WRITEBACK_INTERVAL_MS = 24 * 60 * 60 * 1000
const TOUCH_FLUSH_IDLE_DELAY_MS = 1000
const MAINTENANCE_TRAILING_DELAY_MS = 1000
const MAINTENANCE_MAX_DELAY_MS = 30_000

const configuredWorkers = new WeakMap<ServiceWorker, string>()
const workerMaintenanceStates = new WeakMap<
	ServiceWorker,
	{ firstQueuedAt: number; timerId: ReturnType<typeof setTimeout> | null }
>()

function configureWorkerOnce(
	worker: ServiceWorker,
	config: {
		maxBytes: number
		maxEntries: number
		maxMetadataBytes: number
		maxIdleAgeMs: number
	},
): void {
	const signature = `${config.maxBytes}:${config.maxEntries}:${config.maxMetadataBytes}:${config.maxIdleAgeMs}`
	if (configuredWorkers.get(worker) === signature) return
	configuredWorkers.set(worker, signature)
	worker.postMessage({ type: "CANVAS_MEDIA_CACHE_CONFIG", ...config })
}

function scheduleWorkerMaintenance(worker: ServiceWorker): void {
	const now = Date.now()
	const state = workerMaintenanceStates.get(worker) ?? {
		firstQueuedAt: now,
		timerId: null,
	}
	if (state.timerId === null) state.firstQueuedAt = now
	if (state.timerId !== null) clearTimeout(state.timerId)
	const maxDelayRemaining = Math.max(0, MAINTENANCE_MAX_DELAY_MS - (now - state.firstQueuedAt))
	state.timerId = setTimeout(
		() => {
			state.timerId = null
			state.firstQueuedAt = 0
			worker.postMessage({ type: "CANVAS_MEDIA_CACHE_ENFORCE_LIMIT" })
		},
		Math.min(MAINTENANCE_TRAILING_DELAY_MS, maxDelayRemaining),
	)
	workerMaintenanceStates.set(worker, state)
}

function readServiceWorkerController(): ServiceWorker | null {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
	return navigator.serviceWorker.controller
}

/**
 * 虚拟链接的统一入口前缀。
 *
 * 这类 URL 只用于画布渲染层和 Service Worker 之间做“同源占位”，不会直接指向 OSS。
 * 真正的资源地址会被写入 IndexedDB 的 `sourceUrl`，由 SW 拦截后再回源取数。
 */
const VIRTUAL_RESOURCE_PATH_SEGMENT = "canvas-design-media"
const VIRTUAL_RESOURCE_ROUTE_PREFIX = "sw"
const VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT = "design-resource"
const MEDIA_RESOURCE_OFFLINE_CACHE_CONFIG: MediaResourceOfflineCacheConfig = true

function normalizeConfig(
	config: MediaResourceOfflineCacheConfig,
): MediaResourceOfflineCacheOptions | null {
	if (!config) return null
	if (config === true) return { maxBytes: DEFAULT_MAX_BYTES }
	return {
		...config,
		maxBytes: config.maxBytes ?? DEFAULT_MAX_BYTES,
	}
}

function buildResourceId(
	namespace: string,
	mediaType: MediaResourceOfflineCacheMediaType,
	resourcePath: string,
): string {
	return joinUrlPathSegments(
		normalizeResourceNamespaceForStorage(namespace),
		mediaType,
		normalizeResourcePathForStorage(resourcePath),
	)
}

function joinUrlPathSegments(...segments: string[]): string {
	return segments
		.map((segment, index) => {
			const normalized = segment.replace(/\\/g, "/")
			if (index === 0) return normalized.replace(/\/+$/g, "")
			return normalized.replace(/^\/+|\/+$/g, "")
		})
		.filter(Boolean)
		.join("/")
}

/** 与 canvasResourcePath 中 `trim` 约定对齐：避免非字符串入参导致 `path.trim is not a function` */
function coerceToPathString(value: unknown): string {
	if (typeof value === "string") return value
	if (value == null) return ""
	return String(value)
}

/**
 * 根据规范化后的资源路径生成虚拟链接。
 *
 * 设计目标：
 * 1. 保持同源，便于 `img` / `video` 直接加载，且能被 SW 拦截；
 * 2. URL 直接携带宿主绝对路径，和宿主工作区路由保持同一种资源定位语义；
 * 3. 让同一资源在不同入口写法（`./a.png`、`a.png`、宿主绝对路径）下最终收敛到同一个占位链接。
 *
 * 虚拟链接格式：`{origin}/sw/{segment}/{namespace}/{mediaType}/design-resource/{absolutePath}`
 */
function getVirtualResourceUrlForResourcePath(
	resourcePath: string,
	mediaType: MediaResourceOfflineCacheMediaType,
	namespacePath?: string,
): string {
	const resolvedNamespacePath =
		namespacePath ?? normalizeResourcePathForLookup(window.location.pathname)
	return joinUrlPathSegments(
		window.location.origin,
		VIRTUAL_RESOURCE_ROUTE_PREFIX,
		VIRTUAL_RESOURCE_PATH_SEGMENT,
		encodeResourcePathForUrl(resolvedNamespacePath),
		mediaType,
		VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT,
		encodeResourcePathForUrl(resourcePath),
	)
}

function isBrowserOfflineCacheSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"indexedDB" in window &&
		"caches" in window &&
		"serviceWorker" in navigator
	)
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(transaction.error)
		transaction.onabort = () => reject(transaction.error)
	})
}

export class MediaResourceOfflineCacheManager {
	private static activeConsumerCount = 0

	private options: MediaResourceOfflineCacheOptions | null
	private dbPromise?: Promise<IDBDatabase>
	private isActiveConsumer = false
	private virtualResourceFailureTimestamps: number[] = []
	private virtualResourceFallbackUntil = 0
	private stats = {
		resolveDirectCount: 0,
		resolveVirtualCount: 0,
		cacheHitCount: 0,
		cacheMissCount: 0,
		backgroundRegisterQueuedCount: 0,
		backgroundRegisterCompletedCount: 0,
		backgroundRegisterFailedCount: 0,
	}
	private pendingMetadataWrites = new Map<
		string,
		{
			entry: CachedMediaResource
			worker: ServiceWorker | null
			waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>
		}
	>()
	private metadataFlushScheduled = false
	private pendingTouches = new Map<string, { id: string; lastAccessedAt: number }>()
	private lastTouchWriteAt = new Map<string, number>()
	private touchTimerId: ReturnType<typeof setTimeout> | null = null

	private readonly getResolveResourceReference?: () => ResolveCanvasResourceReference | undefined
	private readonly getVirtualResourceScope?: () => string | undefined

	constructor(options?: MediaResourceOfflineCacheManagerOptions) {
		this.options = normalizeConfig(MEDIA_RESOURCE_OFFLINE_CACHE_CONFIG)
		this.getResolveResourceReference = options?.getResolveResourceReference
		this.getVirtualResourceScope = options?.getVirtualResourceScope
		this.syncActiveConsumer()
	}

	private resolveStoredResourcePath(path: string): string | undefined {
		const rawPath = normalizePathSeparators(coerceToPathString(path).trim())
		if (isAssetResourcePath(rawPath)) return undefined
		const resolveResourceReference = this.getResolveResourceReference?.()
		if (!resolveResourceReference) return undefined

		const resolution = resolveCanvasStorageResourceReference(rawPath, resolveResourceReference)
		if (resolution.status !== "resolved") return undefined
		return resolution.workspacePath ?? resolution.storagePath
	}

	private getResourceNamespace(): string {
		return normalizeResourceNamespaceForStorage(this.getVirtualResourceScope?.())
	}

	private getVirtualResourceUrl(
		resourcePath: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): string {
		return getVirtualResourceUrlForResourcePath(
			resourcePath,
			mediaType,
			this.getResourceNamespace(),
		)
	}

	private getVirtualResourceUrlForNamespace(
		resourcePath: string,
		namespace: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): string {
		return getVirtualResourceUrlForResourcePath(
			resourcePath,
			mediaType,
			normalizeResourceNamespaceForStorage(namespace),
		)
	}

	private getCacheKey(
		entry: Pick<CachedMediaResource, "cacheKey" | "namespace" | "path" | "mediaType">,
	): string {
		return getCacheKey(entry)
	}

	public destroy(): void {
		if (this.touchTimerId !== null) {
			clearTimeout(this.touchTimerId)
			this.touchTimerId = null
		}
		void this.flushPendingTouches()
		this.deactivateConsumer()
	}

	private queueTouch(entry: CachedMediaResource): void {
		const now = Date.now()
		const id = buildResourceId(entry.namespace, entry.mediaType, entry.path)
		const lastWrittenAt = this.lastTouchWriteAt.get(id) ?? entry.lastAccessedAt
		if (now - lastWrittenAt < TOUCH_WRITEBACK_INTERVAL_MS) return
		this.pendingTouches.set(id, { id, lastAccessedAt: now })
		if (this.touchTimerId !== null) return
		this.touchTimerId = setTimeout(() => {
			this.touchTimerId = null
			void this.flushPendingTouches()
		}, TOUCH_FLUSH_IDLE_DELAY_MS)
	}

	private async flushPendingTouches(): Promise<void> {
		const touches = Array.from(this.pendingTouches.values())
		this.pendingTouches.clear()
		if (touches.length === 0 || !this.canUseServiceWorkerCache()) return
		try {
			await this.postMessageToServiceWorker({
				type: "CANVAS_MEDIA_CACHE_TOUCH_BATCH",
				touches,
			})
		} catch {
			return
		}
		touches.forEach(({ id, lastAccessedAt }) => this.lastTouchWriteAt.set(id, lastAccessedAt))
	}

	public isEnabled(): boolean {
		return this.isActiveConsumer && !!this.options && isBrowserOfflineCacheSupported()
	}

	private canUseServiceWorkerCache(): boolean {
		return this.isEnabled() && this.isOfflineCacheFeatureOn()
	}

	/**
	 * 是否具备离线缓存特性（配置 + 浏览器能力），不依赖当前 Canvas 是否仍为「活跃消费者」。
	 * 换链/虚拟 URL 应使用本判断，避免 React Strict Mode 或路由切换销毁 Canvas 后，仍在飞行的
	 * `exchangeOssSrc` 因 `isActiveConsumer === false` 退回 OSS 直链，从而与 SW 虚拟路径策略不一致。
	 */
	private isOfflineCacheFeatureOn(): boolean {
		return (
			!!this.options && isBrowserOfflineCacheSupported() && isAppServiceWorkerFeatureEnabled()
		)
	}

	public static getActiveConsumerCount(): number {
		return MediaResourceOfflineCacheManager.activeConsumerCount
	}

	/**
	 * 将真实资源“记忆”为离线缓存条目，并返回画布层使用的虚拟链接。
	 *
	 * 这里不会改写业务资源的真实地址；它只做两件事：
	 * - 生成并持久化虚拟 URL
	 * - 把 sourceUrl 保留给 Service Worker 回源
	 */
	public async rememberResolvedResource(
		params: RememberResourceParams,
	): Promise<CachedMediaResource | null> {
		try {
			if (isAssetResourcePath(params.path)) return null
			if (!this.isOfflineCacheFeatureOn() || this.shouldBypassVirtualResource()) return null
			const registration = await this.ensureServiceWorker({ requireController: true })
			if (!registration) return null
			const now = Date.now()
			const namespace = this.getResourceNamespace()
			const resourcePath = this.resolveStoredResourcePath(params.path)
			if (!resourcePath) return null
			const resourceUrl = this.getVirtualResourceUrl(resourcePath, params.mediaType)
			const entry: CachedMediaResource = {
				namespace,
				path: resourcePath,
				url: resourceUrl,
				sourceUrl: params.url,
				cacheKey: resourceUrl,
				mediaType: params.mediaType,
				expiresAt: params.expiresAt,
				contentLength: params.contentLength,
				// Keep undefined when omitted so flush can preserve existing version fields.
				resourceVersion: params.resourceVersion,
				sourceUpdatedAt: params.sourceUpdatedAt,
				lastAccessedAt: now,
			}

			const worker = this.getRegistrationWorker(registration)
			await this.saveEntry(entry, worker)
			return entry
		} catch {
			return null
		}
	}

	public async resolveResourceUrl(
		params: RememberResourceParams,
		options?: ResolveResourceUrlOptions,
	): Promise<string> {
		// Asset file_url values are signed and session-scoped; never register them in
		// the workspace-oriented IndexedDB/Service Worker cache.
		if (isAssetResourcePath(params.path)) return params.url
		const featureOn = this.isOfflineCacheFeatureOn()
		const bypass = this.shouldBypassVirtualResource()
		if (options?.bypassVirtualResource || !featureOn || bypass) {
			this.stats.resolveDirectCount += 1
			return params.url
		}

		if (!options?.preferVirtualResource) {
			this.stats.resolveDirectCount += 1
			if (options?.registerOfflineResource !== false) {
				this.rememberResolvedResourceInBackground(params)
			}
			return params.url
		}

		const entry = await this.rememberResolvedResource(params)
		if (entry?.url) {
			this.stats.resolveVirtualCount += 1
			return entry.url
		}
		this.stats.resolveDirectCount += 1
		return entry?.url ?? params.url
	}

	public isVirtualResourceUrl(url: string | null | undefined): boolean {
		if (!url) return false
		try {
			return new URL(url, window.location.href).pathname.includes(
				`/${VIRTUAL_RESOURCE_PATH_SEGMENT}/`,
			)
		} catch {
			return false
		}
	}

	public recordVirtualResourceLoadSuccess(url: string | null | undefined): void {
		if (!this.isVirtualResourceUrl(url)) return
		this.virtualResourceFailureTimestamps = []
		this.virtualResourceFallbackUntil = 0
		this.clearVirtualResourceHealthState()
	}

	public recordVirtualResourceLoadFailure(url: string | null | undefined): void {
		if (!this.isVirtualResourceUrl(url)) return
		const now = Date.now()
		const windowStart = now - VIRTUAL_RESOURCE_FAILURE_WINDOW_MS
		this.virtualResourceFailureTimestamps = [
			...this.virtualResourceFailureTimestamps.filter(
				(timestamp) => timestamp >= windowStart,
			),
			now,
		]
		if (this.virtualResourceFailureTimestamps.length >= VIRTUAL_RESOURCE_FAILURE_THRESHOLD) {
			const unhealthyUntil = now + VIRTUAL_RESOURCE_FALLBACK_COOLDOWN_MS
			this.virtualResourceFallbackUntil = unhealthyUntil
			this.virtualResourceFailureTimestamps = []
			this.persistVirtualResourceHealthState(unhealthyUntil, now)
		}
	}

	public shouldBypassVirtualResource(): boolean {
		const now = Date.now()
		const healthState = this.readVirtualResourceHealthState()
		if (healthState && healthState.unhealthyUntil <= now) {
			this.clearVirtualResourceHealthState()
		}
		return (
			now < this.virtualResourceFallbackUntil ||
			(!!healthState && now < healthState.unhealthyUntil)
		)
	}

	public async getCachedResource(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<CachedMediaResource | null> {
		if (isAssetResourcePath(path)) return null
		if (!this.canUseServiceWorkerCache()) return null
		const entry = await this.getEntry(path, mediaType)
		if (!entry) return null

		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		const response = await cache.match(this.getCacheKey(entry))
		if (!response) {
			this.stats.cacheMissCount += 1
			return null
		}
		this.stats.cacheHitCount += 1

		this.queueTouch(entry)
		return entry
	}

	public getSnapshot() {
		return { ...this.stats }
	}

	private rememberResolvedResourceInBackground(params: RememberResourceParams): void {
		if (!this.isOfflineCacheFeatureOn()) return
		this.stats.backgroundRegisterQueuedCount += 1
		void this.rememberResolvedResource(params)
			.then((entry) => {
				if (entry) this.stats.backgroundRegisterCompletedCount += 1
			})
			.catch(() => {
				this.stats.backgroundRegisterFailedCount += 1
			})
	}

	public removeCachedResource(params: RemoveCachedResourceParams): void {
		if (isAssetResourcePath(params.path)) return
		if (!isBrowserOfflineCacheSupported()) return

		void this.deleteCachedResource(params).catch(() => undefined)
	}

	private getMaxBytes(): number {
		return this.options?.maxBytes ?? DEFAULT_MAX_BYTES
	}

	private syncActiveConsumer(): void {
		if (!this.options || !isBrowserOfflineCacheSupported()) {
			this.deactivateConsumer()
			return
		}

		if (!this.isActiveConsumer) {
			MediaResourceOfflineCacheManager.activeConsumerCount += 1
			this.isActiveConsumer = true
		}

		void this.ensureServiceWorker()
	}

	private deactivateConsumer(): void {
		if (!this.isActiveConsumer) return

		MediaResourceOfflineCacheManager.activeConsumerCount = Math.max(
			0,
			MediaResourceOfflineCacheManager.activeConsumerCount - 1,
		)
		this.isActiveConsumer = false
	}

	/**
	 * 确保离线缓存 SW 已注册。
	 *
	 * 这一步的意义是让“虚拟链接”具备可解释性：渲染层拿到的是同源占位 URL，
	 * 但真正的响应由 SW 在后续请求中根据 `cacheKey/sourceUrl` 还原。
	 */
	private async ensureServiceWorker(
		options: EnsureServiceWorkerOptions = {},
	): Promise<ServiceWorkerRegistration | null> {
		if (!this.isOfflineCacheFeatureOn()) return null

		const registration = await this.waitForServiceWorkerReady()
		if (!registration) return null
		if (options.requireController && !readServiceWorkerController()) return null

		const worker = this.getRegistrationWorker(registration)
		if (worker) {
			configureWorkerOnce(worker, {
				maxBytes: this.getMaxBytes(),
				maxEntries: CANVAS_MEDIA_MAX_ENTRIES,
				maxMetadataBytes: CANVAS_MEDIA_MAX_METADATA_BYTES,
				maxIdleAgeMs: CANVAS_MEDIA_MAX_IDLE_AGE_MS,
			})
		}
		return registration
	}

	private async waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
		let timeoutId: number | undefined
		const readyPromise = navigator.serviceWorker.ready.catch(() => null)
		const timeoutPromise = new Promise<null>((resolve) => {
			timeoutId = window.setTimeout(() => resolve(null), SERVICE_WORKER_READY_TIMEOUT_MS)
		})
		const registration = await Promise.race([readyPromise, timeoutPromise])
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId)
		}
		return registration
	}

	private async postMessageToServiceWorker(message: unknown): Promise<void> {
		if (!this.canUseServiceWorkerCache()) return
		const registration = await this.ensureServiceWorker()
		this.getRegistrationWorker(registration)?.postMessage(message)
	}

	private getRegistrationWorker(
		registration: ServiceWorkerRegistration | null | undefined,
	): ServiceWorker | null {
		return (
			navigator.serviceWorker.controller ||
			registration?.active ||
			registration?.waiting ||
			registration?.installing ||
			null
		)
	}

	private async openDb(): Promise<IDBDatabase> {
		if (this.dbPromise) return this.dbPromise

		this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(CANVAS_MEDIA_DB_NAME, CANVAS_MEDIA_OFFLINE_CACHE_VERSION)
			request.onupgradeneeded = () => {
				const db = request.result
				const tx = request.transaction
				if (!tx) {
					reject(new Error("IndexedDB upgrade missing transaction"))
					return
				}
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: "id" })
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
		return this.dbPromise
	}

	private async saveEntry(
		entry: CachedMediaResource,
		worker: ServiceWorker | null = null,
	): Promise<void> {
		const namespace = normalizeResourceNamespaceForStorage(entry.namespace)
		const id = buildResourceId(namespace, entry.mediaType, entry.path)
		return new Promise<void>((resolve, reject) => {
			const queued = this.pendingMetadataWrites.get(id)
			const previous = queued?.entry
			// Coalesce pending writes without treating omitted version fields as clears.
			const mergedEntry: CachedMediaResource = {
				...entry,
				namespace,
				contentLength:
					entry.contentLength !== undefined
						? entry.contentLength
						: previous?.contentLength,
				resourceVersion:
					entry.resourceVersion !== undefined
						? entry.resourceVersion
						: previous?.resourceVersion,
				sourceUpdatedAt:
					entry.sourceUpdatedAt !== undefined
						? entry.sourceUpdatedAt
						: previous?.sourceUpdatedAt,
			}
			this.pendingMetadataWrites.set(id, {
				entry: mergedEntry,
				worker,
				waiters: [...(queued?.waiters ?? []), { resolve, reject }],
			})
			if (this.metadataFlushScheduled) return
			this.metadataFlushScheduled = true
			queueMicrotask(() => {
				void this.flushPendingMetadataWrites()
			})
		})
	}

	private async flushPendingMetadataWrites(): Promise<void> {
		const writes = Array.from(this.pendingMetadataWrites.entries())
		this.pendingMetadataWrites.clear()
		this.metadataFlushScheduled = false
		if (writes.length === 0) return

		try {
			const db = await this.openDb()
			const transaction = db.transaction(STORE_NAME, "readwrite")
			const transactionDone = transactionToPromise(transaction)
			const store = transaction.objectStore(STORE_NAME)
			for (const [id, { entry }] of writes) {
				const existing = await requestToPromise<StoredCachedMediaResource | undefined>(
					store.get(id),
				)
				await requestToPromise(
					store.put({
						id,
						namespace: entry.namespace,
						path: entry.path,
						sourceUrl: entry.sourceUrl,
						mediaType: entry.mediaType,
						expiresAt: entry.expiresAt,
						size: existing?.size,
						contentLength:
							entry.contentLength !== undefined
								? entry.contentLength
								: (existing?.contentLength ?? null),
						resourceVersion:
							entry.resourceVersion !== undefined
								? entry.resourceVersion
								: (existing?.resourceVersion ?? null),
						sourceUpdatedAt:
							entry.sourceUpdatedAt !== undefined
								? entry.sourceUpdatedAt
								: (existing?.sourceUpdatedAt ?? null),
						lastAccessedAt: entry.lastAccessedAt,
						pendingBodyToken: existing?.pendingBodyToken ?? null,
						pendingBodySize: existing?.pendingBodySize ?? null,
						pendingBodyStartedAt: existing?.pendingBodyStartedAt ?? null,
					} satisfies StoredCachedMediaResource),
				)
			}
			await transactionDone
			new Set(writes.map(([, { worker }]) => worker).filter(Boolean)).forEach((worker) =>
				scheduleWorkerMaintenance(worker as ServiceWorker),
			)
			writes.forEach(([, { waiters }]) => waiters.forEach(({ resolve }) => resolve()))
		} catch (error) {
			writes.forEach(([, { waiters }]) => waiters.forEach(({ reject }) => reject(error)))
		}
	}

	private async getEntry(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<CachedMediaResource | null> {
		if (isAssetResourcePath(path)) return null
		const namespace = this.getResourceNamespace()
		const resourcePath = this.resolveStoredResourcePath(path)
		if (!resourcePath) return null
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readonly")
		const store = transaction.objectStore(STORE_NAME)
		const result = await requestToPromise<StoredCachedMediaResource | undefined>(
			store.get(buildResourceId(namespace, mediaType, resourcePath)),
		)

		if (!result) return null
		return this.toCachedMediaResource(result)
	}

	private toCachedMediaResource(entry: StoredCachedMediaResource): CachedMediaResource {
		const namespace = normalizeResourceNamespaceForStorage(entry.namespace)
		const url =
			entry.url ||
			this.getVirtualResourceUrlForNamespace(entry.path, namespace, entry.mediaType)
		return {
			namespace,
			path: entry.path,
			url,
			sourceUrl: entry.sourceUrl || entry.originalUrl || entry.url,
			cacheKey: entry.cacheKey || url,
			mediaType: entry.mediaType,
			expiresAt: entry.expiresAt,
			size: entry.size,
			contentLength: entry.contentLength ?? null,
			resourceVersion: entry.resourceVersion ?? null,
			sourceUpdatedAt: entry.sourceUpdatedAt ?? null,
			lastAccessedAt: entry.lastAccessedAt ?? entry.updatedAt ?? 0,
		}
	}

	private async deleteCachedResource(params: RemoveCachedResourceParams): Promise<void> {
		const namespace = this.getResourceNamespace()
		const entry = await this.getEntry(params.path, params.mediaType)
		const resourcePathForDelete = entry?.path ?? this.resolveStoredResourcePath(params.path)
		if (!resourcePathForDelete) return
		const cacheKey = entry
			? this.getCacheKey(entry)
			: this.getVirtualResourceUrl(resourcePathForDelete, params.mediaType)
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const transactionDone = transactionToPromise(transaction)
		const store = transaction.objectStore(STORE_NAME)
		await requestToPromise(
			store.delete(buildResourceId(namespace, params.mediaType, resourcePathForDelete)),
		)
		await transactionDone

		const cache = await caches.open(CANVAS_MEDIA_CACHE_NAME)
		await cache.delete(cacheKey)
	}

	private readVirtualResourceHealthState(): VirtualResourceHealthState | null {
		if (typeof window === "undefined" || !window.localStorage) return null
		try {
			const raw = window.localStorage.getItem(HEALTH_STORAGE_KEY)
			if (!raw) return null
			const parsed = JSON.parse(raw) as Partial<VirtualResourceHealthState>
			if (
				parsed.version !== CANVAS_MEDIA_OFFLINE_CACHE_VERSION ||
				typeof parsed.unhealthyUntil !== "number" ||
				typeof parsed.lastRepairAt !== "number" ||
				typeof parsed.repairAttempts !== "number"
			) {
				return null
			}
			return {
				version: parsed.version,
				unhealthyUntil: parsed.unhealthyUntil,
				lastRepairAt: parsed.lastRepairAt,
				repairAttempts: parsed.repairAttempts,
			}
		} catch {
			return null
		}
	}

	private persistVirtualResourceHealthState(unhealthyUntil: number, now: number): boolean {
		if (typeof window === "undefined" || !window.localStorage) return true
		const previous = this.readVirtualResourceHealthState()
		const shouldRepair =
			!previous?.lastRepairAt ||
			now - previous.lastRepairAt >= VIRTUAL_RESOURCE_REPAIR_THROTTLE_MS
		const state: VirtualResourceHealthState = {
			version: CANVAS_MEDIA_OFFLINE_CACHE_VERSION,
			unhealthyUntil: Math.max(unhealthyUntil, previous?.unhealthyUntil ?? 0),
			lastRepairAt: shouldRepair ? now : (previous?.lastRepairAt ?? 0),
			repairAttempts: (previous?.repairAttempts ?? 0) + (shouldRepair ? 1 : 0),
		}
		try {
			window.localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(state))
		} catch {
			// localStorage quota / privacy mode failure should not block resource fallback.
		}
		return shouldRepair
	}

	private clearVirtualResourceHealthState(): void {
		if (typeof window === "undefined" || !window.localStorage) return
		try {
			window.localStorage.removeItem(HEALTH_STORAGE_KEY)
		} catch {
			// ignore localStorage cleanup failure
		}
	}
}
