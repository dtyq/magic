import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import type { TopicStore } from "../stores/core/topic"
import type { Topic, TaskStatus, ProjectListItem } from "../pages/Workspace/types"
import type { TopicMode } from "../pages/Workspace/TopicMode"
import { RequestConfig } from "@/apis/core/HttpClient"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"

export interface FetchTopicsParams {
	projectId: string
	isAutoSelect?: boolean
	isSelectLast?: boolean
	page?: number
}

export interface UpdateTopicStatusParams {
	topicId?: string
	status: TaskStatus
}

export interface CreateTopicParams {
	projectId: string
	topicName: string
	/** Optional mode to set on the new topic */
	topicMode?: TopicMode
}

export interface MarkTopicReadProgressParams {
	topicId: string
	lastReadAt?: string
	lastReadMessageId?: string
}

interface TopicsApiResponse {
	list: Topic[]
	total: number
}

interface GetSidebarTopicsByProjectIdParams {
	projectId: string
	page: number
	pageSize: number
	searchKeyword?: string
}

class TopicService {
	private topicStore: TopicStore
	private pendingRequests = new Map<string, Promise<TopicsApiResponse>>()

	private getRequestKey(apiName: string, ...params: (string | number)[]): string {
		return `${apiName}:${JSON.stringify(params)}`
	}

	constructor({ store }: { store: TopicStore }) {
		this.topicStore = store
	}

	/**
	 * Fetch topics by project ID with request deduplication.
	 * Pure data layer — no store side effects.
	 */
	async getTopicsByProjectId(
		projectId: string,
		page: number,
		pageSize: number,
	): Promise<TopicsApiResponse> {
		const requestKey = this.getRequestKey("getTopicsByProjectId", projectId, page, pageSize)

		const pendingRequest = this.pendingRequests.get(requestKey)
		if (pendingRequest) return pendingRequest

		const requestPromise = SuperMagicApi.getTopicsByProjectId({
			id: projectId,
			page,
			page_size: pageSize,
		}).finally(() => {
			this.pendingRequests.delete(requestKey)
		})

		this.pendingRequests.set(requestKey, requestPromise)

		return requestPromise
	}

	async getSidebarTopicsByProjectId({
		projectId,
		page,
		pageSize,
		searchKeyword,
	}: GetSidebarTopicsByProjectIdParams): Promise<TopicsApiResponse> {
		const requestKey = this.getRequestKey(
			"getSidebarTopicsByProjectId",
			projectId,
			page,
			pageSize,
			searchKeyword?.trim() || "",
		)

		const pendingRequest = this.pendingRequests.get(requestKey)
		if (pendingRequest) return pendingRequest

		const requestPromise = SuperMagicApi.getSidebarTopicsByProjectId({
			id: projectId,
			page,
			page_size: pageSize,
			q: searchKeyword?.trim() || undefined,
		})
			.then((response) => ({
				...response,
				list: Array.isArray(response.list)
					? response.list.map(normalizeTopicHistoryItem)
					: [],
			}))
			.finally(() => {
				this.pendingRequests.delete(requestKey)
			})

		this.pendingRequests.set(requestKey, requestPromise)

		return requestPromise
	}
	async fetchTopics({
		projectId,
		isAutoSelect = true,
		isSelectLast = false,
		page = 1,
	}: FetchTopicsParams): Promise<Topic[]> {
		try {
			const res = await this.getTopicsByProjectId(projectId, page, 99)
			const updatedTopics = Array.isArray(res.list) ? res.list : []

			runInAction(() => {
				this.topicStore.setTopics(updatedTopics)
			})

			if (isAutoSelect && !isSelectLast && this.topicStore.selectedTopic) {
				const _selectedTopic =
					updatedTopics.find(
						(topic: Topic) => topic.id === this.topicStore.selectedTopic?.id,
					) ||
					updatedTopics[0] ||
					null
				runInAction(() => {
					this.topicStore.setSelectedTopic(_selectedTopic)
				})
			} else if (isAutoSelect) {
				const _selectedTopic = updatedTopics[0] || null
				runInAction(() => {
					this.topicStore.setSelectedTopic(_selectedTopic)
				})
			}

			return res.list
		} catch (error) {
			console.error("🚀 ~ 获取项目话题列表失败 ~ error:", error)
			return []
		}
	}

	/**
	 * 获取话题详情
	 * @param topicId 话题ID
	 * @returns 话题详情
	 */
	getTopicDetail(topicId: string, options?: Omit<RequestConfig, "url">): Promise<Topic | null> {
		return SuperMagicApi.getTopicDetail({ id: topicId }, options)
	}

	async createTopic({
		projectId,
		topicName,
		topicMode,
	}: CreateTopicParams): Promise<Topic | null> {
		try {
			const newTopic = await SuperMagicApi.createTopic({
				topic_name: topicName,
				project_id: projectId,
				...(topicMode ? { project_mode: topicMode } : {}),
			})

			// Fetch latest topics list
			const topicsRes = await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})
			const updatedTopics = Array.isArray(topicsRes?.list) ? topicsRes?.list : []

