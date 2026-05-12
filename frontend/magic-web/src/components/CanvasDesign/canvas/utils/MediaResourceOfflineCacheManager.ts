import { resolveCanonicalResourcePath, normalizePathLocal } from "./pathUtils"

/**
 * 画布媒体离线缓存（主线程 IndexedDB + `canvas-media-resource-sw.js`）。
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
	/** 自定义 Service Worker 地址；默认使用 Vite public 下的 canvas-media-resource-sw.js */
	serviceWorkerUrl?: string
}

export type MediaResourceOfflineCacheConfig = boolean | MediaResourceOfflineCacheOptions | undefined

/** 与 {@link Canvas} 构造时注入的宿主能力对齐，用于离线缓存条目的 path 与换链层一致 */
export interface MediaResourceOfflineCacheManagerOptions {
	/** 将画布 path 解析为宿主工作区绝对路径，再与换链/资源管理器使用同一规范键 */
	getResolveAbsolutePath?: () => ((path: string) => string) | undefined
	/** 获取宿主注入的虚拟媒体资源 scope，用于隔离工作区/项目上下文 */
	getVirtualResourceScope?: () => string | undefined
}

export interface MediaResourceOfflineCacheUnregisterOptions {
	/** 即使仍有 CanvasDesign 实例正在使用离线缓存，也强制卸载 SW */
	force?: boolean
	/** 同时清理 CacheStorage 中的媒体缓存 */
	clearCache?: boolean
	/** 同时清理 IndexedDB 中的媒体资源索引 */
	clearDatabase?: boolean
	/** 自定义 Service Worker 地址；默认清理 canvas-media-resource-sw.js */
	serviceWorkerUrl?: string
}

