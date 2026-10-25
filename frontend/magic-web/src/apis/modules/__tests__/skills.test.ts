import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateSkillsApi } from "../skills"

describe("generateSkillsApi", () => {
	it("omits empty skill-market categories by default", async () => {
		const get = vi.fn().mockResolvedValue({ list: [] })
		const api = generateSkillsApi({ get } as unknown as ServiceHttpClient)

		await api.getSkillMarketCategories()

		expect(get).toHaveBeenCalledWith("/api/v1/skill-market/categories", {
			params: { include_empty: undefined },
		})
	})

	it("supports explicitly requesting empty skill-market categories", async () => {
		const get = vi.fn().mockResolvedValue({ list: [] })
		const api = generateSkillsApi({ get } as unknown as ServiceHttpClient)

		await api.getSkillMarketCategories({ include_empty: true })

		expect(get).toHaveBeenCalledWith("/api/v1/skill-market/categories", {
			params: { include_empty: true },
		})
	})

	it("uses the admin endpoint for official Skill parsing", async () => {
		const post = vi.fn().mockResolvedValue({})
		const api = generateSkillsApi({ post } as unknown as ServiceHttpClient)

		await api.parseOfficialSkillFile({ file_key: "org/skills/demo.zip" })

		expect(post).toHaveBeenCalledWith("/api/v1/admin/official-skills/import/parse/file", {
			file_key: "org/skills/demo.zip",
		})
	})

	it("creates and checks async skill publish tasks", async () => {
		const post = vi.fn().mockResolvedValue({
			publish_task_id: "100000000000009004",
			status: "processing",
			progress: 0,
		})
		const get = vi.fn().mockResolvedValue({
			publish_task_id: "100000000000009004",
			status: "ready",
			progress: 100,
		})
		const api = generateSkillsApi({ get, post } as unknown as ServiceHttpClient)
		const body = {
			version: "1.0.0",
			version_description_i18n: { zh_CN: "说明", en_US: "notes" },
			publish_target_type: "PRIVATE" as const,
			publish_target_value: null,
		}

		await api.publishSkillAsync({ code: "SK-1", ...body })
		await api.checkSkillPublish({ code: "SK-1", publish_task_id: "100000000000009004" })

		expect(post).toHaveBeenCalledWith("/api/v1/skills/SK-1/publish/async", body)
		expect(get).toHaveBeenCalledWith("/api/v1/skills/SK-1/publish/check", {
			params: { publish_task_id: "100000000000009004" },
		})
	})

	it("supports token and file-key official Skill import modes", async () => {
		const post = vi.fn().mockResolvedValue({})
		const api = generateSkillsApi({ post } as unknown as ServiceHttpClient)
		const fields = {
			version: "1.0.0",
			name_i18n: { default: "Demo", en_US: "Demo", zh_CN: "演示" },
			description_i18n: { default: "Description", en_US: "Description", zh_CN: "描述" },
		}

		await api.importOfficialSkill({ import_token: "token", ...fields })
		await api.importOfficialSkill({ file_key: "org/skills/demo.zip", ...fields })

		expect(post).toHaveBeenNthCalledWith(1, "/api/v1/admin/official-skills/import", {
			import_token: "token",
			...fields,
		})
		expect(post).toHaveBeenNthCalledWith(2, "/api/v1/admin/official-skills/import", {
			file_key: "org/skills/demo.zip",
			...fields,
		})
	})
})
