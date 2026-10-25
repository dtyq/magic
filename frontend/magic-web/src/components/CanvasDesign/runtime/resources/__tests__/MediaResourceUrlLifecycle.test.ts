import { describe, expect, it, vi } from "vitest"
import {
	MediaResourceUrlLifecycle,
	type MediaResourceUrlEntry,
} from "../offline-cache/MediaResourceUrlLifecycle"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"

function createEntry(overrides: Partial<MediaResourceUrlEntry> = {}): MediaResourceUrlEntry {
	return {
		referencePath: "./images/a.png",
		resourceIdentity: "workspace:/画布A/images/a.png",
		ossSrc: null,
		ossSrcFromCachedFallback: false,
		sourceUrl: null,
		expiresAt: null,
		resourceVersion: null,
		sourceUpdatedAt: null,
		contentLength: null,
		exchangePromise: null,
		backgroundRefreshPromise: null,
		lastFailureReason: null,
		...overrides,
	}
}

function createLifecycle(options?: {
	getFileInfo?: ReturnType<typeof vi.fn>
	getAssetResourceInfo?: ReturnType<typeof vi.fn>
	getFileResourceMeta?: ReturnType<typeof vi.fn>
	getCachedResource?: ReturnType<typeof vi.fn>
	refreshResource?: ReturnType<typeof vi.fn>
	resolveResourceUrl?: ReturnType<typeof vi.fn>
	onResourceMetadataHydrated?: ReturnType<typeof vi.fn>
	onResourceVersionChanged?: ReturnType<typeof vi.fn>
	onResourceDeleted?: ReturnType<typeof vi.fn>
}) {
	const getFileInfo =
		options?.getFileInfo ??
		vi.fn().mockResolvedValue({
			src: "https://oss.test/image.png",
			fileName: "image.png",
			expires_at: "2030-01-01 00:00:00",
			resource_version: "v1",
			updated_at: "2030-01-01T00:00:00Z",
			content_length: 123,
		})
	const getCachedResource = options?.getCachedResource ?? vi.fn().mockResolvedValue(null)
	const getAssetResourceInfo =
		options?.getAssetResourceInfo ??
		vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: "https://assets.test/asset-1.png",
			fileName: "asset-1.png",
		})
	const resolveResourceUrl =
		options?.resolveResourceUrl ?? vi.fn().mockResolvedValue("/virtual/image.png")
	const incrementDiagnostic = vi.fn()
	const onResourceDeleted = options?.onResourceDeleted ?? vi.fn()
	const canvas = {
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo,
					getFileResourceMeta: options?.getFileResourceMeta,
					resolveResourceReference: createTestResourceReferenceResolver(),
				},
			},
		},
		mediaResourceOfflineCacheManager: {
			shouldBypassVirtualResource: vi.fn(() => false),
			isVirtualResourceUrl: vi.fn((url: string | null) => !!url?.startsWith("/virtual/")),
			getCachedResource,
			resolveResourceUrl,
			removeCachedResource: vi.fn(),
			recordVirtualResourceLoadFailure: vi.fn(),
		},
		assetResourceManager: {
			getResource: getAssetResourceInfo,
		},
	}
	const lifecycle = new MediaResourceUrlLifecycle({
		canvas: canvas as never,
		mediaType: "image",
		useImageProcess: true,
		isDestroyed: () => false,
		setFailureReason: (entry, reason) => {
			entry.lastFailureReason = reason
		},
		onResourceDeleted,
		refreshResource: options?.refreshResource ?? vi.fn().mockResolvedValue(true),
		onResourceMetadataHydrated: options?.onResourceMetadataHydrated,
		onResourceVersionChanged: options?.onResourceVersionChanged,
		incrementDiagnostic,
	})
	return {
		canvas,
		getFileInfo,
		getCachedResource,
		incrementDiagnostic,
		lifecycle,
		resolveResourceUrl,
		getAssetResourceInfo,
		onResourceDeleted,
	}
}

