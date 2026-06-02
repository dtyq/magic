import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import { userStore } from "@/models/user"
import { platformKey } from "@/utils/storage"
import type { TopicStore } from "../stores/core/topic"
import type { Topic, TaskStatus, ProjectListItem } from "../pages/Workspace/types"
import { TopicMode } from "../pages/Workspace/TopicMode"
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
	/** Topic whose frontend employee selection should be inherited after creation */
	sourceTopic?: Topic | null
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

interface SyncTopicFrontendModePatchParams {
	topic?: Topic | null
	mode: TopicMode
}

const FRONTEND_MODE_PATCH_TTL_MS = 30 * 60 * 1000

type TopicFrontendModePatch = Pick<Topic, "project_id" | "topic_mode" | "agent_code"> & {
	createdAt: number
	topicUpdatedAtAtPatch?: number
	expiresAt: number
}
type TopicFrontendModePatchStorage = Record<string, TopicFrontendModePatch>

// 新建普通项目话题时，后端只创建空话题，不携带员工/mode。
// 前端需要让新话题继续显示并使用当前话题选择的员工，所以只合并到本地话题对象。
function inheritTopicFrontendMode<T extends Topic>(
	topic: T,
	sourceTopic?: Pick<Topic, "project_id" | "topic_mode" | "agent_code"> | null,
): T {
	if (!sourceTopic?.topic_mode) return topic

	return {
		...topic,
		topic_mode: sourceTopic.topic_mode,
		agent_code: sourceTopic.agent_code,
	}
}

class TopicService {
	private topicStore: TopicStore
	private pendingRequests = new Map<string, Promise<TopicsApiResponse>>()
	// 创建后路由会按 topicId 重新拉详情/列表，后端返回可能仍是空话题。
	// 用 topicId 暂存前端继承的员工字段，避免刷新后把 agent_code/topic_mode 冲掉。
	// sessionStorage 只做短期兜底：刷新后可恢复；后端一旦返回真实 agent_code 会自动让位。
	private frontendModePatches = new Map<string, TopicFrontendModePatch>()

	private getRequestKey(apiName: string, ...params: (string | number)[]): string {
		return `${apiName}:${JSON.stringify(params)}`
	}

