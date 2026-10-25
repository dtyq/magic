import { describe, expect, it, vi } from "vitest"
import { RequestUrl } from "../../constant"
import { generatePlatformPackageApi } from "../platformPackage"

function createClient() {
	return {
		get: vi.fn((url: string) => ({ method: "get", url })),
		post: vi.fn((url: string, data?: unknown) => ({ method: "post", url, data })),
		put: vi.fn((url: string, data?: unknown) => ({ method: "put", url, data })),
		delete: vi.fn((url: string) => ({ method: "delete", url })),
	}
}

describe("PlatformPackageApi Skill market categories", () => {
	it("maps category list and detail APIs", () => {
		const client = createClient()
		const api = generatePlatformPackageApi(client as never)
		const params = { status: 1 as const, keyword: "office" }

		api.getSkillMarketCategoryList(params)
		api.getSkillMarketCategoryDetail("10001")

		expect(client.post).toHaveBeenCalledWith(RequestUrl.getSkillMarketCategoryList, params)
		expect(client.get).toHaveBeenCalledWith("/api/v1/admin/skills/categories/10001")
	})

	it("maps category create, update, and delete APIs", () => {
		const client = createClient()
		const api = generatePlatformPackageApi(client as never)
		const payload = {
			parent_id: "0",
			name_i18n: { zh_CN: "办公效率", en_US: "Productivity" },
			logo: null,
			sort_order: 100,
			status: 1 as const,
		}

		api.createSkillMarketCategory(payload)
		api.updateSkillMarketCategory("10001", payload)
		api.deleteSkillMarketCategory("10001")

		expect(client.post).toHaveBeenCalledWith(RequestUrl.createSkillMarketCategory, payload)
		expect(client.put).toHaveBeenCalledWith("/api/v1/admin/skills/categories/10001", payload)
		expect(client.delete).toHaveBeenCalledWith("/api/v1/admin/skills/categories/10001")
	})

	it("replaces a Skill market item's category relations with string IDs", () => {
		const client = createClient()
		const api = generatePlatformPackageApi(client as never)

		api.updateSkillMarketCategoryRelation("20001", ["10001", "10002"])

		expect(client.put).toHaveBeenCalledWith("/api/v1/admin/skills/markets/20001/category", {
			category_ids: ["10001", "10002"],
		})
	})

	it("maps official Skill manual import APIs", () => {
		const client = createClient()
		const api = generatePlatformPackageApi(client as never)
		const parseParams = { file_key: "private/skills/demo.skill" }
		const importParams = {
			import_token: "import-token",
			version: "1.0.0",
			name_i18n: { zh_CN: "数据分析", en_US: "Data analysis" },
			description_i18n: { zh_CN: "描述", en_US: "Description" },
			category_ids: ["10001"],
		}

		api.parseOfficialSkillFile(parseParams)
		api.importOfficialSkill(importParams)

		expect(client.post).toHaveBeenCalledWith(RequestUrl.parseOfficialSkillFile, parseParams)
		expect(client.post).toHaveBeenCalledWith(RequestUrl.importOfficialSkill, importParams)
	})
})