describe("MediaResourceUrlLifecycle", () => {
	it("resolves asset paths through the asset manager without workspace or offline lookup", async () => {
		const { getFileInfo, getAssetResourceInfo, lifecycle, resolveResourceUrl } =
			createLifecycle()
		const entry = createEntry({
			referencePath: "asset://asset-1",
			resourceIdentity: "opaque-asset:asset://asset-1",
		})

		await expect(lifecycle.exchangeOssSrc("asset://asset-1", entry)).resolves.toBe(
			"https://assets.test/asset-1.png",
		)
		expect(getAssetResourceInfo).toHaveBeenCalledWith("asset-1", {
			forceRefresh: undefined,
			priority: undefined,
		})
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(resolveResourceUrl).not.toHaveBeenCalled()
		expect(entry).toEqual(
			expect.objectContaining({
				ossSrc: "https://assets.test/asset-1.png",
				sourceUrl: "https://assets.test/asset-1.png",
				fileName: "asset-1.png",
			}),
		)
	})

	it("rejects an asset when its metadata type does not match the media manager", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "video",
			fileUrl: "https://assets.test/asset-1.mp4",
		})
		const { lifecycle } = createLifecycle({ getAssetResourceInfo })
		const entry = createEntry({ referencePath: "asset://asset-1" })

		await expect(lifecycle.exchangeOssSrc("asset://asset-1", entry)).resolves.toBeNull()
		expect(entry.lastFailureReason).toBe("load-error")
	})

	it("does not fall back to the offline cache when an asset has no URL", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: null,
		})
		const getCachedResource = vi.fn().mockResolvedValue({ url: "/virtual/stale.png" })
		const { lifecycle } = createLifecycle({ getAssetResourceInfo, getCachedResource })
		const entry = createEntry({ referencePath: "asset://asset-1" })

		await expect(
			lifecycle.ensureFreshOssInfo("asset://asset-1", entry, {
				allowCachedFallback: true,
			}),
		).resolves.toBeNull()
		expect(getCachedResource).not.toHaveBeenCalled()
	})

	it("bounds legacy asset retries per replacement URL", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/expired.png",
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/refreshed.png",
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/refreshed-again.png",
			})
		const { lifecycle } = createLifecycle({ getAssetResourceInfo })
		const entry = createEntry({ referencePath: "asset://asset-1" })

		await lifecycle.exchangeOssSrc("asset://asset-1", entry)
		await expect(
			lifecycle.resolveVirtualResourceFallbackOssSrc(
				"asset://asset-1",
				"https://assets.test/expired.png",
				entry,
				0,
			),
		).resolves.toBe("https://assets.test/refreshed.png")
		await expect(
			lifecycle.resolveVirtualResourceFallbackOssSrc(
				"asset://asset-1",
				"https://assets.test/refreshed.png",
				entry,
				0,
			),
		).resolves.toBe("https://assets.test/refreshed-again.png")
		await expect(
			lifecycle.resolveVirtualResourceFallbackOssSrc(
				"asset://asset-1",
				"https://assets.test/refreshed-again.png",
				entry,
				0,
			),
		).resolves.toBeNull()
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(4)
	})

	it("refreshes an asset inside the optional expiry safety window", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/almost-expired.png",
				expiresAt: new Date(Date.now() + 1_000).toISOString(),
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/fresh.png",
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
			})
		const { lifecycle } = createLifecycle({ getAssetResourceInfo })
		const entry = createEntry({ referencePath: "asset://asset-1" })

		await lifecycle.exchangeOssSrc("asset://asset-1", entry)
		await expect(lifecycle.ensureFreshOssInfo("asset://asset-1", entry)).resolves.toMatchObject(
			{
				ossSrc: "https://assets.test/fresh.png",
			},
		)
		expect(getAssetResourceInfo).toHaveBeenNthCalledWith(2, "asset-1", {
			forceRefresh: true,
			priority: undefined,
		})
	})

	it("force-refreshes an asset after its cached URL has expired", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/expired.png",
				expiresAt: new Date(Date.now() - 1_000).toISOString(),
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://assets.test/fresh.png",
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
			})
		const { lifecycle } = createLifecycle({ getAssetResourceInfo })
		const entry = createEntry({ referencePath: "asset://asset-1" })

		await lifecycle.exchangeOssSrc("asset://asset-1", entry)
		await expect(lifecycle.ensureFreshOssInfo("asset://asset-1", entry)).resolves.toMatchObject(
			{
				ossSrc: "https://assets.test/fresh.png",
			},
		)
		expect(getAssetResourceInfo).toHaveBeenNthCalledWith(2, "asset-1", {
			forceRefresh: true,
			priority: undefined,
		})
	})

	it("does not send malformed asset schemes to workspace getFileInfo", async () => {
		const { getFileInfo, lifecycle } = createLifecycle()
		const entry = createEntry({ referencePath: "asset://a/b" })

		await expect(lifecycle.exchangeOssSrc("asset://a/b", entry)).resolves.toBeNull()
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(entry.lastFailureReason).toBe("load-error")
	})

	it("exchanges an OSS URL and stores link metadata", async () => {
		const { getFileInfo, lifecycle, resolveResourceUrl } = createLifecycle()
		const entry = createEntry()

		await expect(lifecycle.exchangeOssSrc("./images/a.png", entry)).resolves.toBe(
			"/virtual/image.png",
		)

		expect(getFileInfo).toHaveBeenCalledWith("./images/a.png", {
			useImageProcess: true,
			forceRefresh: undefined,
		})
		expect(resolveResourceUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "./images/a.png",
				url: "https://oss.test/image.png",
				mediaType: "image",
				resourceVersion: "v1",
			}),
			{ bypassVirtualResource: undefined, preferVirtualResource: true },
		)
		expect(entry).toEqual(
			expect.objectContaining({
				ossSrc: "/virtual/image.png",
				ossSrcFromCachedFallback: false,
				sourceUrl: "https://oss.test/image.png",
				fileName: "image.png",
				resourceVersion: "v1",
				sourceUpdatedAt: "2030-01-01T00:00:00Z",
				contentLength: 123,
				lastFailureReason: null,
			}),
		)
	})

	it("notifies when initial exchange hydrates missing resource metadata", async () => {
		const onResourceMetadataHydrated = vi.fn()
		const { lifecycle } = createLifecycle({ onResourceMetadataHydrated })
		const entry = createEntry()

		await lifecycle.exchangeOssSrc("./images/a.png", entry)

		expect(onResourceMetadataHydrated).toHaveBeenCalledWith(
			"workspace:/画布A/images/a.png",
			entry,
		)
	})

	it("notifies when an exchange discovers a newer resource version", async () => {
		const onResourceVersionChanged = vi.fn()
		const getFileInfo = vi.fn().mockResolvedValue({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		const { lifecycle } = createLifecycle({ getFileInfo, onResourceVersionChanged })
		const entry = createEntry({ resourceVersion: "v1" })

		await lifecycle.exchangeOssSrc("./images/a.png", entry)

		expect(onResourceVersionChanged).toHaveBeenCalledWith(
			"workspace:/画布A/images/a.png",
			entry,
			"v1",
			"v2",
		)
	})

	it("forwards a higher priority subscriber while an exchange is already pending", async () => {
		let resolveFileInfo!: (value: { src: string; fileName: string; expires_at: string }) => void
		const fileInfoPromise = new Promise<{
			src: string
			fileName: string
			expires_at: string
		}>((resolve) => {
			resolveFileInfo = resolve
		})
		const getFileInfo = vi.fn(() => fileInfoPromise)
		const { lifecycle } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const nearRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			priority: "near",
		})
		const criticalRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			priority: "critical",
		})

		expect(getFileInfo).toHaveBeenNthCalledWith(1, "./images/a.png", {
			useImageProcess: true,
			forceRefresh: undefined,
			priority: "near",
		})
		expect(getFileInfo).toHaveBeenNthCalledWith(2, "./images/a.png", {
			useImageProcess: true,
			priority: "critical",
		})
		resolveFileInfo({
			src: "https://oss.test/image.png",
			fileName: "image.png",
			expires_at: "2030-01-01 00:00:00",
		})
		await expect(Promise.all([nearRequest, criticalRequest])).resolves.toEqual([
			"/virtual/image.png",
			"/virtual/image.png",
		])
	})

	it("does not let an older force-refresh race overwrite the newer exchange", async () => {
		let resolveFirst!: (value: Record<string, unknown>) => void
		let resolveSecond!: (value: Record<string, unknown>) => void
		const first = new Promise<Record<string, unknown>>((resolve) => {
			resolveFirst = resolve
		})
		const second = new Promise<Record<string, unknown>>((resolve) => {
			resolveSecond = resolve
		})
		const getFileInfo = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
		const { lifecycle } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const oldRequest = lifecycle.exchangeOssSrc("./images/a.png", entry)
		const refreshedRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			forceRefresh: true,
		})

		resolveSecond({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		await refreshedRequest
		resolveFirst({
			src: "https://oss.test/image-v1.png",
			fileName: "image.png",
			resource_version: "v1",
		})
		await oldRequest

		expect(entry.resourceVersion).toBe("v2")
		expect(entry.exchangePromise).toBeNull()
	})

	it("does not classify a superseded exchange as not-found", async () => {
		let resolveFirst!: (value: Record<string, unknown>) => void
		let resolveSecond!: (value: Record<string, unknown>) => void
		const first = new Promise<Record<string, unknown>>((resolve) => {
			resolveFirst = resolve
		})
		const second = new Promise<Record<string, unknown>>((resolve) => {
			resolveSecond = resolve
		})
		const getFileInfo = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
		const { lifecycle, onResourceDeleted } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const oldRequest = lifecycle.ensureFreshOssInfo("./images/a.png", entry, {
			allowCachedFallback: false,
		})
		const refreshedRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			forceRefresh: true,
		})

		resolveSecond({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		await refreshedRequest
		resolveFirst({
			src: "https://oss.test/image-v1.png",
			fileName: "image.png",
			resource_version: "v1",
		})

		await expect(oldRequest).resolves.toEqual({
			ossSrc: "/virtual/image.png",
			expiresAt: null,
		})
		expect(entry.lastFailureReason).toBeNull()
		expect(onResourceDeleted).not.toHaveBeenCalled()
	})

	it("keeps the current resource when a superseded exchange returns empty", async () => {
		let resolveFirst!: (value: undefined) => void
		let resolveSecond!: (value: Record<string, unknown>) => void
		const first = new Promise<undefined>((resolve) => {
			resolveFirst = resolve
		})
		const second = new Promise<Record<string, unknown>>((resolve) => {
			resolveSecond = resolve
		})
		const getFileInfo = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
		const { lifecycle, onResourceDeleted } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const oldRequest = lifecycle.ensureFreshOssInfo("./images/a.png", entry, {
			allowCachedFallback: false,
		})
		const refreshedRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			forceRefresh: true,
		})

		resolveSecond({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		await refreshedRequest
		resolveFirst(undefined)

		await expect(oldRequest).resolves.toEqual({
			ossSrc: "/virtual/image.png",
			expiresAt: null,
		})
		expect(entry.lastFailureReason).toBeNull()
		expect(onResourceDeleted).not.toHaveBeenCalled()
	})

	it("keeps the current resource when a superseded exchange rejects", async () => {
		let rejectFirst!: (error: Error) => void
		let resolveSecond!: (value: Record<string, unknown>) => void
		const first = new Promise<Record<string, unknown>>((_, reject) => {
			rejectFirst = reject
		})
		const second = new Promise<Record<string, unknown>>((resolve) => {
			resolveSecond = resolve
		})
		const getFileInfo = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
		const { lifecycle, onResourceDeleted } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const oldRequest = lifecycle.ensureFreshOssInfo("./images/a.png", entry, {
			allowCachedFallback: false,
		})
		const refreshedRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			forceRefresh: true,
		})

		resolveSecond({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		await refreshedRequest
		rejectFirst(Object.assign(new Error("missing"), { code: "RESOURCE_NOT_FOUND" }))

		await expect(oldRequest).resolves.toEqual({
			ossSrc: "/virtual/image.png",
			expiresAt: null,
		})
		expect(entry.lastFailureReason).toBeNull()
		expect(onResourceDeleted).not.toHaveBeenCalled()
	})

	it("does not let an older background metadata probe overwrite a newer exchange", async () => {
		let resolveMeta!: (value: {
			status: "exists"
			fileName: string
			resourceVersion: string
			updatedAt: string
			contentLength: number
		}) => void
		const metaPromise = new Promise<{
			status: "exists"
			fileName: string
			resourceVersion: string
			updatedAt: string
			contentLength: number
		}>((resolve) => {
			resolveMeta = resolve
		})
		const getFileResourceMeta = vi.fn(() => metaPromise)
		const getFileInfo = vi.fn().mockResolvedValue({
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		const { lifecycle } = createLifecycle({ getFileInfo, getFileResourceMeta })
		const entry = createEntry()

		const backgroundRequest = lifecycle.refreshResourceMetadata(
			"./images/a.png",
			"images/a.png",
			entry,
		)
		const foregroundRequest = lifecycle.exchangeOssSrc("./images/a.png", entry, {
			forceRefresh: true,
		})
		await foregroundRequest
		resolveMeta({
			status: "exists",
			fileName: "image.png",
			resourceVersion: "v1",
			updatedAt: "2030-01-01T00:00:00Z",
			contentLength: 123,
		})
		await backgroundRequest

		expect(entry.resourceVersion).toBe("v2")
		expect(entry.exchangePromise).toBeNull()
	})

	it("does not let an in-flight exchange overwrite a primed resource", async () => {
		let resolveFileInfo!: (value: Record<string, unknown>) => void
		const fileInfoPromise = new Promise<Record<string, unknown>>((resolve) => {
			resolveFileInfo = resolve
		})
		const getFileInfo = vi.fn(() => fileInfoPromise)
		const { lifecycle } = createLifecycle({ getFileInfo })
		const entry = createEntry()

		const oldRequest = lifecycle.exchangeOssSrc("./images/a.png", entry)
		lifecycle.primeCache("./images/a.png", entry, {
			src: "https://oss.test/image-v2.png",
			fileName: "image.png",
			resource_version: "v2",
		})
		resolveFileInfo({
			src: "https://oss.test/image-v1.png",
			fileName: "image.png",
			resource_version: "v1",
		})
		await expect(oldRequest).resolves.toBeNull()

		expect(entry.ossSrc).toBe("https://oss.test/image-v2.png")
		expect(entry.sourceUrl).toBe("https://oss.test/image-v2.png")
		expect(entry.resourceVersion).toBe("v2")
		expect(entry.exchangePromise).toBeNull()
	})

	it("does not notify hydration during exchange when resource metadata was already known", async () => {
		const onResourceMetadataHydrated = vi.fn()
		const { lifecycle } = createLifecycle({ onResourceMetadataHydrated })
		const entry = createEntry({ resourceVersion: "v1" })

		await lifecycle.exchangeOssSrc("./images/a.png", entry)

		expect(onResourceMetadataHydrated).not.toHaveBeenCalled()
	})

	it("bypasses virtual resource URLs when requested for fallback exchange", async () => {
		const { lifecycle, resolveResourceUrl } = createLifecycle()
		const entry = createEntry()

		await lifecycle.exchangeOssSrc("./images/a.png", entry, { bypassVirtualResource: true })

		expect(resolveResourceUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "./images/a.png",
				url: "https://oss.test/image.png",
				mediaType: "image",
			}),
			{ bypassVirtualResource: true, preferVirtualResource: false },
		)
	})

	it("falls back to cached resources when exchange misses and fallback is allowed", async () => {
		const getFileInfo = vi.fn().mockResolvedValue(null)
		const getCachedResource = vi.fn().mockResolvedValue({
			url: "/virtual/cached-image.png",
			sourceUrl: "https://oss.test/cached-image.png",
			expiresAt: null,
			resourceVersion: "cached-v1",
			sourceUpdatedAt: "2030-01-02T00:00:00Z",
			contentLength: 456,
		})
		const { lifecycle } = createLifecycle({ getFileInfo, getCachedResource })
		const entry = createEntry()

		await expect(
			lifecycle.ensureFreshOssInfo("./images/a.png", entry, {
				allowCachedFallback: true,
			}),
		).resolves.toEqual({
			ossSrc: "/virtual/cached-image.png",
			expiresAt: null,
		})

		expect(entry).toEqual(
			expect.objectContaining({
				ossSrc: "/virtual/cached-image.png",
				ossSrcFromCachedFallback: true,
				sourceUrl: "https://oss.test/cached-image.png",
				resourceVersion: "cached-v1",
				sourceUpdatedAt: "2030-01-02T00:00:00Z",
				contentLength: 456,
				lastFailureReason: null,
			}),
		)
	})

	it("does not downgrade known resource metadata when cached metadata is missing", async () => {
		const getFileInfo = vi.fn().mockResolvedValue(null)
		const getCachedResource = vi.fn().mockResolvedValue({
			url: "/virtual/cached-image.png",
			sourceUrl: null,
			expiresAt: null,
			resourceVersion: null,
			sourceUpdatedAt: null,
			contentLength: null,
		})
		const { lifecycle } = createLifecycle({ getFileInfo, getCachedResource })
		const entry = createEntry({
			sourceUrl: "https://oss.test/known-image.png",
			resourceVersion: "known-v1",
			sourceUpdatedAt: "2030-01-03T00:00:00Z",
			contentLength: 789,
		})

		await expect(
			lifecycle.ensureFreshOssInfo("./images/a.png", entry, {
				allowCachedFallback: true,
			}),
		).resolves.toEqual({
			ossSrc: "/virtual/cached-image.png",
			expiresAt: null,
		})

		expect(entry).toEqual(
			expect.objectContaining({
				ossSrc: "/virtual/cached-image.png",
				ossSrcFromCachedFallback: true,
				sourceUrl: "https://oss.test/known-image.png",
				resourceVersion: "known-v1",
				sourceUpdatedAt: "2030-01-03T00:00:00Z",
				contentLength: 789,
			}),
		)
	})

	it("hydrates missing cached metadata without refreshing the resource body", async () => {
		const getFileResourceMeta = vi.fn().mockResolvedValue({
			status: "exists",
			source: "workspace",
			fileName: "image.png",
			resourceVersion: "v1",
			updatedAt: "2030-01-01T00:00:00Z",
			contentLength: 123,
		})
		const refreshResource = vi.fn().mockResolvedValue(true)
		const onResourceMetadataHydrated = vi.fn()
		const { lifecycle, incrementDiagnostic } = createLifecycle({
			getFileResourceMeta,
			refreshResource,
			onResourceMetadataHydrated,
		})
		const entry = createEntry({
			ossSrc: "/virtual/cached-image.png",
			ossSrcFromCachedFallback: true,
			contentLength: 45,
		})

		await lifecycle.refreshResourceMetadata("./images/a.png", "images/a.png", entry)

		expect(refreshResource).not.toHaveBeenCalled()
		expect(onResourceMetadataHydrated).toHaveBeenCalledWith("images/a.png", entry)
		expect(incrementDiagnostic).toHaveBeenCalledWith("metadataUnchangedCount")
		expect(entry).toEqual(
			expect.objectContaining({
				resourceVersion: "v1",
				sourceUpdatedAt: "2030-01-01T00:00:00Z",
				contentLength: 123,
				lastFailureReason: null,
			}),
		)
	})

	it("refreshes when known resource metadata changes", async () => {
		const getFileResourceMeta = vi.fn().mockResolvedValue({
			status: "exists",
			source: "workspace",
			fileName: "image.png",
			resourceVersion: "v2",
			updatedAt: "2030-01-02T00:00:00Z",
			contentLength: 456,
		})
		const refreshResource = vi.fn().mockResolvedValue(true)
		const { lifecycle } = createLifecycle({
			getFileResourceMeta,
			refreshResource,
		})
		const entry = createEntry({
			resourceVersion: "v1",
			sourceUpdatedAt: "2030-01-01T00:00:00Z",
			contentLength: 123,
		})

		await lifecycle.refreshResourceMetadata("./images/a.png", "images/a.png", entry)

		expect(refreshResource).toHaveBeenCalledWith("./images/a.png")
	})

	it("cools down background metadata refreshes after a cached resource hit", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
		try {
			const getFileInfo = vi.fn().mockResolvedValue({
				src: "https://oss.test/image.png",
				fileName: "image.png",
				expires_at: "2030-01-01 01:00:00",
				resource_version: "v1",
				updated_at: "2030-01-01T00:00:00Z",
				content_length: 123,
			})
			const { lifecycle, incrementDiagnostic } = createLifecycle({ getFileInfo })
			const entry = createEntry({
				resourceVersion: "v1",
			})

			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
			await entry.backgroundRefreshPromise

			expect(getFileInfo).toHaveBeenCalledTimes(1)
			expect(incrementDiagnostic).toHaveBeenCalledWith("backgroundRefreshQueuedCount")
			expect(incrementDiagnostic).toHaveBeenCalledWith("getFileInfoForceRefreshCount")

			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)

			expect(getFileInfo).toHaveBeenCalledTimes(1)
			expect(incrementDiagnostic).toHaveBeenCalledWith("backgroundRefreshSkippedCount")

			vi.setSystemTime(new Date("2030-01-01T00:01:01Z"))
			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
			await entry.backgroundRefreshPromise

			expect(getFileInfo).toHaveBeenCalledTimes(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it("cools down lightweight resource metadata probes", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
		try {
			const getFileResourceMeta = vi.fn().mockResolvedValue({
				status: "exists",
				source: "workspace",
				fileName: "image.png",
				resourceVersion: "v1",
				updatedAt: "2030-01-01T00:00:00Z",
				contentLength: 123,
			})
			const { lifecycle, incrementDiagnostic } = createLifecycle({ getFileResourceMeta })
			const entry = createEntry({
				resourceVersion: "v1",
			})

			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
			await entry.backgroundRefreshPromise
			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)

			expect(getFileResourceMeta).toHaveBeenCalledTimes(1)
			expect(incrementDiagnostic).toHaveBeenCalledWith("backgroundRefreshSkippedCount")

			vi.setSystemTime(new Date("2030-01-01T00:01:01Z"))
			lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
			await entry.backgroundRefreshPromise
			expect(getFileResourceMeta).toHaveBeenCalledTimes(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it("allows a failed background metadata refresh to retry immediately", async () => {
		const getFileInfo = vi.fn().mockRejectedValue(new Error("temporary failure"))
		const { lifecycle } = createLifecycle({ getFileInfo })
		const entry = createEntry({ resourceVersion: "v1" })

		lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
		await entry.backgroundRefreshPromise
		lifecycle.triggerBackgroundMetadataRefresh("./images/a.png", "images/a.png", entry)
		await entry.backgroundRefreshPromise

		expect(getFileInfo).toHaveBeenCalledTimes(2)
	})
})
