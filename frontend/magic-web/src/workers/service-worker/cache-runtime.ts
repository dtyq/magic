/**
 * Workbox-backed runtime caching: matchers, route registration, and install-time precache.
 */

import {
	APP_IMAGE_CACHE_NAME,
	APP_MARKED_RESOURCE_CACHE_NAME,
	APP_STATIC_CACHE_NAME,
	APP_STATIC_EXPIRATION_OPTIONS,
	CACHE_TTL_14_DAYS,
	CACHE_TTL_30_DAYS,
	CACHE_TTL_60_DAYS,
	CANVAS_MEDIA_SCOPE_PREFIX,
	DEFAULT_VENDOR_CACHEABLE_HOSTS,
	DEFAULT_WORKBOX_RUNTIME_URL,
	EMOJIS_SCOPE_PREFIX,
	EMOJIS_STATIC_CACHE_NAME,
	HASHED_ASSET_PATTERN,
	HASHED_IMAGE_ASSET_PATTERN,
	MARKED_RUNTIME_RESOURCE_CACHE_VALUE,
	PACKAGES_SCOPE_PREFIX,
	PACKAGES_STATIC_CACHE_NAME,
	PRECACHE_BATCH_CONCURRENCY,
	RESOURCE_CACHE_MARK_QUERY_PARAM,
	VENDOR_CACHEABLE_HOSTS_QUERY_PARAM,
	VENDOR_STATIC_CACHE_NAME,
	WORKBOX_CDN_QUERY_PARAM,
	APP_API_CACHE_NAME,
	API_CACHE_EXPIRATION_OPTIONS,
} from "./sw-constants"

// Injected at production build by vite-plugin-app-service-worker (empty in dev).
declare const __SW_PRECACHE_ASSETS__: string[]
declare const __SW_WARMUP_ASSETS__: string[]

declare const workbox: WorkboxLike

export interface WorkboxRouteContext {
	url: URL
	request: Request
}

interface WorkboxLike {
	setConfig?: (config: { modulePathPrefix?: string; debug?: boolean }) => void
	routing: {
		registerRoute: (match: (context: WorkboxRouteContext) => boolean, strategy: unknown) => void
	}
	strategies: {
		CacheFirst: new (options: Record<string, unknown>) => unknown
		StaleWhileRevalidate: new (options: Record<string, unknown>) => unknown
	}
	expiration: {
		ExpirationPlugin: new (options: Record<string, unknown>) => unknown
	}
	cacheableResponse: {
		CacheableResponsePlugin: new (options: Record<string, unknown>) => unknown
	}
}

export interface ExpirationPluginLike {
	expireEntries?: (options: { cacheName: string }) => Promise<void>
}

export interface CacheRuntimeRegistration {
	appStaticExpirationPlugin: ExpirationPluginLike
}

export interface WorkboxBootstrapResult {
	configuredWorkboxRuntimeUrl: string | null
	resolvedWorkboxRuntimeUrl: string
	loaded: boolean
	registration: CacheRuntimeRegistration | null
}

const PRECACHE_ASSETS: readonly string[] =
	typeof __SW_PRECACHE_ASSETS__ !== "undefined" ? __SW_PRECACHE_ASSETS__ : []

const WARMUP_ASSETS: readonly string[] =
	typeof __SW_WARMUP_ASSETS__ !== "undefined" ? __SW_WARMUP_ASSETS__ : []

/**
 * Reads workboxCdnUrl from the SW registration script query string.
 */
export function getConfiguredWorkboxRuntimeUrl(sw: ServiceWorkerGlobalScope): string | null {
	const currentScriptUrl = new URL(sw.location.href)
	return currentScriptUrl.searchParams.get(WORKBOX_CDN_QUERY_PARAM)?.trim() || null
}

/**
 * Reads vendorCacheHosts from the SW registration script query string.
 */
export function getConfiguredVendorCacheableHosts(sw: ServiceWorkerGlobalScope): string[] {
	const currentScriptUrl = new URL(sw.location.href)
	const configuredHosts = currentScriptUrl.searchParams
		.get(VENDOR_CACHEABLE_HOSTS_QUERY_PARAM)
		?.split(",")
		.map((host) => host.trim())
		.filter(Boolean)

	if (!configuredHosts?.length) {
		return [...DEFAULT_VENDOR_CACHEABLE_HOSTS]
	}

	return Array.from(new Set(configuredHosts))
}

