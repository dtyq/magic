import { beforeEach, describe, expect, it, vi } from "vitest"
import { assetLibrarySessionStore, type AssetLibraryQuery } from "../AssetLibrarySessionStore"
import { assetDetailStore } from "../AssetDetailStore"

const mocks = vi.hoisted(() => ({
	queryAssets: vi.fn(),
	getAssetOwners: vi.fn(),
}))

vi.mock("@/apis", () => ({
	AssetsApi: {
		queryAssets: mocks.queryAssets,
		getAssetOwners: mocks.getAssetOwners,
	},
}))

const query: AssetLibraryQuery = {
	mediaTypes: ["IMAGE"],
	scope: "ALL",
	keyword: "",
	ownerUid: "",
	requiresCompliance: false,
}

function asset(
	id: string,
	mediaType: "IMAGE" | "VIDEO" | "AUDIO" = "IMAGE",
	complianceStatus: "UNVERIFIED" | "PASS" = "UNVERIFIED",
) {
	return {
		asset_id: id,
		asset_kind: "ASSET" as const,
		asset_business_type: null,
		asset_media_type: mediaType,
		parent_id: null,
		name: id,
		description: "",
		file_url: `https://example.com/${id}`,
		compliance_status: complianceStatus,
		compliance_failed_reason: null,
		owner: { id: "owner-1", name: "Owner" },
		owner_uid: "owner-1",
		source: "PERSONAL" as const,
		tags: [],
	}
}

function response(...items: ReturnType<typeof asset>[]) {
	return { page: 1, page_size: 200, total: items.length, list: items }
}

