import { makeAutoObservable, runInAction } from "mobx"
import { skillsService } from "@/services/skills/SkillsService"
import type { GetStoreSkillsParams, SkillPublisherType } from "@/apis/modules/skills"
import type { SkillMarketCategoryView, StoreSkillView } from "@/services/skills/SkillsService"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
	resolveKeywordParam,
	toOptionalKeyword,
} from "@/pages/superMagic/utils/paged-list-store"

const DEFAULT_PAGE_SIZE = 20
const FEATURED_PAGE_SIZE = 6
type FeaturedFilter = boolean | 0 | 1 | null

function getUniqueSkillCopies(
	list: StoreSkillView[],
	featuredList: StoreSkillView[],
	id: string,
): StoreSkillView[] {
	const seen = new Set<StoreSkillView>()
	const copies: StoreSkillView[] = []

	for (const item of [...list, ...featuredList]) {
		if (item.id !== id || seen.has(item)) continue
		seen.add(item)
		copies.push(item)
	}

	return copies
}

export class StoreSkillsStore {
	list: StoreSkillView[] = []
	featuredList: StoreSkillView[] = []
	categories: SkillMarketCategoryView[] = []
	featuredPage = 1
	featuredLastPage?: number
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	hasMore = true
	keyword = ""
	categoryIds: string[] = []
	publisherType?: SkillPublisherType
	isFeatured?: FeaturedFilter
	loading = false
	loadingMore = false
	listError = false
	loadingMoreError = false
	featuredLoading = false
	featuredError = false
	categoriesLoading = false
	categoriesError = false
	addingSkillIds = new Set<string>()
	private fetchRequestId = 0
	private featuredRequestId = 0
	private categoryRequestId = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	get canRefreshFeatured() {
		return this.featuredError || (this.featuredList.length > 0 && this.featuredLastPage !== 1)
	}

	async fetchCategories() {
		const requestId = ++this.categoryRequestId
		this.categoriesLoading = true
		this.categoriesError = false

		try {
			const categories = await skillsService.getSkillMarketCategories()
			if (requestId !== this.categoryRequestId) return
			runInAction(() => {
				this.categories = categories
				this.categoriesLoading = false
			})
		} catch {
			if (requestId !== this.categoryRequestId) return
			runInAction(() => {
				this.categoriesLoading = false
				this.categoriesError = true
			})
		}
	}

	setCategoryIds(categoryIds: string[]) {
		return this.fetchSkills({ page: 1, category_ids: categoryIds })
	}

	retrySkills() {
		return this.fetchSkills({
			page: 1,
			keyword: toOptionalKeyword(this.keyword),
			category_ids: this.categoryIds,
			publisher_type: this.publisherType,
			is_featured: this.isFeatured,
		})
	}

	isAddingSkill(id: string) {
		return this.addingSkillIds.has(id)
	}

