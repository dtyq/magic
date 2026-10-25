import type { RequestConfig } from "../clients/types"

/**
 * Request interceptor for Service Worker API caching.
 * Appends `swCache=api-runtime` query parameter to whitelisted GET requests
 * when the SW cache feature toggle is enabled.
 */
export function createSwCacheInterceptor(options: {
	enabled: () => boolean
	isCacheable: (path: string) => boolean
	origin: () => string
}) {
	return function swCacheRequestInterceptor(
		config: RequestConfig<Headers>,
	): RequestConfig<Headers> {
		// 默认开启 API 缓存，除非在环境变量中显式配置为 "false"
		const enableApiCache = options.enabled()
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
					const urlObj = new URL(config.url, options.origin())
					shouldCache = enableApiCache && options.isCacheable(urlObj.pathname)
				} catch {
					shouldCache = enableApiCache && options.isCacheable(config.url)
				}
			}

			if (shouldCache) {
				try {
					const urlObj = new URL(config.url, options.origin())
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
}
