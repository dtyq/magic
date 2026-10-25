import { beforeEach, describe, expect, it, vi } from "vitest"
import { SkillsApi } from "@/apis"
import { SkillsService } from "../SkillsService"

const trackMock = vi.hoisted(() => vi.fn())
vi.mock("@/services/analytics", () => ({
	analyticsService: { report: trackMock },
}))

vi.mock("@/apis", () => ({
	SkillsApi: {
		getSkillMarketCategories: vi.fn(),
		getStoreSkills: vi.fn(),
		getUserSkills: vi.fn(),
		getSkillLastVersions: vi.fn(),
		getSkillDetail: vi.fn(),
		createSkill: vi.fn(),
		addSkillFromStore: vi.fn(),
		importSkill: vi.fn(),
	},
}))

const service = new SkillsService()

describe("SkillsService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses the resolved name for skill-market categories", async () => {
		vi.mocked(SkillsApi.getSkillMarketCategories).mockResolvedValue({
			list: [
				{
					id: "category-1",
					parent_id: "0",
					name: "Resolved category",
					logo: null,
					sort_order: 1,
					status: 1,
					skill_count: 2,
				},
			],
		})

		const result = await service.getSkillMarketCategories()

		expect(result).toEqual([
			{
				id: "category-1",
				name: "Resolved category",
				logo: undefined,
				sortOrder: 1,
				skillCount: 2,
			},
		])
	})

	it("uses resolved fields for market skill lists", async () => {
		vi.mocked(SkillsApi.getStoreSkills).mockResolvedValue({
			list: [
				{
					id: "store-1",
					code: "skill-code",
					package_name: "skill-package",
					name: "Resolved name",
					description: "Resolved description",
					source: "Resolved source",
					logo: "logo.png",
					publisher_type: "OFFICIAL",
					publisher: {},
					publish_status: "PUBLISHED",
					is_added: false,
					need_upgrade: false,
					created_at: "2026-08-22T09:00:00Z",
					updated_at: "2026-08-22T10:00:00Z",
				},
			],
			page: 1,
			page_size: 20,
		})

		const result = await service.getStoreSkills()

		expect(result.list[0]).toMatchObject({
			name: "Resolved name",
			description: "Resolved description",
			source: "Resolved source",
		})
	})

	it("uses resolved fields for user skill lists", async () => {
		vi.mocked(SkillsApi.getUserSkills).mockResolvedValue({
			list: [
				{
					id: "skill-1",
					code: "skill-code",
					name: "Resolved name",
					description: "Resolved description",
					source: "Resolved source",
					logo: "logo.png",
					source_type: "LOCAL_UPLOAD",
					is_enabled: 1,
					pinned_at: null,
					updated_at: "2026-08-25T10:00:00Z",
					created_at: "2026-08-25T09:00:00Z",
				},
			],
			page: 1,
			page_size: 20,
			total: 1,
		})

		const result = await service.getCreatedSkills()

		expect(result.list[0]).toMatchObject({
			name: "Resolved name",
			description: "Resolved description",
			source: "Resolved source",
		})
		expect(result.list[0]?.nameI18n).toEqual({
			default: "Resolved name",
			en_US: "Resolved name",
			zh_CN: "Resolved name",
		})
	})

	it("keeps edit payload compatibility when legacy i18n fields are absent", async () => {
		vi.mocked(SkillsApi.getUserSkills).mockResolvedValue({
			list: [
				{
					id: "skill-1",
					code: "skill-code",
					name: "Resolved name",
					description: "Resolved description",
					source: "Resolved source",
					logo: "logo.png",
					source_type: "LOCAL_UPLOAD",
					is_enabled: 1,
					pinned_at: null,
					updated_at: "2026-08-25T10:00:00Z",
					created_at: "2026-08-25T09:00:00Z",
				},
			],
			page: 1,
			page_size: 20,
			total: 1,
		})

		const result = await service.getCreatedSkills()

		expect(result.list[0]?.nameI18n).toEqual({
			default: "Resolved name",
			en_US: "Resolved name",
			zh_CN: "Resolved name",
		})
		expect(result.list[0]?.descriptionI18n).toEqual({
			default: "Resolved description",
			en_US: "Resolved description",
			zh_CN: "Resolved description",
		})
	})

	it("uses resolved fields for latest published skills", async () => {
		vi.mocked(SkillsApi.getSkillLastVersions).mockResolvedValue({
			list: [
				{
					id: "skill-1",
					code: "skill-code",
					package_name: "skill-package",
					version: "1.0.0",
					name: "Resolved name",
					description: "Resolved description",
					source: "Resolved source",
					name_i18n: {
						default: "Legacy name",
						en_US: "Legacy name",
						zh_CN: "旧名称",
					},
					description_i18n: {
						default: "Legacy description",
						en_US: "Legacy description",
						zh_CN: "旧描述",
					},
					logo: "logo.png",
					file_key: null,
					file_url: null,
					source_type: "LOCAL_UPLOAD",
					publish_status: "PUBLISHED",
					review_status: "APPROVED",
					publish_target_type: "PRIVATE",
					published_at: "2026-08-22T10:00:00Z",
					project_id: null,
					created_at: "2026-08-22T09:00:00Z",
					updated_at: "2026-08-22T10:00:00Z",
				},
			],
			page: 1,
			page_size: 20,
			total: 1,
		})

		const result = await service.getLatestPublishedSkills()

		expect(result.list[0]).toMatchObject({
			name: "Resolved name",
			description: "Resolved description",
			source: "Resolved source",
		})
	})

	it("uses resolved fields for user skill details", async () => {
		vi.mocked(SkillsApi.getSkillDetail).mockResolvedValue({
			id: "skill-1",
			code: "skill-code",
			version_id: 1,
			version_code: "1.0.0",
			source_type: "LOCAL_UPLOAD",
			is_enabled: 1,
			pinned_at: null,
			name: "Resolved name",
			description: "Resolved description",
			source: "Resolved source",
			name_i18n: {
				default: "Legacy name",
				en_US: "Legacy name",
				zh_CN: "旧名称",
			},
			description_i18n: {
				default: "Legacy description",
				en_US: "Legacy description",
				zh_CN: "旧描述",
			},
			source_i18n: {
				default: "Legacy source",
				en_US: "Legacy source",
				zh_CN: "旧来源",
			},
			logo: "logo.png",
			package_name: "skill-package",
			package_description: "Package description",
			file_key: "skill.zip",
			file_url: "",
			skill_file_url: "skill.zip",
			source_id: null,
			source_meta: null,
			created_at: "2026-08-22T09:00:00Z",
			updated_at: "2026-08-22T10:00:00Z",
			project_id: null,
		})

		const result = await service.getUserSkillDetailView("skill-code")

		expect(result).toMatchObject({
			name: "Resolved name",
			description: "Resolved description",
			sourceLabel: "Resolved source",
		})
	})
})

