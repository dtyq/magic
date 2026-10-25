import { describe, expect, it } from "vitest"
import { buildAssetComplianceParamsFromAssetItem } from "../buildCreateAssetParamsFromAssetItem"

describe("buildAssetComplianceParamsFromAssetItem", () => {
	it("builds compliance params from file_key only", () => {
		expect(
			buildAssetComplianceParamsFromAssetItem({
				name: "Demo",
				file_key: "private/asset.png",
			}),
		).toEqual({
			asset_kind: "ASSET",
			name: "Demo",
			file_key: "private/asset.png",
		})
	})

	it("rejects a project path when file_key is missing", () => {
		expect(buildAssetComplianceParamsFromAssetItem({ name: "Demo", file_key: null })).toBeNull()
	})
})
