import { useDeepCompareEffect, useRequest } from "ahooks"
import type { Locale } from "antd-mobile/es/locales/base"
import { configStore } from "@/models/config"
import { getAntdMobileLocale } from "@/utils/locale"

/**
 * Resolves antd-mobile locale for ConfigProvider based on the active app language.
 * Keeps InfiniteScroll and other adm components in sync with i18next language switches.
 */
export function useAntdMobileLocale(): Locale | undefined {
	const { displayLanguage } = configStore.i18n

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

	return locale ?? undefined
}
