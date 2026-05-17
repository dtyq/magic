/// <reference lib="webworker" />

const sw = globalThis as unknown as ServiceWorkerGlobalScope

interface WorkboxRouteContext {
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
	}
	expiration: {
		ExpirationPlugin: new (options: Record<string, unknown>) => unknown
	}
	cacheableResponse: {
		CacheableResponsePlugin: new (options: Record<string, unknown>) => unknown
	}
}

declare const workbox: WorkboxLike

// Query params passed through the service worker registration URL.
const WORKBOX_CDN_QUERY_PARAM = "workboxCdnUrl"
const VENDOR_CACHEABLE_HOSTS_QUERY_PARAM = "vendorCacheHosts"

// Query marker used by app code to opt specific fixed-name resources into SW caching.
const RESOURCE_CACHE_MARK_QUERY_PARAM = "swCache"
const MARKED_RUNTIME_RESOURCE_CACHE_VALUE = "runtime"

// Namespace all cache buckets managed by this SW to avoid touching unrelated same-origin caches.
const CACHE_NAMESPACE = "magic-web"

// Dedicated cache buckets for each resource class to keep eviction and rollback targeted.
const APP_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-app-static-assets-v1`
const APP_IMAGE_CACHE_NAME = `${CACHE_NAMESPACE}-app-image-assets-v1`
const APP_MARKED_RESOURCE_CACHE_NAME = `${CACHE_NAMESPACE}-app-marked-resource-assets-v1`
const PACKAGES_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-packages-static-assets-v1`
const EMOJIS_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-emojis-static-assets-v1`
const VENDOR_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-vendor-static-assets-v1`

const SECONDS_PER_DAY = 60 * 60 * 24
const CACHE_TTL_14_DAYS = SECONDS_PER_DAY * 14
const CACHE_TTL_30_DAYS = SECONDS_PER_DAY * 30
const CACHE_TTL_60_DAYS = SECONDS_PER_DAY * 60

// Path and filename heuristics for cacheable same-origin assets.
// Vite content hashes use base64url characters which include '_' and '-',
// so the character class must cover [A-Za-z0-9_-] to avoid missing ~20% of files.
const HASHED_ASSET_PATTERN = /\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css)$/
const HASHED_IMAGE_ASSET_PATTERN = /\/assets\/.+-[A-Za-z0-9_-]{6,}\.(png|jpe?g|webp|gif|svg|avif)$/
const CANVAS_MEDIA_SCOPE_PREFIX = "/canvas-design-media/"
const PACKAGES_SCOPE_PREFIX = "/packages/"
const EMOJIS_SCOPE_PREFIX = "/emojis/"

// Built-in fallback hosts for third-party vendor assets when runtime config provides none.
const DEFAULT_VENDOR_CACHEABLE_HOSTS = ["cdn.jsdelivr.net"]

/**
 * 解析本次 SW 注册透传的 Workbox 地址。
 */
function getConfiguredWorkboxRuntimeUrl(): string | null {
	const currentScriptUrl = new URL(sw.location.href)
	return currentScriptUrl.searchParams.get(WORKBOX_CDN_QUERY_PARAM)?.trim() || null
}

/**
 * 解析页面注册 SW 时透传的可缓存 vendor host 集合。
 */
function getConfiguredVendorCacheableHosts(): string[] {
	const currentScriptUrl = new URL(sw.location.href)
	const configuredHosts = currentScriptUrl.searchParams
		.get(VENDOR_CACHEABLE_HOSTS_QUERY_PARAM)
		?.split(",")
		.map((host) => host.trim())
		.filter(Boolean)

	if (!configuredHosts?.length) {
		return DEFAULT_VENDOR_CACHEABLE_HOSTS
	}

	return Array.from(new Set(configuredHosts))
}

/**
 * 加载配置中的 Workbox 运行时。
 */