	private get frontendModePatchStorageKey() {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		if (!organizationCode || !userId) return null
		return platformKey(`super_magic/topic_frontend_mode_patch/${organizationCode}/${userId}`)
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
		})
			.then((response) => ({
				...response,
				list: Array.isArray(response.list)
					? response.list.map((topic) => this.applyFrontendModePatch(topic))
					: [],
			}))
			.finally(() => {
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
		return SuperMagicApi.getTopicDetail({ id: topicId }, options).then((topic) =>
			topic ? this.applyFrontendModePatch(topic) : topic,
		)
	}

	async createTopic({
		projectId,
		topicName,
		sourceTopic,
	}: CreateTopicParams): Promise<Topic | null> {
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
			const targetTopic = updatedTopics.find((topic: Topic) => topic?.id === newTopic?.id)
			const selectedTopic = targetTopic
				? inheritTopicFrontendMode(targetTopic, sourceTopic)
				: newTopic
					? inheritTopicFrontendMode(newTopic, sourceTopic)
					: null
			if (selectedTopic) {
				this.rememberFrontendModePatch(selectedTopic.id, sourceTopic, selectedTopic)
			}
			const topicsWithFrontendMode = selectedTopic
				? updatedTopics.map((topic: Topic) =>
						topic.id === selectedTopic.id ? selectedTopic : topic,
					)
				: updatedTopics

			runInAction(() => {
				this.topicStore.setTopics(topicsWithFrontendMode)
				if (selectedTopic) {
					this.topicStore.setSelectedTopic(selectedTopic)
				}
			})

			return selectedTopic
		} catch (error) {
			console.error("创建话题失败:", error)
			return null
		}
	}

	syncTopicFrontendModePatch({ topic, mode }: SyncTopicFrontendModePatchParams) {
		if (!topic?.id || !mode) return

		const patchSource = this.resolveManualFrontendModeSource(topic, mode)
		this.rememberFrontendModePatch(topic.id, patchSource, topic)
		runInAction(() => {
			this.topicStore.mergeTopic(topic.id, {
				topic_mode: patchSource.topic_mode,
				agent_code: patchSource.agent_code,
			})
		})
	}

	private resolveManualFrontendModeSource(
		topic: Topic,
		mode: TopicMode,
	): Pick<Topic, "project_id" | "topic_mode" | "agent_code"> {
		const modeIdentifier = String(mode).trim()

		// ModeToggle 选择自定义员工时传出的是 agent_code。只有 SMA 前缀才按员工归一化；
		// 其他 identifier 仍是普通 topic_mode，避免把普通模式误写成 custom_agent。
		if (modeIdentifier.startsWith("SMA")) {
			return {
				project_id: topic.project_id,
				topic_mode: TopicMode.CustomAgent,
				agent_code: modeIdentifier,
			}
		}

		return {
			project_id: topic.project_id,
			topic_mode: mode,
			agent_code: undefined,
		}
	}

	private rememberFrontendModePatch(
		topicId: string,
		sourceTopic?: Pick<Topic, "project_id" | "topic_mode" | "agent_code"> | null,
		topicAtPatch?: Pick<Topic, "updated_at"> | null,
	) {
		if (!sourceTopic?.topic_mode) return

		const now = Date.now()
		const patch: TopicFrontendModePatch = {
			project_id: sourceTopic.project_id,
			topic_mode: sourceTopic.topic_mode,
			agent_code: sourceTopic.agent_code,
			createdAt: now,
			topicUpdatedAtAtPatch: this.parseTopicUpdatedAt(topicAtPatch),
			expiresAt: now + FRONTEND_MODE_PATCH_TTL_MS,
		}
		this.frontendModePatches.set(topicId, patch)
		this.persistFrontendModePatch(topicId, patch)
	}

	private applyFrontendModePatch<T extends Topic>(topic: T): T {
		if (topic.agent_code?.trim()) {
			this.forgetFrontendModePatch(topic.id)
			return topic
		}

		const patch = this.getFrontendModePatch(topic)
		if (!patch) return topic
		if (this.isBackendTopicNewerThanPatch(topic, patch)) {
			this.forgetFrontendModePatch(topic.id)
			return topic
		}

		return {
			...topic,
			topic_mode: patch.topic_mode,
			agent_code: patch.agent_code,
		}
	}

	private getFrontendModePatch(topic: Topic) {
		const memoryPatch = this.frontendModePatches.get(topic.id)
		if (this.isFrontendModePatchUsable(topic, memoryPatch)) return memoryPatch

		const storage = this.readFrontendModePatchStorage()
		const storagePatch = storage[topic.id]
		if (this.isFrontendModePatchUsable(topic, storagePatch)) {
			this.frontendModePatches.set(topic.id, storagePatch)
			return storagePatch
		}

		if (memoryPatch || storagePatch) this.forgetFrontendModePatch(topic.id)
		return null
	}

	private isFrontendModePatchUsable(topic: Topic, patch?: TopicFrontendModePatch) {
		if (!patch) return false
		return patch.project_id === topic.project_id && patch.expiresAt > Date.now()
	}

	private isBackendTopicNewerThanPatch(topic: Topic, patch: TopicFrontendModePatch) {
		if (!topic.topic_mode) return false

		const backendUpdatedAt = this.parseTopicUpdatedAt(topic)
		if (backendUpdatedAt === undefined) return false

		// 后端在 patch 创建后写入了明确 mode 时，以后端返回为准。
		// 这覆盖了后端切回普通模式、没有 agent_code 的场景；仅 updated_at 变化不清理。
		return backendUpdatedAt > (patch.topicUpdatedAtAtPatch ?? patch.createdAt)
	}

	private parseTopicUpdatedAt(topic?: Pick<Topic, "updated_at"> | null) {
		if (!topic?.updated_at) return undefined
		const updatedAt = Date.parse(topic.updated_at)
		return Number.isNaN(updatedAt) ? undefined : updatedAt
	}

	private persistFrontendModePatch(topicId: string, patch: TopicFrontendModePatch) {
		const storageKey = this.frontendModePatchStorageKey
		if (!storageKey || typeof window === "undefined" || !window.sessionStorage) return

		const storage = this.readFrontendModePatchStorage()
		storage[topicId] = patch
		this.writeFrontendModePatchStorage(storage)
	}

	private forgetFrontendModePatch(topicId: string) {
		this.frontendModePatches.delete(topicId)
		const storageKey = this.frontendModePatchStorageKey
		if (!storageKey || typeof window === "undefined" || !window.sessionStorage) return

		const storage = this.readFrontendModePatchStorage()
		if (!(topicId in storage)) return
		delete storage[topicId]
		this.writeFrontendModePatchStorage(storage)
	}

	private readFrontendModePatchStorage(): TopicFrontendModePatchStorage {
		const storageKey = this.frontendModePatchStorageKey
		if (!storageKey || typeof window === "undefined" || !window.sessionStorage) return {}

		try {
			const raw = window.sessionStorage.getItem(storageKey)
			if (!raw) return {}
			const parsed = JSON.parse(raw)
			return parsed && typeof parsed === "object" ? parsed : {}
		} catch {
			return {}
		}
	}

	private writeFrontendModePatchStorage(storage: TopicFrontendModePatchStorage) {
		const storageKey = this.frontendModePatchStorageKey
		if (!storageKey || typeof window === "undefined" || !window.sessionStorage) return

		try {
			window.sessionStorage.setItem(storageKey, JSON.stringify(storage))
		} catch {
			// sessionStorage is a best-effort bridge for refresh. In-memory patch still works.
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
