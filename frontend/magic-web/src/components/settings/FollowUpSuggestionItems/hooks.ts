import { useMemoizedFn } from "ahooks"
import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import { snapshotUserInfoForRollback } from "@/models/user/utils/userInfoSnapshot"
import type { StructureUserItem } from "@/types/organization"
import type { User } from "@/types/user"

/** 与 `useUserInfo` 返回的 store 态一致，便于偏好补丁函数签名自洽。 */
type StoreUserInfo = User.UserInfo

/**
 * 在本地合并 preferences 补丁，用于请求发出前立刻更新 UI（乐观更新），
 * 与 `userInfo?.preferences?.xxx ?? true` 的展示默认值保持一致。
 */
function mergeUserInfoPreferencesPatch(
	userInfo: StoreUserInfo,
	patch: Partial<NonNullable<StoreUserInfo["preferences"]>>,
): StoreUserInfo {
	const basePrefs = userInfo.preferences ?? {
		show_follow_up_suggestions: true,
		keep_used_follow_up_suggestions: true,
	}
	return {
		...userInfo,
		preferences: {
			...basePrefs,
			...patch,
		},
	}
}

export function useGlobalSuggestion() {
	const { userInfo, setUserInfo } = useUserInfo()
	const followUpSuggestions = userInfo?.preferences?.show_follow_up_suggestions ?? true
	const keepUsedFollowUpSuggestions =
		userInfo?.preferences?.keep_used_follow_up_suggestions ?? true

	const setFollowUpSuggestions = useMemoizedFn(async (value: boolean) => {
		if (value === followUpSuggestions) return
		if (!userInfo) {
			try {
				const response = await MagicUserApi.updateUserInfo({
					preferences: { show_follow_up_suggestions: value },
				})
				setUserInfo(response as StructureUserItem)
			} catch (error) {
				console.error("Failed to update follow_up_suggestions:", error)
			}
			return
		}

		const rollbackSnapshot = snapshotUserInfoForRollback(userInfo)
		setUserInfo(mergeUserInfoPreferencesPatch(userInfo, { show_follow_up_suggestions: value }))

		try {
			const response = await MagicUserApi.updateUserInfo({
				preferences: { show_follow_up_suggestions: value },
			})
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update follow_up_suggestions:", error)
			setUserInfo(rollbackSnapshot)
		}
	})

	const setKeepUsedFollowUpSuggestions = useMemoizedFn(async (value: boolean) => {
		if (value === keepUsedFollowUpSuggestions) return
		if (!userInfo) {
			try {
				const response = await MagicUserApi.updateUserInfo({
					preferences: { keep_used_follow_up_suggestions: value },
				})
				setUserInfo(response as StructureUserItem)
			} catch (error) {
				console.error("Failed to update keep_used_follow_up_suggestions:", error)
			}
			return
		}

		const rollbackSnapshot = snapshotUserInfoForRollback(userInfo)
		setUserInfo(
			mergeUserInfoPreferencesPatch(userInfo, { keep_used_follow_up_suggestions: value }),
		)

		try {
			const response = await MagicUserApi.updateUserInfo({
				preferences: { keep_used_follow_up_suggestions: value },
			})
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update keep_used_follow_up_suggestions:", error)
			setUserInfo(rollbackSnapshot)
		}
	})

	return {
		followUpSuggestions,
		keepUsedFollowUpSuggestions,
		setFollowUpSuggestions,
		setKeepUsedFollowUpSuggestions,
	}
}
