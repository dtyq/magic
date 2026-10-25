import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateSuperMagicApi } from "../superMagic"

const imageProcessOptions = {
	xMagicImageProcess: {
		resize: { w: 1920 },
		format: "webp" as const,
	},
}

describe("generateSuperMagicApi", () => {
	it.each([
		{
			name: "template list",
			request: (api: ReturnType<typeof generateSuperMagicApi>) =>
				api.getSlidesTemplates({ page: 1, page_size: 20 }, imageProcessOptions),
			expectedUrl: "/api/v1/slides-templates",
			expectedConfig: { params: { scope: "official", page: 1, page_size: 20 } },
		},
		{
			name: "template detail",
			request: (api: ReturnType<typeof generateSuperMagicApi>) =>
				api.getSlidesTemplateDetail("business", imageProcessOptions),
			expectedUrl: "/api/v1/slides-templates/business",
			expectedConfig: {},
		},
	])(
		"passes image compression parameters to the $name request",
		async ({ request, expectedUrl, expectedConfig }) => {
			const get = vi.fn().mockResolvedValue({})
			const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

			await request(api)

			expect(get).toHaveBeenCalledWith(expectedUrl, {
				...expectedConfig,
				headers: {
					"X-Magic-Image-Process": "resize=w:1920&format=webp",
				},
			})
		},
	)

	it("uses the personal template endpoints and code as the resource identity", async () => {
		const get = vi.fn().mockResolvedValue({})
		const post = vi.fn().mockResolvedValue([])
		const deleteRequest = vi.fn().mockResolvedValue([])
		const api = generateSuperMagicApi({
			get,
			post,
			delete: deleteRequest,
		} as unknown as ServiceHttpClient)

		await api.getSlidesTemplates({
			scope: "user",
			code: "PPT-created",
			page: 2,
			page_size: 40,
		})
		await api.getFavoriteSlidesTemplates({ page: 1, page_size: 40, keyword: "sales" })
		await api.getUsedSlidesTemplates({ page: 3, page_size: 40 })
		await api.getSlidesTemplateCodeAvailability("PPT-owned")
		await api.favoriteSlidesTemplate("PPT-owned")
		await api.unfavoriteSlidesTemplate("PPT-owned")
		await api.deleteSlidesTemplate("PPT-owned")
		await api.getSlidesTemplateTags({ page: 1, page_size: 20, keyword: "报告" })
		await api.saveSlidesTemplate({
			label: { zh_CN: "我的模板", en_US: "My template" },
			description: { zh_CN: "描述", en_US: "Description" },
			thumbnail_file_key: "thumbnail.png",
			template_file_key: "template.zip",
		})

		expect(get).toHaveBeenNthCalledWith(1, "/api/v1/slides-templates", {
			params: { scope: "user", code: "PPT-created", page: 2, page_size: 40 },
			headers: {},
		})
		expect(get).toHaveBeenNthCalledWith(2, "/api/v1/slides-templates/favorites", {
			params: { page: 1, page_size: 40, keyword: "sales" },
			headers: {},
		})
		expect(get).toHaveBeenNthCalledWith(3, "/api/v1/slides-templates/used", {
			params: { page: 3, page_size: 40 },
			headers: {},
		})
		expect(get).toHaveBeenNthCalledWith(4, "/api/v1/slides-templates/PPT-owned/availability")
		expect(post).toHaveBeenCalledWith("/api/v1/slides-templates/PPT-owned/favorite")
		expect(deleteRequest).toHaveBeenCalledWith("/api/v1/slides-templates/PPT-owned/favorite")
		expect(deleteRequest).toHaveBeenCalledWith("/api/v1/slides-templates/PPT-owned")
		expect(get).toHaveBeenNthCalledWith(5, "/api/v1/slides-template-tags", {
			params: { page: 1, page_size: 20, keyword: "报告" },
		})
		expect(post).toHaveBeenNthCalledWith(2, "/api/v1/slides-templates", {
			label: { zh_CN: "我的模板", en_US: "My template" },
			description: { zh_CN: "描述", en_US: "Description" },
			thumbnail_file_key: "thumbnail.png",
			template_file_key: "template.zip",
		})
	})

	it("uses temporary share access for the template categories", async () => {
		const get = vi.fn().mockResolvedValue({})
		const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

		await api.getSlidesTemplateCategories(
			{ page: 1, page_size: 20 },
			{ temporaryToken: "temporary-share-token" },
		)

		expect(get).toHaveBeenCalledWith("/api/v1/slides-template-categories", {
			params: {
				page: 1,
				page_size: 20,
				token: "temporary-share-token",
			},
			enableAuthorization: false,
			enableAuthorizationVerification: false,
		})
	})

	it("uses temporary share access for the template list", async () => {
		const get = vi.fn().mockResolvedValue({})
		const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

		await api.getSlidesTemplates(
			{ page: 1, page_size: 20 },
			{ temporaryToken: "temporary-share-token" },
		)

		expect(get).toHaveBeenCalledWith("/api/v1/slides-templates", {
			params: {
				scope: "official",
				page: 1,
				page_size: 20,
				token: "temporary-share-token",
			},
			headers: {},
			enableAuthorization: false,
			enableAuthorizationVerification: false,
		})
	})

	it("uses temporary share access for the template count", async () => {
		const get = vi.fn().mockResolvedValue({})
		const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

		await api.getSlidesTemplateCount(
			{ page: 1, page_size: 20 },
			{ temporaryToken: "temporary-share-token" },
		)

		expect(get).toHaveBeenCalledWith("/api/v1/slides-templates/count", {
			params: {
				scope: "official",
				page: 1,
				page_size: 20,
				token: "temporary-share-token",
			},
			enableAuthorization: false,
			enableAuthorizationVerification: false,
		})
	})

	it("uses temporary share access for the template tag groups", async () => {
		const get = vi.fn().mockResolvedValue({})
		const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

		await api.getSlidesTemplateTagGroups(
			{ category_code: "PPT-CATE-business-report" },
			{ temporaryToken: "temporary-share-token" },
		)

		expect(get).toHaveBeenCalledWith("/api/v1/slides-template/tags/groups", {
			params: {
				category_code: "PPT-CATE-business-report",
				token: "temporary-share-token",
			},
			enableAuthorization: false,
			enableAuthorizationVerification: false,
		})
	})

	it("uses the generic AI ability availability endpoint for convert high configuration", async () => {
		const get = vi.fn().mockResolvedValue({
			abilities: {
				image_convert_high: {
					enabled: true,
					image_size_config: { sizes: [] },
				},
				image_remove_background: { enabled: true },
				image_eraser: { enabled: false },
				image_expand: { enabled: true },
			},
		})
		const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)

		await expect(api.getConvertHightConfig()).resolves.toEqual({
			enabled: true,
			image_size_config: { sizes: [] },
		})
		await expect(api.getAiAbilityAvailability()).resolves.toEqual({
			abilities: {
				image_convert_high: { enabled: true },
				image_remove_background: { enabled: true },
				image_eraser: { enabled: false },
				image_expand: { enabled: true },
			},
		})

		expect(get).toHaveBeenNthCalledWith(1, "/api/v1/ai-abilities/availability")
		expect(get).toHaveBeenNthCalledWith(2, "/api/v1/ai-abilities/availability")
	})
})

describe("sidebar topic type query", () => {
	it.each(["all", "topic", "scheduled_task"] as const)(
		"serializes %s without changing search or paging",
		async (topicType) => {
			const get = vi.fn().mockResolvedValue({ list: [], total: 0 })
			const api = generateSuperMagicApi({ get } as unknown as ServiceHttpClient)
			await api.getSidebarTopicsByProjectId({
				id: "project-1",
				page: 2,
				page_size: 100,
				q: "report",
				topicType,
			})
			expect(get).toHaveBeenCalledWith(
				"/api/v1/super-agent/projects/project-1/sidebar-topics",
				{
					params: {
						page: 2,
						page_size: 100,
						q: "report",
						...(topicType === "all"
							? {}
							: { topic_types: topicType === "topic" ? 1 : 2 }),
					},
				},
			)
		},
	)
})
