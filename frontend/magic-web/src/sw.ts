/// <reference lib="webworker" />

import { bootstrapWorkboxCacheRuntime } from "./workers/service-worker/cache-runtime"
import { createServiceWorkerDiagnostics } from "./workers/service-worker/sw-diagnostics"
import { bindServiceWorkerEvents } from "./workers/service-worker/sw-runtime"

const sw = globalThis as unknown as ServiceWorkerGlobalScope
const diagnostics = createServiceWorkerDiagnostics(sw)

// Bind before Workbox registers its fetch listener so dispatch timing starts at event entry.
diagnostics.bindFetchListener()

const bootstrapResult = bootstrapWorkboxCacheRuntime(sw, diagnostics)
const { registration: cacheRegistration } = bootstrapResult

diagnostics.logBootComplete({
	workboxLoaded: bootstrapResult.loaded,
	workboxRuntimeUrl: bootstrapResult.resolvedWorkboxRuntimeUrl,
})

bindServiceWorkerEvents(sw, { cacheRegistration })
