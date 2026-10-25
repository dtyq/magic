import { useCallback } from "react"
import { usePersonalPreferences } from "@/hooks/usePersonalPreferences"
import { isLongTermMemoryEnabled } from "@/utils/personalPreferencesCache"

/** 将通用个人偏好映射为长期记忆开关语义。 */
export function useLongTermMemoryPreference() {
	const { preference, isLoading, refresh, update } = usePersonalPreferences()
	const enabled = isLongTermMemoryEnabled(preference)

	/** 保存长期记忆开关，同时保留个人偏好中的其他字段。 */
	const setEnabled = useCallback(
		(nextEnabled: boolean) => update({ long_term_memory_enabled: nextEnabled }),
		[update],
	)

	return {
		enabled,
		isLoading,
		refresh,
		setEnabled,
	}
}
