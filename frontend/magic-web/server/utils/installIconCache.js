const crypto = require("node:crypto")
const getGlobalPlatformInfo = require("../apis/getGlobalPlatformInfo")
const getPublishedMicroApp = require("../apis/getPublishedMicroApp")
const defaultInstallIcon = require("./defaultInstallIcon")
const downloadInstallIcon = require("./downloadInstallIcon")
const { BUILTIN_DEFAULT_ICON_KEY } = require("./microAppInstallConstants")

const PUBLISHED_MICRO_APP_CACHE_TTL_MS = 30_000
const INSTALL_ICON_CACHE_TTL_MS = 5 * 60_000
const INSTALL_ICON_NEGATIVE_CACHE_TTL_MS = 10_000
const MAX_CACHE_ENTRIES = 1_000
const ICON_RATE_LIMIT_WINDOW_MS = 60_000
const ICON_RATE_LIMIT_MAX = 120
const MAX_UPSTREAM_ICON_DOWNLOADS = 8

const publishedMicroAppCache = new Map()
const installIconCache = new Map()
const installIconInflight = new Map()
const iconRateLimitBuckets = new Map()
let upstreamIconDownloads = 0

function setBoundedCacheValue(cache, key, value) {
	if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
		cache.delete(cache.keys().next().value)
	}
	cache.set(key, value)
}

function readInstallIconUrl(publishedMicroApp) {
	const rawUrl = publishedMicroApp?.icon_url
	return typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : ""
}

function readPlatformFaviconUrl(platformInfo) {
	const favicon = platformInfo?.favicon
	return typeof favicon === "string" && favicon.trim() ? favicon.trim() : ""
}

function readResourceId(publishedMicroApp) {
	const resourceId = publishedMicroApp?.resource_id
	return typeof resourceId === "string" && resourceId.trim() ? resourceId.trim() : ""
}

async function readPlatformFaviconSourceKey() {
	const platformFaviconUrl = await getGlobalPlatformInfo()
		.then(readPlatformFaviconUrl)
		.catch(() => "")
	return platformFaviconUrl ? toStableIconSourceKey(platformFaviconUrl) : BUILTIN_DEFAULT_ICON_KEY
}

/**
 * Drop signed query/hash so token rotation reuses the same cache entry.
 * Key shape: appId + resource_id + stable source identity.
 */
async function buildInstallIconCacheKey(appId, publishedMicroApp) {
	const iconUrl = readInstallIconUrl(publishedMicroApp)
	const resourceId = readResourceId(publishedMicroApp) || "no-resource"
	const sourceKey = iconUrl
		? toStableIconSourceKey(iconUrl)
		: await readPlatformFaviconSourceKey()
	return `${appId}:${resourceId}:${sourceKey}`
}

