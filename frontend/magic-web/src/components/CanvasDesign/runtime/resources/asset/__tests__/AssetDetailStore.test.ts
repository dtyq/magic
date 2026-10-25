import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AssetItem } from "@/apis"
import { AssetDetailStore } from "../AssetDetailStore"

const mocks = vi.hoisted(() => ({
	getAsset: vi.fn(),
	batchGetAssets: vi.fn(),
}))

vi.mock("@/apis", () => ({
	AssetsApi: {
		getAsset: mocks.getAsset,
		batchGetAssets: mocks.batchGetAssets,
	},
}))

function asset(id: string, fileUrl = `https://example.com/${id}`): AssetItem {
	return {
		asset_id: id,
		asset_kind: "ASSET",
		asset_business_type: null,
		asset_media_type: "IMAGE",
		parent_id: null,
		name: id,
		description: "",
		file_url: fileUrl,
		compliance_status: "UNVERIFIED",
		compliance_failed_reason: null,
		owner: { id: "owner", name: "Owner" },
		owner_uid: "owner",
		source: "PERSONAL",
		tags: [],
	}
}

describe("AssetDetailStore", () => {
	let store: AssetDetailStore

	beforeEach(() => {
		store = new AssetDetailStore()
		mocks.getAsset.mockReset()
		mocks.batchGetAssets.mockReset()
	})

	it("shares detail requests and accepts list/mutation upserts", async () => {
		mocks.getAsset.mockResolvedValue(asset("1"))
		const first = store.get("1", undefined, "scope-a")
		const second = store.get("1", undefined, "scope-a")
		expect(await first).toEqual(asset("1"))
		expect(await second).toEqual(asset("1"))
		expect(mocks.getAsset).toHaveBeenCalledTimes(1)

		const updated = asset("1", "https://example.com/new")
		store.upsert(updated, "scope-a")
		expect(store.getCached("1", "scope-a")).toEqual(updated)
	})

	it("emits mutation invalidation without invalidating ordinary detail reads", async () => {
		store.getCached("scope-bootstrap", "scope-a")
		const changes: string[] = []
		const unsubscribe = store.subscribe((change) => {
			changes.push(`${change.kind}:${change.assetId ?? "all"}`)
		})
		mocks.getAsset.mockResolvedValue(asset("1"))

		await store.get("1", undefined, "scope-a")
		expect(changes).toEqual([])

		store.upsert(asset("1"), "scope-a")
		store.invalidate("1", "scope-a")
		expect(changes).toEqual(["upsert:1", "invalidate:1"])
		unsubscribe()
	})

	it("uses one batch request for missing details", async () => {
		mocks.batchGetAssets.mockResolvedValue([asset("1"), asset("2")])
		await expect(store.batchGet(["1", "2"], undefined, "scope-a")).resolves.toEqual([
			asset("1"),
			asset("2"),
		])
		expect(mocks.batchGetAssets).toHaveBeenCalledWith({ asset_ids: ["1", "2"] })
	})

	it("falls back to single detail requests for non-numeric legacy IDs", async () => {
		mocks.getAsset.mockResolvedValue(asset("legacy-id"))
		await expect(store.batchGet(["legacy-id"], undefined, "scope-a")).resolves.toEqual([
			asset("legacy-id"),
		])
		expect(mocks.getAsset).toHaveBeenCalledWith("legacy-id")
		expect(mocks.batchGetAssets).not.toHaveBeenCalled()
	})

	it("refetches incomplete list metadata before returning a Canvas detail", async () => {
		store.upsert(
			{
				...asset("1"),
				asset_media_type: null,
				file_url: null,
			},
			"scope-a",
		)
		mocks.getAsset.mockResolvedValue(asset("1", "https://example.com/hydrated"))

		await expect(store.get("1", undefined, "scope-a")).resolves.toMatchObject({
			file_url: "https://example.com/hydrated",
		})
		expect(mocks.getAsset).toHaveBeenCalledWith("1")
	})

	it("refetches a list row when existing-asset compliance needs file_key", async () => {
		store.upsert(asset("1"), "scope-a")
		mocks.getAsset.mockResolvedValue({ ...asset("1"), file_key: "private/portrait.png" })

		await expect(store.getWithFileKey("1", undefined, "scope-a")).resolves.toMatchObject({
			file_key: "private/portrait.png",
		})
		expect(mocks.getAsset).toHaveBeenCalledWith("1")
	})

	it("falls back to single detail when an in-flight batch omits file_key", async () => {
		let resolveBatch!: (assets: AssetItem[]) => void
		mocks.batchGetAssets.mockReturnValueOnce(
			new Promise<AssetItem[]>((resolve) => {
				resolveBatch = resolve
			}),
		)
		const batchPromise = store.batchGet(["1"], undefined, "scope-a")
		mocks.getAsset.mockResolvedValue({ ...asset("1"), file_key: "private/portrait.png" })

		const compliancePromise = store.getWithFileKey("1", undefined, "scope-a")
		resolveBatch([asset("1")])

		await expect(compliancePromise).resolves.toMatchObject({
			file_key: "private/portrait.png",
		})
		await batchPromise
		expect(mocks.getAsset).toHaveBeenCalledWith("1")
	})

	it("does not request details when the cached asset already has file_key", async () => {
		store.upsert(
			{
				...asset("1"),
				asset_media_type: null,
				file_url: null,
				file_key: "private/portrait.png",
			},
			"scope-a",
		)

		await expect(store.getWithFileKey("1", undefined, "scope-a")).resolves.toMatchObject({
			file_key: "private/portrait.png",
		})
		expect(mocks.getAsset).not.toHaveBeenCalled()
	})

	it("drops a detail omitted by an authoritative batch response", async () => {
		mocks.batchGetAssets
			.mockResolvedValueOnce([asset("1", "https://example.com/old")])
			.mockResolvedValueOnce([])
		mocks.getAsset.mockResolvedValue(asset("1", "https://example.com/fresh"))

		await store.batchGet(["1"], undefined, "scope-a")
		await store.batchGet(["1"], { forceRefresh: true }, "scope-a")
		await expect(store.get("1", undefined, "scope-a")).resolves.toMatchObject({
			file_url: "https://example.com/fresh",
		})
		expect(mocks.batchGetAssets).toHaveBeenCalledTimes(2)
		expect(mocks.getAsset).toHaveBeenCalledWith("1")
	})

	it("bypasses the completed batch cache when a forced refresh is requested", async () => {
		mocks.batchGetAssets
			.mockResolvedValueOnce([asset("1", "https://example.com/old")])
			.mockResolvedValueOnce([asset("1", "https://example.com/new")])

		await store.batchGet(["1"], undefined, "scope-a")
		await expect(store.batchGet(["1"], { forceRefresh: true }, "scope-a")).resolves.toEqual([
			asset("1", "https://example.com/new"),
		])

		expect(mocks.batchGetAssets).toHaveBeenCalledTimes(2)
	})

	it("allows one bounded forced refresh after a load failure without expiry metadata", async () => {
		mocks.getAsset.mockResolvedValueOnce(asset("1", "old"))
		await store.get("1", undefined, "scope-a")
		mocks.getAsset.mockResolvedValueOnce(asset("1", "new"))
		await store.refreshAfterLoadFailure("1", "scope-a")
		await store.refreshAfterLoadFailure("1", "scope-a")
		expect(mocks.getAsset).toHaveBeenCalledTimes(2)
	})

	it("switches from the legacy retry guard to expiry-aware refreshes", async () => {
		mocks.getAsset
			.mockResolvedValueOnce(asset("1", "old"))
			.mockResolvedValueOnce({
				...asset("1", "fresh-with-expiry"),
				expires_at: new Date(Date.now() + 60_000).toISOString(),
			})
			.mockResolvedValueOnce({
				...asset("1", "fresh-again"),
				expires_at: new Date(Date.now() + 60_000).toISOString(),
			})

		await store.get("1", undefined, "scope-a")
		await store.refreshAfterLoadFailure("1", "scope-a")
		await store.refreshAfterLoadFailure("1", "scope-a")

		expect(mocks.getAsset).toHaveBeenCalledTimes(3)
	})

	it("forces a refresh when the optional expiry enters the safety window", async () => {
		const expiring = { ...asset("1"), expires_at: new Date(Date.now() + 1_000).toISOString() }
		mocks.getAsset.mockResolvedValueOnce(expiring).mockResolvedValueOnce(asset("1", "fresh"))
		await store.get("1", undefined, "scope-a")
		await store.get("1", undefined, "scope-a")
		expect(mocks.getAsset).toHaveBeenCalledTimes(2)
	})

	it("does not let an older forced request overwrite a newer detail", async () => {
		let resolveOld!: (value: AssetItem) => void
		let resolveNew!: (value: AssetItem) => void
		mocks.getAsset
			.mockReturnValueOnce(new Promise<AssetItem>((resolve) => (resolveOld = resolve)))
			.mockReturnValueOnce(new Promise<AssetItem>((resolve) => (resolveNew = resolve)))

		const oldRequest = store.get("1", undefined, "scope-a")
		const newRequest = store.get("1", { forceRefresh: true }, "scope-a")
		resolveNew(asset("1", "https://example.com/new"))
		await newRequest
		resolveOld(asset("1", "https://example.com/old"))
		await oldRequest

		expect(store.getCached("1", "scope-a")?.file_url).toBe("https://example.com/new")
	})

	it("does not reuse or accept an in-flight detail request after invalidation", async () => {
		let resolveOld!: (value: AssetItem) => void
		mocks.getAsset
			.mockReturnValueOnce(new Promise<AssetItem>((resolve) => (resolveOld = resolve)))
			.mockResolvedValueOnce(asset("1", "https://example.com/fresh"))

		const oldRequest = store.get("1", undefined, "scope-a")
		store.invalidate("1", "scope-a")
		await expect(store.get("1", undefined, "scope-a")).resolves.toEqual(
			asset("1", "https://example.com/fresh"),
		)

		resolveOld(asset("1", "https://example.com/stale"))
		await oldRequest
		expect(store.getCached("1", "scope-a")?.file_url).toBe("https://example.com/fresh")
		expect(mocks.getAsset).toHaveBeenCalledTimes(2)
	})

	it("does not let an older detail response overwrite a mutation upsert", async () => {
		let resolveOld!: (value: AssetItem) => void
		mocks.getAsset.mockReturnValueOnce(
			new Promise<AssetItem>((resolve) => (resolveOld = resolve)),
		)

		const oldRequest = store.get("1", undefined, "scope-a")
		store.upsert(asset("1", "https://example.com/mutated"), "scope-a")
		resolveOld(asset("1", "https://example.com/stale"))
		await oldRequest

		expect(store.getCached("1", "scope-a")?.file_url).toBe("https://example.com/mutated")
	})

	it("preserves omitted detail fields in a compact mutation response", async () => {
		store.upsert(asset("1", "https://example.com/original"), "scope-a")

		store.upsert(
			{
				asset_id: "1",
				asset_kind: "ASSET",
				name: "Renamed",
				compliance_status: "PASS",
			} as AssetItem,
			"scope-a",
		)

		expect(store.getCached("1", "scope-a")).toMatchObject({
			name: "Renamed",
			asset_media_type: "IMAGE",
			file_url: "https://example.com/original",
		})
	})

	it("allows one fallback refresh again after a legacy URL changes", async () => {
		mocks.getAsset
			.mockResolvedValueOnce(asset("1", "https://example.com/old"))
			.mockResolvedValueOnce(asset("1", "https://example.com/new"))
			.mockResolvedValueOnce(asset("1", "https://example.com/newer"))

		await store.get("1", undefined, "scope-a")
		await store.refreshAfterLoadFailure("1", "scope-a")
		store.upsert(asset("1", "https://example.com/newer"), "scope-a")
		await store.refreshAfterLoadFailure("1", "scope-a")

		expect(mocks.getAsset).toHaveBeenCalledTimes(3)
	})

	it("notifies Canvas consumers when a list refresh observes an external edit", () => {
		store.upsert(asset("1", "https://example.com/old"), "scope-a")
		const changes: string[] = []
		store.subscribe((change) => changes.push(`${change.kind}:${change.assetId ?? "all"}`))

		store.seedFromList({ ...asset("1", "https://example.com/new"), name: "Updated" }, "scope-a")

		expect(changes).toEqual(["upsert:1"])
	})

	it("does not clear every detail for a blank invalidation id", () => {
		store.upsert(asset("1"), "scope-a")
		store.upsert(asset("2"), "scope-a")
		store.invalidate("", "scope-a")

		expect(store.getCached("1", "scope-a")).toBeDefined()
		expect(store.getCached("2", "scope-a")).toBeDefined()
	})
})
