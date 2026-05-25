/**
 * Centralized Service Worker constants: cache buckets, TTLs, path rules, and registration query keys.
 * Adjust boundaries here; route/matcher logic lives in cache-runtime.ts.
 *
 * Also imported at build time by `plugins/collect-precache-asset-urls.ts` (plugins → src is intentional:
 * keep path/matcher rules in one module; the plugin must not import bundled `sw.js` output).
 */

/** Query param on the SW script URL for the Workbox CDN runtime. */
export const WORKBOX_CDN_QUERY_PARAM = "workboxCdnUrl"

/** Query param listing comma-separated third-party hosts allowed into the vendor cache bucket. */
export const VENDOR_CACHEABLE_HOSTS_QUERY_PARAM = "vendorCacheHosts"

/** Query marker used by app code to opt fixed-name same-origin resources into SW caching. */
export const RESOURCE_CACHE_MARK_QUERY_PARAM = "swCache"

/** Value of swCache that routes a request into the marked-runtime resource bucket. */
export const MARKED_RUNTIME_RESOURCE_CACHE_VALUE = "runtime"

/** Optional version query on marked resources (`markServiceWorkerCacheableResourceUrl`). */
export const RESOURCE_CACHE_VERSION_QUERY_PARAM = "swv"

/** Prefix for all cache buckets owned by this SW (activate cleanup uses this namespace). */
export const CACHE_NAMESPACE = "magic-web"

/**
 * Hashed JS/CSS under /assets/** — shared by runtime CacheFirst matcher and build-time precache collection.
 * Vite content hashes use base64url characters including '_' and '-'.
 */
export const HASHED_ASSET_PATTERN = /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css)$/

/**
 * Returns whether a pathname is eligible for app-static precache (hashed js/css only).
 */
export function isPrecacheableStaticAssetPath(pathname: string): boolean {
	return HASHED_ASSET_PATTERN.test(pathname)
}

/** Hashed images under /assets/** for the dedicated image bucket. */
export const HASHED_IMAGE_ASSET_PATTERN =
	/^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(png|jpe?g|webp|gif|svg|avif)$/

/**
 * Virtual canvas media URLs: /sw/canvas-design-media/...
 * Must match MediaResourceOfflineCacheManager path generation.
 */
export const CANVAS_MEDIA_SCOPE_PREFIX = "/sw/canvas-design-media/"

/** Same-origin versioned packages served from /packages/** */
export const PACKAGES_SCOPE_PREFIX = "/packages/"

/** Same-origin emoji images served from /emojis/** */
export const EMOJIS_SCOPE_PREFIX = "/emojis/"

/** Fallback vendor hosts when registration does not pass vendorCacheHosts. */
export const DEFAULT_VENDOR_CACHEABLE_HOSTS = ["cdn.jsdelivr.net"] as const

/** Fallback Workbox runtime when workboxCdnUrl is missing on the SW registration URL. */
export const DEFAULT_WORKBOX_RUNTIME_URL =
	"https://cdn.jsdelivr.net/npm/workbox-sw@7.4.1/build/workbox-sw.js"

/** Max concurrent fetch+put operations during install precache. */
export const PRECACHE_BATCH_CONCURRENCY = 20

const SECONDS_PER_DAY = 60 * 60 * 24
 
export const CACHE_TTL_3_DAYS = SECONDS_PER_DAY * 3
export const CACHE_TTL_14_DAYS = SECONDS_PER_DAY * 14
export const CACHE_TTL_30_DAYS = SECONDS_PER_DAY * 30
export const CACHE_TTL_60_DAYS = SECONDS_PER_DAY * 60
 
export const APP_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-app-static-assets-v1`
export const APP_IMAGE_CACHE_NAME = `${CACHE_NAMESPACE}-app-image-assets-v1`
export const APP_MARKED_RESOURCE_CACHE_NAME = `${CACHE_NAMESPACE}-app-marked-resource-assets-v1`
export const PACKAGES_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-packages-static-assets-v1`
export const EMOJIS_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-emojis-static-assets-v1`
export const VENDOR_STATIC_CACHE_NAME = `${CACHE_NAMESPACE}-vendor-static-assets-v1`
export const APP_API_CACHE_NAME = `${CACHE_NAMESPACE}-app-api-cache-v1`

export const CACHEABLE_API_RULES: ReadonlyArray<string | RegExp> = [
	// 核心配置 (支持 RegExp 与 string 混用。写 RegExp 时务必带上 ^ 与 $ 锚点，防止误匹配包含此 URL 作为 query 参数的其它接口)
	/^\/api\/v1\/settings\/(all|menu-modules)$/,
	"/api/v1/auth/environment",
	"/api/v1/modes/default",
	// 多语言翻译包
	"/v4/locales/settings",
	// 功能权限与订阅
	"/api/v1/function-permissions/me",
	"/api/v1/operation-permissions/organization-admin",
	// 工作空间与推荐卡片
	"/api/v1/super-agents/featured",
]

/**
 * Checks whether a given API request URL or pathname matches the cacheable API rules.
 * 
 * NOTE: 
 * 1. This function will automatically clean up the query parameters and hashes, 
 *    extracting the clean pathname to prevent false matching when a URL (e.g. callback URL) 
 *    is included as a query parameter of another non-cacheable API request.
 * 2. When writing RegExp rules in CACHEABLE_API_RULES, ALWAYS anchor them (e.g. starting with `/^` 
 *    and ending with `$/`) or write strict patterns to prevent partial matching bugs.
 */
export function isCacheableApiRequest(urlOrPath: string): boolean {
	if (!urlOrPath) return false

	let pathname = ""
	try {
		// Attempt to parse with a dummy base to handle both absolute URLs and relative paths
		const urlObj = new URL(urlOrPath, "http://localhost")
		pathname = urlObj.pathname
	} catch {
		// Fallback for non-standard formats: manually strip query and hash
		pathname = urlOrPath.split("?")[0].split("#")[0]
	}

	let normalizedPath = pathname.trim()
	if (!normalizedPath.startsWith("/")) {
		normalizedPath = `/${normalizedPath}`
	}
	if (normalizedPath.endsWith("/") && normalizedPath.length > 1) {
		normalizedPath = normalizedPath.slice(0, -1)
	}

	return CACHEABLE_API_RULES.some((rule) => {
		if (rule instanceof RegExp) {
			return rule.test(normalizedPath)
		}
		return rule === normalizedPath
	})
}
 
/** ExpirationPlugin options shared by CacheFirst and post-install precache LRU enforcement. */
export const APP_STATIC_EXPIRATION_OPTIONS = {
	maxEntries: 1200,
	maxAgeSeconds: CACHE_TTL_14_DAYS,
}

export const API_CACHE_EXPIRATION_OPTIONS = {
	maxEntries: 50,
	maxAgeSeconds: CACHE_TTL_3_DAYS,
}
 
/** Cache buckets registered by Workbox routes; activate keeps only these under CACHE_NAMESPACE. */
export const MANAGED_APP_CACHE_NAMES = [
	APP_STATIC_CACHE_NAME,
	APP_IMAGE_CACHE_NAME,
	APP_MARKED_RESOURCE_CACHE_NAME,
	PACKAGES_STATIC_CACHE_NAME,
	EMOJIS_STATIC_CACHE_NAME,
	VENDOR_STATIC_CACHE_NAME,
	APP_API_CACHE_NAME,
] as const
 
/** Prefix for activate-time deletion of stale magic-web buckets. */
export function getManagedCacheNamePrefix(): string {
	return `${CACHE_NAMESPACE}-`
}