function loadWorkboxRuntime(runtimeUrl: string): boolean {
	try {
		importScripts(runtimeUrl)
		return true
	} catch {
		return false
	}
}

/**
 * 判断请求是否属于主站带 hash 的静态资源或稳定字体资源。
 */
function isCacheableStaticAsset({ request, url }: WorkboxRouteContext): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	// Only cache same-origin fonts here; cross-origin fonts go through isCacheableVendorAsset.
	if (request.destination === "font") return url.origin === sw.location.origin
	if (request.destination !== "script" && request.destination !== "style") return false
	if (url.origin !== sw.location.origin) return false
	return HASHED_ASSET_PATTERN.test(url.pathname)
}

/**
 * 判断请求是否属于主站带 hash 的图片资源。
 */
function isCacheableImageAsset({ request, url }: WorkboxRouteContext): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (request.destination !== "image") return false
	return HASHED_IMAGE_ASSET_PATTERN.test(url.pathname)
}

/**
 * 判断请求是否为业务代码显式标记的同源固定名资源，如 wasm、worker 等。
 */
function isExplicitlyMarkedCacheableResource({ request, url }: WorkboxRouteContext): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sw.location.origin) return false
	return (
		url.searchParams.get(RESOURCE_CACHE_MARK_QUERY_PARAM) ===
		MARKED_RUNTIME_RESOURCE_CACHE_VALUE
	)
}

/**
 * 判断请求是否属于同源 packages 目录下的静态资源。
 */
function isCacheablePackagesAsset({ request, url }: WorkboxRouteContext): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sw.location.origin) return false
	return url.pathname.startsWith(PACKAGES_SCOPE_PREFIX)
}

/**
 * 判断请求是否属于同源 emojis 目录下的图片资源。
 */
function isCacheableEmojiAsset({ request, url }: WorkboxRouteContext): boolean {
	if (request.method !== "GET") return false
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (url.origin !== sw.location.origin) return false
	if (request.destination !== "image") return false
	return url.pathname.startsWith(EMOJIS_SCOPE_PREFIX)
}

/**
 * 判断请求是否属于允许进入独立缓存桶的第三方稳定静态资源。
 */
