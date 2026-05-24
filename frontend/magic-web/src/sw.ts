/// <reference lib="webworker" />

import { bootstrapWorkboxCacheRuntime } from "./workers/service-worker/cache-runtime"
import { bindServiceWorkerEvents } from "./workers/service-worker/sw-runtime"

const sw = globalThis as unknown as ServiceWorkerGlobalScope

const { registration: cacheRegistration } = bootstrapWorkboxCacheRuntime(sw)

bindServiceWorkerEvents(sw, { cacheRegistration })
