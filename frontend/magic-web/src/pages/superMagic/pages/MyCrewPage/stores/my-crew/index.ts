import { makeAutoObservable, runInAction } from "mobx"
import { crewService } from "@/services/crew/CrewService"
import type { GetAgentsParams } from "@/apis/modules/crew"
import type { MyCrewView } from "@/services/crew/CrewService"

const DEFAULT_PAGE_SIZE = 20

export class MyCrewStore {
	list: MyCrewView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	loading = false
	loadingMore = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMore() {
		return this.list.length < this.total
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	async fetchAgents(params: GetAgentsParams = {}) {
		if (this.loading) return
		this.loading = true
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = params.keyword?.trim() ?? this.keyword

		if (page === 1) {
			this.list = []
			this.page = 1
		}

		try {
			const data = await crewService.getMyAgents({
				page,
				page_size: pageSize,
				keyword: keyword || undefined,
			})

			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.keyword = keyword
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
			const data = await crewService.getMyAgents({
				page: nextPage,
				page_size: this.pageSize,
				keyword: this.keyword || undefined,
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

	async deleteAgent(agentCode: string) {
		await crewService.deleteAgent(agentCode)
		runInAction(() => {
			this.list = this.list.filter((item) => item.agentCode !== agentCode)
			this.total = Math.max(0, this.total - 1)
		})
	}

	async upgradeAgent(agentCode: string) {
		await crewService.upgradeAgent(agentCode)
		runInAction(() => {
			const target = this.list.find((item) => item.agentCode === agentCode)
			if (target) target.needUpgrade = false
		})
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.keyword = ""
		this.loading = false
		this.loadingMore = false
	}
}
