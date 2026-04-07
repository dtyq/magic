import { makeAutoObservable, runInAction } from "mobx"
import { crewService } from "@/services/crew/CrewService"
import type { GetStoreAgentsParams } from "@/apis/modules/crew"
import type { StoreAgentView, CategoryView } from "@/services/crew/CrewService"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
	resolveKeywordParam,
	toOptionalKeyword,
} from "@/pages/superMagic/utils/paged-list-store"

const DEFAULT_PAGE_SIZE = 20

export class StoreCrewStore {
	list: StoreAgentView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	categoryId: string | undefined = undefined
	loading = false
	loadingMore = false
	private fetchRequestId = 0

	categories: CategoryView[] = []
	categoriesLoading = false
	categoriesLoaded = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMore() {
		return this.list.length < this.total
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	async fetchCategories() {
		if (this.categoriesLoaded || this.categoriesLoading) return
		this.categoriesLoading = true
		try {
			const data = await crewService.getStoreCategories()
			runInAction(() => {
				this.categories = data
				this.categoriesLoaded = true
				this.categoriesLoading = false
			})
		} catch {
			runInAction(() => {
				this.categoriesLoading = false
			})
		}
	}

	async fetchAgents(params: GetStoreAgentsParams = {}) {
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = resolveKeywordParam(params, this.keyword)
		const categoryId = "category_id" in params ? params.category_id : this.categoryId
		const requestId = beginPageRequest({
			page,
			loading: this.loading,
			currentRequestId: this.fetchRequestId,
		})
		if (requestId == null) return

		this.fetchRequestId = requestId
		this.loading = true

		if (page === 1) {
			this.list = []
			this.page = 1
			// Align loadMore with in-flight filters before response returns
			this.keyword = keyword
			this.categoryId = categoryId
			this.loadingMore = false
		}

		try {
			const data = await crewService.getStoreAgents({
				page,
				page_size: pageSize,
				keyword: toOptionalKeyword(keyword),
				category_id: categoryId,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.keyword = keyword
				this.categoryId = categoryId
				this.loading = false
			})
		} catch {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loading = false
			})
		}
	}

	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return
		this.loadingMore = true
		const nextPage = this.page + 1
		const requestId = this.fetchRequestId

		try {
			const data = await crewService.getStoreAgents({
				page: nextPage,
				page_size: this.pageSize,
				keyword: toOptionalKeyword(this.keyword),
				category_id: this.categoryId,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.list = appendUniqueById(this.list, data.list)
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.loadingMore = false
			})
		} catch {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loadingMore = false
			})
		}
	}

	async hireAgent(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target || target.allowDelete || target.isAdded) return

		await crewService.hireAgent(target.agentCode)
		runInAction(() => {
			this.list = this.list.map((item) =>
				item.id === id ? { ...item, isAdded: true, allowDelete: true } : item,
			)
		})
	}

	async dismissAgent(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target || !target.allowDelete) return

		await crewService.deleteAgent(target.userCode ?? target.agentCode)
		runInAction(() => {
			this.list = this.list.map((item) =>
				item.id === id ? { ...item, isAdded: false, allowDelete: false } : item,
			)
		})
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.keyword = ""
		this.categoryId = undefined
		this.loading = false
		this.loadingMore = false
		this.fetchRequestId = 0
	}
}
