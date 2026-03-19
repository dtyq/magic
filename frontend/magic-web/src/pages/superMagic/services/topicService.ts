import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import topicStore from "../stores/core/topic"
import type { Topic, TaskStatus, ProjectListItem } from "../pages/Workspace/types"
import { RequestConfig } from "@/apis/core/HttpClient"

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
}

interface TopicsApiResponse {
	list: Topic[]
}

class TopicService {
	// Request deduplication: store ongoing requests
	private pendingRequests = new Map<string, Promise<TopicsApiResponse>>()

	/**
	 * Generate request key for deduplication
	 */
	private getRequestKey(apiName: string, ...params: (string | number)[]): string {
		return `${apiName}:${JSON.stringify(params)}`
	}

	/**
	 * Wrapper for getTopicsByProjectId with deduplication
	 */
	private async getTopicsByProjectId(
		projectId: string,
		page: number,
		pageSize: number,
	): Promise<{ list: Topic[] }> {
		const requestKey = this.getRequestKey("getTopicsByProjectId", projectId, page, pageSize)

		// Check if request is already pending
		const pendingRequest = this.pendingRequests.get(requestKey)
		if (pendingRequest) {
			return pendingRequest as Promise<TopicsApiResponse>
		}

		// Create new request
		const requestPromise = SuperMagicApi.getTopicsByProjectId({
			id: projectId,
			page,
			page_size: pageSize,
		}).finally(() => {
			// Remove from pending requests
			this.pendingRequests.delete(requestKey)
		})

		// Store pending request
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
				topicStore.setTopics(updatedTopics)
			})

			if (isAutoSelect && !isSelectLast && topicStore.selectedTopic) {
				const _selectedTopic =
					updatedTopics.find(
						(topic: Topic) => topic.id === topicStore.selectedTopic?.id,
					) ||
					updatedTopics[0] ||
					null
				runInAction(() => {
					topicStore.setSelectedTopic(_selectedTopic)
				})
			} else if (isAutoSelect) {
				const _selectedTopic = updatedTopics[0] || null
				runInAction(() => {
					topicStore.setSelectedTopic(_selectedTopic)
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

	async createTopic({ projectId, topicName }: CreateTopicParams): Promise<Topic | null> {
		try {
			const newTopic = await SuperMagicApi.createTopic({
				topic_name: topicName,
				project_id: projectId,
			})

			// Fetch latest topics list
			const topicsRes = await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})
			const updatedTopics = Array.isArray(topicsRes?.list) ? topicsRes?.list : []

			runInAction(() => {
				topicStore.setTopics(updatedTopics)
				const targetTopic = updatedTopics.find((topic: Topic) => topic?.id === newTopic?.id)
				if (targetTopic) {
					topicStore.setSelectedTopic(targetTopic)
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
			topicStore.updateTopicName(topicId, topicName)
		})
	}

	async updateTopicStatus(topicId: string, status: TaskStatus): Promise<void> {
		if (!topicId) return
		runInAction(() => {
			topicStore.updateTopicStatus(topicId, status)
		})
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
		const topics = topicStore.topics
		const newTopicList = topics.filter((topic) => topic.id !== topicId)

		runInAction(() => {
			topicStore.removeTopic(topicId)
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
				topicStore.setTopics(updatedTopics)
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
				topicStore.setSelectedTopic(_selectedTopic)
			})

			return _selectedTopic
		} catch (error) {
			console.error("获取话题列表失败:", error)
			return null
		}
	}
}

export default TopicService