			runInAction(() => {
				this.topicStore.setTopics(updatedTopics)
				const targetTopic = updatedTopics.find((topic: Topic) => topic?.id === newTopic?.id)
				if (targetTopic) {
					this.topicStore.setSelectedTopic(targetTopic)
				}
			})

			return newTopic
		} catch (error) {
			console.error("创建话题失败:", error)
			return null
		}
	}

	async updateTopicName(topicId: string, topicName: string): Promise<void> {
		runInAction(() => {
			this.topicStore.updateTopicName(topicId, topicName)
		})
	}

	async updateTopicStatus(topicId: string, status: TaskStatus): Promise<void> {
		if (!topicId) return
		runInAction(() => {
			this.topicStore.updateTopicStatus(topicId, status)
		})
	}

	async markTopicReadProgress({
		topicId,
		lastReadAt,
		lastReadMessageId,
	}: MarkTopicReadProgressParams): Promise<{
		topic_id: string
		last_read_at: string | null
		last_read_message_id: string | null
		has_unread: boolean
	} | null> {
		if (!topicId) return null
		if (!lastReadAt && !lastReadMessageId) return null

		try {
			const response = await SuperMagicApi.markTopicReadProgress(topicId, {
				...(lastReadAt ? { last_read_at: lastReadAt } : {}),
				...(lastReadMessageId ? { last_read_message_id: lastReadMessageId } : {}),
			})

			runInAction(() => {
				this.topicStore.mergeTopic(topicId, {
					last_read_at: response.last_read_at ?? null,
					last_read_message_id: response.last_read_message_id ?? null,
					has_unread: Boolean(response.has_unread),
				})
			})

			return response
		} catch (error) {
			console.warn("上报话题已读进度失败:", error)
			return null
		}
	}

	async pinTopic(topicId: string): Promise<Topic | null> {
		try {
			const response = await SuperMagicApi.pinTopic(topicId)
			const topic = normalizeTopicHistoryItem(response.topic)
			runInAction(() => {
				this.topicStore.mergeTopic(topicId, topic)
			})
			return topic
		} catch (error) {
			console.error("置顶话题失败:", error)
			return null
		}
	}

	async unpinTopic(topicId: string): Promise<Topic | null> {
		try {
			const response = await SuperMagicApi.unpinTopic(topicId)
			const topic = normalizeTopicHistoryItem(response.topic)
			runInAction(() => {
				this.topicStore.mergeTopic(topicId, topic)
			})
			return topic
		} catch (error) {
			console.error("取消置顶话题失败:", error)
			return null
		}
	}

	async archiveTopic(topicId: string): Promise<Topic | null> {
		try {
			const response = await SuperMagicApi.archiveTopic(topicId)
			const topic = normalizeTopicHistoryItem(response.topic)
			runInAction(() => {
				this.topicStore.mergeTopic(topicId, topic)
			})
			return topic
		} catch (error) {
			console.error("归档话题失败:", error)
			return null
		}
	}

	async unarchiveTopic(topicId: string): Promise<Topic | null> {
		try {
			const response = await SuperMagicApi.unarchiveTopic(topicId)
			const topic = normalizeTopicHistoryItem(response.topic)
			runInAction(() => {
				this.topicStore.mergeTopic(topicId, topic)
			})
			return topic
		} catch (error) {
			console.error("取消归档话题失败:", error)
			return null
		}
	}

	/**
	 * Delete topic - handles API call and store update
	 * @param topicId Topic ID to delete
	 * @param workspaceId Workspace ID that contains the topic
	 * @returns The remaining topics list after deletion
	 */
	async deleteTopic(topicId: string): Promise<Topic[]> {
		await SuperMagicApi.deleteTopic({
			id: topicId,
		})

		// Update store after successful API call
		const topics = this.topicStore.topics
		const newTopicList = topics.filter((topic) => topic.id !== topicId)

		runInAction(() => {
			this.topicStore.removeTopic(topicId)
		})

		return newTopicList
	}

	async selectTopicWithProject(
		project: ProjectListItem,
		projectTopicMapLocalStorageKey: string,
	): Promise<Topic | null> {
		try {
			const res = await this.getTopicsByProjectId(project.id, 1, 99)
			const updatedTopics = Array.isArray(res.list) ? res.list : []

			runInAction(() => {
				this.topicStore.setTopics(updatedTopics)
			})

			// 缓存优先：获取本地缓存的历史话题
			const cachedProjectTopicMap = JSON.parse(
				localStorage.getItem(projectTopicMapLocalStorageKey) || "{}",
			)
			const cachedSelectedTopicId = cachedProjectTopicMap[project.id]

			const _selectedTopic =
				updatedTopics.find((topic: Topic) => topic.id === cachedSelectedTopicId) ||
				updatedTopics[0] ||
				null

			runInAction(() => {
				this.topicStore.setSelectedTopic(_selectedTopic)
			})

			return _selectedTopic
		} catch (error) {
			console.error("获取话题列表失败:", error)
			return null
		}
	}
}

export default TopicService
