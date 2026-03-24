import { makeAutoObservable, runInAction } from "mobx"
import { crewService } from "@/services/crew/CrewService"
import type { GetAgentsParams } from "@/apis/modules/crew"
import type { MyCrewView } from "@/services/crew/CrewService"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
	resolveKeywordParam,
	toOptionalKeyword,
} from "@/pages/superMagic/utils/paged-list-store"

const DEFAULT_PAGE_SIZE = 20
export type MyCrewListVariant = "created" | "hired"

export class MyCrewStore {
	list: MyCrewView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	listVariant: MyCrewListVariant = "created"
	loading = false
	loadingMore = false
	private fetchRequestId = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMore() {
		return this.list.length < this.total
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	async fetchAgents(params: GetAgentsParams & { listVariant?: MyCrewListVariant } = {}) {
		const page = params.page ?? 1
		const pageSize = params.page_size ?? this.pageSize
		const keyword = resolveKeywordParam(params, this.keyword)
		const listVariant = params.listVariant ?? this.listVariant
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
			this.loadingMore = false
		}

		try {
			const serviceMethod =
				listVariant === "created"
					? crewService.getCreatedAgents.bind(crewService)
					: crewService.getExternalAgents.bind(crewService)
			const data = await serviceMethod({
				page,
				page_size: pageSize,
				keyword: toOptionalKeyword(keyword),
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return

			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.keyword = keyword
				this.listVariant = listVariant
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
			const serviceMethod =
				this.listVariant === "created"
					? crewService.getCreatedAgents.bind(crewService)
					: crewService.getExternalAgents.bind(crewService)
			const data = await serviceMethod({
				page: nextPage,
				page_size: this.pageSize,
				keyword: toOptionalKeyword(this.keyword),
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

	async offlineAgent(agentCode: string) {
		await crewService.offlineAgent(agentCode)
		runInAction(() => {
			const target = this.list.find((item) => item.agentCode === agentCode)
			if (target) target.enabled = false
		})
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.keyword = ""
		this.listVariant = "created"
		this.loading = false
		this.loadingMore = false
		this.fetchRequestId = 0
	}
}
