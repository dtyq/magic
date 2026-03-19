import superMagicModeService from "./SuperMagicModeService"
import { platformKey } from "@/utils/storage"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { interfaceStore } from "@/stores/interface"

// 聚合存储：按用户隔离，存储全局 + 项目默认 topic mode
const storageKey = platformKey("super_magic/topic_mode_store")
// 旧格式：分散的全局默认键
const legacyGlobalPrefix = `${platformKey("super_magic/default_topic_mode")}/`
// 旧格式：分散的项目默认键
const legacyProjectPrefix = `${platformKey("super_magic/default_project_topic_mode")}/`
// 预留版本位，便于未来扩展
const storeVersion = 1

interface UserTopicModeBucket {
	global?: TopicMode
	projects?: Record<string, TopicMode>
}

interface TopicModeStoreShape {
	version: number
	users: Record<string, UserTopicModeBucket>
}

interface GetModeParams {
	userKey: string
	projectKey?: string
	fallbackMode: TopicMode
}

interface SetModeParams {
	userKey: string
	projectKey?: string
	mode: TopicMode
}

function createEmptyStore(): TopicModeStoreShape {
	return {
		version: storeVersion,
		users: {},
	}
}

function persistStore(store: TopicModeStoreShape) {
	localStorage.setItem(storageKey, JSON.stringify(store))
}

const fallbackModeSet = new Set(Object.values(TopicMode).filter((mode) => mode !== TopicMode.Empty))

function isModeValid(mode: TopicMode | undefined) {
	if (!mode) return false
	if (superMagicModeService.isModeValid(mode)) return true

	const set = new Set(fallbackModeSet)

	if (interfaceStore.isMobile) {
		set.delete(TopicMode.Chat)
	}

	// 模式列表未初始化时，退化为枚举校验（已去除 Empty, Chat）
	return set.has(mode)
}

function getUserBucket(store: TopicModeStoreShape, userKey: string) {
	if (!store.users[userKey]) {
		store.users[userKey] = {}
	}
	return store.users[userKey]
}

function migrateLegacyKeys(): TopicModeStoreShape {
	const store = createEmptyStore()
	const legacyKeys: string[] = []

	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index)
		if (!key) continue

		// 旧全局键：直接写入对应用户桶的 global
		if (key.startsWith(legacyGlobalPrefix)) {
			legacyKeys.push(key)
			const userKey = key.slice(legacyGlobalPrefix.length)
			const raw = localStorage.getItem(key)
			if (!raw || raw === "undefined") continue
			try {
				const parsed = JSON.parse(raw) as TopicMode
				if (!isModeValid(parsed)) continue
				const bucket = getUserBucket(store, userKey)
				bucket.global = parsed
			} catch (error) {
				continue
			}
		}

		// 旧项目键：转换数组为对象，过滤无效模式
		if (key.startsWith(legacyProjectPrefix)) {
			legacyKeys.push(key)
			const userKey = key.slice(legacyProjectPrefix.length)
			const raw = localStorage.getItem(key)
			if (!raw) continue
			try {
				const parsed = JSON.parse(raw) as [string, TopicMode][]
				const projectMap: Record<string, TopicMode> = {}
				parsed.forEach(([projectKey, mode]) => {
					if (isModeValid(mode)) {
						projectMap[projectKey] = mode
					}
				})
				if (Object.keys(projectMap).length > 0) {
					const bucket = getUserBucket(store, userKey)
					bucket.projects = projectMap
				}
			} catch (error) {
				continue
			}
		}
	}

	if (legacyKeys.length > 0) {
		legacyKeys.forEach((key) => localStorage.removeItem(key))
		persistStore(store)
	}

	return store
}

function readStore(): TopicModeStoreShape {
	const raw = localStorage.getItem(storageKey)
	if (!raw) return migrateLegacyKeys()

	try {
		const parsed = JSON.parse(raw) as TopicModeStoreShape
		if (!parsed || !parsed.users) {
			return migrateLegacyKeys()
		}
		return parsed
	} catch (error) {
		return migrateLegacyKeys()
	}
}

function getOrFallback({ userKey, projectKey, fallbackMode }: GetModeParams) {
	const store = readStore()
	const bucket = store.users[userKey]

	if (projectKey) {
		const projectMode = bucket?.projects?.[projectKey]
		if (isModeValid(projectMode)) return projectMode
	}

	if (isModeValid(bucket?.global)) return bucket?.global as TopicMode

	// 未命中则使用调用方传入的默认值
	return fallbackMode
}

function setMode({ userKey, projectKey, mode }: SetModeParams) {
	if (!isModeValid(mode)) return
	const store = readStore()
	const bucket = getUserBucket(store, userKey)

	if (projectKey) {
		if (!bucket.projects) bucket.projects = {}
		bucket.projects[projectKey] = mode
	} else {
		bucket.global = mode
	}

	persistStore(store)
}

function getProjects(userKey: string) {
	const store = readStore()
	const bucket = store.users[userKey]
	return bucket?.projects || {}
}

function setProjects(userKey: string, projects: Record<string, TopicMode>) {
	const store = readStore()
	const bucket = getUserBucket(store, userKey)
	bucket.projects = projects
	persistStore(store)
}

const DefaultTopicModeStorageService = {
	getOrFallback,
	setMode,
	getProjects,
	setProjects,
}

export default DefaultTopicModeStorageService
