import { userStore } from "@/models/user"

const STORAGE_KEY = "magic_web_personal_preferences_cache_v1"

export interface PersonalPreferencesValue {
	add_ai_watermark?: boolean
	long_term_memory_enabled?: boolean
	[key: string]: unknown
}

interface PreferenceCache {
	userKey: string
	value: PersonalPreferencesValue
}

interface StoredPreferencePayload {
	userKey: string
	value: PersonalPreferencesValue
}

let preferenceCache: PreferenceCache | null = null

/** 获取用于隔离个人偏好缓存的当前用户与组织标识。 */
export function getPersonalPreferencesUserKey() {
	const { organizationCode, userInfo, authorization } = userStore.user
	if (!authorization) return ""
	return `${userInfo?.user_id || ""}:${organizationCode || userInfo?.organization_code || ""}`
}

/** 从浏览器持久化缓存读取指定用户的个人偏好。 */
function readStoredPreferenceForUser(currentUserKey: string): PersonalPreferencesValue | null {
	if (!currentUserKey || typeof localStorage === "undefined") return null

	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null

		const parsed = JSON.parse(raw) as StoredPreferencePayload
		if (!parsed?.userKey || parsed.userKey !== currentUserKey || !parsed.value) return null

		return parsed.value
	} catch {
		return null
	}
}

/** 将指定用户的完整个人偏好写入浏览器持久化缓存。 */
function writeStoredPreference(userKey: string, value: PersonalPreferencesValue) {
	if (!userKey || typeof localStorage === "undefined") return

	try {
		const payload: StoredPreferencePayload = { userKey, value }
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
	} catch {
		// 浏览器隐私模式或存储空间不足时仅跳过持久化，不影响当前会话。
	}
}

/** 获取指定用户的个人偏好缓存，默认使用当前登录用户。 */
export function getCachedPersonalPreferences(
	userKey = getPersonalPreferencesUserKey(),
): PersonalPreferencesValue | null {
	if (!userKey) return null

	if (preferenceCache?.userKey === userKey) return preferenceCache.value

	const fromStorage = readStoredPreferenceForUser(userKey)
	if (fromStorage) {
		preferenceCache = {
			userKey,
			value: fromStorage,
		}
		return fromStorage
	}

	return null
}

/** 更新指定用户的个人偏好缓存，默认使用当前登录用户。 */
export function setCachedPersonalPreferences(
	value: PersonalPreferencesValue,
	userKey = getPersonalPreferencesUserKey(),
) {
	if (!userKey) return value

	preferenceCache = {
		userKey,
		value,
	}

	writeStoredPreference(userKey, value)
	return value
}

/** 解析长期记忆偏好，仅严格的 false 表示关闭。 */
export function isLongTermMemoryEnabled(value?: PersonalPreferencesValue | null) {
	return value?.long_term_memory_enabled !== false
}
