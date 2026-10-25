import { StrictMode, type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { MY_SLIDES_TEMPLATES_GROUP_KEY } from "@/pages/superMagic/pages/SlidesTemplates/useMySlidesTemplates"
import { FEATURED_SLIDES_TEMPLATE_TAG_CODE } from "../../../panels/slides-preset/templateMeta"
import {
	SLIDES_TEMPLATE_IMAGE_PROCESS,
	SLIDES_TEMPLATE_PAGE_SIZE,
	createSlidesTemplateCategoryGroupKey,
	createSlidesTemplateTagGroupKey,
	type SlidesTemplateCategoryItem,
	type SlidesTemplateItem,
} from "../slidesTemplateState"
import { useSlidesTemplatePanelState } from "../useSlidesTemplatePanelState"

const apiMock = vi.hoisted(() => ({
	favoriteSlidesTemplate: vi.fn(),
	getFavoriteSlidesTemplates: vi.fn(),
	getSlidesTemplateCategories: vi.fn(),
	getSlidesTemplateCodeAvailability: vi.fn(),
	getSlidesTemplateTagGroups: vi.fn(),
	getSlidesTemplateCount: vi.fn(),
	getSlidesTemplateDetail: vi.fn(),
	getSlidesTemplates: vi.fn(),
	getUsedSlidesTemplates: vi.fn(),
	unfavoriteSlidesTemplate: vi.fn(),
}))

const slidesTemplateImageOptions = {
	xMagicImageProcess: SLIDES_TEMPLATE_IMAGE_PROCESS,
}

vi.mock("@/apis", () => ({
	SuperMagicApi: apiMock,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const businessCategory: SlidesTemplateCategoryItem = {
	id: "1",
	code: "PPT-CATE-business",
	name_i18n: {
		zh_CN: "商务",
		en_US: "Business",
	},
	sort: 100,
	template_count: 2,
	is_official: true,
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

function createFullTemplatePage(firstTemplate: SlidesTemplateItem): SlidesTemplateItem[] {
	return Array.from({ length: SLIDES_TEMPLATE_PAGE_SIZE }, (_, index) =>
		index === 0
			? firstTemplate
			: {
					...firstTemplate,
					code: `${firstTemplate.code}-${index}`,
				},
	)
}

function resolveCategories() {
	vi.mocked(SuperMagicApi.getSlidesTemplateCategories).mockResolvedValue({
		page: 1,
		page_size: 200,
		total: 1,
		list: [businessCategory],
	})
}

function resolveTags() {
	vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([])
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
	return <StrictMode>{children}</StrictMode>
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve
		reject = promiseReject
	})

	return { promise, resolve, reject }
}

describe("useSlidesTemplatePanelState", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resolveCategories()
		resolveTags()
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: SLIDES_TEMPLATE_PAGE_SIZE,
			total: 1,
			list: [businessTemplate],
		})
		vi.mocked(SuperMagicApi.getFavoriteSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 40,
			list: [],
		})
		vi.mocked(SuperMagicApi.getUsedSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 40,
			list: [],
		})
		vi.mocked(SuperMagicApi.favoriteSlidesTemplate).mockResolvedValue([])
		vi.mocked(SuperMagicApi.unfavoriteSlidesTemplate).mockResolvedValue([])
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("loads the first page and keeps the all group first", async () => {
		const { result } = renderHook(() => useSlidesTemplatePanelState())

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

		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledWith(
			{
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				scope: "official",
			},
			slidesTemplateImageOptions,
		)
		expect(result.current.groups[0].group_key).toBe("all")
		expect(result.current.templateOptions[0].value).toBe(businessTemplate.code)
	})

	it("inserts My templates immediately before Featured", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([
			{
				id: "operational",
				code: "operational_group",
				name_i18n: { zh_CN: "运营标签", en_US: "Operational" },
				sort: 100,
				tags: [
					{
						id: "featured",
						code: FEATURED_SLIDES_TEMPLATE_TAG_CODE,
						name_i18n: { zh_CN: "精选", en_US: "Featured" },
						sort: 100,
						template_count: 1,
						is_official: true,
					},
				],
			},
		])

		const { result } = renderHook(() => useSlidesTemplatePanelState())
		const featuredGroupKey = createSlidesTemplateTagGroupKey(FEATURED_SLIDES_TEMPLATE_TAG_CODE)

		await waitFor(() =>
			expect(
				result.current.groups.some((group) => group.group_key === featuredGroupKey),
			).toBe(true),
		)

		const groupKeys = result.current.groups.map((group) => group.group_key)
		expect(groupKeys.indexOf(MY_SLIDES_TEMPLATES_GROUP_KEY)).toBe(
			groupKeys.indexOf(featuredGroupKey) - 1,
		)
	})

	it("switches the three My templates data sources and defaults to Created", async () => {
		const createdTemplate = { ...businessTemplate, code: "PPT-created", is_official: false }
		const favoriteTemplate = {
			...businessTemplate,
			code: "PPT-favorite",
			is_favorite: true,
		}
		const usedTemplate = { ...businessTemplate, code: "PPT-used" }
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockImplementation(async (params) => ({
			page: params.page ?? 1,
			page_size: params.page_size ?? 40,
			list: params.scope === "user" ? [createdTemplate] : [businessTemplate],
		}))
		vi.mocked(SuperMagicApi.getFavoriteSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 40,
			list: [favoriteTemplate],
		})
		vi.mocked(SuperMagicApi.getUsedSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: 40,
			list: [usedTemplate],
		})
		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		act(() => result.current.setSelectedGroupKey(MY_SLIDES_TEMPLATES_GROUP_KEY))
		await waitFor(() => expect(result.current.templateOptions[0]?.value).toBe("PPT-created"))
		expect(result.current.myTemplatesActiveSection).toBe("created")
		expect(result.current.tagGroups).toEqual([])

		act(() => result.current.setMyTemplatesActiveSection("favorites"))
		await waitFor(() => expect(result.current.templateOptions[0]?.value).toBe("PPT-favorite"))
		expect(SuperMagicApi.getFavoriteSlidesTemplates).toHaveBeenCalled()

		act(() => result.current.setMyTemplatesActiveSection("used"))
		await waitFor(() => expect(result.current.templateOptions[0]?.value).toBe("PPT-used"))
		expect(SuperMagicApi.getUsedSlidesTemplates).toHaveBeenCalled()
	})

	it("keeps the home search action stable when switching My templates sections", async () => {
		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		act(() => result.current.setSelectedGroupKey(MY_SLIDES_TEMPLATES_GROUP_KEY))
		const initialSetKeyword = result.current.setKeyword

		act(() => result.current.setMyTemplatesActiveSection("favorites"))

		expect(result.current.selectedGroupKey).toBe(MY_SLIDES_TEMPLATES_GROUP_KEY)
		expect(result.current.setKeyword).toBe(initialSetKeyword)
	})

	it("keeps official tag filters visible and leaves My templates when a tag changes", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplateTagGroups).mockResolvedValue([
			{
				id: "scene-group",
				code: "scene_group",
				name_i18n: { zh_CN: "场景", en_US: "Scene" },
				sort: 100,
				tags: [
					{
						id: "report",
						code: "report",
						name_i18n: { zh_CN: "汇报", en_US: "Report" },
						sort: 100,
						template_count: 1,
						is_official: true,
					},
				],
			},
		])
		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.tagGroups).toHaveLength(1))
		act(() => result.current.setSelectedGroupKey(MY_SLIDES_TEMPLATES_GROUP_KEY))
		await waitFor(() =>
			expect(result.current.selectedGroupKey).toBe(MY_SLIDES_TEMPLATES_GROUP_KEY),
		)
		expect(result.current.tagGroups).toHaveLength(1)

		act(() => result.current.setSelectedChildTagCodes(["report"]))
		await waitFor(() => expect(result.current.selectedGroupKey).toBe("all"))
		expect(result.current.selectedChildTagCodes).toEqual(["report"])
	})

	it("optimistically favorites a template without changing its code identity", async () => {
		const { result } = renderHook(() => useSlidesTemplatePanelState())
		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			await result.current.toggleTemplateFavorite(result.current.templateOptions[0])
		})

		expect(SuperMagicApi.favoriteSlidesTemplate).toHaveBeenCalledWith(businessTemplate.code)
		expect(result.current.templateOptions[0].value).toBe(businessTemplate.code)
		expect(result.current.templateOptions[0].is_favorite).toBe(true)
	})

	it("marks all templates as empty when the first page list is empty", async () => {
		vi.mocked(SuperMagicApi.getSlidesTemplates).mockResolvedValue({
			page: 1,
			page_size: SLIDES_TEMPLATE_PAGE_SIZE,
			total: 1,
			list: [],
		})

		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.hasCheckedAnyTemplate).toBe(true)
		expect(result.current.hasAnyTemplate).toBe(false)
		expect(result.current.templateOptions).toHaveLength(0)
	})

	it("finishes loading under React StrictMode", async () => {
		const { result } = renderHook(() => useSlidesTemplatePanelState(), {
			wrapper: StrictModeWrapper,
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.templateOptions[0].value).toBe(businessTemplate.code)
	})

	it("appends the next page when loading more", async () => {
		const firstPageTemplates = createFullTemplatePage(businessTemplate)
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: firstPageTemplates.length + 1,
				list: firstPageTemplates,
			})
			.mockResolvedValueOnce({
				page: 2,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: firstPageTemplates.length + 1,
				list: [educationTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		act(() => {
			result.current.loadMore()
		})

		await waitFor(() => expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledTimes(2))
		expect(result.current.templateOptions).toHaveLength(firstPageTemplates.length + 1)
		expect(result.current.templateOptions.at(-1)?.value).toBe(educationTemplate.code)
	})

	it("deduplicates repeated load-more calls before React updates loading state", async () => {
		const firstPageTemplates = createFullTemplatePage(businessTemplate)
		const nextPageResponse = createDeferred<{
			page: number
			page_size: number
			total: number
			list: SlidesTemplateItem[]
		}>()

		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: firstPageTemplates.length + 1,
				list: firstPageTemplates,
			})
			.mockReturnValueOnce(nextPageResponse.promise)

		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		act(() => {
			result.current.loadMore()
			result.current.loadMore()
		})

		expect(SuperMagicApi.getSlidesTemplates).toHaveBeenCalledTimes(2)

		await act(async () => {
			nextPageResponse.resolve({
				page: 2,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: firstPageTemplates.length + 1,
				list: [educationTemplate],
			})
			await nextPageResponse.promise
		})

		expect(result.current.templateOptions).toHaveLength(firstPageTemplates.length + 1)
		expect(result.current.templateOptions.at(-1)?.value).toBe(educationTemplate.code)
	})

	it("keeps old templates visible while replacing results", async () => {
		const nextResult = createDeferred<{
			page: number
			page_size: number
			total: number
			list: SlidesTemplateItem[]
		}>()

		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})
			.mockReturnValueOnce(nextResult.promise)

		const { result } = renderHook(() => useSlidesTemplatePanelState())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		const initialTemplateViewRevision = result.current.templateViewRevision
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

		await waitFor(() => expect(result.current.isRefreshing).toBe(true))
		expect(result.current.templateViewRevision).toBe(initialTemplateViewRevision)
		expect(result.current.templateOptions.map((template) => template.value)).toEqual([
			businessTemplate.code,
		])

		await act(async () => {
			nextResult.resolve({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [educationTemplate],
			})
			await nextResult.promise
		})

		await waitFor(() => expect(result.current.isRefreshing).toBe(false))
		expect(result.current.templateViewRevision).toBeGreaterThan(initialTemplateViewRevision)
		expect(result.current.templateOptions.map((template) => template.value)).toEqual([
			educationTemplate.code,
		])
	})

	it("keeps the applied view revision stable after a failed category refresh and retries it", async () => {
		const failedResult = createDeferred<{
			page: number
			page_size: number
			total: number
			list: SlidesTemplateItem[]
		}>()
		vi.mocked(SuperMagicApi.getSlidesTemplates)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [businessTemplate],
			})
			.mockReturnValueOnce(failedResult.promise)
			.mockResolvedValueOnce({
				page: 1,
				page_size: SLIDES_TEMPLATE_PAGE_SIZE,
				total: 1,
				list: [educationTemplate],
			})

		const { result } = renderHook(() => useSlidesTemplatePanelState())

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
		const initialTemplateViewRevision = result.current.templateViewRevision

		act(() => {
			result.current.setSelectedGroupKey(
				createSlidesTemplateCategoryGroupKey(businessCategory.code),
			)
		})

		await waitFor(() => expect(result.current.isRefreshing).toBe(true))
		await act(async () => {
			failedResult.reject(new Error("network error"))
			try {
				await failedResult.promise
			} catch {
				// The hook converts the rejected request into refresh state.
			}
		})

		await waitFor(() => expect(result.current.isRefreshFailed).toBe(true))
		expect(result.current.templateViewRevision).toBe(initialTemplateViewRevision)
		expect(result.current.templateOptions[0]?.value).toBe(businessTemplate.code)

		act(() => {
			result.current.retryRefresh()
		})

		await waitFor(() => expect(result.current.isRefreshFailed).toBe(false))
		await waitFor(() => expect(result.current.isRefreshing).toBe(false))
		expect(result.current.templateViewRevision).toBeGreaterThan(initialTemplateViewRevision)
		expect(result.current.templateOptions[0]?.value).toBe(educationTemplate.code)
	})

	it("passes category and keyword params to the template query", async () => {
		const { result } = renderHook(() => useSlidesTemplatePanelState())

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
			expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
				{
					page: 1,
					page_size: SLIDES_TEMPLATE_PAGE_SIZE,
					scope: "official",
					category_code: businessCategory.code,
				},
				slidesTemplateImageOptions,
			),
		)

		act(() => {
			result.current.setKeyword(" whitepaper ")
		})

		await waitFor(
			() =>
				expect(SuperMagicApi.getSlidesTemplates).toHaveBeenLastCalledWith(
					{
						page: 1,
						page_size: SLIDES_TEMPLATE_PAGE_SIZE,
						scope: "official",
						category_code: businessCategory.code,
						keyword: "whitepaper",
					},
					slidesTemplateImageOptions,
				),
			{ timeout: 1000 },
		)
	})
})
