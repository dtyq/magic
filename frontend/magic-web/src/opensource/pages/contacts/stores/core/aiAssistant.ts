import { makeAutoObservable, runInAction } from "mobx"
import type { Friend } from "@/opensource/types/contact"
import contactStore from "@/opensource/stores/contact"
import userInfoStore from "@/opensource/stores/userInfo"
import userInfoService from "@/opensource/services/userInfo"

class AiAssistantStore {
	friends: Friend[] = []
	pageToken?: string
	hasMore = false
	isLoading = false
	lastFetchTime = 0

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setFriends(friends: Friend[], append = false) {
		if (append) {
			this.friends = [...this.friends, ...friends]
		} else {
			this.friends = friends
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
		if (this.friends.length > 0) {
			// 有缓存，触发静默更新
			this.fetchAndUpdate(true)
			return {
				items: this.friends,
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
			const result = await contactStore.getFriends({})

			// 获取用户信息
			if (result && result.items?.length > 0) {
				const unUserInfos = result.items.filter(
					(item: Friend) => !userInfoStore.get(item.friend_id),
				)
				if (unUserInfos.length > 0) {
					await userInfoService
						.fetchUserInfos(
							unUserInfos.map((item: Friend) => item.friend_id),
							2,
						)
						.catch(() => {
							console.log("fetchUserInfos error", unUserInfos)
						})
				}
			}

			runInAction(() => {
				this.friends = result?.items || []
				this.hasMore = result?.has_more || false
				this.pageToken = result?.page_token
				this.lastFetchTime = Date.now()
			})

			return {
				items: this.friends,
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} catch (error) {
			console.error("Failed to fetch AI assistant friends:", error)
			return {
				items: this.friends,
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
			const result = await contactStore.getFriends({
				page_token: this.pageToken,
			})

			// 获取用户信息
			if (result && result.items?.length > 0) {
				const unUserInfos = result.items.filter(
					(item: Friend) => !userInfoStore.get(item.friend_id),
				)
				if (unUserInfos.length > 0) {
					await userInfoService
						.fetchUserInfos(
							unUserInfos.map((item: Friend) => item.friend_id),
							2,
						)
						.catch(() => {
							console.log("fetchUserInfos error", unUserInfos)
						})
				}
			}

			runInAction(() => {
				this.friends = [...this.friends, ...(result?.items || [])]
				this.hasMore = result?.has_more || false
				this.pageToken = result?.page_token
			})

			return {
				items: result?.items || [],
				hasMore: this.hasMore,
				pageToken: this.pageToken,
			}
		} catch (error) {
			console.error("Failed to fetch more AI assistant friends:", error)
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
		this.friends = []
		this.pageToken = undefined
		this.hasMore = false
		this.isLoading = false
		this.lastFetchTime = 0
	}
}

export default new AiAssistantStore()
