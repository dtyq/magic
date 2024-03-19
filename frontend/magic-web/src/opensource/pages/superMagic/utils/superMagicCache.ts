import { platformKey } from "@/opensource/utils/storage"

/**
 * 工作区状态（会话级别）
 */
export interface WorkspaceState {
	workspaceId: string | null
	projectId: string | null
	topicId: string | null
}

/**
 * 用户信息接口（简化版，只包含必要字段）
 */
export interface UserInfo {
	user_id?: string
	organization_code?: string
}

/**
 * 工作区状态缓存管理（SessionStorage）
 */
export const WorkspaceStateCache = {
	/**
	 * 获取缓存 Key
	 */
	getKey(userInfo: UserInfo | null): string {
		const userId = userInfo?.user_id || "unknown"
		return platformKey(`super_magic/workspace_state/${userId}/${userInfo?.organization_code}`)
	},

	/**
	 * 获取工作区状态
	 */
	get(userInfo: UserInfo | null): WorkspaceState {
		try {
			const key = this.getKey(userInfo)
			const cached = sessionStorage.getItem(key)
			if (!cached) {
				return { workspaceId: null, projectId: null, topicId: null }
			}
			return JSON.parse(cached)
		} catch (error) {
			console.error("Failed to get workspace state from sessionStorage:", error)
			return { workspaceId: null, projectId: null, topicId: null }
		}
	},

	/**
	 * 设置工作区状态
	 */
	set(userInfo: UserInfo | null, state: WorkspaceState): void {
		try {
			const key = this.getKey(userInfo)
			sessionStorage.setItem(key, JSON.stringify(state))
		} catch (error) {
			console.error("Failed to set workspace state to sessionStorage:", error)
		}
	},

	/**
	 * 清除工作区状态
	 */
	clear(userInfo: UserInfo | null): void {
		try {
			const key = this.getKey(userInfo)
			sessionStorage.removeItem(key)
		} catch (error) {
			console.error("Failed to clear workspace state from sessionStorage:", error)
		}
	},
}

/**
 * 用户工作区映射缓存管理（LocalStorage）
 * 存储格式：{ "userId/orgCode": "workspaceId" }
 */
export const UserWorkspaceMapCache = {
	/**
	 * 获取存储 Key（所有用户共享一个 Map）
	 */
	getStorageKey(): string {
		return platformKey(`super_magic/user_workspace_map`)
	},

	/**
	 * 获取用户 Key
	 */
	getUserKey(userInfo: UserInfo | null): string {
		const userId = userInfo?.user_id || "unknown"
		return `${userId}/${userInfo?.organization_code}`
	},

	/**
	 * 获取所有用户的工作区映射
	 */
	getAll(): Record<string, string | null> {
		try {
			const storageKey = this.getStorageKey()
			const cached = localStorage.getItem(storageKey)
			return cached ? JSON.parse(cached) : {}
		} catch (error) {
			console.error("Failed to get all user workspaces from localStorage:", error)
			return {}
		}
	},

	/**
	 * 获取当前用户的工作区ID
	 */
	get(userInfo: UserInfo | null): string | null {
		try {
			const userKey = this.getUserKey(userInfo)
			const allWorkspaces = this.getAll()
			return allWorkspaces[userKey] || null
		} catch (error) {
			console.error("Failed to get workspace ID from localStorage:", error)
			return null
		}
	},

	/**
	 * 设置当前用户的工作区ID
	 */
	set(userInfo: UserInfo | null, workspaceId: string | null): void {
		try {
			const storageKey = this.getStorageKey()
			const userKey = this.getUserKey(userInfo)
			const allWorkspaces = this.getAll()

			allWorkspaces[userKey] = workspaceId
			localStorage.setItem(storageKey, JSON.stringify(allWorkspaces))
		} catch (error) {
			console.error("Failed to set workspace ID to localStorage:", error)
		}
	},

	/**
	 * 清除当前用户的工作区ID
	 */
	clear(userInfo: UserInfo | null): void {
		try {
			const storageKey = this.getStorageKey()
			const userKey = this.getUserKey(userInfo)
			const allWorkspaces = this.getAll()

			delete allWorkspaces[userKey]
			localStorage.setItem(storageKey, JSON.stringify(allWorkspaces))
		} catch (error) {
			console.error("Failed to clear workspace ID from localStorage:", error)
		}
	},

	/**
	 * 清除所有用户的工作区映射
	 */
	clearAll(): void {
		try {
			const storageKey = this.getStorageKey()
			localStorage.removeItem(storageKey)
		} catch (error) {
			console.error("Failed to clear all user workspaces from localStorage:", error)
		}
	},
}

