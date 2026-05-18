const APP_SERVICE_WORKER_URL = "/sw.js"
const APP_SERVICE_WORKER_SCOPE = "/"
const WORKBOX_CDN_QUERY_PARAM = "workboxCdnUrl"
const VENDOR_CACHEABLE_HOSTS_QUERY_PARAM = "vendorCacheHosts"
const RESOURCE_CACHE_MARK_QUERY_PARAM = "swCache"
const RESOURCE_CACHE_VERSION_QUERY_PARAM = "swv"
const MARKED_RUNTIME_RESOURCE_CACHE_VALUE = "runtime"
// TODO: 后续替换为自己的 CDN 地址（使用 MAGIC_CDNHOST 或 packages 发布链路）
const WORKBOX_JSDELIVR_FALLBACK_URL = "https://cdn.jsdelivr.net/npm/workbox-sw@7.4.1/build/workbox-sw.js"
const CANVAS_MEDIA_SCOPE_PREFIX = "/canvas-design-media/"
const WAITING_ACTIVATION_TIMEOUT_MS = 1500
const DEFAULT_VENDOR_CACHEABLE_HOSTS = ["cdn.jsdelivr.net"]

let appServiceWorkerRegistration: ServiceWorkerRegistration | null = null

function isDevelopmentMode(): boolean {
	return import.meta.env.DEV
}

function isLocalMockEnabled(): boolean {
	return import.meta.env.MAGIC_MOCK === "true"
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

	const appServiceWorkerPathname = new URL(APP_SERVICE_WORKER_URL, window.location.origin).pathname
	const registrations = await navigator.serviceWorker.getRegistrations()
	const appRegistrations = registrations.filter((registration) =>
		[registration.active, registration.waiting, registration.installing].some((worker: ServiceWorker | null | undefined) =>
			isAppServiceWorkerWorker(worker, appServiceWorkerPathname),
		),
	)

	if (!appRegistrations.length) return

	await Promise.all(appRegistrations.map((registration) => registration.unregister()))
	appServiceWorkerRegistration = null
}

/**
 * 判断路径是否属于 Canvas 媒体虚拟资源。
 */
export function isCanvasMediaPath(pathname: string): boolean {
	return pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)
}

/**
 * 为缺少稳定命名特征的同源资源显式打上 SW 缓存标记。
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
 * 获取最近一次主 SW 注册结果，供更新提示入口复用。
 */
export function getAppServiceWorkerRegistration(): ServiceWorkerRegistration | null {
	return appServiceWorkerRegistration
}

/**
 * 从 MAGIC_CDNHOST 推导 Workbox 地址，统一复用 packages 资源发布链路。
 */
function getConfiguredWorkboxCdnUrl(): string {
	// TODO: 后续改为从 MAGIC_CDNHOST 推导自己的 CDN 地址
	return WORKBOX_JSDELIVR_FALLBACK_URL
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

/**
 * 从运行时配置推导允许进入 vendor 桶的 host 列表，避免在 SW 中写死环境相关域名。
 */
function getConfiguredVendorCacheHosts(): string[] {
	const configuredHosts: string[] = []
	const fromMagicCdnHost = getHostnameFromUrl(window.CONFIG?.MAGIC_CDNHOST)
	const fromPublicCdnUrl = getHostnameFromUrl(window.CONFIG?.MAGIC_PUBLIC_CDN_URL)

	if (fromMagicCdnHost) configuredHosts.push(fromMagicCdnHost)
	if (fromPublicCdnUrl) configuredHosts.push(fromPublicCdnUrl)
	configuredHosts.push.apply(configuredHosts, DEFAULT_VENDOR_CACHEABLE_HOSTS)

	return configuredHosts.filter((host, index, list) => list.indexOf(host) === index)
}

/**
 * 生成主 SW 注册地址，并在 query 中携带 Workbox CDN 配置。
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
 * 在页面 load 后注册主 SW，避免阻塞首屏渲染。
 */
export function registerAppServiceWorker(): void {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
	if (isDevelopmentMode() && !isLocalMockEnabled()) {
		void unregisterAppServiceWorkers()
		return
	}

	/**
	 * 执行真实注册并缓存 registration，供后续 waiting 激活复用。
	 */
	async function handleRegister() {
		try {
			appServiceWorkerRegistration = await navigator.serviceWorker.register(
				getAppServiceWorkerUrl(),
				{
					scope: APP_SERVICE_WORKER_SCOPE,
				},
			)
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
 * 用户确认刷新后，优先激活 waiting SW；若激活事件迟迟未到，则退回一次普通刷新。
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

		/**
		 * 清理本次 waiting 激活的监听器和超时句柄，避免重复刷新。
		 */
		function cleanup(timeoutId: number, handleControllerChange: () => void): void {
			window.clearTimeout(timeoutId)
			navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
		}

		/**
		 * 在 controllerchange 或超时兜底时执行一次刷新，并结束等待。
		 */
		function finish(timeoutId: number, handleControllerChange: () => void): void {
			if (finished) return
			finished = true
			cleanup(timeoutId, handleControllerChange)
			reload()
			resolve()
		}

		/**
		 * 新 SW 接管当前页面后刷新，确保页面被最新控制器管理。
		 */
		function handleControllerChange(): void {
			finish(timeoutId, handleControllerChange)
		}

		const timeoutId = window.setTimeout(() => {
			finish(timeoutId, handleControllerChange)
		}, WAITING_ACTIVATION_TIMEOUT_MS)

		navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
		registration.waiting?.postMessage({ type: "SKIP_WAITING" })
	})
}
