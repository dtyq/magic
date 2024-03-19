import { makeAutoObservable, runInAction } from "mobx"
import { crewService } from "@/opensource/services/crew/CrewService"
import type { GetStoreAgentsParams } from "@/opensource/apis/modules/crew"
import type { StoreAgentView, CategoryView } from "@/opensource/services/crew/CrewService"

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
		if (this.loading) return
		this.loading = true
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = params.keyword?.trim() ?? this.keyword
		const categoryId = "category_id" in params ? params.category_id : this.categoryId

		if (page === 1) {
			this.list = []
			this.page = 1
		}

		try {
			const data = await crewService.getStoreAgents({
				page,
				page_size: pageSize,
				keyword: keyword || undefined,
				category_id: categoryId,
			})
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
			runInAction(() => {
				this.loading = false
			})
		}
	}

	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return
		this.loadingMore = true
		const nextPage = this.page + 1

		try {
			const data = await crewService.getStoreAgents({
				page: nextPage,
				page_size: this.pageSize,
				keyword: this.keyword || undefined,
				category_id: this.categoryId,
			})
			runInAction(() => {
				const existingIds = new Set(this.list.map((item) => item.id))
				const appendList = data.list.filter((item) => !existingIds.has(item.id))
				this.list = [...this.list, ...appendList]
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.loadingMore = false
			})
		} catch {
			runInAction(() => {
				this.loadingMore = false
			})
		}
	}

	async hireAgent(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target || target.isAdded) return

		await crewService.hireAgent(target.agentCode)
		runInAction(() => {
			target.isAdded = true
		})
	}

	async dismissAgent(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target || !target.isAdded) return

		await crewService.deleteAgent(target.agentCode)
		runInAction(() => {
			target.isAdded = false
			target.needUpgrade = false
		})
	}

	async upgradeAgent(id: string) {
		const target = this.list.find((item) => item.id === id)
		if (!target) return

		await crewService.upgradeAgent(target.agentCode)
		runInAction(() => {
			target.needUpgrade = false
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
	}
}
