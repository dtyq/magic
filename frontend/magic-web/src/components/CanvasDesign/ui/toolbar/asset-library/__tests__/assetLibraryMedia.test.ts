import { describe, expect, it } from "vitest"
import type { AssetItem } from "@/apis"
import { toAssetLibraryFullscreenPreviewItem } from "../assetLibraryMedia"

function asset(assetMediaType: AssetItem["asset_media_type"]): AssetItem {
	return {
		asset_id: "asset-1",
		asset_kind: "ASSET",
		asset_business_type: null,
		asset_media_type: assetMediaType,
		parent_id: null,
		name: "Portrait",
		description: "",
		file_url: "https://example.com/portrait",
		compliance_status: "UNVERIFIED",
		compliance_failed_reason: null,
		owner: { id: "owner-1", name: "Owner" },
		owner_uid: "owner-1",
		source: "PERSONAL",
		tags: [],
	}
}

describe("assetLibraryMedia", () => {
	it("does not guess an unknown media type as an image", () => {
		expect(toAssetLibraryFullscreenPreviewItem(asset(null))).toBeNull()
	})

	it("maps known media types to their preview kind", () => {
		expect(toAssetLibraryFullscreenPreviewItem(asset("IMAGE"))?.kind).toBe("image")
		expect(toAssetLibraryFullscreenPreviewItem(asset("VIDEO"))?.kind).toBe("video")
		expect(toAssetLibraryFullscreenPreviewItem(asset("AUDIO"))?.kind).toBe("audio")
	})
})
