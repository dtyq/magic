import { makeAutoObservable, runInAction } from "mobx"
import type { GroupConversationDetail } from "@/types/chat/conversation"
import contactStore from "@/stores/contact"

class MyGroupsStore {
	groups: GroupConversationDetail[] = []
	pageToken?: string
	hasMore = false
	isLoading = false
	lastFetchTime = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setGroups(groups: GroupConversationDetail[], append = false) {
		if (append) {
			this.groups = [...this.groups, ...groups]
		} else {
			this.groups = groups
		}
	}

	setPageToken(pageToken?: string) {
		this.pageToken = pageToken
	}

	setHasMore(hasMore: boolean) {
		this.hasMore = hasMore
	}

	setIsLoading(isLoading: boolean) {
		this.isLoading = isLoading
	}

	/**
	 * 初始化加载 - 如果有缓存则立即返回，同时触发后台更新
	 */
	async initialize() {
		if (this.groups.length > 0) {
			// 有缓存，触发静默更新
			this.fetchAndUpdate(true)
			return {
				items: this.groups,
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		}

		// 无缓存，正常加载
		return this.fetchAndUpdate(false)
	}

	/**
	 * 获取最新数据并更新（首页数据）
	 * @param silent - 是否静默更新（不显示 loading 状态）
	 */
	async fetchAndUpdate(silent = false) {
		if (!silent) {
			runInAction(() => {
				this.isLoading = true
			})
		}

		try {
			const result = await contactStore.getUserGroups({})

			runInAction(() => {
				this.groups = result.items || []
				this.hasMore = result.has_more || false
				this.pageToken = result.page_token
				this.lastFetchTime = Date.now()
			})

			return {
				items: this.groups,
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} catch (error) {
			console.error("Failed to fetch my groups:", error)
			return {
				items: this.groups,
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} finally {
			if (!silent) {
				runInAction(() => {
					this.isLoading = false
				})
			}
		}
	}

	/**
	 * 加载更多（分页）
	 */
	async fetchMore() {
		if (!this.hasMore || this.isLoading) {
			return {
				items: [],
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		}

		runInAction(() => {
			this.isLoading = true
		})

		try {
			const result = await contactStore.getUserGroups({
				page_token: this.pageToken,
			})

			runInAction(() => {
				this.groups = [...this.groups, ...(result.items || [])]
				this.hasMore = result.has_more || false
				this.pageToken = result.page_token
			})

			return {
				items: result.items || [],
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} catch (error) {
			console.error("Failed to fetch more groups:", error)
			return {
				items: [],
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} finally {
			runInAction(() => {
				this.isLoading = false
			})
		}
	}

	/**
	 * 清空数据
	 */
	reset() {
		this.groups = []
		this.pageToken = undefined
		this.hasMore = false
		this.isLoading = false
		this.lastFetchTime = 0
	}
}

export default new MyGroupsStore()