	async fetchSkills(params: GetStoreSkillsParams = {}) {
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = resolveKeywordParam(params, this.keyword)
		const categoryIds = Object.prototype.hasOwnProperty.call(params, "category_ids")
			? (params.category_ids ?? [])
			: this.categoryIds
		const publisherType = Object.prototype.hasOwnProperty.call(params, "publisher_type")
			? params.publisher_type
			: this.publisherType
		const isFeatured = Object.prototype.hasOwnProperty.call(params, "is_featured")
			? params.is_featured
			: this.isFeatured
		const requestId = beginPageRequest({
			page,
			loading: this.loading,
			currentRequestId: this.fetchRequestId,
		})
		if (requestId == null) return

		this.fetchRequestId = requestId
		this.loading = true
		if (page === 1) this.listError = false

		if (page === 1) {
			this.list = []
			this.page = 1
			this.hasMore = true
			this.loadingMoreError = false
			// Align loadMore with in-flight search before response returns
			this.keyword = keyword
			this.categoryIds = categoryIds
			this.publisherType = publisherType
			this.isFeatured = isFeatured
			this.loadingMore = false
		}

		try {
			const data = await skillsService.getStoreSkills({
				page,
				page_size: pageSize,
				keyword: toOptionalKeyword(keyword),
				publisher_type: publisherType,
				category_ids: categoryIds.length > 0 ? categoryIds : undefined,
				is_featured: isFeatured,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = data.list
				this.page = data.page
				this.pageSize = data.pageSize
				this.hasMore = data.list.length >= data.pageSize
				this.keyword = keyword
				this.categoryIds = categoryIds
				this.publisherType = publisherType
				this.isFeatured = isFeatured
				this.loading = false
				this.listError = false
			})
		} catch (error) {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loading = false
				if (page === 1) this.listError = true
			})
			throw error
		}
	}

	/** Load the first featured page without affecting main-list pagination. */
	async fetchFeaturedSkills() {
		await this.fetchFeaturedPage(1, true)
	}

	/** Request the next featured page; wrap to page one after the last page. */
	async fetchNextFeaturedSkills() {
		if (this.featuredLoading) return
		if (this.featuredList.length === 0) {
			await this.fetchFeaturedPage(1, true)
			return
		}

		const nextPage =
			this.featuredLastPage && this.featuredPage >= this.featuredLastPage
				? 1
				: this.featuredPage + 1
		await this.fetchFeaturedPage(nextPage, false)
	}

	private async fetchFeaturedPage(page: number, resetPagination: boolean) {
		const requestId = ++this.featuredRequestId
		this.featuredLoading = true
		this.featuredError = false
		let lastPage = resetPagination ? undefined : this.featuredLastPage

		try {
			let data = await skillsService.getStoreSkills({
				page,
				page_size: FEATURED_PAGE_SIZE,
				is_featured: 1,
			})
			if (requestId !== this.featuredRequestId) return

			if (data.list.length < data.pageSize) lastPage = data.page

			// A full final page is indistinguishable from a non-final page without total.
			// If the following page is empty, remember the previous page as the end and wrap.
			if (page > 1 && data.list.length === 0) {
				lastPage = Math.max(1, page - 1)
				data = await skillsService.getStoreSkills({
					page: 1,
					page_size: FEATURED_PAGE_SIZE,
					is_featured: 1,
				})
				if (requestId !== this.featuredRequestId) return
				if (data.list.length < data.pageSize) lastPage = 1
			}

			runInAction(() => {
				this.featuredList = data.list
				this.featuredPage = data.page
				this.featuredLastPage = lastPage
				this.featuredLoading = false
				this.featuredError = false
			})
		} catch {
			if (requestId !== this.featuredRequestId) return
			runInAction(() => {
				this.featuredLoading = false
				this.featuredError = true
			})
		}
	}

	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return
		this.loadingMore = true
		this.loadingMoreError = false
		const nextPage = this.page + 1
		const requestId = this.fetchRequestId

		try {
			const data = await skillsService.getStoreSkills({
				page: nextPage,
				page_size: this.pageSize,
				keyword: toOptionalKeyword(this.keyword),
				publisher_type: this.publisherType,
				category_ids: this.categoryIds.length > 0 ? this.categoryIds : undefined,
				is_featured: this.isFeatured,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = appendUniqueById(this.list, data.list)
				this.page = data.page
				this.pageSize = data.pageSize
				this.hasMore = data.list.length >= data.pageSize
				this.loadingMore = false
				this.loadingMoreError = false
			})
		} catch (error) {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loadingMore = false
				this.loadingMoreError = true
			})
			throw error
		}
	}

	async addSkill(id: string) {
		const copies = getUniqueSkillCopies(this.list, this.featuredList, id)
		const target = copies.find((item) => item.status !== "added")
		if (!target || this.isAddingSkill(id)) return

		this.addingSkillIds.add(id)
		try {
			await skillsService.addSkillFromStore(target.storeSkillId)
			runInAction(() => {
				for (const item of getUniqueSkillCopies(this.list, this.featuredList, id)) {
					const wasAdded = item.status === "added"
					item.status = "added"
					if (!wasAdded && typeof item.installCount === "number") item.installCount += 1
				}
			})
		} finally {
			runInAction(() => {
				this.addingSkillIds.delete(id)
			})
		}
	}

	async upgradeSkill(id: string) {
		const copies = getUniqueSkillCopies(this.list, this.featuredList, id)
		const target = copies.find((item) => item.needUpgrade) ?? copies[0]
		if (!target) return

		await skillsService.upgradeSkill(target.skillCode)
		runInAction(() => {
			for (const item of getUniqueSkillCopies(this.list, this.featuredList, id)) {
				item.needUpgrade = false
			}
		})
	}

	/** Refetch list after locale change (server i18n fields). */
	refreshAfterLanguageChange() {
		void this.fetchSkills({
			page: 1,
			keyword: toOptionalKeyword(this.keyword),
			category_ids: this.categoryIds,
			publisher_type: this.publisherType,
			is_featured: this.isFeatured,
		})
		void this.fetchFeaturedSkills()
		void this.fetchCategories()
	}

	reset() {
		this.list = []
		this.featuredList = []
		this.categories = []
		this.featuredPage = 1
		this.featuredLastPage = undefined
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.hasMore = true
		this.keyword = ""
		this.categoryIds = []
		this.publisherType = undefined
		this.isFeatured = undefined
		this.loading = false
		this.loadingMore = false
		this.listError = false
		this.loadingMoreError = false
		this.featuredLoading = false
		this.featuredError = false
		this.categoriesLoading = false
		this.categoriesError = false
		this.addingSkillIds.clear()
		this.fetchRequestId += 1
		this.featuredRequestId += 1
		this.categoryRequestId += 1
	}
}
