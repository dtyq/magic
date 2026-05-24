import { env } from "@/utils/env"
import { isCacheableApiRequest } from "@/workers/service-worker/sw-constants"
import type { RequestConfig } from "../../core/HttpClient"

/**
 * Request interceptor for Service Worker API caching.
 * Appends `swCache=api-runtime` query parameter to whitelisted GET requests
 * when the SW cache feature toggle is enabled.
 */
export function swCacheRequestInterceptor(config: RequestConfig): RequestConfig {
	// 默认开启 API 缓存，除非在环境变量中显式配置为 "false"
	const enableApiCache = env("MAGIC_ENABLE_API_CACHE") !== "false"
	const method = config.method ? config.method.toUpperCase() : "GET"

	if (method === "GET" && config.url) {
		const swCacheOption = config.swCacheOption || "default"
		let shouldCache = false

		if (swCacheOption === "cache") {
			shouldCache = true
		} else if (swCacheOption === "no-cache") {
			shouldCache = false
		} else {
			// default: follows environmental toggle and whitelist rules
			try {
				const urlObj = new URL(config.url, window.location.origin)
				shouldCache = enableApiCache && isCacheableApiRequest(urlObj.pathname)
			} catch {
				shouldCache = enableApiCache && isCacheableApiRequest(config.url)
			}
		}

		if (shouldCache) {
			try {
				const urlObj = new URL(config.url, window.location.origin)
				urlObj.searchParams.set("swCache", "api-runtime")
				config.url = config.url.startsWith("http")
					? urlObj.toString()
					: `${urlObj.pathname}${urlObj.search}${urlObj.hash}`
			} catch {
				// Fallback
			}
		}
	}

	return config
}
