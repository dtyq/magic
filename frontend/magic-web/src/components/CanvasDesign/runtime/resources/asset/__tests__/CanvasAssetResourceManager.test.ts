import { describe, expect, it, vi } from "vitest"
import { CanvasAssetResourceManager } from "../CanvasAssetResourceManager"
import { assetDetailStore } from "../AssetDetailStore"
import { getSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"

function createManager(
	getAssetResourceInfo: ReturnType<typeof vi.fn> = vi.fn(),
	getAssetResourceInfos?: ReturnType<typeof vi.fn>,
) {
	const canvas = {
		magicConfigManager: {
			config: {
				methods: { getAssetResourceInfo, getAssetResourceInfos },
			},
		},
	}
	return {
		canvas,
		manager: new CanvasAssetResourceManager(canvas as never),
	}
}

describe("CanvasAssetResourceManager", () => {
	it("deduplicates concurrent detail requests and keeps the normalized result in memory", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: " https://cdn.test/asset-1.png ",
			fileName: "asset-1.png",
			complianceStatus: "PASSED",
		})
		const { manager } = createManager(getAssetResourceInfo)

		const [first, second] = await Promise.all([
			manager.getResource("asset-1", { priority: "visible" }),
			manager.getResource("asset-1", { priority: "critical" }),
		])

		expect(getAssetResourceInfo).toHaveBeenCalledTimes(1)
		expect(first).toEqual({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: "https://cdn.test/asset-1.png",
			fileName: "asset-1.png",
			complianceStatus: "PASS",
		})
		expect(second).toBe(first)

		await manager.getResource("asset-1")
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(1)
	})

	it("refreshes numeric asset ids through one batch request and deduplicates ids", async () => {
		const getAssetResourceInfos = vi.fn().mockImplementation(async (assetIds: string[]) =>
			assetIds.map((assetId) => ({
				assetId,
				mediaType: "image",
				fileUrl: `https://cdn.test/${assetId}.png`,
			})),
		)
		const { manager } = createManager(vi.fn(), getAssetResourceInfos)

		const resources = await manager.refreshResources(["100", "101", "100"])

		expect(getAssetResourceInfos).toHaveBeenCalledTimes(1)
		expect(getAssetResourceInfos).toHaveBeenCalledWith(["100", "101"])
		expect([...resources.keys()]).toEqual(["100", "101"])
	})

	it("splits batch refreshes into requests of at most 200 ids", async () => {
		const getAssetResourceInfos = vi.fn().mockImplementation(async (assetIds: string[]) =>
			assetIds.map((assetId) => ({
				assetId,
				mediaType: "video",
				fileUrl: `https://${assetId}`,
			})),
		)
		const { manager } = createManager(vi.fn(), getAssetResourceInfos)
		const assetIds = Array.from({ length: 201 }, (_, index) => String(index + 1))

		await manager.refreshResources(assetIds)

		expect(getAssetResourceInfos).toHaveBeenCalledTimes(2)
		expect(getAssetResourceInfos.mock.calls[0][0]).toHaveLength(200)
		expect(getAssetResourceInfos.mock.calls[1][0]).toHaveLength(1)
	})

	it("passes force refresh through the batch resolver", async () => {
		const getAssetResourceInfos = vi.fn().mockResolvedValue([
			{
				assetId: "100",
				mediaType: "image",
				fileUrl: "https://cdn.test/100-fresh.png",
			},
		])
		const { manager } = createManager(vi.fn(), getAssetResourceInfos)

		await manager.refreshResources(["100"], { forceRefresh: true })

		expect(getAssetResourceInfos).toHaveBeenCalledWith(["100"], { forceRefresh: true })
	})

	it("unbinds document content when a successful asset batch omits the asset", async () => {
		const assetId = "987654321098765432"
		assetDetailStore.invalidate(assetId, getSharedMediaResourceScope())
		const element: ImageElement = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [
				{
					contentId: "content-1",
					src: "./images/portrait.png",
					assetId,
				},
			],
		}
		const update = vi.fn()
		const stop = vi.fn()
		const canvas = {
			magicConfigManager: {
				config: {
					methods: {
						getAssetResourceInfos: vi.fn().mockResolvedValue([]),
					},
				},
			},
			elementManager: {
				getAllElements: () => [element],
				getElementData: () => element,
				update,
			},
			permissionManager: { can: () => true },
			assetCompliancePollingManager: { stop },
			assetResourceManager: null as unknown as CanvasAssetResourceManager,
			refreshMediaComplianceFailedTags: vi.fn(),
		}
		const manager = new CanvasAssetResourceManager(canvas as never)
		canvas.assetResourceManager = manager

		await manager.preloadDocumentAssets({ elements: [element] } as never)

		expect(canvas.magicConfigManager.config.methods.getAssetResourceInfos).toHaveBeenCalledWith(
			[assetId],
			{ forceRefresh: true },
		)
		expect(stop).toHaveBeenCalledWith(assetId)
		const contents = update.mock.calls[0]?.[1]?.contents as ImageElement["contents"]
		expect(contents[0]?.assetId).toBeUndefined()
		manager.destroy()
	})

	it("does not batch non-numeric legacy ids and normalizes old compliance values", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "reference.png",
			mediaType: "image",
			fileUrl: "https://cdn.test/reference.png",
			complianceStatus: "PASSED",
		})
		const getAssetResourceInfos = vi.fn()
		const { manager } = createManager(getAssetResourceInfo, getAssetResourceInfos)

		await expect(manager.getResource("reference.png")).resolves.toMatchObject({
			assetId: "reference.png",
			complianceStatus: "PASS",
		})
		expect(getAssetResourceInfo).toHaveBeenCalledWith("reference.png", undefined)
		expect(getAssetResourceInfos).not.toHaveBeenCalled()
	})

	it("falls back to the single resolver when a batch request fails", async () => {
		const getAssetResourceInfos = vi.fn().mockRejectedValue(new Error("batch unavailable"))
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "123",
			mediaType: "audio",
			fileUrl: "https://cdn.test/audio.mp3",
		})
		const { manager } = createManager(getAssetResourceInfo, getAssetResourceInfos)

		await expect(manager.getResource("123")).resolves.toMatchObject({
			assetId: "123",
			mediaType: "audio",
		})
		expect(getAssetResourceInfos).toHaveBeenCalledWith(["123"])
		expect(getAssetResourceInfo).toHaveBeenCalledWith("123", undefined)
	})

	it("replaces a stale URL on force refresh", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "video",
				fileUrl: "https://cdn.test/old.mp4",
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "video",
				fileUrl: "https://cdn.test/new.mp4",
			})
		const { manager } = createManager(getAssetResourceInfo)

		await manager.getResource("asset-1")
		await expect(manager.getResource("asset-1", { forceRefresh: true })).resolves.toEqual(
			expect.objectContaining({ fileUrl: "https://cdn.test/new.mp4" }),
		)
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(2)
	})

	it("drops its local cache when the shared asset detail is invalidated", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: "https://cdn.test/asset-1.png",
		})
		const { manager } = createManager(getAssetResourceInfo)

		await manager.getResource("asset-1")
		assetDetailStore.invalidate("asset-1", getSharedMediaResourceScope())
		await manager.getResource("asset-1")

		expect(getAssetResourceInfo).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("rehydrates the Canvas cache when shared detail data is upserted", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://cdn.test/old.png",
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://cdn.test/new.png",
			})
		const { manager } = createManager(getAssetResourceInfo)

		await manager.getResource("asset-1")
		assetDetailStore.upsert(
			{
				asset_id: "asset-1",
				asset_kind: "ASSET",
				asset_business_type: null,
				asset_media_type: "IMAGE",
				parent_id: null,
				name: "Updated",
				description: "",
				file_url: "https://cdn.test/new.png",
				compliance_status: "PASS",
				compliance_failed_reason: null,
				owner: { id: "owner", name: "Owner" },
				owner_uid: "owner",
				source: "PERSONAL",
				tags: [],
			},
			getSharedMediaResourceScope(),
		)

		await vi.waitFor(() => {
			expect(manager.getCachedResource("asset-1")?.fileUrl).toBe("https://cdn.test/new.png")
		})
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(2)
		manager.destroy()
	})

	it("does not reuse an in-flight detail request after invalidation", async () => {
		let resolveOld!: (value: { assetId: string; mediaType: "image"; fileUrl: string }) => void
		const getAssetResourceInfo = vi
			.fn()
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveOld = resolve
				}),
			)
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://cdn.test/fresh.png",
			})
		const { manager } = createManager(getAssetResourceInfo)

		const oldRequest = manager.getResource("asset-1")
		manager.invalidate("asset-1")
		const freshRequest = manager.getResource("asset-1")
		resolveOld({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: "https://cdn.test/stale.png",
		})

		await expect(freshRequest).resolves.toMatchObject({
			fileUrl: "https://cdn.test/fresh.png",
		})
		await expect(oldRequest).resolves.toMatchObject({
			fileUrl: "https://cdn.test/stale.png",
		})
		expect(manager.getCachedResource("asset-1")?.fileUrl).toBe("https://cdn.test/fresh.png")
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(2)
	})

	it("maps the documented not-found response to a stable resource error", async () => {
		const error = Object.assign(new Error("asset unavailable"), { response: { code: 48000 } })
		const getAssetResourceInfo = vi.fn().mockRejectedValue(error)
		const { manager } = createManager(getAssetResourceInfo)

		await expect(manager.getResource("asset-404")).rejects.toMatchObject({
			name: "CanvasAssetResourceError",
			reason: "not-found",
		})
	})

	it("does not silently accept a response for another asset", async () => {
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "another-asset",
			mediaType: "audio",
			fileUrl: "https://cdn.test/audio.mp3",
		})
		const { manager } = createManager(getAssetResourceInfo)

		await expect(manager.getResource("asset-1")).rejects.toMatchObject({
			name: "CanvasAssetResourceError",
			reason: "load-error",
		})
	})

	it("refetches incomplete resource metadata instead of reusing it", async () => {
		const getAssetResourceInfo = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: null,
				fileUrl: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				mediaType: "image",
				fileUrl: "https://cdn.test/hydrated.png",
			})
		const { manager } = createManager(getAssetResourceInfo)

		await manager.getResource("asset-1")
		await expect(manager.getResource("asset-1")).resolves.toMatchObject({
			mediaType: "image",
			fileUrl: "https://cdn.test/hydrated.png",
		})
		expect(getAssetResourceInfo).toHaveBeenCalledTimes(2)
	})

	it("drops a cached resource when batch-get no longer returns the asset", async () => {
		const getAssetResourceInfos = vi
			.fn()
			.mockResolvedValueOnce([
				{
					assetId: "100",
					mediaType: "image",
					fileUrl: "https://cdn.test/old.png",
				},
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					assetId: "100",
					mediaType: "image",
					fileUrl: "https://cdn.test/fresh.png",
				},
			])
		const { manager } = createManager(vi.fn(), getAssetResourceInfos)

		await manager.refreshResources(["100"])
		await manager.refreshResources(["100"], { forceRefresh: true })
		await expect(manager.getResource("100")).resolves.toMatchObject({
			fileUrl: "https://cdn.test/fresh.png",
		})
		expect(getAssetResourceInfos).toHaveBeenCalledTimes(3)
	})
})
