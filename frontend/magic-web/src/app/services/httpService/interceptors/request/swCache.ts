import { env } from "@/utils/env"
import { isCacheableApiRequest } from "@/workers/service-worker/sw-constants"
import { createSwCacheInterceptor } from "@/infrastructure/network/http/interceptors/swCache"

/** Application cache eligibility is injected into the infrastructure mechanism. */
export function createAppSwCacheInterceptor() {
	return createSwCacheInterceptor({
		enabled: () => env("MAGIC_ENABLE_API_CACHE") !== "false",
		isCacheable: isCacheableApiRequest,
		origin: () => window.location.origin,
	})
}