/**
 * 项目话题映射缓存管理（LocalStorage）
 * 存储格式：{ "projectId": "topicId" }
 */
export const ProjectTopicMapCache = {
	/**
	 * 获取缓存 Key（每个用户一个 Map）
	 */
	getKey(userInfo: UserInfo | null): string {
		const userId = userInfo?.user_id || "unknown"
		return platformKey(`super_magic/project_topic_map/${userId}/${userInfo?.organization_code}`)
	},

	/**
	 * 获取所有项目的话题映射
	 */
	getAll(userInfo: UserInfo | null): Record<string, string> {
		try {
			const key = this.getKey(userInfo)
			const cached = localStorage.getItem(key)
			return cached ? JSON.parse(cached) : {}
		} catch (error) {
			console.error("Failed to get all project topics from localStorage:", error)
			return {}
		}
	},

	/**
	 * 获取指定项目的话题ID
	 */
	get(userInfo: UserInfo | null, projectId: string): string | null {
		try {
			const allTopics = this.getAll(userInfo)
			return allTopics[projectId] || null
		} catch (error) {
			console.error("Failed to get topic ID from localStorage:", error)
			return null
		}
	},

	/**
	 * 设置指定项目的话题ID
	 */
	set(userInfo: UserInfo | null, projectId: string, topicId: string): void {
		try {
			const key = this.getKey(userInfo)
			const allTopics = this.getAll(userInfo)

			allTopics[projectId] = topicId
			localStorage.setItem(key, JSON.stringify(allTopics))
		} catch (error) {
			console.error("Failed to set topic ID to localStorage:", error)
		}
	},

	/**
	 * 清除指定项目的话题ID
	 */
	clear(userInfo: UserInfo | null, projectId: string): void {
		try {
			const key = this.getKey(userInfo)
			const allTopics = this.getAll(userInfo)

			delete allTopics[projectId]
			localStorage.setItem(key, JSON.stringify(allTopics))
		} catch (error) {
			console.error("Failed to clear topic ID from localStorage:", error)
		}
	},

	/**
	 * 清除所有项目的话题映射
	 */
	clearAll(userInfo: UserInfo | null): void {
		try {
			const key = this.getKey(userInfo)
			localStorage.removeItem(key)
		} catch (error) {
			console.error("Failed to clear all project topics from localStorage:", error)
		}
	},
}

/**
 * 统一的缓存管理器
 * 提供更高级的缓存操作，协调三种缓存的更新
 */
export const SuperMagicCache = {
	WorkspaceState: WorkspaceStateCache,
	UserWorkspaceMap: UserWorkspaceMapCache,
	ProjectTopicMap: ProjectTopicMapCache,

	/**
	 * 同步更新完整状态（包括 SessionStorage 和 LocalStorage）
	 */
	syncState(
		userInfo: UserInfo | null,
		state: WorkspaceState & { updateProjectTopic?: boolean },
	): void {
		const { workspaceId, projectId, topicId, updateProjectTopic = true } = state

		// 更新 SessionStorage
		WorkspaceStateCache.set(userInfo, { workspaceId, projectId, topicId })

		// 更新 UserWorkspaceMap
		UserWorkspaceMapCache.set(userInfo, workspaceId)

		// 如果有完整的项目和话题信息，并且允许更新，则更新 ProjectTopicMap
		if (updateProjectTopic && projectId && topicId) {
			ProjectTopicMapCache.set(userInfo, projectId, topicId)
		}
	},

	/**
	 * 清除所有缓存
	 */
	clearAll(userInfo: UserInfo | null): void {
		WorkspaceStateCache.clear(userInfo)
		UserWorkspaceMapCache.clear(userInfo)
		ProjectTopicMapCache.clearAll(userInfo)
	},
}