describe("SkillsService skill_create_attempted analytics", () => {
	let analyticsService: SkillsService

	beforeEach(() => {
		vi.clearAllMocks()
		analyticsService = new SkillsService()
	})

	it("reports empty after empty create returns a skill code", async () => {
		vi.mocked(SkillsApi.createSkill).mockResolvedValue({
			id: "skill-1",
			code: "SKL-empty",
		})

		await analyticsService.createEmptySkill()

		expect(trackMock).toHaveBeenCalledTimes(2)
		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "empty",
		})
		expect(trackMock).toHaveBeenCalledWith("project_create_attempted", {
			sceneOverride: "skill",
		})
	})

	it("does not report empty create when the response has no skill code", async () => {
		vi.mocked(SkillsApi.createSkill).mockResolvedValue({ id: "skill-1" })

		await expect(analyticsService.createEmptySkill()).rejects.toThrow(
			"create-skill-missing-code",
		)
		expect(trackMock).toHaveBeenCalled()
	})

	it("does not report empty create when the skill code is blank", async () => {
		vi.mocked(SkillsApi.createSkill).mockResolvedValue({ id: "skill-1", code: "   " })

		await expect(analyticsService.createEmptySkill()).rejects.toThrow(
			"create-skill-missing-code",
		)
		expect(trackMock).toHaveBeenCalled()
	})

	it("does not report empty create when the API fails", async () => {
		vi.mocked(SkillsApi.createSkill).mockRejectedValue(new Error("network"))

		await expect(analyticsService.createEmptySkill()).rejects.toThrow("network")
		expect(trackMock).toHaveBeenCalled()
	})

	it("reports store from a from-store object skill_code, not the store id", async () => {
		vi.mocked(SkillsApi.addSkillFromStore).mockResolvedValue({
			id: "store-row-9",
		} as never)

		await analyticsService.addSkillFromStore("store-row-9")

		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "store",
		})
	})

	it("reports store when from-store returns a one-item list", async () => {
		vi.mocked(SkillsApi.addSkillFromStore).mockResolvedValue([{ code: "SKL-list" }] as never)

		await analyticsService.addSkillFromStore("store-1")

		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "store",
		})
	})

	it("reports store from the loaded marketplace row when the install response is empty", async () => {
		vi.mocked(SkillsApi.getStoreSkills).mockResolvedValue({
			list: [{ id: "store-1", code: "SKL-cached" }],
			page: 1,
			page_size: 20,
		} as never)
		vi.mocked(SkillsApi.addSkillFromStore).mockResolvedValue([] as never)

		await analyticsService.getStoreSkills()
		await analyticsService.addSkillFromStore("store-1")

		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "store",
		})
	})

	it("does not report store when neither response nor loaded row provides a skill code", async () => {
		vi.mocked(SkillsApi.addSkillFromStore).mockResolvedValue([] as never)

		await analyticsService.addSkillFromStore("store-unknown")

		expect(trackMock).toHaveBeenCalled()
	})

	it("uses a caller-known market code when the install response is empty", async () => {
		vi.mocked(SkillsApi.addSkillFromStore).mockResolvedValue([] as never)

		await analyticsService.addSkillFromStore("store-unknown", " SKL-row ")

		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "store",
		})
	})

	it("folds the import request source_type into the import analytics bucket", async () => {
		vi.mocked(SkillsApi.importSkill).mockResolvedValue({
			id: "1",
		})

		await analyticsService.importSkill({
			import_token: "token",
			name_i18n: { zh_CN: "n", en_US: "n" },
			description_i18n: { zh_CN: "d", en_US: "d" },
			source_type: "GITHUB",
		})

		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "import",
		})
	})

	it("reports import when the request omits its internal source_type", async () => {
		vi.mocked(SkillsApi.importSkill).mockResolvedValue({
			id: "1",
		})

		await analyticsService.importSkill({
			import_token: "token",
			name_i18n: { zh_CN: "n", en_US: "n" },
			description_i18n: { zh_CN: "d", en_US: "d" },
		})

		expect(trackMock).toHaveBeenCalledWith("skill_create_attempted", {
			source_type: "import",
		})
	})

	it("does not report import when skill_code is missing", async () => {
		vi.mocked(SkillsApi.importSkill).mockResolvedValue({
			id: "1",
			skill_code: "",
		})

		await analyticsService.importSkill({
			import_token: "token",
			name_i18n: { zh_CN: "n", en_US: "n" },
			description_i18n: { zh_CN: "d", en_US: "d" },
			source_type: "GITHUB",
		})

		expect(trackMock).toHaveBeenCalled()
	})

	it("does not report import when skill_code is blank", async () => {
		vi.mocked(SkillsApi.importSkill).mockResolvedValue({
			id: "1",
			skill_code: "   ",
		})

		await analyticsService.importSkill({
			import_token: "token",
			name_i18n: { zh_CN: "n", en_US: "n" },
			description_i18n: { zh_CN: "d", en_US: "d" },
			source_type: "GITHUB",
		})

		expect(trackMock).toHaveBeenCalled()
	})

	it("does not report import when the API fails", async () => {
		vi.mocked(SkillsApi.importSkill).mockRejectedValue(new Error("import-failed"))

		await expect(
			analyticsService.importSkill({
				import_token: "token",
				name_i18n: { zh_CN: "n", en_US: "n" },
				description_i18n: { zh_CN: "d", en_US: "d" },
			}),
		).rejects.toThrow("import-failed")
		expect(trackMock).toHaveBeenCalled()
	})
})
