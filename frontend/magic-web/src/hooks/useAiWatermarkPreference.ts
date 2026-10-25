import { useCallback, useMemo } from "react"
import { userStore } from "@/models/user"
import { Admin } from "@/types/admin"
import { isAiWatermarkAgreementEnabled } from "@/utils/aiWatermarkPreferenceCache"
import {
	PERSONAL_PREFERENCES_KEY,
	loadPersonalPreferences,
	updatePersonalPreferences,
	usePersonalPreferences,
	type PersonalPreferencesValue,
} from "@/hooks/usePersonalPreferences"

export const loadAiWatermarkPreference = loadPersonalPreferences

export async function agreeAiWatermarkPreference() {
	return updatePersonalPreferences({ add_ai_watermark: false })
}

export async function revokeAiWatermarkPreference() {
	return updatePersonalPreferences({ add_ai_watermark: true })
}

export function useAiWatermarkPreference() {
	const { organizationSubscriptionInfo } = userStore.user
	const { preference, isLoading, refresh, update } = usePersonalPreferences()

	const isFreeTrialVersion = useMemo(() => {
		return organizationSubscriptionInfo?.plan_type === Admin.PlanType.Personal
			? !organizationSubscriptionInfo?.is_paid_plan
			: false
	}, [organizationSubscriptionInfo])

	const agree = useCallback(async () => {
		return update({ add_ai_watermark: false })
	}, [update])

	const revoke = useCallback(async () => {
		return update({ add_ai_watermark: true })
	}, [update])

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
