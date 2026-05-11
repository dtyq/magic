import useSWRImmutable from "swr/immutable"
import { getCurrentLang } from "@/utils/locale"
import { useMemoizedFn } from "ahooks"
import { useGlobalLanguage } from "@/models/config/hooks"
import { getTimezones } from "@dtyq/timezone"
import type { Timezone } from "@dtyq/timezone"
import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
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

		try {
			const response = await MagicUserApi.updateUserInfo({ timezone: tz })
			setUserInfo(response as StructureUserItem)
		} catch (error) {
			console.error("Failed to update timezone:", error)
		}
	})

	return { timezone, setTimezone }
}
