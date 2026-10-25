import type { BrowserClient, HttpPayload } from "@apmplus/web"
import { isIgnoredUrl, type HttpMonitorOptions } from "../http-monitor"

/** A single Fetch request produces one SDK http event; sampling belongs to the SDK. */
export const plugin = (options: HttpMonitorOptions = {}) => {
	let restore: (() => void) | undefined
	let removeStartListener: (() => void) | undefined
	let active = false
	return {
		name: "customFetch",
		setup(client: BrowserClient) {
			const start = () => {
				if (restore || options.enabled === false || typeof window.fetch !== "function")
					return
				const originalFetch = window.fetch
				active = true
				const wrappedFetch: typeof window.fetch = async (input, init) => {
					if (!active) return originalFetch.call(window, input, init)
					const request = typeof input === "object" && "url" in input ? input : undefined
					let url: string
					try {
						url = new URL(request?.url || String(input), window.location.href).href
					} catch {
						return originalFetch.call(window, input, init)
					}
					if (!/^https?:/.test(url)) return originalFetch.call(window, input, init)
					if (isIgnoredUrl(url, options.excludeUrls))
						return originalFetch.call(window, input, init)
					const startTime = performance.now()
					const timestamp = Date.now()
					const config = client.config()
					// Preserve the view that issued the request even if its response arrives after navigation.
					const overrides = {
						pid: config?.pid,
						view_id: config?.viewId,
						url: window.location.href,
						timestamp,
					}
					const signal = init?.signal ?? request?.signal
					const payload: HttpPayload = {
						api: "fetch",
						request: {
							url,
							method: (init?.method || request?.method || "GET").toLowerCase(),
							timestamp,
						},
						response: { status: 0, is_custom_error: false, timestamp },
						duration: 0,
					}
					const report = () => {
						// Optional monitoring must never reject a successful business request.
						try {
							if (active) client.report({ ev_type: "http", payload, overrides })
						} catch {
							/* SDK unavailable. */
						}
					}
					let response: Response
					try {
						response = await originalFetch.call(window, input, init)
					} catch (error) {
						payload.duration = performance.now() - startTime
						payload.response.timestamp = Date.now()
						// Navigation/search cancellation is not an API failure; preserve the original rejection.
						if (
							!signal?.aborted &&
							!(
								error &&
								typeof error === "object" &&
								"name" in error &&
								error.name === "AbortError"
							)
						)
							report()
						throw error
					}
					payload.duration = performance.now() - startTime
					payload.response = {
						status: response.status,
						is_custom_error: false,
						timestamp: Date.now(),
						headers: { "content-type": response.headers.get("content-type") || "" },
					}
					// Technical monitoring never clones, parses or consumes response bodies.
					report()
					return response
				}
				window.fetch = wrappedFetch
				restore = () => {
					if (window.fetch === wrappedFetch) window.fetch = originalFetch
				}
			}
			client.on("start", start)
			removeStartListener = () => client.off("start", start)
		},
		tearDown() {
			active = false
			removeStartListener?.()
			restore?.()
			restore = undefined
		},
	}
}