describe("AssetLibrarySessionStore", () => {
	beforeEach(() => {
		assetLibrarySessionStore.clearAll()
		mocks.queryAssets.mockReset()
		mocks.getAssetOwners.mockReset()
		mocks.getAssetOwners.mockResolvedValue([])
	})

	it("caches a completed query and reuses it on the next call", async () => {
		mocks.queryAssets.mockResolvedValue(response(asset("asset-1")))

		await expect(assetLibrarySessionStore.queryAssets(query, "scope-a")).resolves.toEqual([
			asset("asset-1"),
		])
		await expect(assetLibrarySessionStore.queryAssets(query, "scope-a")).resolves.toEqual([
			asset("asset-1"),
		])

		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
		expect(assetLibrarySessionStore.getCachedAssets(query, "scope-a")).toEqual([
			asset("asset-1"),
		])
		expect(assetDetailStore.getCached("asset-1", "scope-a")).toEqual(asset("asset-1"))
	})

	it("shares a pending promise for concurrent requests", async () => {
		let resolveRequest: ((value: ReturnType<typeof response>) => void) | undefined
		mocks.queryAssets.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			}),
		)

		const first = assetLibrarySessionStore.queryAssets(query, "scope-a")
		const second = assetLibrarySessionStore.queryAssets(query, "scope-a")

		expect(first).toBe(second)
		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
		resolveRequest?.(response(asset("asset-1")))
		await expect(first).resolves.toHaveLength(1)
	})

	it("queries all image and video assets once without a media type filter", async () => {
		mocks.queryAssets.mockResolvedValue(
			response(asset("IMAGE", "IMAGE"), asset("VIDEO", "VIDEO")),
		)
		const imageAndVideo = { ...query, mediaTypes: ["IMAGE", "VIDEO"] as const }
		const videoAndImage = { ...query, mediaTypes: ["VIDEO", "IMAGE"] as const }

		await expect(
			assetLibrarySessionStore.queryAssets(imageAndVideo, "scope-a"),
		).resolves.toEqual([asset("IMAGE", "IMAGE"), asset("VIDEO", "VIDEO")])
		await assetLibrarySessionStore.queryAssets(videoAndImage, "scope-a")

		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
		expect(mocks.queryAssets.mock.calls[0][0]).not.toHaveProperty("asset_media_type")
	})

	it("filters unsupported media returned by the unfiltered endpoint", async () => {
		mocks.queryAssets.mockResolvedValue(
			response(asset("IMAGE", "IMAGE"), asset("AUDIO", "AUDIO"), asset("VIDEO", "VIDEO")),
		)
		const imageAndVideo = { ...query, mediaTypes: ["IMAGE", "VIDEO"] as const }

		await expect(
			assetLibrarySessionStore.queryAssets(imageAndVideo, "scope-a"),
		).resolves.toEqual([asset("IMAGE", "IMAGE"), asset("VIDEO", "VIDEO")])
	})

	it("keeps a media type filter for a single-type query", async () => {
		mocks.queryAssets.mockResolvedValue(response(asset("IMAGE", "IMAGE")))

		await assetLibrarySessionStore.queryAssets(query, "scope-a")

		expect(mocks.queryAssets).toHaveBeenCalledWith(
			expect.objectContaining({ asset_media_type: "IMAGE" }),
		)
	})

	it("refreshes only the current query and keeps old assets when refresh fails", async () => {
		mocks.queryAssets
			.mockResolvedValueOnce(response(asset("old")))
			.mockRejectedValueOnce(new Error("refresh failed"))
		await assetLibrarySessionStore.queryAssets(query, "scope-a")

		await expect(assetLibrarySessionStore.refreshAssets(query, "scope-a")).rejects.toThrow(
			"refresh failed",
		)
		expect(assetLibrarySessionStore.getCachedAssets(query, "scope-a")).toEqual([asset("old")])
		expect(
			assetLibrarySessionStore.getSnapshotByKey(
				assetLibrarySessionStore.getQueryKey(query, "scope-a"),
				"scope-a",
			).error,
		).toEqual(new Error("refresh failed"))
	})

	it("isolates list and owner caches by scope", async () => {
		mocks.queryAssets.mockResolvedValue(response(asset("asset-a")))
		mocks.getAssetOwners.mockResolvedValue([{ id: "owner-1", name: "Owner" }])

		await assetLibrarySessionStore.queryAssets(query, "scope-a")
		await assetLibrarySessionStore.getOwners("scope-a")
		await assetLibrarySessionStore.queryAssets(query, "scope-b")
		await assetLibrarySessionStore.getOwners("scope-b")

		expect(mocks.queryAssets).toHaveBeenCalledTimes(2)
		expect(mocks.getAssetOwners).toHaveBeenCalledTimes(2)
	})

	it("invalidates all list queries in the current scope but keeps owner data", async () => {
		mocks.queryAssets.mockResolvedValue(response(asset("asset-1")))
		await assetLibrarySessionStore.queryAssets(query, "scope-a")
		await assetLibrarySessionStore.queryAssets({ ...query, keyword: "other" }, "scope-a")
		await assetLibrarySessionStore.getOwners("scope-a")

		assetLibrarySessionStore.invalidateCurrentScope("scope-a")
		mocks.queryAssets.mockResolvedValue(response(asset("asset-2")))
		await assetLibrarySessionStore.queryAssets(query, "scope-a")
		await assetLibrarySessionStore.getOwners("scope-a")

		expect(mocks.queryAssets).toHaveBeenCalledTimes(3)
		expect(mocks.getAssetOwners).toHaveBeenCalledTimes(1)
	})

	it("marks cached lists stale without dropping the previous result", async () => {
		mocks.queryAssets
			.mockResolvedValueOnce(response(asset("old")))
			.mockResolvedValueOnce(response(asset("new")))
		await assetLibrarySessionStore.queryAssets(query, "scope-a")

		const queryKey = assetLibrarySessionStore.getQueryKey(query, "scope-a")
		assetLibrarySessionStore.invalidateCurrentScope("scope-a")
		const staleSnapshot = assetLibrarySessionStore.getSnapshotByKey(queryKey, "scope-a")
		expect(staleSnapshot.assets).toEqual([asset("old")])
		expect(staleSnapshot.stale).toBe(true)

		await assetLibrarySessionStore.queryAssets(query, "scope-a")
		expect(assetLibrarySessionStore.getCachedAssets(query, "scope-a")).toEqual([asset("new")])
	})

	it("upserts a mutation response into the visible list before revalidation", async () => {
		mocks.queryAssets.mockResolvedValue(response(asset("asset-1")))
		await assetLibrarySessionStore.queryAssets(query, "scope-a")

		const updated = { ...asset("asset-1"), name: "Updated" }
		assetLibrarySessionStore.upsertAsset(updated, "scope-a")

		const snapshot = assetLibrarySessionStore.getSnapshotByKey(
			assetLibrarySessionStore.getQueryKey(query, "scope-a"),
			"scope-a",
		)
		expect(snapshot.assets).toEqual([updated])
		expect(snapshot.stale).toBe(true)
	})

	it("patches ordinary lists and only stales compliance-filtered lists", async () => {
		const filteredQuery = { ...query, requiresCompliance: true }
		mocks.queryAssets
			.mockResolvedValueOnce(response(asset("asset-1")))
			.mockResolvedValueOnce(response(asset("asset-1", "IMAGE", "PASS")))

		await assetLibrarySessionStore.queryAssets(query, "scope-a")
		await assetLibrarySessionStore.queryAssets(filteredQuery, "scope-a")

		assetLibrarySessionStore.applyAssetComplianceState(
			"asset-1",
			"FAILED",
			"包含不允许的内容",
			"scope-a",
		)

		const normalSnapshot = assetLibrarySessionStore.getSnapshotByKey(
			assetLibrarySessionStore.getQueryKey(query, "scope-a"),
			"scope-a",
		)
		const filteredSnapshot = assetLibrarySessionStore.getSnapshotByKey(
			assetLibrarySessionStore.getQueryKey(filteredQuery, "scope-a"),
			"scope-a",
		)

		expect(normalSnapshot).toMatchObject({
			stale: false,
			assets: [
				expect.objectContaining({
					compliance_status: "FAILED",
					compliance_failed_reason: "包含不允许的内容",
				}),
			],
		})
		expect(filteredSnapshot.stale).toBe(true)
		expect(filteredSnapshot.assets[0].compliance_status).toBe("PASS")
	})

	it("does not seed an in-flight stale list over a newer mutation detail", async () => {
		let resolveList!: (value: ReturnType<typeof response>) => void
		mocks.queryAssets.mockReturnValue(
			new Promise((resolve) => {
				resolveList = resolve
			}),
		)

		const pendingList = assetLibrarySessionStore.queryAssets(query, "scope-a")
		const updated = asset("asset-1")
		updated.name = "Mutation result"
		assetLibrarySessionStore.upsertAsset(updated, "scope-a")
		resolveList(response(asset("asset-1")))
		await pendingList

		expect(assetDetailStore.getCached("asset-1", "scope-a")?.name).toBe("Mutation result")
	})

	it("clears detail entries when a mutation has no full asset response", () => {
		assetDetailStore.upsert(asset("asset-1"), "scope-a")
		expect(assetDetailStore.getCached("asset-1", "scope-a")).toBeDefined()

		assetLibrarySessionStore.invalidateAsset("asset-1", "scope-a")

		expect(assetDetailStore.getCached("asset-1", "scope-a")).toBeUndefined()
	})
})
