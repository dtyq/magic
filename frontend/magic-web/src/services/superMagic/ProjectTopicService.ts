import { userStore } from "@/models/user"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { platformKey } from "@/utils/storage"
import superMagicModeService from "./SuperMagicModeService"
import DefaultTopicModeStorageService from "./DefaultTopicModeStorageService"

class ProjectTopicService {
	projectTopicModeMap: Map<string, TopicMode> = new Map()

	constructor() {
		this.projectTopicModeMap = new Map(Object.entries(this.getProjectBucket()))
	}

	/**
	 * 获取全局主题模式本地存储键
	 * @returns
	 */
	globalTopicModeLocaleStorageKey() {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		return platformKey(`super_magic/default_topic_mode/${organizationCode}/${userId}`)
	}

	projectTopicModeLocaleStorageKey() {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		return platformKey(`super_magic/default_project_topic_mode/${organizationCode}/${userId}`)
	}

	private getUserKey() {
		const organizationCode = userStore.user.organizationCode || "unknown"
		const userId = userStore.user.userInfo?.user_id || "legacy"
		return `${organizationCode}/${userId}`
	}

	/**
	 * 生成全局主题模式本地存储键
	 * @param workspaceId
	 * @param projectId
	 * @returns
	 */
	genProjectTopicModeCacheKey(workspaceId: string, projectId: string) {
		return `${workspaceId}/${projectId}`
	}

	isTopicModeValid(mode: TopicMode) {
		if (!mode) return false
		return superMagicModeService.isModeValid(mode)
	}

	/**
	 * 获取全局主题模式
	 * @returns
	 */
	getGlobalTopicMode(): TopicMode | undefined {
		const userKey = this.getUserKey()
		const mode = DefaultTopicModeStorageService.getOrFallback({
			userKey,
			fallbackMode: superMagicModeService.firstModeIdentifier,
		})

		this.setGlobalTopicMode(mode)
		return mode
	}

	/**
	 * 设置全局主题模式
	 * @param mode
	 */
	setGlobalTopicMode(mode: TopicMode | undefined) {
		if (!mode) return
		const userKey = this.getUserKey()
		DefaultTopicModeStorageService.setMode({
			userKey,
			mode,
		})
	}

	/**
	 * 获取项目默认主题模式
	 * @param workspaceId
	 * @param projectId
	 * @returns
	 */
	getProjectDefaultTopicMode(workspaceId: string, projectId: string) {
		const key = this.genProjectTopicModeCacheKey(workspaceId, projectId)
		const value = this.projectTopicModeMap.get(key)

		if (value && this.isTopicModeValid(value)) {
			return value
		}

		const globalValue = this.getGlobalTopicMode()

		if (!globalValue) return undefined

		this.setProjectDefaultTopicMode(workspaceId, projectId, globalValue)

		return globalValue
	}

	/**
	 * 设置项目默认主题模式
	 * @param workspaceId
	 * @param projectId
	 * @param value
	 */
	setProjectDefaultTopicMode(
		workspaceId: string,
		projectId: string,
		value: TopicMode | undefined,
	) {
		if (value) {
			const key = this.genProjectTopicModeCacheKey(workspaceId, projectId)

			this.projectTopicModeMap.set(key, value)
			DefaultTopicModeStorageService.setProjects(
				this.getUserKey(),
				Object.fromEntries(this.projectTopicModeMap.entries()),
			)
		}
	}

	private getProjectBucket() {
		return DefaultTopicModeStorageService.getProjects(this.getUserKey())
	}
}

export default new ProjectTopicService()
