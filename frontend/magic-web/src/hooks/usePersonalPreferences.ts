import { useCallback, useEffect, useState } from "react"
import { ContactApi } from "@/apis"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	getCachedPersonalPreferences,
	getPersonalPreferencesUserKey,
	setCachedPersonalPreferences,
	type PersonalPreferencesValue,
} from "@/utils/personalPreferencesCache"

export const PERSONAL_PREFERENCES_KEY = "personal_preferences"

const preferenceLoadInflightByUserKey = new Map<string, Promise<PersonalPreferencesValue>>()
const preferenceUpdateQueueByUserKey = new Map<string, Promise<PersonalPreferencesValue>>()

/** 加载当前用户完整个人偏好，同一用户的并发请求会复用同一 Promise。 */
export async function loadPersonalPreferences(force = false) {
	const userKey = getPersonalPreferencesUserKey()
	if (!userKey) return {}

	if (!force) {
		const cachedPreference = getCachedPersonalPreferences(userKey)
		if (cachedPreference) return cachedPreference
	}

	const existing = preferenceLoadInflightByUserKey.get(userKey)
	if (existing) return existing

	const promise = ContactApi.getPersonalPreferences<PersonalPreferencesValue>()
		.then((response) => {
			const value = response?.value || {}
			return setCachedPersonalPreferences(value, userKey)
		})
		.finally(() => {
			preferenceLoadInflightByUserKey.delete(userKey)
		})

	preferenceLoadInflightByUserKey.set(userKey, promise)
	return promise
}

/** 串行合并并保存个人偏好，避免同页面多个功能并发覆盖彼此字段。 */
export function updatePersonalPreferences(patch: Partial<PersonalPreferencesValue>) {
	const userKey = getPersonalPreferencesUserKey()
	if (!userKey) return Promise.reject(new Error("当前用户未登录，无法保存个人偏好"))

	const previous = preferenceUpdateQueueByUserKey.get(userKey) ?? Promise.resolve({})
	const operation = previous
		.catch(() => ({}))
		.then(async () => {
			if (getPersonalPreferencesUserKey() !== userKey) {
				throw new Error("用户身份已变化，请重新操作")
			}

			const currentPreference = await loadPersonalPreferences(true)
			const nextPreference = {
				...currentPreference,
				...patch,
			}
			const response = await ContactApi.savePersonalPreferences(nextPreference)
			const latestPreference = response?.data?.value || nextPreference

			setCachedPersonalPreferences(latestPreference, userKey)
			pubsub.publish(PubSubEvents.Personal_Preferences_Updated, {
				userKey,
				value: latestPreference,
			})
			return latestPreference
		})

	preferenceUpdateQueueByUserKey.set(userKey, operation)
	const cleanup = () => {
		if (preferenceUpdateQueueByUserKey.get(userKey) === operation) {
			preferenceUpdateQueueByUserKey.delete(userKey)
		}
	}
	void operation.then(cleanup, cleanup)
	return operation
}

/** 提供统一的个人偏好加载、刷新、合并保存和跨组件同步能力。 */
export function usePersonalPreferences() {
	const userKey = getPersonalPreferencesUserKey()
	const cachedPreference = getCachedPersonalPreferences(userKey)
	const [preference, setPreference] = useState<PersonalPreferencesValue>(
		() => cachedPreference || {},
	)
	const [isLoading, setIsLoading] = useState(!cachedPreference && !!userKey)

	const refresh = useCallback(async () => {
		if (!userKey) {
			setPreference({})
			setIsLoading(false)
			return {}
		}

		setIsLoading(true)
		try {
			const latestPreference = await loadPersonalPreferences(true)
			setPreference(latestPreference)
			return latestPreference
		} catch {
			const safePreference = getCachedPersonalPreferences(userKey) || {}
			setPreference(safePreference)
			return safePreference
		} finally {
			setIsLoading(false)
		}
	}, [userKey])

	const update = useCallback(async (patch: Partial<PersonalPreferencesValue>) => {
		const latestPreference = await updatePersonalPreferences(patch)
		setPreference(latestPreference)
		return latestPreference
	}, [])

	useEffect(() => {
		if (!userKey) {
			setPreference({})
			setIsLoading(false)
			return
		}

		const currentCachedPreference = getCachedPersonalPreferences(userKey)
		setPreference(currentCachedPreference || {})
		setIsLoading(!currentCachedPreference)

		let isCancelled = false
		void loadPersonalPreferences(true)
			.then((latest) => {
				if (isCancelled) return
				setPreference(latest)
				setIsLoading(false)
			})
			.catch(() => {
				if (isCancelled) return
				setPreference(getCachedPersonalPreferences(userKey) || {})
				setIsLoading(false)
			})

		return () => {
			isCancelled = true
		}
	}, [userKey])

	useEffect(() => {
		const handlePreferenceUpdated = ({
			userKey: updatedUserKey,
			value,
		}: {
			userKey: string
			value: PersonalPreferencesValue
		}) => {
			if (updatedUserKey === userKey) setPreference(value)
		}

		pubsub.subscribe(PubSubEvents.Personal_Preferences_Updated, handlePreferenceUpdated)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Personal_Preferences_Updated, handlePreferenceUpdated)
		}
	}, [userKey])

	return {
		preference,
		isLoading,
		refresh,
		update,
	}
}

export type { PersonalPreferencesValue }