/**
 * Loads the Workbox IIFE runtime via importScripts.
 */
export function loadWorkboxRuntime(runtimeUrl: string): boolean {
	try {
		importScripts(runtimeUrl)
		return true
	} catch {
		return false
	}
}

export function getWorkboxModulePathPrefix(
	runtimeUrl: string,
	baseUrl?: string,
): string | null {
	const normalizedRuntimeUrl = runtimeUrl.trim()
	if (!normalizedRuntimeUrl) return null

	try {
		const resolvedRuntimeUrl = baseUrl
			? new URL(normalizedRuntimeUrl, baseUrl)
			: new URL(normalizedRuntimeUrl)
		const lastSlashIndex = resolvedRuntimeUrl.pathname.lastIndexOf("/")
		if (lastSlashIndex < 0) return null

		const modulePathname = resolvedRuntimeUrl.pathname.slice(0, lastSlashIndex)
		return `${resolvedRuntimeUrl.origin}${modulePathname}`
	} catch {
		return null
	}
}

/**
 * Resolves Workbox CDN URL, loads runtime, and registers all CacheFirst buckets.
 */
export function bootstrapWorkboxCacheRuntime(sw: ServiceWorkerGlobalScope): WorkboxBootstrapResult {
	const configuredWorkboxRuntimeUrl = getConfiguredWorkboxRuntimeUrl(sw)
	const resolvedWorkboxRuntimeUrl = configuredWorkboxRuntimeUrl || DEFAULT_WORKBOX_RUNTIME_URL

	if (!configuredWorkboxRuntimeUrl) {
		console.warn(
			"[sw] Missing workboxCdnUrl in service worker registration URL, fallback to default runtime URL",
		)
	}

	if (!loadWorkboxRuntime(resolvedWorkboxRuntimeUrl)) {
		console.error("[sw] Failed to load Workbox runtime", {
			attemptedUrl: resolvedWorkboxRuntimeUrl,
			configuredUrl: configuredWorkboxRuntimeUrl,
		})
		return {
			configuredWorkboxRuntimeUrl,
			resolvedWorkboxRuntimeUrl,
			loaded: false,
			registration: null,
		}
	}

	const vendorCacheableHosts = getConfiguredVendorCacheableHosts(sw)
	const registration = registerAppCacheRoutes(
		sw,
		vendorCacheableHosts,
		resolvedWorkboxRuntimeUrl,
	)
	return {
		configuredWorkboxRuntimeUrl,
		resolvedWorkboxRuntimeUrl,
		loaded: true,
		registration,
	}
}

/**
 * Registers Workbox CacheFirst routes for all managed app cache buckets.
 */
