import { resolveCanonicalResourcePath, normalizePathLocal } from "./pathUtils"
import {
	getCacheKey,
	normalizeResourceNamespace,
	normalizeResourcePathForLookup,
} from "@/workers/service-worker/canvasMediaShared"
import { isAppServiceWorkerFeatureEnabled } from "@/workers/service-worker/register"

/**
 * 画布媒体离线缓存（主线程 IndexedDB + 主 SW Canvas 虚拟资源通道）。
 *
 * 与 SW 配合时的根因备忘：
 * - 虚拟 URL 命中 SW 后，IDB 查找键须与 SW 内 `normalizeResourcePathForLookup` 一致（见 SW 文件头注释：fetch
 *   pathname 可能为 percent-encoded，主线程写入为 Unicode 明文）。
 * - `resolveResourceUrl` / `rememberResolvedResource` / `ensureServiceWorker` 使用 `isOfflineCacheFeatureOn`，
 *   勿仅用 `isEnabled()`（后者含 `isActiveConsumer`），否则 Canvas 销毁后仍在飞行的换链会退回 OSS 直链。
 */

export type MediaResourceOfflineCacheMediaType = "image" | "video"

export interface MediaResourceOfflineCacheOptions {
	/** 离线缓存总容量上限，默认 1GB */
	maxBytes?: number
}

export type MediaResourceOfflineCacheConfig = boolean | MediaResourceOfflineCacheOptions | undefined

/** 与 {@link Canvas} 构造时注入的宿主能力对齐，用于离线缓存条目的 path 与换链层一致 */
export interface MediaResourceOfflineCacheManagerOptions {
	/** 将画布 path 解析为宿主工作区绝对路径，再与换链/资源管理器使用同一规范键 */
	getResolveAbsolutePath?: () => ((path: string) => string) | undefined
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
	etag?: string | null
	lastModified?: string | null
	contentLength?: number | null
	contentType?: string | null
	lastAccessedAt: number
	updatedAt: number
}

type StoredCachedMediaResource = Omit<CachedMediaResource, "url" | "cacheKey"> & {
	id: string
	url?: string
	cacheKey?: string
	originalUrl?: string
}

interface RefreshResourceMessageResult {
	type?: string
	refreshed?: boolean
	changed?: boolean
}

interface RememberResourceParams {
	path: string
	url: string
	mediaType: MediaResourceOfflineCacheMediaType
	expiresAt?: number | null
}

interface ResolveResourceUrlOptions {
	/** 绕过 SW 虚拟 URL，直接返回真实源地址，用于主线程 fallback */
	bypassVirtualResource?: boolean
}

interface CacheResourceParams extends RememberResourceParams {
	force?: boolean
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
const OFFLINE_CACHE_VERSION = 1
const DB_BASE_NAME = "canvas-media-resource-offline-cache"
const DB_VERSION = OFFLINE_CACHE_VERSION
const DB_NAME = `${DB_BASE_NAME}-v${OFFLINE_CACHE_VERSION}`
const STORE_NAME = "resources"
const CACHE_BASE_NAME = "canvas-media-resources"
const CACHE_NAME = `${CACHE_BASE_NAME}-v${OFFLINE_CACHE_VERSION}`
const HEALTH_STORAGE_KEY = `${CACHE_BASE_NAME}-health-v${OFFLINE_CACHE_VERSION}`
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
const DEFAULT_RESOURCE_NAMESPACE = "__global__"
const VIRTUAL_RESOURCE_FAILURE_WINDOW_MS = 10_000
const VIRTUAL_RESOURCE_FAILURE_THRESHOLD = 3
const VIRTUAL_RESOURCE_FALLBACK_COOLDOWN_MS = 60_000
const VIRTUAL_RESOURCE_REPAIR_THROTTLE_MS = 30_000
const SERVICE_WORKER_READY_TIMEOUT_MS = 1500

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
		normalizeResourceNamespace(namespace),
		mediaType,
		normalizeResourcePathForLookup(resourcePath),
	)
}

