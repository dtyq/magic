import {
	SW_DIAGNOSTICS_CACHE_MATCH_THRESHOLD_QUERY_PARAM,
	SW_DIAGNOSTICS_CACHE_START_THRESHOLD_QUERY_PARAM,
	SW_DIAGNOSTICS_ENABLED_QUERY_PARAM,
	SW_DIAGNOSTICS_TOTAL_THRESHOLD_QUERY_PARAM,
} from "./sw-constants"

const SW_MODULE_EVALUATED_AT = performance.now()

interface DiagnosticsThresholds {
	cacheStartMs: number
	cacheMatchMs: number
	totalMs: number
}

interface DiagnosticMetrics {
	cacheMatchMs: number | null
	fetchToCacheStartMs: number | null
	totalMs: number
}

interface RequestTimingState {
	sequence: number
	url: string
	// Timestamp when the SW fetch listener first observed the request.
	fetchStartedAt: number
	// Timestamp when Workbox started its cache-key lookup for this route.
	cacheLookupStartedAt?: number
	// Timestamp after Workbox completed cache lookup and cached-response plugins.
	cacheLookupFinishedAt?: number
	// Whether Workbox received a response from the configured cache bucket.
	cacheHit?: boolean
	// First monitored static request, not necessarily the first fetch event of the SW.
	firstStaticRequest?: boolean
	// Number of monitored static requests active when this lookup started, including this one.
	activeRequestCountAtStart?: number
}

interface CacheKeyWillBeUsedContext {
	event: ExtendableEvent
	mode: "read" | "write"
	request: Request
}

interface CachedResponseWillBeUsedContext {
	cachedResponse?: Response
	event: ExtendableEvent
}

interface HandlerDidCompleteContext {
	error?: Error
	event: ExtendableEvent
	request: Request
	response?: Response
}

const DIAGNOSTIC_URL_FIELDS = new Set(["url", "scriptUrl", "runtimeUrl", "workboxRuntimeUrl"])

export interface ServiceWorkerDiagnostics {
	enabled: boolean
	bindFetchListener: () => void
	createCacheTimingPlugin: (
		cacheName: string,
		options?: { requestDestination?: RequestDestination; resourceCategory?: string },
	) => Record<string, unknown>
	logBootComplete: (details: Record<string, unknown>) => void
	logWorkboxLoad: (details: Record<string, unknown>) => void
}

/** Provides a shared no-op callback while diagnostics are disabled by the main thread. */
function noop(): void {
	return undefined
}

/** Creates an inert diagnostics implementation that adds no per-request state. */
function createDisabledDiagnostics(): ServiceWorkerDiagnostics {
	return {
		enabled: false,
		bindFetchListener: noop,
		createCacheTimingPlugin() {
			return {}
		},
		logBootComplete: noop,
		logWorkboxLoad: noop,
	}
}

/** Parses a non-negative threshold passed on the SW registration URL. */
function getThreshold(scriptUrl: URL, queryParam: string, fallback: number): number {
	const rawValue = scriptUrl.searchParams.get(queryParam)?.trim()
	if (!rawValue) return fallback

	const parsedValue = Number(rawValue)
	return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback
}

/** Removes query parameters before a URL is written to the browser console. */
function sanitizeDiagnosticUrl(rawUrl: string): string {
	try {
		const url = new URL(rawUrl)
		url.search = ""
		return url.toString()
	} catch {
		return rawUrl.split("?")[0]
	}
}

/** Sanitizes every known URL field through the shared diagnostics log boundary. */
function sanitizeDiagnosticDetails(details: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(details).map(([key, value]) => [
			key,
			DIAGNOSTIC_URL_FIELDS.has(key) && typeof value === "string"
				? sanitizeDiagnosticUrl(value)
				: value,
		]),
	)
}

/** Returns the reasons that make one diagnostic event worth printing. */
function getDiagnosticReasons(
	timing: RequestTimingState,
	metrics: DiagnosticMetrics,
	thresholds: DiagnosticsThresholds,
	error?: Error,
): string[] {
	return [
		...(timing.firstStaticRequest ? ["first-static-request"] : []),
		...(metrics.fetchToCacheStartMs !== null &&
		metrics.fetchToCacheStartMs >= thresholds.cacheStartMs
			? ["slow-cache-start"]
			: []),
		...(metrics.cacheMatchMs !== null && metrics.cacheMatchMs >= thresholds.cacheMatchMs
			? ["slow-cache-match"]
			: []),
		...(metrics.totalMs >= thresholds.totalMs ? ["slow-total"] : []),
		...(error ? ["strategy-error"] : []),
	]
}

/** Returns the console level based on whether the event is an error or has multiple slow phases. */
function getDiagnosticLogLevel(reasons: string[], error?: Error): "info" | "warn" | "error" {
	if (error) return "error"
	return reasons.length > 1 ? "warn" : "info"
}

