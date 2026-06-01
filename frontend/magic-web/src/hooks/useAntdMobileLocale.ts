import { useDeepCompareEffect, useRequest } from "ahooks"
import type { Locale } from "antd-mobile/es/locales/base"
import { configStore } from "@/models/config"
import { getAntdMobileLocale, getAntdMobileLocaleSyncFallback } from "@/utils/locale"

/**
 * Resolves antd-mobile locale for ConfigProvider based on the active app language.
 * Always returns a valid Locale: sync fallback while chunks load, then async bundle.
 * Never pass `undefined` to ConfigProvider — adm merges props and would wipe defaults.
 */
export function useAntdMobileLocale(): Locale {
	const { displayLanguage } = configStore.i18n
	const syncFallback = getAntdMobileLocaleSyncFallback(displayLanguage)

	const {
		data: locale,
		runAsync,
		cancel,
	} = useRequest<Locale | null, [string]>((lang: string) => getAntdMobileLocale(lang), {
		manual: true,
	})

	useDeepCompareEffect(() => {
		void runAsync?.(displayLanguage).catch(console.error)
		return () => cancel?.()
	}, [displayLanguage, runAsync, cancel])

	return locale ?? syncFallback
}
