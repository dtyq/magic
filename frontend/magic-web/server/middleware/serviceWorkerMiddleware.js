/**
 * Service Worker 接管配置（通过环境变量控制）。
 *
 * 1) MAGIC_SW_MODE（大小写不敏感）
 *    - kill: 下发 kill SW，按 MAGIC_SW_CLEAR_CACHES 清缓存后注销 SW。
 *    - off: 下发 off SW，仅注销 SW，不清理缓存。
 *    - 其他值或不配置：不接管 /sw.js，保持构建产物中的正常 SW。
 *
 * 2) MAGIC_SW_CLEAR_CACHES（仅在 MAGIC_SW_MODE=kill 时生效）
 *    - 必须显式配置；不配置时 kill 模式不会生效。
 *    - 配置逗号分隔缓存桶名：按指定桶清理。
 *    - 配置 ALL（大小写不敏感）：清理当前 origin 下全部 CacheStorage 桶。
 *
 * 示例：
 * - MAGIC_SW_MODE=off
 * - MAGIC_SW_MODE=kill MAGIC_SW_CLEAR_CACHES=ALL
 * - MAGIC_SW_MODE=kill MAGIC_SW_CLEAR_CACHES=magic-web-app-static-assets-v1,canvas-media-resources-v1
 */
const SW_MODE_ENV_KEY = "MAGIC_SW_MODE"
const KILL_SWITCH_MODE = "kill"
const OFF_MODE = "off"
const CLEAR_ALL_CACHES = "all"
const KILL_SWITCH_CACHE_NAMES_ENV_KEY = "MAGIC_SW_CLEAR_CACHES"

function isServiceWorkerKillSwitchEnabled() {
	return getServiceWorkerMode() === KILL_SWITCH_MODE
}

function isServiceWorkerOffModeEnabled() {
	return getServiceWorkerMode() === OFF_MODE
}

function getServiceWorkerMode() {
	return process.env[SW_MODE_ENV_KEY]?.trim().toLowerCase()
}

/**
 * 允许通过 MAGIC_SW_CLEAR_CACHES 指定要清理的缓存桶。
 * kill 模式下必须显式配置该值；不配置时视为无效配置。
 */
function getKillSwitchCacheNames() {
	const configuredCacheNames = process.env[KILL_SWITCH_CACHE_NAMES_ENV_KEY]
		?.split(",")
		.map((cacheName) => cacheName.trim())
		.filter(Boolean)

	if (!configuredCacheNames?.length) {
		return null
	}

	if (configuredCacheNames.some((cacheName) => cacheName.toLowerCase() === CLEAR_ALL_CACHES)) {
		return CLEAR_ALL_CACHES
	}

	return [...new Set(configuredCacheNames)]
}

function buildKillSwitchServiceWorkerSource(cacheNames) {
	return `self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		const cacheNames = ${JSON.stringify(cacheNames)};
		if (cacheNames === "${CLEAR_ALL_CACHES}") {
			const allCacheNames = await caches.keys();
			await Promise.all(allCacheNames.map((cacheName) => caches.delete(cacheName)));
		} else {
			// 仅删除当前配置命中的缓存桶，随后主动注销自身，恢复到无 SW 状态。
			await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
		}
		const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
		await self.registration.unregister();
		for (const client of clients) {
			client.navigate(client.url);
		}
	})());
});

self.addEventListener("fetch", () => {
	return;
});
`
}

function buildOffModeServiceWorkerSource() {
	return `self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
		await self.registration.unregister();
		for (const client of clients) {
			client.navigate(client.url);
		}
	})());
});

self.addEventListener("fetch", () => {
	return;
});
`
}

function serviceWorkerMiddleware(req, res, next) {
	if (req.path !== "/sw.js") {
		return next()
	}

	if (!isServiceWorkerKillSwitchEnabled() && !isServiceWorkerOffModeEnabled()) {
		return next()
	}

	// kill/off 模式下由 server 直接接管 /sw.js 响应，不再返回 dist 中的正常 SW 文件。
	res.status(200)
	res.setHeader("Content-Type", "application/javascript; charset=utf-8")
	res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
	res.setHeader("Pragma", "no-cache")
	res.setHeader("Expires", "0")
	res.setHeader("Service-Worker-Allowed", "/")

	if (isServiceWorkerKillSwitchEnabled()) {
		const cacheNames = getKillSwitchCacheNames()
		if (!cacheNames) {
			// kill 模式要求显式配置 MAGIC_SW_CLEAR_CACHES，缺失时回退到正常 SW。
			return next()
		}
		res.send(buildKillSwitchServiceWorkerSource(cacheNames))
		return undefined
	}

	// off 模式下仅注销 SW，不触碰任何缓存桶。
	res.send(buildOffModeServiceWorkerSource())
	return undefined
}

module.exports = serviceWorkerMiddleware