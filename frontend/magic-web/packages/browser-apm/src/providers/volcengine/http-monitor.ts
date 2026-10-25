import type { HttpPayload } from "@apmplus/web"

export const TELEMETRY_IGNORE_URLS = [
	/\/monitor_web\/collect/,
	/\/monitor_browser\/collect/,
	/\/settings\/get\/webpro/,
]
export const RESOURCE_IGNORE_TYPES = ["fetch", "xmlhttprequest", "beacon"]

export interface HttpMonitorOptions {
	enabled?: boolean
	/** Milliseconds, defaults to one second. */
	slowApiThreshold?: number
	excludeUrls?: (string | RegExp)[]
}

export function isIgnoredUrl(url: string, patterns: (string | RegExp)[] = []) {
	return [...TELEMETRY_IGNORE_URLS, ...patterns].some((pattern) => {
		if (typeof pattern === "string") return url.includes(pattern)
		pattern.lastIndex = 0
		return pattern.test(url)
	})
}

export function annotateHttp(payload: HttpPayload, threshold = 1000) {
	const streaming = /text\/event-stream/i.test(payload.response.headers?.["content-type"] || "")
	payload.extra = {
		...payload.extra,
		is_slow: String(!streaming && payload.duration >= threshold),
		slow_threshold: String(threshold),
		// HTTP 2xx/3xx and opaque responses are not application failures.
		is_http_error: String(payload.response.status >= 400),
	}
	return payload
}
