import { StrictMode, type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import {
	SLIDES_TEMPLATE_IMAGE_PROCESS,
	SLIDES_TEMPLATE_PAGE_SIZE,
	SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE,
	createSlidesTemplateCategoryGroupKey,
	createSlidesTemplateTagGroupKey,
	type SlidesTemplateCategoryItem,
	type SlidesTemplateItem,
	type SlidesTemplateTagItem,
} from "../slidesTemplateState"
import { useSlidesTemplateCatalogState } from "../useSlidesTemplateCatalogState"

const apiMock = vi.hoisted(() => ({
	getSlidesTemplateCategories: vi.fn(),
	getSlidesTemplateTagGroups: vi.fn(),
	getSlidesTemplateCount: vi.fn(),
	getSlidesTemplateDetail: vi.fn(),
	getSlidesTemplates: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: apiMock,
}))

const slidesTemplateImageOptions = {
	xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS,
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve
	})

	return { promise, resolve }
}

const businessCategory: SlidesTemplateCategoryItem = {
	id: "1",
	code: "PPT-CATE-business",
	name_i18n: {
		zh_CN: "商务",
		en_US: "Business",
	},
	sort: 100,
	template_count: 1,
	is_official: true,
}

const featuredTag: SlidesTemplateTagItem = {
	id: "tag-1",
	code: "featured",
	name_i18n: {
		zh_CN: "精选",
		en_US: "Featured",
	},
	sort: 100,
	template_count: 1,
	is_official: true,
}

const businessStyleTag: SlidesTemplateTagItem = {
	...featuredTag,
	id: "tag-2",
	code: "style-business",
	name_i18n: {
		zh_CN: "商务",
		en_US: "Business",
	},
}

const businessTemplate: SlidesTemplateItem = {
	code: "PPT-business",
	source_type: "OFFICIAL",
	category_code: businessCategory.code,
	label: {
		zh_CN: "商务模板",
		en_US: "Business Template",
	},
	description: {
		zh_CN: "商务模板描述",
		en_US: "Business template description",
	},
	sort: 100,
	is_official: true,
	tags: [
		{
			id: featuredTag.id,
			code: featuredTag.code,
			name_i18n: featuredTag.name_i18n,
			sort: featuredTag.sort,
		},
	],
}

const educationTemplate: SlidesTemplateItem = {
	...businessTemplate,
	code: "PPT-education",
	category_code: "PPT-CATE-education",
	label: {
		zh_CN: "教育模板",
		en_US: "Education Template",
	},
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
	return <StrictMode>{children}</StrictMode>
}