function getBaseUrl(): string {
	const meta = import.meta as ImportMeta & { env?: { BASE_URL?: string } }
	const base = meta.env?.BASE_URL || "/"
	return base.endsWith("/") ? base : `${base}/`
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

/** 与 pathUtils 中 `trim` 约定对齐：避免非字符串入参导致 `path.trim is not a function` */
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
	return joinUrlPathSegments(
		window.location.origin,
		VIRTUAL_RESOURCE_ROUTE_PREFIX,
		VIRTUAL_RESOURCE_PATH_SEGMENT,
		namespacePath || window.location.pathname,
		mediaType,
		VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT,
		resourcePath,
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
	private cachePromises = new Map<string, Promise<void>>()
	private isActiveConsumer = false
	private virtualResourceFailureTimestamps: number[] = []
	private virtualResourceFallbackUntil = 0

	private readonly getResolveAbsolutePath?: () => ((path: string) => string) | undefined
	private readonly getVirtualResourceScope?: () => string | undefined

	constructor(options?: MediaResourceOfflineCacheManagerOptions) {
		this.options = normalizeConfig(MEDIA_RESOURCE_OFFLINE_CACHE_CONFIG)
		this.getResolveAbsolutePath = options?.getResolveAbsolutePath
		this.getVirtualResourceScope = options?.getVirtualResourceScope
		this.syncActiveConsumer()
	}

	private resolveStoredCanonicalPath(path: string): string {
		return resolveCanonicalResourcePath(
			coerceToPathString(path),
			this.getResolveAbsolutePath?.(),
		)
	}

	private resolveStoredResourcePath(path: string): string {
		const canonicalPath = this.resolveStoredCanonicalPath(path)
		const resolveAbsolutePath = this.getResolveAbsolutePath?.()
		if (!resolveAbsolutePath) return canonicalPath
		return normalizePathLocal(coerceToPathString(resolveAbsolutePath(canonicalPath)))
	}

	private getResourceNamespace(): string {
		return normalizeResourceNamespace(this.getVirtualResourceScope?.())
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
			normalizeResourceNamespace(namespace),
		)
	}

	private getCacheKey(
		entry: Pick<CachedMediaResource, "cacheKey" | "namespace" | "path" | "mediaType">,
	): string {
		return getCacheKey(entry)
	}

	public destroy(): void {
		this.deactivateConsumer()
		this.cachePromises.clear()
	}

	public isEnabled(): boolean {
		return this.isActiveConsumer && !!this.options && isBrowserOfflineCacheSupported()
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
			if (!this.isOfflineCacheFeatureOn() || this.shouldBypassVirtualResource()) return null
			const registration = await this.ensureServiceWorker({ requireController: true })
			if (!registration) return null
			const now = Date.now()
			const namespace = this.getResourceNamespace()
			const resourcePath = this.resolveStoredResourcePath(params.path)
			const existing = await this.getEntry(params.path, params.mediaType)
			const resourceUrl = this.getVirtualResourceUrl(resourcePath, params.mediaType)
			const entry: CachedMediaResource = {
				namespace,
				path: resourcePath,
				url: resourceUrl,
				sourceUrl: params.url,
				cacheKey: resourceUrl,
				mediaType: params.mediaType,
				expiresAt: params.expiresAt,
				size: existing?.size,
				etag: existing?.etag,
				lastModified: existing?.lastModified,
				contentLength: existing?.contentLength,
				contentType: existing?.contentType,
				lastAccessedAt: now,
				updatedAt: now,
			}

			await this.saveEntry(entry)
			this.getRegistrationWorker(registration)?.postMessage({
				type: "CANVAS_MEDIA_CACHE_REGISTER",
				entry,
				maxBytes: this.getMaxBytes(),
			})
			return entry
		} catch {
			return null
		}
	}

	public async resolveResourceUrl(
		params: RememberResourceParams,
		options?: ResolveResourceUrlOptions,
	): Promise<string> {
		if (
			options?.bypassVirtualResource ||
			!this.isOfflineCacheFeatureOn() ||
			this.shouldBypassVirtualResource()
		) {
			return params.url
		}
		const entry = await this.rememberResolvedResource(params)
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
			if (this.persistVirtualResourceHealthState(unhealthyUntil, now)) {
				this.requestVirtualResourceRepair()
			}
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

	public async refreshCachedResource(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<boolean> {
		if (!this.isEnabled()) return false

		const entry = await this.getEntry(path, mediaType)
		if (!entry?.sourceUrl) return false

		const result =
			await this.postMessageToServiceWorkerWithResponse<RefreshResourceMessageResult>({
				type: "CANVAS_MEDIA_CACHE_REFRESH",
				entry: {
					...entry,
					lastAccessedAt: Date.now(),
				},
				maxBytes: this.getMaxBytes(),
			})
		return result?.refreshed === true && result.changed === true
	}

	public async getCachedResource(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<CachedMediaResource | null> {
		if (!this.isEnabled()) return null
		const entry = await this.getEntry(path, mediaType)
		if (!entry) return null

		const cache = await caches.open(CACHE_NAME)
		const response = await cache.match(this.getCacheKey(entry))
		if (!response) return null

		await this.touchEntry(entry)
		await this.postMessageToServiceWorker({
			type: "CANVAS_MEDIA_CACHE_REGISTER",
			entry: {
				...entry,
				lastAccessedAt: Date.now(),
			},
			maxBytes: this.getMaxBytes(),
		})
		return entry
	}

	public cacheResolvedResource(params: CacheResourceParams): void {
		if (!this.isOfflineCacheFeatureOn()) return
		void (async () => {
			const namespace = this.getResourceNamespace()
			const resourcePath = this.resolveStoredResourcePath(params.path)
			const key = buildResourceId(namespace, params.mediaType, resourcePath)
			if (!params.force && this.cachePromises.has(key)) return

			const promise = this.rememberResolvedResource(params)
				.then(() => undefined)
				.catch(() => undefined)
				.finally(() => {
					this.cachePromises.delete(key)
				})
			this.cachePromises.set(key, promise)
		})()
	}

	public removeCachedResource(params: RemoveCachedResourceParams): void {
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

		this.getRegistrationWorker(registration)?.postMessage({
			type: "CANVAS_MEDIA_CACHE_CONFIG",
			maxBytes: this.getMaxBytes(),
		})
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
		if (!this.isEnabled()) return
		const registration = await this.ensureServiceWorker()
		this.getRegistrationWorker(registration)?.postMessage(message)
	}

	private async postMessageToServiceWorkerWithResponse<T>(message: unknown): Promise<T | null> {
		if (!this.isEnabled()) return null
		const registration = await this.ensureServiceWorker()
		const worker = this.getRegistrationWorker(registration)
		if (!worker) return null

		return new Promise<T | null>((resolve) => {
			const channel = new MessageChannel()
			const timeoutId = window.setTimeout(() => {
				channel.port1.onmessage = null
				channel.port1.close()
				channel.port2.close()
				resolve(null)
			}, 30000)

			channel.port1.onmessage = (event: MessageEvent<T>) => {
				window.clearTimeout(timeoutId)
				channel.port1.onmessage = null
				channel.port1.close()
				channel.port2.close()
				resolve(event.data)
			}

			worker.postMessage(message, [channel.port2])
		})
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
			const request = indexedDB.open(DB_NAME, DB_VERSION)
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

	private async saveEntry(entry: CachedMediaResource): Promise<void> {
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		const namespace = normalizeResourceNamespace(entry.namespace)
		const derivedCacheKey = this.getVirtualResourceUrlForNamespace(
			entry.path,
			namespace,
			entry.mediaType,
		)
		const cacheKey = this.getCacheKey(entry)
		const storedEntry: StoredCachedMediaResource = {
			id: buildResourceId(namespace, entry.mediaType, entry.path),
			namespace,
			path: entry.path,
			sourceUrl: entry.sourceUrl,
			mediaType: entry.mediaType,
			expiresAt: entry.expiresAt,
			size: entry.size,
			etag: entry.etag,
			lastModified: entry.lastModified,
			contentLength: entry.contentLength,
			contentType: entry.contentType,
			lastAccessedAt: entry.lastAccessedAt,
			updatedAt: entry.updatedAt,
			...(cacheKey !== derivedCacheKey ? { cacheKey } : {}),
		}
		await requestToPromise(store.put(storedEntry))
		await transactionToPromise(transaction)
	}

	private async getEntry(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<CachedMediaResource | null> {
		const namespace = this.getResourceNamespace()
		const resourcePath = this.resolveStoredResourcePath(path)
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
		const namespace = normalizeResourceNamespace(entry.namespace)
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
			etag: entry.etag,
			lastModified: entry.lastModified,
			contentLength: entry.contentLength,
			contentType: entry.contentType,
			lastAccessedAt: entry.lastAccessedAt,
			updatedAt: entry.updatedAt,
		}
	}

	private async touchEntry(entry: CachedMediaResource): Promise<void> {
		await this.saveEntry({
			...entry,
			lastAccessedAt: Date.now(),
		})
	}

	private async deleteCachedResource(params: RemoveCachedResourceParams): Promise<void> {
		const namespace = this.getResourceNamespace()
		const entry = await this.getEntry(params.path, params.mediaType)
		const resourcePathForDelete = entry?.path ?? this.resolveStoredResourcePath(params.path)
		const cacheKey = entry
			? this.getCacheKey(entry)
			: this.getVirtualResourceUrl(resourcePathForDelete, params.mediaType)
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		await requestToPromise(
			store.delete(buildResourceId(namespace, params.mediaType, resourcePathForDelete)),
		)

		const cache = await caches.open(CACHE_NAME)
		await cache.delete(cacheKey)
	}

	private readVirtualResourceHealthState(): VirtualResourceHealthState | null {
		if (typeof window === "undefined" || !window.localStorage) return null
		try {
			const raw = window.localStorage.getItem(HEALTH_STORAGE_KEY)
			if (!raw) return null
			const parsed = JSON.parse(raw) as Partial<VirtualResourceHealthState>
			if (
				parsed.version !== OFFLINE_CACHE_VERSION ||
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
			version: OFFLINE_CACHE_VERSION,
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

	private requestVirtualResourceRepair(): void {
		this.cachePromises.clear()
	}
}