function registerAppCacheRoutes(
	sw: ServiceWorkerGlobalScope,
	vendorCacheableHosts: readonly string[],
	workboxRuntimeUrl: string,
): CacheRuntimeRegistration {
	const modulePathPrefix = getWorkboxModulePathPrefix(workboxRuntimeUrl, sw.location.origin)
	workbox.setConfig?.({ modulePathPrefix: modulePathPrefix || undefined, debug: false })

	const { registerRoute } = workbox.routing
	const { CacheFirst, StaleWhileRevalidate } = workbox.strategies
	const { ExpirationPlugin } = workbox.expiration
	const { CacheableResponsePlugin } = workbox.cacheableResponse

	const appStaticExpirationPlugin = new ExpirationPlugin(
		APP_STATIC_EXPIRATION_OPTIONS,
	) as ExpirationPluginLike

	const sameOrigin = sw.location.origin

	registerRoute(
		(context) => isCacheableStaticAsset(context, sameOrigin),
		new CacheFirst({
			cacheName: APP_STATIC_CACHE_NAME,
			plugins: [new CacheableResponsePlugin({ statuses: [200] }), appStaticExpirationPlugin],
		}),
	)

	registerRoute(
		(context) => isCacheableImageAsset(context),
		new CacheFirst({
			cacheName: APP_IMAGE_CACHE_NAME,
			plugins: [
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 500,
					maxAgeSeconds: CACHE_TTL_14_DAYS,
				}),
			],
		}),
	)

	registerRoute(
		(context) => isExplicitlyMarkedCacheableResource(context, sameOrigin),
		new CacheFirst({
			cacheName: APP_MARKED_RESOURCE_CACHE_NAME,
			plugins: [
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 100,
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	registerRoute(
		(context) => isCacheablePackagesAsset(context, sameOrigin),
		new CacheFirst({
			cacheName: PACKAGES_STATIC_CACHE_NAME,
			plugins: [
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 400,
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	registerRoute(
		(context) => isCacheableEmojiAsset(context, sameOrigin),
		new CacheFirst({
			cacheName: EMOJIS_STATIC_CACHE_NAME,
			plugins: [
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 400,
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	registerRoute(
		(context) => isCacheableVendorAsset(context, vendorCacheableHosts),
		new CacheFirst({
			cacheName: VENDOR_STATIC_CACHE_NAME,
			fetchOptions: {
				credentials: "omit",
			},
			plugins: [
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 400,
					maxAgeSeconds: CACHE_TTL_30_DAYS,
				}),
			],
		}),
	)

	const apiBusinessCacheablePlugin = {
		cacheWillUpdate: async ({ response }: { response: Response }) => {
			if (response.status !== 200) return null
			try {
				const clonedResponse = response.clone()
				const json = await clonedResponse.json()
				if (json && (json.code === 1000 || json.code === undefined)) {
					return response
				}
			} catch {
				return null
			}
			return null
		},
		requestWillFetch: async ({ request }: { request: Request }) => {
			try {
				const url = new URL(request.url)
				if (url.searchParams.has("swCache")) {
					url.searchParams.delete("swCache")
					return new Request(url.toString(), request)
				}
			} catch {
				// Fallback
			}
			return request
		}
	}

	registerRoute(
		({ request, url }) => {
			if (request.method !== "GET") return false
			return url.searchParams.get("swCache") === "api-runtime"
		},
		new StaleWhileRevalidate({
			cacheName: APP_API_CACHE_NAME,
			plugins: [
				apiBusinessCacheablePlugin,
				new ExpirationPlugin(API_CACHE_EXPIRATION_OPTIONS),
			],
		}),
	)

	return { appStaticExpirationPlugin }
}

/**
 * Runs async work on items in fixed-size batches to avoid saturating the network on install.
 */
async function runTasksInBatches<T>(
	items: readonly T[],
	batchSize: number,
	runner: (item: T) => Promise<void>,
): Promise<void> {
	for (let index = 0; index < items.length; index += batchSize) {
		const batch = items.slice(index, index + batchSize)
		await Promise.allSettled(batch.map((item) => runner(item)))
	}
}

/**
 * Populates the static assets bucket during install so CacheFirst can hit on first routed request.
 */
export async function precacheStaticAssetsOnInstall(): Promise<void> {
	if (!PRECACHE_ASSETS.length) return

	const cache = await caches.open(APP_STATIC_CACHE_NAME)
	await runTasksInBatches(PRECACHE_ASSETS, PRECACHE_BATCH_CONCURRENCY, async (assetPath) => {
		try {
			const request = new Request(assetPath, { credentials: "same-origin" })
			const response = await fetch(request)
			if (!response.ok) return
			await cache.put(request, response)
		} catch {
			// A single failed precache URL must not reject the install event.
		}
	})
}

let lastWarmedUpAssetsSerialized = ""
let inFlightWarmUpSerialized = ""
let inFlightWarmUpPromise: Promise<void> | null = null
const activeWarmUpUrls = new Set<string>()

function normalizeWarmUpAssets(assets?: readonly string[]): string[] {
	const sourceAssets = assets?.length ? assets : WARMUP_ASSETS
	const normalizedAssets = sourceAssets
		.map((assetPath) => assetPath.trim())
		.filter((assetPath) => Boolean(assetPath))

	return Array.from(new Set(normalizedAssets)).sort()
}

function toWarmUpCacheKey(assetPath: string): string {
	return new URL(assetPath, self.location.origin).toString()
}

/**
 * Populates static assets list during browser idle phase.
 * Uses concurrent batches of 10 and 200ms delay between intervals.
 */
export async function warmUpStaticAssetsOnIdle(assets?: string[]): Promise<void> {
	const assetsToWarm = normalizeWarmUpAssets(assets)
	if (!assetsToWarm.length) return

	const serialized = assetsToWarm.join(",")
	if (lastWarmedUpAssetsSerialized === serialized) return

	if (inFlightWarmUpPromise && inFlightWarmUpSerialized === serialized) {
		try {
			await inFlightWarmUpPromise
		} catch {
			// The owner invocation logs overall failure details.
		}
		return
	}

	inFlightWarmUpSerialized = serialized
	inFlightWarmUpPromise = (async () => {
		const cache = await caches.open(APP_STATIC_CACHE_NAME)
		const batchSize = 10
		const intervalMs = 200

		for (let index = 0; index < assetsToWarm.length; index += batchSize) {
			const batch = assetsToWarm.slice(index, index + batchSize)
			let fetchedInBatch = false

			await Promise.allSettled(
				batch.map(async (assetPath) => {
					const cacheKey = toWarmUpCacheKey(assetPath)
					if (activeWarmUpUrls.has(cacheKey)) return
					activeWarmUpUrls.add(cacheKey)

					try {
						const request = new Request(cacheKey, { credentials: "same-origin" })
						// Skip if already in cache (e.g. cached via regular HTTP dynamic request)
						const existing = await cache.match(request)
						if (existing) return

						fetchedInBatch = true
						const response = await fetch(request)
						if (response.ok) {
							await cache.put(request, response)
						}
					} catch {
						// Ignored single request failure.
					} finally {
						activeWarmUpUrls.delete(cacheKey)
					}
				}),
			)

			if (fetchedInBatch) {
				await new Promise((resolve) => setTimeout(resolve, intervalMs))
			}
		}

		// Mark as completed only after all batches are processed.
		lastWarmedUpAssetsSerialized = serialized
	})()

	try {
		await inFlightWarmUpPromise
	} catch (error) {
		console.warn("[sw] Warm-up overall failure", { error })
	} finally {
		if (inFlightWarmUpSerialized === serialized) {
			inFlightWarmUpSerialized = ""
			inFlightWarmUpPromise = null
		}
	}
}

/**
 * After install precache, enforce APP_STATIC maxEntries because native puts skip ExpirationPlugin.
 */
export async function enforceAppStaticExpirationAfterPrecache(
	registration: CacheRuntimeRegistration | null,
): Promise<void> {
	if (!registration?.appStaticExpirationPlugin.expireEntries) return
	await registration.appStaticExpirationPlugin.expireEntries({
		cacheName: APP_STATIC_CACHE_NAME,
	})
}

function isCacheableStaticAsset(
	{ request, url }: WorkboxRouteContext,
	sameOrigin: string,
): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (request.destination === "font") return url.origin === sameOrigin
	if (request.destination !== "script" && request.destination !== "style") return false
	if (url.origin !== sameOrigin) return false
	return HASHED_ASSET_PATTERN.test(url.pathname)
}

function isCacheableImageAsset({ request, url }: WorkboxRouteContext): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (request.destination !== "image") return false
	return HASHED_IMAGE_ASSET_PATTERN.test(url.pathname)
}

function isExplicitlyMarkedCacheableResource(
	{ request, url }: WorkboxRouteContext,
	sameOrigin: string,
): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sameOrigin) return false
	return (
		url.searchParams.get(RESOURCE_CACHE_MARK_QUERY_PARAM) ===
		MARKED_RUNTIME_RESOURCE_CACHE_VALUE
	)
}

function isCacheablePackagesAsset(
	{ request, url }: WorkboxRouteContext,
	sameOrigin: string,
): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sameOrigin) return false
	return url.pathname.startsWith(PACKAGES_SCOPE_PREFIX)
}

function isCacheableEmojiAsset({ request, url }: WorkboxRouteContext, sameOrigin: string): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sameOrigin) return false
	if (request.destination !== "image") return false
	return url.pathname.startsWith(EMOJIS_SCOPE_PREFIX)
}

function isCacheableVendorAsset(
	{ request, url }: WorkboxRouteContext,
	vendorCacheableHosts: readonly string[],
): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (
		request.destination !== "script" &&
		request.destination !== "style" &&
		request.destination !== "font"
	) {
		return false
	}
	return vendorCacheableHosts.includes(url.hostname)
}
