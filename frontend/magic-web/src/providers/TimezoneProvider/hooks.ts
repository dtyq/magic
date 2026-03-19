import useSWRImmutable from "swr/immutable"
import { getCurrentLang } from "@/utils/locale"
import { useMemoizedFn } from "ahooks"
import { useGlobalLanguage } from "@/models/config/hooks"
import { useAppearanceStore } from "@/providers/AppearanceProvider/context"
import { getTimezones } from "@dtyq/timezone"
import type { Timezone } from "@dtyq/timezone"

export function useTimezoneList() {
	const lang = useGlobalLanguage()

	const locale = getCurrentLang(lang as Timezone.Locale)

	return useSWRImmutable(locale, () => getTimezones({ locale }))
}

export function useTimezone() {
	const timezone = useAppearanceStore((state) => state.timezone)
	const setTimezone = useMemoizedFn((tz: Timezone.TimezoneCode) => {
		useAppearanceStore.setState({ timezone: tz })
	})
	return { timezone, setTimezone }
}
