import { useCallback, useEffect, useMemo, useState } from "react"
import { ContactApi } from "@/apis"
import { userStore } from "@/models/user"
import { Admin } from "@/types/admin"
import pubsub from "@/utils/pubsub"
import {
	getAiWatermarkPreferenceUserKey,
	getCachedAiWatermarkPreference,
	setCachedAiWatermarkPreference,
	isAiWatermarkAgreementEnabled,
	type PersonalPreferencesValue,
} from "@/utils/aiWatermarkPreferenceCache"

const PERSONAL_PREFERENCES_KEY = "personal_preferences"
const AI_WATERMARK_PREFERENCE_UPDATED = "ai-watermark-preference-updated"

/** Same userKey in-flight GET is shared so Strict Mode / multi-hook / userKey micro-shifts only hit the network once */
const preferenceLoadInflightByUserKey = new Map<string, Promise<PersonalPreferencesValue>>()

export async function loadAiWatermarkPreference(force = false) {
	const userKey = getAiWatermarkPreferenceUserKey()
	if (!userKey) return {}

	if (!force) {
		const cachedPreference = getCachedAiWatermarkPreference()
		if (cachedPreference) return cachedPreference
	}

	const existing = preferenceLoadInflightByUserKey.get(userKey)
	if (existing) return existing

	const promise = ContactApi.getPersonalPreferences<PersonalPreferencesValue>()
		.then((response) => {
			const value = response?.value || {}
			return setCachedAiWatermarkPreference(value)
		})
		.finally(() => {
			preferenceLoadInflightByUserKey.delete(userKey)
		})

	preferenceLoadInflightByUserKey.set(userKey, promise)
	return promise
}

async function saveAiWatermarkPreference(addAiWatermark: boolean) {
	const currentPreference = await loadAiWatermarkPreference(true)
	const nextPreference = {
		...currentPreference,
		add_ai_watermark: addAiWatermark,
	}

	const response = await ContactApi.savePersonalPreferences(nextPreference)
	const latestPreference = response?.data?.value || nextPreference

	setCachedAiWatermarkPreference(latestPreference)
	pubsub.publish(AI_WATERMARK_PREFERENCE_UPDATED, latestPreference)

	return latestPreference
}

export async function agreeAiWatermarkPreference() {
	return saveAiWatermarkPreference(false)
}

export async function revokeAiWatermarkPreference() {
	return saveAiWatermarkPreference(true)
}

export function useAiWatermarkPreference() {
	const userKey = getAiWatermarkPreferenceUserKey()
	const { organizationSubscriptionInfo } = userStore.user
	const [preference, setPreference] = useState<PersonalPreferencesValue>(
		() => getCachedAiWatermarkPreference() || {},
	)
	const [isLoading, setIsLoading] = useState(!getCachedAiWatermarkPreference() && !!userKey)

	const isFreeTrialVersion = useMemo(() => {
		return organizationSubscriptionInfo?.plan_type === Admin.PlanType.Personal
			? !organizationSubscriptionInfo?.is_paid_plan
			: false
	}, [organizationSubscriptionInfo])

	const refresh = useCallback(async () => {
		if (!userKey) {
			setPreference({})
			setIsLoading(false)
			return {}
		}

		setIsLoading(true)

		try {
			const latestPreference = await loadAiWatermarkPreference(true)
			setPreference(latestPreference)
			return latestPreference
		} catch {
			const safePreference = getCachedAiWatermarkPreference() || {}
			setPreference(safePreference)
			return safePreference
		} finally {
			setIsLoading(false)
		}
	}, [userKey])

	const agree = useCallback(async () => {
		const latestPreference = await agreeAiWatermarkPreference()
		setPreference(latestPreference)
		return latestPreference
	}, [])

	const revoke = useCallback(async () => {
		const latestPreference = await revokeAiWatermarkPreference()
		setPreference(latestPreference)
		return latestPreference
	}, [])

	useEffect(() => {
		if (!userKey) {
			setPreference({})
			setIsLoading(false)
			return
		}

		const cachedPreference = getCachedAiWatermarkPreference()
		setPreference(cachedPreference || {})
		setIsLoading(!cachedPreference)

		let isCancelled = false

		void loadAiWatermarkPreference(true)
			.then((latest) => {
				if (isCancelled) return
				setPreference(latest)
				setIsLoading(false)
			})
			.catch(() => {
				if (isCancelled) return
				setPreference(getCachedAiWatermarkPreference() || {})
				setIsLoading(false)
			})

		return () => {
			isCancelled = true
		}
	}, [userKey])

	useEffect(() => {
		const handlePreferenceUpdated = (latestPreference: PersonalPreferencesValue) => {
			setPreference(latestPreference)
		}

		pubsub.subscribe(AI_WATERMARK_PREFERENCE_UPDATED, handlePreferenceUpdated)

		return () => {
			pubsub.unsubscribe(AI_WATERMARK_PREFERENCE_UPDATED, handlePreferenceUpdated)
		}
	}, [])

	return {
		preference,
		isLoading,
		isFreeTrialVersion,
		hasGlobalAgreement: isAiWatermarkAgreementEnabled(preference),
		refresh,
		agree,
		revoke,
	}
}

export type { PersonalPreferencesValue }
export { PERSONAL_PREFERENCES_KEY, isAiWatermarkAgreementEnabled }
