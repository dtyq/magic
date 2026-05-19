import { userStore } from "@/models/user"

const STORAGE_KEY = "magic_web_personal_preferences_cache_v1"

export interface PersonalPreferencesValue {
	add_ai_watermark?: boolean
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

export function getAiWatermarkPreferenceUserKey() {
	const { organizationCode, userInfo, authorization } = userStore.user
	if (!authorization) return ""
	return `${userInfo?.user_id || ""}:${organizationCode || userInfo?.organization_code || ""}`
}

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

function writeStoredPreference(userKey: string, value: PersonalPreferencesValue) {
	if (!userKey || typeof localStorage === "undefined") return

	try {
		const payload: StoredPreferencePayload = { userKey, value }
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
	} catch {
		// ignore quota / private mode
	}
}

export function getCachedAiWatermarkPreference() {
	const currentUserKey = getAiWatermarkPreferenceUserKey()
	if (!currentUserKey) return null

	if (preferenceCache?.userKey === currentUserKey) return preferenceCache.value

	const fromStorage = readStoredPreferenceForUser(currentUserKey)
	if (fromStorage) {
		preferenceCache = {
			userKey: currentUserKey,
			value: fromStorage,
		}
		return fromStorage
	}

	return null
}

export function setCachedAiWatermarkPreference(value: PersonalPreferencesValue) {
	const currentUserKey = getAiWatermarkPreferenceUserKey()
	if (!currentUserKey) return value

	preferenceCache = {
		userKey: currentUserKey,
		value,
	}

	writeStoredPreference(currentUserKey, value)

	return value
}

export function isAiWatermarkAgreementEnabled(value?: PersonalPreferencesValue | null) {
	return value?.add_ai_watermark === false
}
