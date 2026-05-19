import { useMemoizedFn } from "ahooks"
import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import type { StructureUserItem } from "@/types/organization"

export function useGlobalSuggestion() {
	const { userInfo, setUserInfo } = useUserInfo()
	const followUpSuggestions = userInfo?.preferences?.show_follow_up_suggestions ?? true
	const keepUsedFollowUpSuggestions =
		userInfo?.preferences?.keep_used_follow_up_suggestions ?? true

	const setFollowUpSuggestions = useMemoizedFn(async (value: boolean) => {
		if (value === followUpSuggestions) return

		try {
			const response = await MagicUserApi.updateUserInfo({
				preferences: { show_follow_up_suggestions: value },
			})
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update follow_up_suggestions:", error)
		}
	})

	const setKeepUsedFollowUpSuggestions = useMemoizedFn(async (value: boolean) => {
		if (value === keepUsedFollowUpSuggestions) return

		try {
			const response = await MagicUserApi.updateUserInfo({
				preferences: { keep_used_follow_up_suggestions: value },
			})
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update keep_used_follow_up_suggestions:", error)
		}
	})

	return {
		followUpSuggestions,
		keepUsedFollowUpSuggestions,
		setFollowUpSuggestions,
		setKeepUsedFollowUpSuggestions,
	}
}
