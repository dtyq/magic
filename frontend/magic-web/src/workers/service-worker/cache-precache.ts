import { APP_STATIC_CACHE_NAME, PRECACHE_BATCH_CONCURRENCY } from "./sw-constants"
import type { CacheExpirationLike } from "./cache-runtime"

// Injected at production build by vite-plugin-app-service-worker (empty in dev).
declare const __SW_PRECACHE_ASSETS__: string[]

const PRECACHE_ASSETS: readonly string[] =
	typeof __SW_PRECACHE_ASSETS__ !== "undefined" ? __SW_PRECACHE_ASSETS__ : []

/** Runs async work in fixed-size batches to avoid saturating the network during install. */
async function runTasksInBatches<T>(
	items: readonly T[],
	batchSize: number,
	runner: (item: T) => Promise<void>,
): Promise<void> {
	for (let index = 0; index < items.length; index += batchSize) {
		const batch = items.slice(index, index + batchSize)
		await Promise.allSettled(batch.map((item) => runner(item)))
	}
}

/** Populates the static assets bucket during install so CacheFirst can hit immediately. */
export async function precacheStaticAssetsOnInstall(
	expirationManager?: CacheExpirationLike | null,
): Promise<void> {
	if (!PRECACHE_ASSETS.length) return

	const cache = await caches.open(APP_STATIC_CACHE_NAME)
	await runTasksInBatches(PRECACHE_ASSETS, PRECACHE_BATCH_CONCURRENCY, async (assetPath) => {
		try {
			const request = new Request(assetPath, { credentials: "same-origin" })
			const response = await fetch(request)
			if (!response.ok) return
			await cache.put(request, response)
			await expirationManager?.updateTimestamp(request.url)
		} catch {
			// A single failed precache URL must not reject the install event.
		}
	})
}
