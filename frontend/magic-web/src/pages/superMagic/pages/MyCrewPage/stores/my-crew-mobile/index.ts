import { makeAutoObservable, runInAction } from "mobx"
import { crewService } from "@/services/crew/CrewService"
import type { MyCrewView } from "@/services/crew/CrewService"
import type { UnifiedAgentScope, UnifiedAgentSort } from "@/apis/modules/crew"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
} from "@/pages/superMagic/utils/paged-list-store"

const DEFAULT_PAGE_SIZE = 20

/**
 * Mobile-only store for the unified agent list.
 * Isolated from MyCrewStore (used by desktop) to prevent cross-platform regressions.
 */
export class MyCrewMobileStore {
	list: MyCrewView[] = []
	total = 0
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	scope: UnifiedAgentScope = "all"
	sort: UnifiedAgentSort = "updated_at"
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

	/**
	 * Fetch first page. Called on mount and when scope/sort changes.
	 * Updates store scope/sort state and resets list.
	 */
	async fetchAgents(params?: { scope?: UnifiedAgentScope; sort?: UnifiedAgentSort }) {
		const scope = params?.scope ?? this.scope
		const sort = params?.sort ?? this.sort
		const requestId = beginPageRequest({
			page: 1,
			loading: this.loading,
			currentRequestId: this.fetchRequestId,
		})
		if (requestId == null) return

		this.fetchRequestId = requestId
		this.loading = true
		this.list = []
		this.page = 1
		this.loadingMore = false

		try {
			const data = await crewService.getUnifiedAgents({
				page: 1,
				page_size: this.pageSize,
				scope,
				sort,
			})
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return

			runInAction(() => {
				this.list = data.list
				this.total = data.total
				this.page = data.page
				this.pageSize = data.pageSize
				this.scope = scope
				this.sort = sort
				this.loading = false
			})
		} catch {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loading = false
			})
		}
	}

	/** Load next page. Returns Promise for InfiniteScroll consumption. */
	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return
		this.loadingMore = true
		const nextPage = this.page + 1
		const requestId = this.fetchRequestId

		try {
			const data = await crewService.getUnifiedAgents({
				page: nextPage,
				page_size: this.pageSize,
				scope: this.scope,
				sort: this.sort,
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

	/** Pull-to-refresh: reload page 1 preserving current scope/sort. */
	async refresh() {
		await this.fetchAgents({ scope: this.scope, sort: this.sort })
	}

	/** Remove an agent from store after dismissal confirmation. */
	async dismissAgent(agentCode: string) {
		await crewService.deleteAgent(agentCode)
		runInAction(() => {
			this.list = this.list.filter((item) => item.agentCode !== agentCode)
			this.total = Math.max(0, this.total - 1)
		})
	}

	reset() {
		this.list = []
		this.total = 0
		this.page = 1
		this.pageSize = DEFAULT_PAGE_SIZE
		this.scope = "all"
		this.sort = "updated_at"
		this.loading = false
		this.loadingMore = false
		this.fetchRequestId = 0
	}
}