function toStableIconSourceKey(iconUrl) {
	try {
		const url = new URL(iconUrl)
		return `${url.origin}${url.pathname}`
	} catch {
		return iconUrl.split(/[?#]/)[0] || iconUrl
	}
}

function pruneStaleAppIconEntries(appId, keepKey) {
	const prefix = `${appId}:`
	for (const key of installIconCache.keys()) {
		if (key.startsWith(prefix) && key !== keepKey) installIconCache.delete(key)
	}
}

function getIconClientKey(req) {
	const forwarded = req.headers?.["x-forwarded-for"]
	if (typeof forwarded === "string" && forwarded.trim())
		return forwarded.split(",")[0].trim()
	if (typeof req.ip === "string" && req.ip.trim()) return req.ip.trim()
	return "anonymous"
}

function consumeIconRateLimit(clientKey) {
	const now = Date.now()
	const cached = iconRateLimitBuckets.get(clientKey)
	const bucket =
		cached && now - cached.windowStart < ICON_RATE_LIMIT_WINDOW_MS
			? cached
			: { windowStart: now, count: 0 }

	if (bucket.count >= ICON_RATE_LIMIT_MAX) {
		setBoundedCacheValue(iconRateLimitBuckets, clientKey, bucket)
		return false
	}

	bucket.count += 1
	setBoundedCacheValue(iconRateLimitBuckets, clientKey, bucket)
	return true
}

async function withUpstreamIconSlot(task) {
	if (upstreamIconDownloads >= MAX_UPSTREAM_ICON_DOWNLOADS) {
		const error = new Error("Install icon upstream concurrency limit exceeded")
		error.statusCode = 503
		throw error
	}

	upstreamIconDownloads += 1
	try {
		return await task()
	} finally {
		upstreamIconDownloads -= 1
	}
}

function createIconEtag(icon) {
	return `"${crypto.createHash("sha256").update(icon.body).digest("hex")}"`
}

async function getCachedPublishedMicroApp(appId) {
	const now = Date.now()
	const cached = publishedMicroAppCache.get(appId)
	if (cached && cached.expiresAt > now) {
		if (cached.error) throw cached.error
		return cached.value
	}

	try {
		const value = await getPublishedMicroApp(appId)
		setBoundedCacheValue(publishedMicroAppCache, appId, {
			value,
			expiresAt: now + PUBLISHED_MICRO_APP_CACHE_TTL_MS,
		})
		return value
	} catch (error) {
		const statusCode = Number(error?.statusCode)
		if (statusCode >= 400 && statusCode < 500) {
			setBoundedCacheValue(publishedMicroAppCache, appId, {
				error,
				expiresAt: now + INSTALL_ICON_NEGATIVE_CACHE_TTL_MS,
			})
		}
		throw error
	}
}

async function resolveInstallIconBody(publishedMicroApp) {
	// App icon.svg → platform favicon → built-in default (keeps installable).
	const iconUrl = readInstallIconUrl(publishedMicroApp)
	if (iconUrl) {
		const icon = await downloadInstallIcon(iconUrl).catch(() => null)
		if (icon) return icon
	}

	const platformFaviconUrl = await getGlobalPlatformInfo()
		.then(readPlatformFaviconUrl)
		.catch(() => "")
	if (platformFaviconUrl) {
		const platformIcon = await downloadInstallIcon(platformFaviconUrl).catch(() => null)
		if (platformIcon) return platformIcon
	}

	return defaultInstallIcon
}

/**
 * Coalesce concurrent size variants and cache by stable source identity.
 * When source/resource changes, prune older keys for the same appId.
 */
async function getCachedInstallIcon(appId) {
	const inflight = installIconInflight.get(appId)
	if (inflight) return inflight

	const promise = (async () => {
		const publishedMicroApp = await getCachedPublishedMicroApp(appId)
		const cacheKey = await buildInstallIconCacheKey(appId, publishedMicroApp)
		pruneStaleAppIconEntries(appId, cacheKey)

		const now = Date.now()
		const cached = installIconCache.get(cacheKey)
		if (cached && cached.expiresAt > now) return cached.value

		const icon = await withUpstreamIconSlot(() => resolveInstallIconBody(publishedMicroApp))
		const value = icon ? { ...icon, etag: createIconEtag(icon) } : null
		setBoundedCacheValue(installIconCache, cacheKey, {
			value,
			expiresAt:
				now + (value ? INSTALL_ICON_CACHE_TTL_MS : INSTALL_ICON_NEGATIVE_CACHE_TTL_MS),
		})
		return value
	})()

	installIconInflight.set(appId, promise)
	try {
		return await promise
	} finally {
		installIconInflight.delete(appId)
	}
}

function resetInstallIconCache({ keepIconBodies = false } = {}) {
	publishedMicroAppCache.clear()
	installIconInflight.clear()
	iconRateLimitBuckets.clear()
	upstreamIconDownloads = 0
	if (!keepIconBodies) installIconCache.clear()
}

module.exports = {
	buildInstallIconCacheKey,
	consumeIconRateLimit,
	getCachedInstallIcon,
	getIconClientKey,
	readInstallIconUrl,
	resetInstallIconCache,
	resolveInstallIconBody,
	toStableIconSourceKey,
}
