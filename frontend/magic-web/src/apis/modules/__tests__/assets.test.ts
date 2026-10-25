import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { buildAssetVisibility, generateAssetsApi, normalizeAssetItem } from "../assets"

describe("generateAssetsApi", () => {
	it("encodes personal and team visibility explicitly", () => {
		expect(buildAssetVisibility()).toEqual({
			visibility_type: "PERSONAL",
			user_ids: [],
			department_ids: [],
		})
		expect(buildAssetVisibility(["user-1"], [])).toEqual({
			visibility_type: "TEAM",
			user_ids: ["user-1"],
			department_ids: [],
		})
	})

	it("normalizes unknown media types instead of treating them as images", () => {
		const normalized = normalizeAssetItem({
			asset_id: "asset-1",
			asset_kind: "ASSET",
			asset_business_type: null,
			asset_media_type: "UNKNOWN" as never,
			parent_id: null,
			name: "Portrait",
			description: "",
			file_url: "https://example.com/portrait.png",
			compliance_status: "UNVERIFIED",
			compliance_failed_reason: null,
			owner: { id: "owner-1", name: "Owner" },
			owner_uid: "owner-1",
			source: "PERSONAL",
			tags: [],
		})

		expect(normalized.asset_media_type).toBeNull()
	})

	it("declares asset-library endpoints with the documented request shapes", async () => {
		const get = vi.fn().mockResolvedValue({})
		const post = vi.fn((path: string) => {
			if (path === "/api/v1/assets/queries") {
				return Promise.resolve({ page: 1, page_size: 10, total: 0, list: [] })
			}
			if (path === "/api/v1/assets/batch-get") return Promise.resolve([])
			if (path === "/api/v1/assets/batch-delete") {
				return Promise.resolve({ deleted_num: 2, asset_ids: ["asset-1", "asset-2"] })
			}
			if (path === "/api/v1/assets/batch-compliance") return Promise.resolve({ items: [] })
			return Promise.resolve({})
		})
		const put = vi.fn().mockResolvedValue({})
		const deleteRequest = vi.fn().mockResolvedValue({})
		const api = generateAssetsApi({
			get,
			post,
			put,
			delete: deleteRequest,
		} as unknown as ServiceHttpClient)

		await api.getPrivateUploadToken({ business_code: "ASSET", expires: 1800 })
		await api.getAssetAgreementStatus()
		await api.signAssetAgreement()
		await api.startAssetCompliance({
			name: "已有素材",
			file_key: "org/user/asset/existing.png",
		})
		await api.startAssetCompliance({
			name: "人物参考图",
			project_id: "project-1",
			project_file_path: "/images/reference.png",
		})
		await api.saveAssetToLibrary({
			name: "项目参考视频",
			file_key: "org/user/asset/reference.mp4",
			visibility: {
				visibility_type: "PERSONAL",
				user_ids: [],
				department_ids: [],
			},
		})
		await api.queryAssets({ scope: "ALL", compliance_status: "PASS" })
		await api.getAsset("asset-1")
		await api.getAssetVisibilityConfig("asset-1")
		await api.updateAsset("asset-1", {
			name: "更新后的素材",
			description: "",
			visibility: {
				visibility_type: "TEAM",
				user_ids: [],
				department_ids: ["department-1"],
			},
			tag_ids: [],
		})
		await api.batchGetAssets({ asset_ids: ["asset-1", "asset-2"] })
		await api.batchDeleteAssets({ asset_ids: ["asset-1", "asset-2"] })
		await api.getAssetCompliance("asset-1")
		await api.getAssetTags()
		await api.createAssetTag({ name: "人物", node_type: "group", parent_id: "0" })
		await api.updateAssetTag("tag-1", { name: "肖像" })
		await api.deleteAssetTag("tag-1")
		await api.getAssetOwners()
		await api.transferAssetOwner({ asset_ids: ["asset-1"], owner_uid: "user-2" })
		await api.deleteAsset("asset-1")
		await api.batchGetAssetCompliance({ asset_ids: ["asset-1", "asset-2"] })

		expect(post).toHaveBeenNthCalledWith(1, "/api/v1/file/private-upload-token", {
			business_code: "ASSET",
			expires: 1800,
		})
		expect(post).toHaveBeenNthCalledWith(2, "/api/v1/asset-agreements")
		expect(post).toHaveBeenNthCalledWith(3, "/api/v1/assets", {
			name: "已有素材",
			file_key: "org/user/asset/existing.png",
		})
		expect(post).toHaveBeenNthCalledWith(4, "/api/v1/assets", {
			name: "人物参考图",
			project_id: "project-1",
			project_file_path: "/images/reference.png",
		})
		expect(post).toHaveBeenNthCalledWith(5, "/api/v1/assets/library", {
			name: "项目参考视频",
			file_key: "org/user/asset/reference.mp4",
			visibility: {
				visibility_type: "PERSONAL",
				user_ids: [],
				department_ids: [],
			},
		})
		expect(post).toHaveBeenNthCalledWith(6, "/api/v1/assets/queries", {
			scope: "ALL",
			compliance_status: "PASS",
		})
		expect(post).toHaveBeenNthCalledWith(7, "/api/v1/assets/batch-get", {
			asset_ids: ["asset-1", "asset-2"],
		})
		expect(post).toHaveBeenNthCalledWith(8, "/api/v1/assets/batch-delete", {
			asset_ids: ["asset-1", "asset-2"],
		})
		expect(post).toHaveBeenCalledWith("/api/v1/assets/batch-compliance", {
			asset_ids: ["asset-1", "asset-2"],
		})
		expect(get).toHaveBeenNthCalledWith(1, "/api/v1/asset-agreements")
		expect(get).toHaveBeenNthCalledWith(2, "/api/v1/assets/asset-1")
		expect(get).toHaveBeenNthCalledWith(3, "/api/v1/resource-visibility/config", {
			params: {
				resource_type: 5,
				resource_code: "asset-1",
			},
		})
		expect(get).toHaveBeenNthCalledWith(4, "/api/v1/assets/asset-1/compliance")
		expect(get).toHaveBeenNthCalledWith(5, "/api/v1/assets/tags")
		expect(get).toHaveBeenNthCalledWith(6, "/api/v1/assets/owners")
		expect(put).toHaveBeenNthCalledWith(1, "/api/v1/assets/asset-1", {
			name: "更新后的素材",
			description: "",
			visibility: {
				visibility_type: "TEAM",
				user_ids: [],
				department_ids: ["department-1"],
			},
			tag_ids: [],
		})
		expect(put).toHaveBeenNthCalledWith(2, "/api/v1/assets/tags/tag-1", {
			name: "肖像",
		})
		expect(deleteRequest).toHaveBeenNthCalledWith(1, "/api/v1/assets/tags/tag-1")
		expect(deleteRequest).toHaveBeenNthCalledWith(2, "/api/v1/assets/asset-1")
	})
})
