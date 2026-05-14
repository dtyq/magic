import useSWRImmutable from "swr/immutable"
import { getCurrentLang } from "@/utils/locale"
import { useMemoizedFn } from "ahooks"
import { useGlobalLanguage } from "@/models/config/hooks"
import { getTimezones } from "@dtyq/timezone"
import type { Timezone } from "@dtyq/timezone"
import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import { snapshotUserInfoForRollback } from "@/models/user/utils/userInfoSnapshot"
import type { StructureUserItem } from "@/types/organization"
import { getPreferredTimezone } from "./utils"

export function useTimezoneList() {
	const lang = useGlobalLanguage()

	const locale = getCurrentLang(lang as Timezone.Locale)

	return useSWRImmutable(locale, () => getTimezones({ locale }))
}

export function useTimezone() {
	const { userInfo, setUserInfo } = useUserInfo()
	const timezone = getPreferredTimezone(userInfo?.timezone)

	const setTimezone = useMemoizedFn(async (tz: Timezone.TimezoneCode) => {
		if (tz === userInfo?.timezone) return

		if (!userInfo) {
			try {
				const response = await MagicUserApi.updateUserInfo({ timezone: tz })
				setUserInfo(response as StructureUserItem)
			} catch (error) {
				console.error("Failed to update timezone:", error)
			}
			return
		}

		const rollbackSnapshot = snapshotUserInfoForRollback(userInfo)
		setUserInfo({ ...userInfo, timezone: tz })

		try {
			const response = await MagicUserApi.updateUserInfo({ timezone: tz })
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update timezone:", error)
			setUserInfo(rollbackSnapshot)
		}
	})

	return { timezone, setTimezone }
}