/** Builds structured timing hooks for one running SW instance. */
export function createServiceWorkerDiagnostics(
	sw: ServiceWorkerGlobalScope,
): ServiceWorkerDiagnostics {
	const scriptUrl = new URL(sw.location.href)
	const enabled = scriptUrl.searchParams.get(SW_DIAGNOSTICS_ENABLED_QUERY_PARAM) === "1"
	if (!enabled) return createDisabledDiagnostics()

	const thresholds: DiagnosticsThresholds = {
		cacheStartMs: getThreshold(
			scriptUrl,
			SW_DIAGNOSTICS_CACHE_START_THRESHOLD_QUERY_PARAM,
			100,
		),
		cacheMatchMs: getThreshold(
			scriptUrl,
			SW_DIAGNOSTICS_CACHE_MATCH_THRESHOLD_QUERY_PARAM,
			100,
		),
		totalMs: getThreshold(scriptUrl, SW_DIAGNOSTICS_TOTAL_THRESHOLD_QUERY_PARAM, 300),
	}

	const workerInstanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
	const timings = new WeakMap<ExtendableEvent, RequestTimingState>()
	let requestSequence = 0
	let staticRequestSequence = 0
	let activeStaticRequestCount = 0

	/** Emits a consistent log payload that can be filtered by the diagnostics prefix. */
	function log(
		phase: string,
		details: Record<string, unknown>,
		level: "info" | "warn" | "error" = "info",
	): void {
		console[level]("[sw:diagnostics]", {
			phase,
			workerInstanceId,
			...sanitizeDiagnosticDetails(details),
		})
	}

	/** Records fetch dispatch before Workbox begins its asynchronous strategy handling. */
	function bindFetchListener(): void {
		sw.addEventListener("fetch", (event) => {
			requestSequence += 1
			timings.set(event, {
				sequence: requestSequence,
				url: event.request.url,
				fetchStartedAt: performance.now(),
			})
		})
	}

	/** Adds Workbox plugin callbacks around cache lookup and final strategy completion. */
	function createCacheTimingPlugin(
		cacheName: string,
		options: { requestDestination?: RequestDestination; resourceCategory?: string } = {},
	): Record<string, unknown> {
		/** Keeps instrumentation limited to the requested resource class, such as CDN scripts. */
		function shouldTrack(request: Request): boolean {
			return options.requestDestination
				? request.destination === options.requestDestination
				: true
		}

		return {
			cacheKeyWillBeUsed({ event, mode, request }: CacheKeyWillBeUsedContext) {
				if (mode !== "read" || !shouldTrack(request)) return request
				const timing = timings.get(event)
				if (timing) {
					staticRequestSequence += 1
					activeStaticRequestCount += 1
					timing.cacheLookupStartedAt = performance.now()
					timing.firstStaticRequest = staticRequestSequence === 1
					timing.activeRequestCountAtStart = activeStaticRequestCount
				}
				return request
			},
			cachedResponseWillBeUsed({ cachedResponse, event }: CachedResponseWillBeUsedContext) {
				const timing = timings.get(event)
				if (timing) {
					timing.cacheLookupFinishedAt = performance.now()
					timing.cacheHit = Boolean(cachedResponse)
				}
				return cachedResponse
			},
			handlerDidComplete({ event, request, response, error }: HandlerDidCompleteContext) {
				const timing = timings.get(event)
				if (!timing) return

				const completedAt = performance.now()
				const fetchToCacheStartMs =
					timing.cacheLookupStartedAt === undefined
						? null
						: timing.cacheLookupStartedAt - timing.fetchStartedAt
				const cacheMatchMs =
					timing.cacheLookupStartedAt === undefined ||
					timing.cacheLookupFinishedAt === undefined
						? null
						: timing.cacheLookupFinishedAt - timing.cacheLookupStartedAt
				const totalMs = completedAt - timing.fetchStartedAt
				const reasons = getDiagnosticReasons(
					timing,
					{ fetchToCacheStartMs, cacheMatchMs, totalMs },
					thresholds,
					error,
				)

				// Normal requests stay silent; only the first or slow requests are printed.
				if (reasons.length) {
					log(
						error ? "static-request-error" : "static-request-diagnostic",
						{
							sequence: timing.sequence,
							url: request.url,
							cacheName,
							resourceCategory: options.resourceCategory ?? "app-static",
							cacheHit: timing.cacheHit ?? null,
							firstStaticRequest: timing.firstStaticRequest ?? false,
							workerUptimeMs: timing.fetchStartedAt - SW_MODULE_EVALUATED_AT,
							activeRequestCountAtStart: timing.activeRequestCountAtStart ?? null,
							fetchToCacheStartMs,
							cacheMatchMs,
							status: response?.status ?? null,
							error: error?.message ?? null,
							totalMs,
							thresholds,
							reasons,
						},
						getDiagnosticLogLevel(reasons, error),
					)
				}

				activeStaticRequestCount = Math.max(0, activeStaticRequestCount - 1)
				timings.delete(event)
			},
		}
	}

	log("boot-start", {
		scriptUrl: scriptUrl.toString(),
		moduleEvaluationAgeMs: performance.now() - SW_MODULE_EVALUATED_AT,
	})

	return {
		enabled,
		bindFetchListener,
		createCacheTimingPlugin,
		logBootComplete(details) {
			log("boot-complete", {
				bootMs: performance.now() - SW_MODULE_EVALUATED_AT,
				...details,
			})
		},
		logWorkboxLoad(details) {
			log("workbox-load", details)
		},
	}
}
