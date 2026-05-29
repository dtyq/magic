/**
 * Service Worker lifecycle orchestration and feature dispatch.
 * Register new capabilities (push, background sync, etc.) via ServiceWorkerFeature.
 */

import { handleCanvasMediaMessage, handleCanvasMediaRequest } from "./canvasMediaShared"
import type { CacheRuntimeRegistration } from "./cache-runtime"
import {
	enforceAppStaticExpirationAfterPrecache,
	precacheStaticAssetsOnInstall,
	warmUpStaticAssetsOnIdle,
} from "./cache-runtime"
import {
	CANVAS_MEDIA_SCOPE_PREFIX,
	getManagedCacheNamePrefix,
	MANAGED_APP_CACHE_NAMES,
} from "./sw-constants"

export interface SwContext {
	sw: ServiceWorkerGlobalScope
}

/**
 * Pluggable SW capability: install/activate hooks and optional message/fetch handlers.
 * Return true from onMessage/onFetch when the feature fully handled the event.
 */
export interface ServiceWorkerFeature {
	id: string
	onInstall?: (context: SwContext) => Promise<void> | void
	onActivate?: (context: SwContext) => Promise<void> | void
	onMessage?: (event: ExtendableMessageEvent, context: SwContext) => boolean
	onFetch?: (event: FetchEvent, context: SwContext) => boolean
}

interface BindServiceWorkerOptions {
	cacheRegistration: CacheRuntimeRegistration | null
	extraFeatures?: ServiceWorkerFeature[]
}

/**
 * Built-in feature: install precache + LRU enforcement + SKIP_WAITING + stale bucket cleanup.
 */
function createAppCacheFeature(
	cacheRegistration: CacheRuntimeRegistration | null,
): ServiceWorkerFeature {
	const knownCacheNames = new Set<string>(MANAGED_APP_CACHE_NAMES)
	const cacheNamePrefix = getManagedCacheNamePrefix()

	return {
		id: "app-cache",
		async onInstall() {
			await precacheStaticAssetsOnInstall()
			await enforceAppStaticExpirationAfterPrecache(cacheRegistration)
		},
		async onActivate({ sw }) {
			await sw.clients.claim()
			const keys = await caches.keys()
			await Promise.all(
				keys
					.filter((key) => {
						if (knownCacheNames.has(key)) return false
						return key.startsWith(cacheNamePrefix)
					})
					.map((key) => caches.delete(key)),
			)
		},
		onMessage(event, { sw }) {
			if (event.data?.type === "SKIP_WAITING") {
				void sw.skipWaiting()
				return true
			}
			if (event.data?.type === "START_WARMUP") {
					const assets = Array.isArray(event.data?.assets)
						? event.data.assets.filter((item): item is string => typeof item === "string")
						: undefined
					event.waitUntil(warmUpStaticAssetsOnIdle(assets))
				return true
			}
			return false
		},
	}
}

/**
 * Canvas virtual media URLs under /sw/canvas-design-media/** (delegates to canvasMediaShared).
 */
function createCanvasMediaFeature(): ServiceWorkerFeature {
	return {
		id: "canvas-media",
		onMessage(event) {
			handleCanvasMediaMessage(event)
			return false
		},
		onFetch(event) {
			const requestUrl = new URL(event.request.url)
			if (event.request.method !== "GET") return false
			if (!requestUrl.pathname.startsWith(CANVAS_MEDIA_SCOPE_PREFIX)) return false

			event.respondWith(
				handleCanvasMediaRequest(event.request).then(
					(response) => response ?? fetch(event.request),
				),
			)
			return true
		},
	}
}

/**
 * Runs install hooks for all features in registration order.
 */
async function runFeatureInstallHooks(
	features: ServiceWorkerFeature[],
	context: SwContext,
): Promise<void> {
	for (const feature of features) {
		await feature.onInstall?.(context)
	}
}

/**
 * Runs activate hooks for all features in registration order.
 */
async function runFeatureActivateHooks(
	features: ServiceWorkerFeature[],
	context: SwContext,
): Promise<void> {
	for (const feature of features) {
		await feature.onActivate?.(context)
	}
}

/**
 * Dispatches a message event to features until one reports handled.
 */
function dispatchFeatureMessage(
	features: ServiceWorkerFeature[],
	event: ExtendableMessageEvent,
	context: SwContext,
): void {
	for (const feature of features) {
		if (feature.onMessage?.(event, context)) return
	}
}

/**
 * Dispatches a fetch event to features until one reports handled.
 */
function dispatchFeatureFetch(
	features: ServiceWorkerFeature[],
	event: FetchEvent,
	context: SwContext,
): void {
	for (const feature of features) {
		if (feature.onFetch?.(event, context)) return
	}
}

/**
 * Wires install / activate / message / fetch listeners for the default and extra features.
 */
export function bindServiceWorkerEvents(
	sw: ServiceWorkerGlobalScope,
	options: BindServiceWorkerOptions,
): void {
	const context: SwContext = { sw }
	const features: ServiceWorkerFeature[] = [
		createAppCacheFeature(options.cacheRegistration),
		createCanvasMediaFeature(),
		...(options.extraFeatures ?? []),
	]

	sw.addEventListener("install", (event) => {
		event.waitUntil(runFeatureInstallHooks(features, context))
	})

	sw.addEventListener("activate", (event) => {
		event.waitUntil(runFeatureActivateHooks(features, context))
	})

	sw.addEventListener("message", (event) => {
		dispatchFeatureMessage(features, event, context)
	})

	sw.addEventListener("fetch", (event) => {
		dispatchFeatureFetch(features, event, context)
	})
}
