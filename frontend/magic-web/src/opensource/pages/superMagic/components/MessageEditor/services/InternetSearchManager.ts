import { platformKey } from "@/opensource/utils/storage"
import { userStore } from "@/opensource/models/user"

/** 首页输入框互联网搜索状态的默认键 */
export const DEFAULT_KEY = "default"

/** 互联网搜索状态管理器 */
export class InternetSearchManager {
	private isCheckedTopicMap: Record<string, boolean> | null = null

	get localStorageKey() {
		// 组织维度下的话题维度隔离
		const key = userStore.user.organizationCode
		return key ? platformKey(`super_magic/topic_internet_search/${key}`) : ""
	}

	public getIsChecked(topicId: string | undefined): boolean {
		const getKey = topicId ?? DEFAULT_KEY
		// 1. 优先读取内存
		if (this.isCheckedTopicMap) {
			return this.isCheckedTopicMap[getKey] ?? true
		}
		// 2. 处理组织码为空的极端情况
		const localStorageKey = this.localStorageKey
		if (!localStorageKey) return true
		// 3. 读取 localStorage
		const cachedIsCheckedTopicMap = localStorage.getItem(this.localStorageKey)
		// 4. 处理 localStorage 为空的情况
		if (!cachedIsCheckedTopicMap) return true
		// 5. 处理 localStorage 不为空的情况
		const cachedIsCheckedTopicMapObj = JSON.parse(cachedIsCheckedTopicMap)
		return cachedIsCheckedTopicMapObj[getKey] ?? true
	}

	public setIsChecked(topicId: string | undefined, isChecked: boolean) {
		// 1. 处理组织码为空的极端情况
		if (!this.localStorageKey) return
		const getKey = topicId ?? DEFAULT_KEY
		// 2. 处理内存为空的情况
		if (!this.isCheckedTopicMap) {
			this.isCheckedTopicMap = {
				[DEFAULT_KEY]: isChecked,
			}
		}
		// 3. 写入内存
		this.isCheckedTopicMap[getKey] = isChecked
		// 4. 写入 localStorage
		localStorage.setItem(this.localStorageKey, JSON.stringify(this.isCheckedTopicMap))
	}

	public init() {
		this.isCheckedTopicMap = null
	}
}

export const internetSearchManager = new InternetSearchManager()
