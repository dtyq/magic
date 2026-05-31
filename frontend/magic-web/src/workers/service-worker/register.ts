import { env } from "@/utils/env"
import {
	DEFAULT_VENDOR_CACHEABLE_HOSTS,
	MARKED_RUNTIME_RESOURCE_CACHE_VALUE,
	RESOURCE_CACHE_MARK_QUERY_PARAM,
	RESOURCE_CACHE_VERSION_QUERY_PARAM,
	VENDOR_CACHEABLE_HOSTS_QUERY_PARAM,
	WORKBOX_CDN_QUERY_PARAM,
} from "./sw-constants"

const APP_SERVICE_WORKER_URL = "/sw.js"
const APP_SERVICE_WORKER_SCOPE = "/"
const SW_MODE_ENV_KEY = "MAGIC_SW_MODE"
const SW_MODE_ON = "on"
const SW_MODE_KILL = "kill"
const SW_MODE_NONE = "none"
// Wait briefly for controllerchange after posting SKIP_WAITING; then fallback to a plain reload.
const WAITING_ACTIVATION_TIMEOUT_MS = 1500

// Keep the latest app SW registration so update prompts can reuse it.
let appServiceWorkerRegistration: ServiceWorkerRegistration | null = null

interface ReloadActivationContext {
	// One-shot guard for a single register() lifecycle to avoid repeated auto-activation attempts.
	triggered: boolean
}

function isDevelopmentMode(): boolean {
	return import.meta.env.DEV
}

function isLocalMockEnabled(): boolean {
	return env("MAGIC_MOCK") === "true"
}

function isForceEnableServiceWorkerInDevelopment(): boolean {
	return env("MAGIC_FORCE_ENABLE_SW_IN_DEV") === "true"
}

function getServiceWorkerMode(): string {
	return env(SW_MODE_ENV_KEY)?.trim().toLowerCase() ?? ""
}

function shouldRegisterAppServiceWorker(): boolean {
	const serviceWorkerMode = getServiceWorkerMode()
	if (serviceWorkerMode === SW_MODE_NONE) return false

	return [SW_MODE_ON, SW_MODE_KILL].includes(serviceWorkerMode)
}

export function isAppServiceWorkerFeatureEnabled(): boolean {
	if (
		isDevelopmentMode() &&
		!isLocalMockEnabled() &&
		!isForceEnableServiceWorkerInDevelopment()
	) {
		return false
	}
	return getServiceWorkerMode() === SW_MODE_ON
}

function shouldAutoActivateWaitingWorkerOnReload(): boolean {
	return getServiceWorkerMode() === SW_MODE_ON
}

function isAppServiceWorkerWorker(
	worker: ServiceWorker | null | undefined,
	appServiceWorkerPathname: string,
): boolean {
	if (!worker?.scriptURL) return false

	try {
		const workerUrl = new URL(worker.scriptURL)
		return workerUrl.pathname === appServiceWorkerPathname
	} catch {
		return false
	}
}

async function unregisterAppServiceWorkers(): Promise<void> {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
	if (typeof navigator.serviceWorker.getRegistrations !== "function") return

	const appServiceWorkerPathname = new URL(APP_SERVICE_WORKER_URL, window.location.origin)
		.pathname
	const registrations = await navigator.serviceWorker.getRegistrations()
	const appRegistrations = registrations.filter((registration) =>
		[registration.active, registration.waiting, registration.installing].some(
			(worker: ServiceWorker | null | undefined) =>
				isAppServiceWorkerWorker(worker, appServiceWorkerPathname),
		),
	)

	if (!appRegistrations.length) return

	await Promise.all(appRegistrations.map((registration) => registration.unregister()))
	appServiceWorkerRegistration = null
}

/**
 * Mark fixed-name same-origin resources so the SW can cache them via explicit route rules.
 * This is used for assets like wasm/worker files that do not have hashed filenames.
 */
