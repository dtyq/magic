import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	bootstrapWorkboxCacheRuntime,
	enforceAppStaticExpiration,
	isCacheableFeaturedSlidesTemplateImage,
	isCacheableSlidesTemplateImage,
	type WorkboxRouteContext,
} from "../cache-runtime"
import {
	APP_IMAGE_CACHE_NAME,
	CACHE_TTL_15_DAYS,
	CACHE_TTL_7_DAYS,
	FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_NAME,
	FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES,
	SLIDES_TEMPLATE_IMAGE_CACHE_NAME,
	SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES,
} from "../sw-constants"

function createContext(
	url: string,
	{
		method = "GET",
		destination = "image",
	}: { method?: string; destination?: RequestDestination } = {},
): WorkboxRouteContext {
	return {
		request: { destination, method } as Request,
		url: new URL(url),
	}
}

describe("slides template image cache route", () => {
	beforeEach(() => {
		vi.unstubAllGlobals()
	})

	it("accepts only explicitly marked image requests", () => {
		const ordinaryContext = createContext(
			"https://storage.example.com/template.webp?swCache=slides-template-image-v2",
		)
		const featuredContext = createContext(
			"https://storage.example.com/template.webp?swCache=featured-slides-template-image-v2",
		)

		expect(isCacheableSlidesTemplateImage(ordinaryContext)).toBe(true)
		expect(isCacheableFeaturedSlidesTemplateImage(ordinaryContext)).toBe(false)
		expect(isCacheableFeaturedSlidesTemplateImage(featuredContext)).toBe(true)
		expect(isCacheableSlidesTemplateImage(featuredContext)).toBe(false)
	})

	it("does not route legacy markers into the v2 cache buckets", () => {
		const ordinaryLegacyContext = createContext(
			"https://storage.example.com/template.webp?swCache=slides-template-image",
		)
		const featuredLegacyContext = createContext(
			"https://storage.example.com/template.webp?swCache=featured-slides-template-image",
		)

		expect(isCacheableSlidesTemplateImage(ordinaryLegacyContext)).toBe(false)
		expect(isCacheableFeaturedSlidesTemplateImage(featuredLegacyContext)).toBe(false)
	})

	it("rejects unmarked images and non-image requests", () => {
		expect(
			isCacheableSlidesTemplateImage(
				createContext("https://storage.example.com/template.webp"),
			),
		).toBe(false)
		expect(
			isCacheableSlidesTemplateImage(
				createContext(
					"https://storage.example.com/template.webp?swCache=slides-template-image-v2",
					{
						destination: "script",
					},
				),
			),
		).toBe(false)
		expect(
			isCacheableSlidesTemplateImage(
				createContext(
					"https://storage.example.com/template.webp?swCache=slides-template-image-v2",
					{
						method: "POST",
					},
				),
			),
		).toBe(false)
	})

	it("only caches CORS-readable image responses", () => {
		const cacheFirstOptions: Record<string, unknown>[] = []
		const cacheableResponseOptions: Record<string, unknown>[] = []
		const expirationOptions: Record<string, unknown>[] = []
		const cacheExpirationConstructors: Array<{
			cacheName: string
			options: Record<string, unknown>
		}> = []

		class CacheFirst {
			constructor(options: Record<string, unknown>) {
				cacheFirstOptions.push(options)
			}
		}
		class StaleWhileRevalidate {
			constructor(options: Record<string, unknown>) {
				void options
			}
		}
		class ExpirationPlugin {
			constructor(options: Record<string, unknown>) {
				expirationOptions.push(options)
			}
		}
		class CacheExpiration {
			constructor(cacheName: string, options: Record<string, unknown>) {
				cacheExpirationConstructors.push({ cacheName, options })
			}
		}
		class CacheableResponsePlugin {
			constructor(options: Record<string, unknown>) {
				cacheableResponseOptions.push(options)
			}
		}

		vi.stubGlobal("importScripts", vi.fn())
		vi.stubGlobal("workbox", {
			setConfig: vi.fn(),
			routing: { registerRoute: vi.fn() },
			strategies: { CacheFirst, StaleWhileRevalidate },
			expiration: { ExpirationPlugin, CacheExpiration },
			cacheableResponse: { CacheableResponsePlugin },
		})

		bootstrapWorkboxCacheRuntime({
			location: {
				href: "https://app.example.com/sw.js?workboxCdnUrl=https%3A%2F%2Fcdn.example.com%2Fworkbox-sw.js",
			},
		} as ServiceWorkerGlobalScope)

		expect(cacheFirstOptions).toContainEqual(
			expect.objectContaining({ cacheName: FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_NAME }),
		)
		expect(cacheFirstOptions).toContainEqual(
			expect.objectContaining({ cacheName: SLIDES_TEMPLATE_IMAGE_CACHE_NAME }),
		)
		expect(
			cacheFirstOptions.findIndex(
				(options) => options.cacheName === FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_NAME,
			),
		).toBeLessThan(
			cacheFirstOptions.findIndex(
				(options) => options.cacheName === SLIDES_TEMPLATE_IMAGE_CACHE_NAME,
			),
		)
		expect(
			cacheFirstOptions.findIndex(
				(options) => options.cacheName === SLIDES_TEMPLATE_IMAGE_CACHE_NAME,
			),
		).toBeLessThan(
			cacheFirstOptions.findIndex((options) => options.cacheName === APP_IMAGE_CACHE_NAME),
		)
		expect(cacheableResponseOptions).toContainEqual({ statuses: [200] })
		expect(cacheableResponseOptions).not.toContainEqual({ statuses: [0, 200] })
		expect(SLIDES_TEMPLATE_IMAGE_CACHE_NAME).toContain("-v2")
		expect(FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_NAME).toContain("-v2")
		expect(expirationOptions).toContainEqual({
			maxEntries: FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES,
			maxAgeSeconds: CACHE_TTL_15_DAYS,
			purgeOnQuotaError: true,
		})
		expect(expirationOptions).toContainEqual({
			maxEntries: SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES,
			maxAgeSeconds: CACHE_TTL_7_DAYS,
			purgeOnQuotaError: true,
		})

		expect(SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES).toBe(60)
		expect(FEATURED_SLIDES_TEMPLATE_IMAGE_CACHE_MAX_ENTRIES).toBe(40)

		expect(cacheExpirationConstructors).toContainEqual({
			cacheName: "magic-web-app-static-assets-v2",
			options: { maxEntries: 4000, maxAgeSeconds: 14 * 24 * 60 * 60 },
		})
	})

	it("serializes static expiration enforcement for native warmup writes", async () => {
		let expireCalls = 0
		let resolveExpiration: (() => void) | null = null
		const expirationManager = {
			updateTimestamp: vi.fn(async () => undefined),
			expireEntries: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						expireCalls += 1
						resolveExpiration = resolve
					}),
			),
		}

		const firstRun = enforceAppStaticExpiration(expirationManager)
		const secondRun = enforceAppStaticExpiration(expirationManager)

		expect(expirationManager.expireEntries).toHaveBeenCalledTimes(1)
		resolveExpiration?.()
		await Promise.all([firstRun, secondRun])
		expect(expireCalls).toBe(1)
	})
})