describe("useSlidesTemplateCatalogState", () => {
	it("supports a larger page size for the full-screen canvas", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockResolvedValue({ total: 68 })
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			list: [],
			page: 1,
			page_size: 40,
			total: 0,
		})

		renderHook(() => useSlidesTemplateCatalogState({ pageSize: 40 }))

		await waitFor(() => {
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledWith(
				expect.objectContaining({ page: 1, page_size: 40 }),
				expect.anything(),
			)
		})
		await waitFor(() => expect(SuperMagicApi.getSlidesTemplateCount).toHaveBeenCalled())
	})

	it("reads the total from the dedicated count endpoint", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockResolvedValue({ total: 68 })

		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.total).toBe(68))
		expect(SuperMagicApi.getSlidesTemplateCount).toHaveBeenCalledWith({
			scope: "official",
			page: 1,
			page_size: SLIDES_TEMPLATE_PAGE_SIZE,
		})
	})

	it("renders the template list without waiting for the auxiliary count request", async () => {
		const countResult = createDeferred<{ total: number }>()
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockReturnValue(countResult.promise)

		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.templateOptions[0]?.value).toBe(businessTemplate.code)
		expect(result.current.total).toBe(1)

		await act(async () => {
			countResult.resolve({ total: 68 })
			await countResult.promise
		})

		await waitFor(() => expect(result.current.total).toBe(68))
	})

	it("continues pagination when the count endpoint is inaccurate but the page is full", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockResolvedValue({ total: 0 })
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: 1,
				list: [businessTemplate],
			})
			.mockResolvedValueOnce({
				page: 2,
				page_size: 1,
				list: [],
			})

		const { result } = renderHook(() => useSlidesTemplateCatalogState({ pageSize: 1 }))

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.total).toBe(0)
		expect(result.current.hasMore).toBe(true)

		act(() => {
			result.current.loadMore()
		})

		await waitFor(() => expect(result.current.isLoadingMore).toBe(false))
		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
			{ scope: "official", page: 2, page_size: 1 },
			slidesTemplateImageOptions,
		)
		expect(result.current.hasMore).toBe(false)
	})

	it("keeps the template list available when the count endpoint fails", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockRejectedValue(
			new Error("count unavailable"),
		)
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 1,
			list: [businessTemplate],
		})

		const { result } = renderHook(() => useSlidesTemplateCatalogState({ pageSize: 1 }))

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.templateOptions[0]?.value).toBe(businessTemplate.code)
		expect(result.current.hasMore).toBe(true)
	})

	it("loads preview resources only when a template is selected", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateDetail).mockResolvedValue({
			...businessTemplate,
			colors: ["#112233"],
			collage_url: "https://example.com/collage.png",
			preview_image_urls: ["https://example.com/preview.png"],
			preview_url: null,
		})

		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		const listTemplateBeforeDetail = result.current.templateOptions[0]
		let detail: Awaited<ReturnType<typeof result.current.loadTemplateDetail>>
		await act(async () => {
			detail = await result.current.loadTemplateDetail(businessTemplate.code)
		})

		expect(SuperMagicApi.getSlidesTemplateDetail).toHaveBeenCalledWith(
			businessTemplate.code,
			slidesTemplateImageOptions,
		)
		expect(detail?.preview_image_urls?.[0]).toContain("https://example.com/preview.png")
		expect(result.current.templateOptions[0]).toBe(listTemplateBeforeDetail)
	})

	it("reuses in-flight and completed template detail requests", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateDetail).mockResolvedValue({
			...businessTemplate,
			colors: ["#112233"],
			collage_url: "https://example.com/collage.png",
			preview_image_urls: ["https://example.com/preview.png"],
			preview_url: "https://example.com/preview",
		})

		const { result } = renderHook(() => useSlidesTemplateCatalogState())
		await waitFor(() => expect(result.current.isLoading).toBe(false))

		let details: Awaited<ReturnType<typeof result.current.loadTemplateDetail>>[]
		await act(async () => {
			details = await Promise.all([
				result.current.loadTemplateDetail(businessTemplate.code),
				result.current.loadTemplateDetail(businessTemplate.code),
			])
		})

		expect(SuperMagicApi.getSlidesTemplateDetail).toHaveBeenCalledTimes(1)
		expect(details[0]).toBe(details[1])

		await act(async () => {
			await result.current.loadTemplateDetail(businessTemplate.code)
		})
		expect(SuperMagicApi.getSlidesTemplateDetail).toHaveBeenCalledTimes(1)
	})

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(SuperMagicApi.getSlidesTemplateCategories).mockResolvedValue({
			page: 1,
			page_size: 200,
			total: 1,
			list: [businessCategory],
		})
		vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([
			{
				id: "featured-group",
				code: SYSTEM_SLIDES_TEMPLATE_TAG_GROUP_CODE,
				name_i18n: { zh_CN: "精选", en_US: "Featured" },
				sort: 100,
				tags: [featuredTag, businessStyleTag],
			},
		])
		vi.mocked(SuperMagicApi.getSlidesTemplateCount).mockResolvedValue({ total: 1 })
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: SLIDES_TEMPLATE_PAGE_SIZE,
			total: 1,
			list: [businessTemplate],
		})
	})

	it("loads initial templates and exposes catalog groups", async () => {
		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		expect(result.current.isPrimaryFilterLoading).toBe(true)
		expect(result.current.isTagFilterLoading).toBe(true)
		await waitFor(() => expect(result.current.isLoading).toBe(false))
		await waitFor(() => expect(result.current.isPrimaryFilterLoading).toBe(false))
		expect(result.current.isTagFilterLoading).toBe(false)
		await waitFor(() =>
			expect(
				result.current.groups.some(
					(group) =>
						group.group_key ===
						createSlidesTemplateCategoryGroupKey(businessCategory.code),
				),
			).toBe(true),
		)
		await waitFor(() =>
			expect(
				result.current.groups.some(
					(group) =>
						group.group_key === createSlidesTemplateTagGroupKey(featuredTag.code),
				),
			).toBe(true),
		)

		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledWith(
			{
				scope: "official",
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
			},
			slidesTemplateImageOptions,
		)
		expect(SuperMagicApi.getSlidesTemplateTagGroups).toHaveBeenCalledWith({})
		expect(result.current.tagGroups).toHaveLength(1)
		expect(result.current.templateOptions.map((template) => template.value)).toEqual([
			businessTemplate.code,
		])
		expect(result.current.groups.map((group) => group.group_key)).toEqual([
			"all",
			createSlidesTemplateTagGroupKey(featuredTag.code),
			createSlidesTemplateTagGroupKey(businessStyleTag.code),
			createSlidesTemplateCategoryGroupKey(businessCategory.code),
		])
	})

	it("queries all templates by tags selected from the filter panel", async () => {
		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.tagGroups).toHaveLength(1))

		act(() => {
			result.current.setSelectedChildTagCodes([businessStyleTag.code])
		})

		await waitFor(() =>
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
				{
					scope: "official",
					page: 1,
					page_size: SLIDES_TEMPLATE_PAGE_SIZE,
					tag_codes: [businessStyleTag.code],
					tag_match: "any",
				},
				slidesTemplateImageOptions,
			),
		)
	})

	it("deduplicates the initial template request in StrictMode", async () => {
		const { result } = renderHook(() => useSlidesTemplateCatalogState(), {
			wrapper: StrictModeWrapper,
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledTimes(1)
	})

	it("stops pagination when an appended page contains no new templates", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: 1,
				total: 2,
				list: [businessTemplate],
			})
			.mockResolvedValueOnce({
				page: 2,
				page_size: 1,
				total: 2,
				list: [businessTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplateCatalogState({ pageSize: 1 }))

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.hasMore).toBe(true)

		act(() => {
			result.current.loadMore()
		})

		await waitFor(() => expect(result.current.isLoadingMore).toBe(false))
		expect(result.current.templateOptions).toHaveLength(1)
		expect(result.current.hasMore).toBe(false)

		act(() => {
			result.current.loadMore()
		})
		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledTimes(2)
	})

	it("pauses automatic pagination after a failed append and supports manual retry", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: 1,
				total: 2,
				list: [businessTemplate],
			})
			.mockRejectedValueOnce(new Error("network error"))
			.mockResolvedValueOnce({
				page: 2,
				page_size: 1,
				total: 2,
				list: [educationTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplateCatalogState({ pageSize: 1 }))

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		act(() => {
			result.current.loadMore()
		})

		await waitFor(() => expect(result.current.isLoadMoreFailed).toBe(true))
		act(() => {
			result.current.loadMore()
		})
		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledTimes(2)

		act(() => {
			result.current.retryLoadMore()
		})
		await waitFor(() => expect(result.current.isLoadingMore).toBe(false))
		expect(result.current.isLoadMoreFailed).toBe(false)
		expect(result.current.templateOptions).toHaveLength(2)
	})

	it("replaces results after category and keyword changes", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [educationTemplate],
			})
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		await waitFor(() =>
			expect(
				result.current.groups.some(
					(group) =>
						group.group_key ===
						createSlidesTemplateCategoryGroupKey(businessCategory.code),
				),
			).toBe(true),
		)

		act(() => {
			result.current.setSelectedGroupKey(
				createSlidesTemplateCategoryGroupKey(businessCategory.code),
			)
		})

		await waitFor(() =>
			expect(result.current.templateOptions.map((template) => template.value)).toEqual([
				educationTemplate.code,
			]),
		)
		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
			{
				scope: "official",
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				category_code: businessCategory.code,
			},
			slidesTemplateImageOptions,
		)
		await waitFor(() =>
			expect(SuperMagicApi.getSlidesTemplateTagGroups).toHaveBeenLastCalledWith({
				category_code: businessCategory.code,
			}),
		)

		act(() => {
			result.current.setKeyword(" business ")
		})

		await waitFor(
			() =>
				expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
					{
						scope: "official",
						page: 1,
						page_size: SLIDES_TEMPLATE_PAGE_SIZE,
						category_code: businessCategory.code,
						keyword: "business",
					},
					slidesTemplateImageOptions,
				),
			{ timeout: 1000 },
		)
		await waitFor(() =>
			expect(result.current.templateOptions.map((template) => template.value)).toEqual([
				businessTemplate.code,
			]),
		)

		act(() => {
			result.current.setSelectedChildTagCodes([featuredTag.code, businessStyleTag.code])
		})

		await waitFor(() =>
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
				{
					scope: "official",
					page: 1,
					page_size: SLIDES_TEMPLATE_PAGE_SIZE,
					category_code: businessCategory.code,
					keyword: "business",
					tag_codes: [featuredTag.code, businessStyleTag.code],
					tag_match: "any",
				},
				slidesTemplateImageOptions,
			),
		)
	})

	it("queries templates by selected tag", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplateCatalogState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		await waitFor(() =>
			expect(
				result.current.groups.some(
					(group) =>
						group.group_key === createSlidesTemplateTagGroupKey(featuredTag.code),
				),
			).toBe(true),
		)

		act(() => {
			result.current.setSelectedGroupKey(createSlidesTemplateTagGroupKey(featuredTag.code))
		})

		await waitFor(() =>
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
				{
					scope: "official",
					page: 1,
					page_size: SLIDES_TEMPLATE_PAGE_SIZE,
					tag_codes: [featuredTag.code],
					tag_match: "any",
				},
				slidesTemplateImageOptions,
			),
		)

		act(() => {
			result.current.setSelectedChildTagCodes([businessStyleTag.code])
		})

		await waitFor(() =>
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
				{
					scope: "official",
					page: 1,
					page_size: SLIDES_TEMPLATE_PAGE_SIZE,
					tag_codes: [featuredTag.code, businessStyleTag.code],
					tag_match: "any",
				},
				slidesTemplateImageOptions,
			),
		)
	})
})