export interface CachedMediaResource {
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

interface CacheResourceParams extends RememberResourceParams {
	force?: boolean
}

interface RemoveCachedResourceParams {
	path: string
	mediaType: MediaResourceOfflineCacheMediaType
}

const DB_NAME = "canvas-media-resource-offline-cache"
const DB_VERSION = 1
const STORE_NAME = "resources"
const CACHE_NAME = "canvas-media-resources-v1"
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024
const DEFAULT_SW_FILE = "canvas-media-resource-sw.js"

/** 读取当前 controlling worker，避免 TS 在 `await` 之后仍把 `navigator.serviceWorker.controller` 窄成 `null`。 */
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
	mediaType: MediaResourceOfflineCacheMediaType,
	resourcePath: string,
): string {
	return `${mediaType}:${resourcePath}`
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
 * 虚拟链接格式：`{origin}/sw/{segment}/{pathname}/design-resource/{absolutePath}`
 */
function getVirtualResourceUrlForResourcePath(resourcePath: string, scopePath?: string): string {
	return joinUrlPathSegments(
		window.location.origin,
		getServiceWorkerScope(getDefaultServiceWorkerUrl()),
		VIRTUAL_RESOURCE_ROUTE_PREFIX,
		VIRTUAL_RESOURCE_PATH_SEGMENT,
		scopePath || window.location.pathname,
		VIRTUAL_RESOURCE_DESIGN_RESOURCE_SEGMENT,
		resourcePath,
	)
}

function getDefaultServiceWorkerUrl(): string {
	return `${getBaseUrl()}${DEFAULT_SW_FILE}`
}

function getServiceWorkerScope(swUrl: string): string {
	try {
		const url = new URL(swUrl, window.location.href)
		const pathname = url.pathname
		return pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/"
	} catch {
		return "/"
	}
}

function getAbsoluteServiceWorkerUrl(swUrl: string): string {
	return new URL(swUrl, window.location.href).href
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

export class MediaResourceOfflineCacheManager {
	private static registrationPromises = new Map<
		string,
		Promise<ServiceWorkerRegistration | null>
	>()
	private static activeConsumerCount = 0
	private static defaultUnregisterPromise?: Promise<boolean>

	private options: MediaResourceOfflineCacheOptions | null
	private dbPromise?: Promise<IDBDatabase>
	private cachePromises = new Map<string, Promise<void>>()
	private isActiveConsumer = false

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

	private getVirtualResourceUrl(resourcePath: string): string {
		return getVirtualResourceUrlForResourcePath(resourcePath, this.getVirtualResourceScope?.())
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
		return !!this.options && isBrowserOfflineCacheSupported()
	}

	public static getActiveConsumerCount(): number {
		return MediaResourceOfflineCacheManager.activeConsumerCount
	}

	public static async unregisterServiceWorker(
		options: MediaResourceOfflineCacheUnregisterOptions = {},
	): Promise<boolean> {
		if (!isBrowserOfflineCacheSupported()) return false
		if (MediaResourceOfflineCacheManager.activeConsumerCount > 0 && !options.force) return false

		const swUrl = options.serviceWorkerUrl || getDefaultServiceWorkerUrl()
		const absoluteSwUrl = getAbsoluteServiceWorkerUrl(swUrl)
		const registrations = await navigator.serviceWorker.getRegistrations()
		const targetRegistrations = registrations.filter((registration) =>
			[registration.active, registration.waiting, registration.installing].some(
				(worker) => worker?.scriptURL === absoluteSwUrl,
			),
		)

		const unregisterResults = await Promise.all(
			targetRegistrations.map((registration) => registration.unregister()),
		)

		MediaResourceOfflineCacheManager.registrationPromises.delete(absoluteSwUrl)

		if (options.clearCache) await caches.delete(CACHE_NAME)
		if (options.clearDatabase) await this.deleteDatabase()

		return unregisterResults.some(Boolean)
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
			if (!this.isOfflineCacheFeatureOn()) return null
			const registration = await this.ensureServiceWorker()
			if (!registration) return null
			const now = Date.now()
			const resourcePath = this.resolveStoredResourcePath(params.path)
			const existing = await this.getEntry(params.path, params.mediaType)
			const resourceUrl = this.getVirtualResourceUrl(resourcePath)
			const entry: CachedMediaResource = {
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

	public async resolveResourceUrl(params: RememberResourceParams): Promise<string> {
		if (!this.isOfflineCacheFeatureOn()) return params.url
		const entry = await this.rememberResolvedResource(params)
		return entry?.url ?? params.url
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
		const response = await cache.match(entry.cacheKey)
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
			const resourcePath = this.resolveStoredResourcePath(params.path)
			const key = `${params.mediaType}:${resourcePath}`
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
			MediaResourceOfflineCacheManager.requestDefaultUnregister()
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
		MediaResourceOfflineCacheManager.requestDefaultUnregister()
	}

	/**
	 * 确保离线缓存 SW 已注册。
	 *
	 * 这一步的意义是让“虚拟链接”具备可解释性：渲染层拿到的是同源占位 URL，
	 * 但真正的响应由 SW 在后续请求中根据 `cacheKey/sourceUrl` 还原。
	 */
	private async ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
		if (!this.isOfflineCacheFeatureOn()) return null

		const swUrl = this.options?.serviceWorkerUrl || getDefaultServiceWorkerUrl()
		const absoluteSwUrl = getAbsoluteServiceWorkerUrl(swUrl)
		const existingPromise =
			MediaResourceOfflineCacheManager.registrationPromises.get(absoluteSwUrl)
		if (existingPromise) return existingPromise

		const swScope = getServiceWorkerScope(swUrl)
		const registrationPromise = navigator.serviceWorker
			.register(swUrl, { scope: swScope })
			.then(async (registration) => {
				await navigator.serviceWorker.ready.catch(() => registration)
				await this.waitForServiceWorkerController()
				this.getRegistrationWorker(registration)?.postMessage({
					type: "CANVAS_MEDIA_CACHE_CONFIG",
					maxBytes: this.getMaxBytes(),
				})
				if (MediaResourceOfflineCacheManager.activeConsumerCount === 0) {
					MediaResourceOfflineCacheManager.requestDefaultUnregister()
				}
				return registration
			})
			.catch(() => null)

		MediaResourceOfflineCacheManager.registrationPromises.set(
			absoluteSwUrl,
			registrationPromise,
		)
		return registrationPromise
	}

	private async waitForServiceWorkerController(): Promise<void> {
		const initialController = readServiceWorkerController()
		if (initialController) return

		await new Promise<void>((resolve) => {
			function cleanup() {
				window.clearTimeout(timeoutId)
				navigator.serviceWorker.removeEventListener(
					"controllerchange",
					handleControllerChange,
				)
			}

			function finish() {
				cleanup()
				resolve()
			}

			function handleControllerChange() {
				finish()
			}

			const timeoutId = window.setTimeout(finish, 1000)

			navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
		})
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
		await requestToPromise(
			store.put({
				...entry,
				id: buildResourceId(entry.mediaType, entry.path),
			}),
		)
	}

	private async getEntry(
		path: string,
		mediaType: MediaResourceOfflineCacheMediaType,
	): Promise<CachedMediaResource | null> {
		const resourcePath = this.resolveStoredResourcePath(path)
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readonly")
		const store = transaction.objectStore(STORE_NAME)
		const result = await requestToPromise<(CachedMediaResource & { id: string }) | undefined>(
			store.get(buildResourceId(mediaType, resourcePath)),
		)

		if (!result) return null
		return this.toCachedMediaResource(result)
	}

	private toCachedMediaResource(
		entry: CachedMediaResource & { id: string },
	): CachedMediaResource {
		return {
			path: entry.path,
			url: entry.url,
			sourceUrl: entry.sourceUrl,
			cacheKey: entry.cacheKey,
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
		const entry = await this.getEntry(params.path, params.mediaType)
		const resourcePathForDelete = entry?.path ?? this.resolveStoredResourcePath(params.path)
		const cacheKey = entry?.cacheKey ?? this.getVirtualResourceUrl(resourcePathForDelete)
		const db = await this.openDb()
		const transaction = db.transaction(STORE_NAME, "readwrite")
		const store = transaction.objectStore(STORE_NAME)
		await requestToPromise(
			store.delete(buildResourceId(params.mediaType, resourcePathForDelete)),
		)

		const cache = await caches.open(CACHE_NAME)
		await cache.delete(cacheKey)
	}

	private static async deleteDatabase(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(DB_NAME)
			request.onsuccess = () => resolve()
			request.onerror = () => reject(request.error)
			request.onblocked = () => resolve()
		})
	}

	private static requestDefaultUnregister(): void {
		if (MediaResourceOfflineCacheManager.activeConsumerCount > 0) return
		if (MediaResourceOfflineCacheManager.defaultUnregisterPromise) return

		MediaResourceOfflineCacheManager.defaultUnregisterPromise =
			MediaResourceOfflineCacheManager.unregisterServiceWorker().finally(() => {
				MediaResourceOfflineCacheManager.defaultUnregisterPromise = undefined
			})
	}
}
