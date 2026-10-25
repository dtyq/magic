import { beforeEach, describe, expect, it, vi } from "vitest"
import { skillsService } from "@/services/skills/SkillsService"
import type { StoreSkillView, StoreSkillsPage } from "@/services/skills/SkillsService"
import { StoreSkillsStore } from ".."

vi.mock("@/services/skills/SkillsService", () => ({
	skillsService: {
		getSkillMarketCategories: vi.fn(),
		getStoreSkills: vi.fn(),
		addSkillFromStore: vi.fn(),
		upgradeSkill: vi.fn(),
	},
}))

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

function createSkill(id: string, overrides: Partial<StoreSkillView> = {}): StoreSkillView {
	return {
		id,
		storeSkillId: `store-${id}`,
		skillCode: `skill.${id}`,
		name: `Skill ${id}`,
		description: "description",
		isFeatured: false,
		installCount: 3,
		status: "not-added",
		needUpgrade: false,
		updatedAt: "2026-03-21 10:00:00",
		...overrides,
	}
}

function createPage(
	list: StoreSkillView[],
	page: number,
	pageSize = 20,
): StoreSkillsPage<StoreSkillView> {
	return { list, page, pageSize }
}

describe("StoreSkillsStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("clears keyword when search input is emptied", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getStoreSkills).mockResolvedValueOnce(createPage([], 1))

		await store.fetchSkills({ keyword: "   ", page: 1 })

		expect(skillsService.getStoreSkills).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
			publisher_type: undefined,
			category_ids: undefined,
			is_featured: undefined,
		})
		expect(store.keyword).toBe("")
	})

	it("loads only categories containing skills", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getSkillMarketCategories).mockResolvedValueOnce([])

		await store.fetchCategories()

		expect(skillsService.getSkillMarketCategories).toHaveBeenCalledWith()
		expect(store.categories).toEqual([])
		expect(store.categoriesLoading).toBe(false)
		expect(store.categoriesError).toBe(false)
	})

	it("resets pagination and requests the selected category as a string id", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getStoreSkills).mockResolvedValueOnce(createPage([], 1))

		await store.setCategoryIds(["10001"])

		expect(skillsService.getStoreSkills).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			keyword: undefined,
			publisher_type: undefined,
			category_ids: ["10001"],
			is_featured: undefined,
		})
		expect(store.categoryIds).toEqual(["10001"])
		expect(store.page).toBe(1)
	})

	it("keeps query filters while loading a full next page", async () => {
		const store = new StoreSkillsStore()
		const firstPage = Array.from({ length: 20 }, (_, index) => createSkill(String(index)))
		vi.mocked(skillsService.getStoreSkills)
			.mockResolvedValueOnce(createPage(firstPage, 1))
			.mockResolvedValueOnce(createPage([createSkill("20")], 2))

		await store.fetchSkills({
			page: 1,
			category_ids: ["10001"],
			publisher_type: "OFFICIAL",
			is_featured: 1,
		})
		await store.loadMore()

		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(1, {
			page: 1,
			page_size: 20,
			keyword: undefined,
			publisher_type: "OFFICIAL",
			category_ids: ["10001"],
			is_featured: 1,
		})
		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(2, {
			page: 2,
			page_size: 20,
			keyword: undefined,
			publisher_type: "OFFICIAL",
			category_ids: ["10001"],
			is_featured: 1,
		})
		expect(store.list).toHaveLength(21)
		expect(store.hasMore).toBe(false)
	})

	it("stops pagination when the response is shorter than page size", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getStoreSkills).mockResolvedValueOnce(createPage([], 1))

		await store.fetchSkills()
		await store.loadMore()

		expect(store.hasMore).toBe(false)
		expect(skillsService.getStoreSkills).toHaveBeenCalledTimes(1)
	})

	it("loads featured skills through an independent filtered query", async () => {
		const store = new StoreSkillsStore()
		const featuredSkill = createSkill("featured", { isFeatured: true })
		vi.mocked(skillsService.getStoreSkills).mockResolvedValueOnce(
			createPage([featuredSkill], 1, 6),
		)

		await store.fetchFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenCalledWith({
			page: 1,
			page_size: 6,
			is_featured: 1,
		})
		expect(store.featuredList).toEqual([featuredSkill])
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLastPage).toBe(1)
		expect(store.canRefreshFeatured).toBe(false)
		expect(store.featuredLoading).toBe(false)
	})

	it("requests the next featured page and wraps after a short last page", async () => {
		const store = new StoreSkillsStore()
		const firstPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-first-${index}`, { isFeatured: true }),
		)
		const secondPage = [
			createSkill("featured-second-1", { isFeatured: true }),
			createSkill("featured-second-2", { isFeatured: true }),
		]
		vi.mocked(skillsService.getStoreSkills)
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))
			.mockResolvedValueOnce(createPage(secondPage, 2, 6))
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))

		await store.fetchFeaturedSkills()
		await store.fetchNextFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(2, {
			page: 2,
			page_size: 6,
			is_featured: 1,
		})
		expect(store.featuredList).toEqual(secondPage)
		expect(store.featuredPage).toBe(2)
		expect(store.featuredLastPage).toBe(2)

		await store.fetchNextFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(3, {
			page: 1,
			page_size: 6,
			is_featured: 1,
		})
		expect(store.featuredList).toEqual(firstPage)
		expect(store.featuredPage).toBe(1)
	})

	it("probes an empty next page and wraps without exposing an empty list", async () => {
		const store = new StoreSkillsStore()
		const firstPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-first-${index}`, { isFeatured: true }),
		)
		const secondPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-second-${index}`, { isFeatured: true }),
		)
		vi.mocked(skillsService.getStoreSkills)
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))
			.mockResolvedValueOnce(createPage(secondPage, 2, 6))
			.mockResolvedValueOnce(createPage([], 3, 6))
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))

		await store.fetchFeaturedSkills()
		await store.fetchNextFeaturedSkills()
		await store.fetchNextFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(3, {
			page: 3,
			page_size: 6,
			is_featured: 1,
		})
		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(4, {
			page: 1,
			page_size: 6,
			is_featured: 1,
		})
		expect(store.featuredList).toEqual(firstPage)
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLastPage).toBe(2)
	})

	it("deduplicates concurrent featured page requests", async () => {
		const store = new StoreSkillsStore()
		const firstPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-first-${index}`, { isFeatured: true }),
		)
		const secondPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-second-${index}`, { isFeatured: true }),
		)
		const deferred = createDeferred<StoreSkillsPage<StoreSkillView>>()
		vi.mocked(skillsService.getStoreSkills)
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))
			.mockReturnValueOnce(deferred.promise)

		await store.fetchFeaturedSkills()
		const firstRefresh = store.fetchNextFeaturedSkills()
		await Promise.resolve()
		const duplicateRefresh = store.fetchNextFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenCalledTimes(2)
		deferred.resolve(createPage(secondPage, 2, 6))
		await Promise.all([firstRefresh, duplicateRefresh])

		expect(store.featuredList).toEqual(secondPage)
		expect(store.featuredPage).toBe(2)
	})

	it("keeps the current featured page when the next request fails", async () => {
		const store = new StoreSkillsStore()
		const firstPage = Array.from({ length: 6 }, (_, index) =>
			createSkill(`featured-first-${index}`, { isFeatured: true }),
		)
		vi.mocked(skillsService.getStoreSkills)
			.mockResolvedValueOnce(createPage(firstPage, 1, 6))
			.mockRejectedValueOnce(new Error("failed"))

		await store.fetchFeaturedSkills()
		await store.fetchNextFeaturedSkills()

		expect(store.featuredList).toEqual(firstPage)
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLastPage).toBeUndefined()
		expect(store.featuredLoading).toBe(false)
		expect(store.featuredError).toBe(true)
	})

	it("records the first featured request failure and clears it after retry", async () => {
		const store = new StoreSkillsStore()
		const featuredPage = [createSkill("featured-retry", { isFeatured: true })]
		vi.mocked(skillsService.getStoreSkills)
			.mockRejectedValueOnce(new Error("failed"))
			.mockResolvedValueOnce(createPage(featuredPage, 1, 6))

		await store.fetchFeaturedSkills()

		expect(store.featuredList).toEqual([])
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLoading).toBe(false)
		expect(store.featuredError).toBe(true)
		expect(store.canRefreshFeatured).toBe(true)

		await store.fetchNextFeaturedSkills()

		expect(skillsService.getStoreSkills).toHaveBeenNthCalledWith(2, {
			page: 1,
			page_size: 6,
			is_featured: 1,
		})
		expect(store.featuredList).toEqual(featuredPage)
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLastPage).toBe(1)
		expect(store.featuredLoading).toBe(false)
		expect(store.featuredError).toBe(false)
	})

	it("clears the featured error when reset", async () => {
		const store = new StoreSkillsStore()
		vi.mocked(skillsService.getStoreSkills).mockRejectedValueOnce(new Error("failed"))

		await store.fetchFeaturedSkills()
		expect(store.featuredError).toBe(true)

		store.reset()

		expect(store.featuredError).toBe(false)
		expect(store.featuredList).toEqual([])
		expect(store.featuredPage).toBe(1)
		expect(store.featuredLastPage).toBeUndefined()
	})

	it("can install a skill rendered in the featured section", async () => {
		const store = new StoreSkillsStore()
		const featuredSkill = createSkill("featured", { isFeatured: true })
		store.featuredList = [featuredSkill]
		vi.mocked(skillsService.addSkillFromStore).mockResolvedValueOnce([])

		await store.addSkill("featured")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledWith("store-featured")
		expect(store.featuredList[0]?.status).toBe("added")
		expect(store.featuredList[0]?.installCount).toBe(4)
	})

	it("synchronizes installation across distinct copies of the same skill", async () => {
		const store = new StoreSkillsStore()
		const listSkill = createSkill("shared")
		const featuredSkill = createSkill("shared", {
			storeSkillId: "featured-store-shared",
			isFeatured: true,
		})
		store.list = [listSkill]
		store.featuredList = [featuredSkill]
		vi.mocked(skillsService.addSkillFromStore).mockResolvedValueOnce([])

		await store.addSkill("shared")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledTimes(1)
		expect(skillsService.addSkillFromStore).toHaveBeenCalledWith("store-shared")
		expect(store.list[0]?.status).toBe("added")
		expect(store.featuredList[0]?.status).toBe("added")
		expect(store.list[0]?.installCount).toBe(4)
		expect(store.featuredList[0]?.installCount).toBe(4)
	})

	it("installs the featured copy when the main-list copy is already installed", async () => {
		const store = new StoreSkillsStore()
		const listSkill = createSkill("shared", {
			status: "added",
			installCount: 9,
		})
		const featuredSkill = createSkill("shared", {
			storeSkillId: "featured-store-shared",
			isFeatured: true,
		})
		store.list = [listSkill]
		store.featuredList = [featuredSkill]
		vi.mocked(skillsService.addSkillFromStore).mockResolvedValueOnce([])

		await store.addSkill("shared")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledWith("featured-store-shared")
		expect(store.list[0]?.status).toBe("added")
		expect(store.featuredList[0]?.status).toBe("added")
		expect(store.list[0]?.installCount).toBe(9)
		expect(store.featuredList[0]?.installCount).toBe(4)
	})

	it("increments install count once when both lists share the same object", async () => {
		const store = new StoreSkillsStore()
		store.list = [createSkill("shared")]
		const [sharedSkill] = store.list
		if (!sharedSkill) throw new Error("Expected the shared skill fixture")
		store.featuredList = [sharedSkill]
		vi.mocked(skillsService.addSkillFromStore).mockResolvedValueOnce([])
		expect(store.featuredList[0]).toBe(sharedSkill)

		await store.addSkill("shared")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledTimes(1)
		expect(sharedSkill.status).toBe("added")
		expect(sharedSkill.installCount).toBe(4)
	})

	it("synchronizes upgrade state across copies of the same skill", async () => {
		const store = new StoreSkillsStore()
		const listSkill = createSkill("shared", {
			status: "added",
			needUpgrade: false,
			skillCode: "skill.shared.current",
		})
		const featuredSkill = createSkill("shared", {
			status: "added",
			needUpgrade: true,
			skillCode: "skill.shared.upgrade",
			isFeatured: true,
		})
		store.list = [listSkill]
		store.featuredList = [featuredSkill]
		vi.mocked(skillsService.upgradeSkill).mockResolvedValueOnce(undefined)

		await store.upgradeSkill("shared")

		expect(skillsService.upgradeSkill).toHaveBeenCalledWith("skill.shared.upgrade")
		expect(store.list[0]?.needUpgrade).toBe(false)
		expect(store.featuredList[0]?.needUpgrade).toBe(false)
	})

	it("keeps the latest search result when a previous request resolves later", async () => {
		const store = new StoreSkillsStore()
		const firstRequest = createDeferred<StoreSkillsPage<StoreSkillView>>()
		const secondRequest = createDeferred<StoreSkillsPage<StoreSkillView>>()

		vi.mocked(skillsService.getStoreSkills)
			.mockReturnValueOnce(firstRequest.promise)
			.mockReturnValueOnce(secondRequest.promise)

		const firstFetch = store.fetchSkills({ keyword: "alpha", page: 1 })
		const secondFetch = store.fetchSkills({ keyword: "", page: 1 })

		secondRequest.resolve(createPage([], 1))
		await secondFetch

		firstRequest.resolve(createPage([createSkill("stale")], 1))
		await firstFetch

		expect(store.keyword).toBe("")
		expect(store.list).toEqual([])
	})

	it("ignores an in-flight response after reset and a new request", async () => {
		const store = new StoreSkillsStore()
		const staleRequest = createDeferred<StoreSkillsPage<StoreSkillView>>()
		const freshRequest = createDeferred<StoreSkillsPage<StoreSkillView>>()
		const staleSkill = createSkill("stale")
		const freshSkill = createSkill("fresh")
		vi.mocked(skillsService.getStoreSkills)
			.mockReturnValueOnce(staleRequest.promise)
			.mockReturnValueOnce(freshRequest.promise)

		const staleFetch = store.fetchSkills({ keyword: "stale", page: 1 })
		store.reset()
		const freshFetch = store.fetchSkills({ keyword: "fresh", page: 1 })

		freshRequest.resolve(createPage([freshSkill], 1))
		await freshFetch
		staleRequest.resolve(createPage([staleSkill], 1))
		await staleFetch

		expect(store.list).toEqual([freshSkill])
		expect(store.keyword).toBe("fresh")
		expect(store.loading).toBe(false)
	})

	it("optimistically marks the skill as added and increments install count", async () => {
		const store = new StoreSkillsStore()
		store.list = [createSkill("skill-1")]

		vi.mocked(skillsService.addSkillFromStore).mockResolvedValueOnce([])

		await store.addSkill("skill-1")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledWith("store-skill-1")
		expect(store.list[0]?.status).toBe("added")
		expect(store.list[0]?.installCount).toBe(4)
	})

	it("deduplicates concurrent add requests for the same skill", async () => {
		const store = new StoreSkillsStore()
		store.list = [createSkill("skill-1")]
		const deferred = createDeferred<[]>()
		vi.mocked(skillsService.addSkillFromStore).mockReturnValueOnce(deferred.promise)

		const firstRequest = store.addSkill("skill-1")
		await Promise.resolve()
		await store.addSkill("skill-1")

		expect(skillsService.addSkillFromStore).toHaveBeenCalledTimes(1)
		expect(store.isAddingSkill("skill-1")).toBe(true)

		deferred.resolve([])
		await firstRequest

		expect(store.isAddingSkill("skill-1")).toBe(false)
		expect(store.list[0]?.status).toBe("added")
	})

	it("clears the pending add state when installation fails", async () => {
		const store = new StoreSkillsStore()
		store.list = [createSkill("skill-1")]
		vi.mocked(skillsService.addSkillFromStore).mockRejectedValueOnce(new Error("failed"))

		await expect(store.addSkill("skill-1")).rejects.toThrow("failed")

		expect(store.isAddingSkill("skill-1")).toBe(false)
		expect(store.list[0]?.status).toBe("not-added")
	})
})