function isCacheableVendorAsset({ request, url }: WorkboxRouteContext): boolean {
	if (url.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false
	if (
		request.destination !== "script" &&
		request.destination !== "style" &&
		request.destination !== "font"
	) {
		return false
	}
	return getConfiguredVendorCacheableHosts().includes(url.hostname)
}

const configuredWorkboxRuntimeUrl = getConfiguredWorkboxRuntimeUrl()

if (!configuredWorkboxRuntimeUrl) {
	console.error("[sw] Missing workboxCdnUrl in service worker registration URL")
} else if (loadWorkboxRuntime(configuredWorkboxRuntimeUrl)) {
	workbox.setConfig?.({ debug: false })

	const { registerRoute } = workbox.routing
	const { CacheFirst } = workbox.strategies
	const { ExpirationPlugin } = workbox.expiration
	const { CacheableResponsePlugin } = workbox.cacheableResponse

	// Hashed app scripts, styles, and stable fonts are version-coupled to each build,
	// so a long-lived CacheFirst bucket is safe and keeps repeat visits fast.
	registerRoute(
		isCacheableStaticAsset,
		new CacheFirst({
			cacheName: APP_STATIC_CACHE_NAME,
			plugins: [
				// Only cache successful responses and keep enough entries for the current build.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 1200,
					// Keep at least 14 days to satisfy the minimum retention window while limiting stale buildup.
					maxAgeSeconds: CACHE_TTL_14_DAYS,
				}),
			],
		}),
	)

	// Hashed images are also build-versioned, but their count is higher than JS/CSS,
	// so they get a larger bucket and independent eviction pressure.
	registerRoute(
		isCacheableImageAsset,
		new CacheFirst({
			cacheName: APP_IMAGE_CACHE_NAME,
			plugins: [
				// Cache only valid image responses to avoid storing broken placeholders.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					// Images are fewer than JS chunks, but releases still churn hashed references.
					maxEntries: 500,
					// Keep at least 14 days to match the minimum retention policy across runtime buckets.
					maxAgeSeconds: CACHE_TTL_14_DAYS,
				}),
			],
		}),
	)

	// Explicitly marked runtime assets cover fixed-name resources such as wasm or workers.
	// They are high-value but few in number, so keep this bucket intentionally small.
	registerRoute(
		isExplicitlyMarkedCacheableResource,
		new CacheFirst({
			cacheName: APP_MARKED_RESOURCE_CACHE_NAME,
			plugins: [
				// Only successful fetches should be reused for fixed-name runtime assets.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					// Marked runtime resources are few but critical (wasm/worker), reserve extra rollback headroom.
					maxEntries: 100,
					// Keep 60 days because these fixed-name runtime resources are relatively stable.
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	// /packages/** contains same-origin runtime libraries and auxiliary static files.
	// It gets its own bucket so future rollback or cleanup can target package assets only.
	registerRoute(
		isCacheablePackagesAsset,
		new CacheFirst({
			cacheName: PACKAGES_STATIC_CACHE_NAME,
			plugins: [
				// Restrict caching to successful package asset responses.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					maxEntries: 400,
					// Keep 60 days because package resources are typically long-lived and rarely changed.
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	// Emoji images are numerous and frequently revisited by the picker, so they use
	// an image-only bucket with a higher entry cap.
	registerRoute(
		isCacheableEmojiAsset,
		new CacheFirst({
			cacheName: EMOJIS_STATIC_CACHE_NAME,
			plugins: [
				// Emoji cache should only contain successful image responses.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					// Emoji assets are relatively stable; keep enough entries to avoid re-downloading packs.
					maxEntries: 400,
					// Keep 60 days because emoji packs are long-lived and benefit from extended reuse.
					maxAgeSeconds: CACHE_TTL_60_DAYS,
				}),
			],
		}),
	)

	// Cross-origin vendor assets stay isolated from same-origin app assets so incidents,
	// host migrations, or cleanup can be handled without touching first-party caches.
	registerRoute(
		isCacheableVendorAsset,
		new CacheFirst({
			cacheName: VENDOR_STATIC_CACHE_NAME,
			plugins: [
				// Only cache successful vendor responses from the allowlisted hosts.
				new CacheableResponsePlugin({ statuses: [200] }),
				new ExpirationPlugin({
					// Vendor dependencies are fewer, but keep moderate room for version bumps and host rollovers.
					maxEntries: 400,
					// Keep 30 days for third-party assets to balance hit rate and stale risk.
					maxAgeSeconds: CACHE_TTL_30_DAYS,
				}),
			],
		}),
	)
} else {
	console.error("[sw] Failed to load Workbox runtime from configured URL")
}

sw.addEventListener("message", (event) => {
	if (event.data?.type !== "SKIP_WAITING") return
	void sw.skipWaiting()
})

sw.addEventListener("activate", (event) => {
	const knownCacheNames = new Set([
		APP_STATIC_CACHE_NAME,
		APP_IMAGE_CACHE_NAME,
		APP_MARKED_RESOURCE_CACHE_NAME,
		PACKAGES_STATIC_CACHE_NAME,
		EMOJIS_STATIC_CACHE_NAME,
		VENDOR_STATIC_CACHE_NAME,
	])
	const cacheNamePrefix = `${CACHE_NAMESPACE}-`
	event.waitUntil(
		Promise.all([
			sw.clients.claim(),
			caches.keys().then((keys) =>
				Promise.all(
					keys
						.filter((key) => {
							if (knownCacheNames.has(key)) return false
							return key.startsWith(cacheNamePrefix)
						})
						.map((key) => caches.delete(key)),
				),
			),
		]),
	)
})