export function markServiceWorkerCacheableResourceUrl(
	resourceUrl: string,
	version?: string | null,
): string {
	if (typeof window === "undefined") return resourceUrl

	try {
		const resolvedUrl = new URL(resourceUrl, window.location.origin)
		resolvedUrl.searchParams.set(
			RESOURCE_CACHE_MARK_QUERY_PARAM,
			MARKED_RUNTIME_RESOURCE_CACHE_VALUE,
		)

		const normalizedVersion = version?.trim()
		if (normalizedVersion) {
			resolvedUrl.searchParams.set(RESOURCE_CACHE_VERSION_QUERY_PARAM, normalizedVersion)
		}

		if (resolvedUrl.origin === window.location.origin) {
			return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`
		}

		return resolvedUrl.toString()
	} catch {
		return resourceUrl
	}
}

/**
 * Return the most recent app SW registration instance.
 * Update notification UIs call this to activate waiting workers on user action.
 */
export function getAppServiceWorkerRegistration(): ServiceWorkerRegistration | null {
	return appServiceWorkerRegistration
}

/**
 * Resolve the Workbox runtime URL used by /sw.js.
 * Kept as a function so we can switch to environment-driven CDN mapping later.
 */
function getConfiguredWorkboxCdnUrl(): string {
	return `${env("MAGIC_CDNHOST")}/workbox/7.4.1/workbox-sw.js`
}

function getHostnameFromUrl(rawUrl: string | undefined): string | null {
	const trimmed = rawUrl?.trim()
	if (!trimmed) return null

	try {
		return new URL(trimmed).hostname
	} catch {
		return null
	}
}

function isReloadNavigation(): boolean {
	if (typeof window === "undefined") return false
	if (typeof performance.getEntriesByType !== "function") return false

	// We only auto-activate waiting workers when the user explicitly reloads the page.
	const [navigationEntry] = performance.getEntriesByType(
		"navigation",
	) as PerformanceNavigationTiming[]
	return navigationEntry?.type === "reload"
}

function tryAutoActivateWaitingServiceWorkerOnReload(
	registration: ServiceWorkerRegistration,
	context: ReloadActivationContext,
): void {
	// Keep regular in-app navigation non-intrusive; only act on hard reload.
	if (!isReloadNavigation()) return
	// One-shot guard for this registration attempt.
	if (context.triggered) return
	// Nothing to activate yet.
	if (!registration.waiting) return

	context.triggered = true
	// Trigger waiting -> active transition and reload once control is switched.
	void activateWaitingServiceWorkerAndReload(registration)
}

function watchInstallingWorkerForReloadActivation(
	registration: ServiceWorkerRegistration,
	context: ReloadActivationContext,
): void {
	if (!isReloadNavigation()) return

	// A registration can expose multiple installing workers across update cycles.
	// Keep listeners idempotent to avoid duplicate SKIP_WAITING posts.
	const watchedWorkers = new WeakSet<ServiceWorker>()

	const watchInstallingWorker = (worker: ServiceWorker | null): void => {
		if (!worker || watchedWorkers.has(worker)) return
		watchedWorkers.add(worker)

		const handleStateChange = () => {
			// "installed" means a candidate worker may now be in registration.waiting.
			if (worker.state === "installed") {
				tryAutoActivateWaitingServiceWorkerOnReload(registration, context)
			}

			// Remove listeners once this worker is done evolving.
			if (worker.state === "installed" || worker.state === "redundant") {
				worker.removeEventListener("statechange", handleStateChange)
			}
		}

		worker.addEventListener("statechange", handleStateChange)
	}

	watchInstallingWorker(registration.installing)
	// Future update cycles on the same registration may create new installing workers.
	registration.addEventListener("updatefound", () => {
		watchInstallingWorker(registration.installing)
	})
}

/**
 * Build allowlisted vendor hosts from runtime config.
 * This avoids hardcoding environment-specific CDN domains in worker code.
 */
function getConfiguredVendorCacheHosts(): string[] {
	const configuredHosts: string[] = []
	const fromMagicCdnHost = getHostnameFromUrl(window.CONFIG?.MAGIC_CDNHOST)
	const fromPublicCdnUrl = getHostnameFromUrl(window.CONFIG?.MAGIC_PUBLIC_CDN_URL)

	if (fromMagicCdnHost) configuredHosts.push(fromMagicCdnHost)
	if (fromPublicCdnUrl) configuredHosts.push(fromPublicCdnUrl)
	configuredHosts.push(...DEFAULT_VENDOR_CACHEABLE_HOSTS)

	return configuredHosts.filter((host, index, list) => list.indexOf(host) === index)
}

/**
 * Build the /sw.js registration URL with runtime query params.
 * The worker reads these params from self.location.href.
 */
function getAppServiceWorkerUrl(): string {
	const workboxCdnUrl = getConfiguredWorkboxCdnUrl()
	const swUrl = new URL(APP_SERVICE_WORKER_URL, window.location.origin)
	swUrl.searchParams.set(WORKBOX_CDN_QUERY_PARAM, workboxCdnUrl)
	swUrl.searchParams.set(
		VENDOR_CACHEABLE_HOSTS_QUERY_PARAM,
		getConfiguredVendorCacheHosts().join(","),
	)

	return `${swUrl.pathname}${swUrl.search}`
}

/**
 * Register the app service worker after page load to avoid first-render contention.
 * On reload navigation, opportunistically activate waiting workers to make updates
 * effective on this refresh cycle whenever possible.
 */
export function registerAppServiceWorker(): void {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
	if (
		isDevelopmentMode() &&
		!isLocalMockEnabled() &&
		!isForceEnableServiceWorkerInDevelopment()
	) {
		void unregisterAppServiceWorkers()
		return
	}
	if (!shouldRegisterAppServiceWorker()) {
		// Default to no SW registration and actively retire previously registered app workers.
		void unregisterAppServiceWorkers()
		return
	}

	// Scope auto-activation deduplication to one register() execution path.
	const reloadActivationContext: ReloadActivationContext = { triggered: false }

	async function handleRegister() {
		try {
			appServiceWorkerRegistration = await navigator.serviceWorker.register(
				getAppServiceWorkerUrl(),
				{
					scope: APP_SERVICE_WORKER_SCOPE,
				},
			)

			// Cover timing gap: register() may return before waiting is available.
			// We listen for installing/updatefound and also perform an immediate waiting check.
			if (shouldAutoActivateWaitingWorkerOnReload()) {
				watchInstallingWorkerForReloadActivation(
					appServiceWorkerRegistration,
					reloadActivationContext,
				)
				tryAutoActivateWaitingServiceWorkerOnReload(
					appServiceWorkerRegistration,
					reloadActivationContext,
				)
			}
			void triggerWarmUpWhenIdle()
		} catch {
			appServiceWorkerRegistration = null
		}
	}

	if (document.readyState === "complete") {
		void handleRegister()
		return
	}

	window.addEventListener(
		"load",
		() => {
			void handleRegister()
		},
		{ once: true },
	)
}

/**
 * Activate a waiting SW and then reload.
 * If controllerchange does not arrive in time, fallback to a plain reload so the
 * user is never blocked by update orchestration.
 */
export async function activateWaitingServiceWorkerAndReload(
	registration: ServiceWorkerRegistration | null,
	reload: () => void = () => window.location.reload(),
): Promise<void> {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
		reload()
		return
	}

	if (!registration?.waiting) {
		reload()
		return
	}

	await new Promise<void>((resolve) => {
		let finished = false

		// Remove temporary listeners/timers to prevent duplicate reloads.
		function cleanup(timeoutId: number, handleControllerChange: () => void): void {
			window.clearTimeout(timeoutId)
			navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
		}

		// Complete exactly once on success signal or timeout fallback.
		function finish(timeoutId: number, handleControllerChange: () => void): void {
			if (finished) return
			finished = true
			cleanup(timeoutId, handleControllerChange)
			reload()
			resolve()
		}

		// Controller switched: refresh under the new active SW.
		function handleControllerChange(): void {
			finish(timeoutId, handleControllerChange)
		}

		// If no controllerchange arrives, still reload once as a safe fallback path.
		const timeoutId = window.setTimeout(() => {
			finish(timeoutId, handleControllerChange)
		}, WAITING_ACTIVATION_TIMEOUT_MS)

		navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
		registration.waiting?.postMessage({ type: "SKIP_WAITING" })
	})
}

function scheduleWarmUpPostMessage(worker: ServiceWorker): void {
	const postMsg = async () => {
		try {
			const res = await fetch(`/warmup-assets.json?t=${Date.now()}`)
			if (res.ok) {
				const assets = await res.json()
				worker.postMessage({ type: "START_WARMUP", assets })
			} else {
				worker.postMessage({ type: "START_WARMUP", assets: [] })
			}
		} catch (e) {
			console.error("[sw] Failed to fetch warmup-assets.json", e)
			worker.postMessage({ type: "START_WARMUP", assets: [] })
		}
	}

	if (typeof window !== "undefined" && "requestIdleCallback" in window) {
		window.requestIdleCallback(
			() => {
				void postMsg()
			},
			{ timeout: 30000 },
		)
	} else {
		globalThis.setTimeout(() => {
			void postMsg()
		}, 5000)
	}
}

function triggerWarmUpWhenIdle(): void {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

	if (!navigator.serviceWorker.controller) {
		// If there is no controller active (e.g. first load), wait for controllerchange or ready state
		navigator.serviceWorker.ready.then((registration) => {
			if (registration.active) {
				scheduleWarmUpPostMessage(registration.active)
			}
		})
	} else {
		scheduleWarmUpPostMessage(navigator.serviceWorker.controller)
	}
}
