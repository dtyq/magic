import { PropsWithChildren } from "react"
import { configStore } from "@/models/config"
import { isRtlLang } from "rtl-detect"
import { observer } from "mobx-react-lite"
import { ConfigProvider } from "antd"
import { useRequest, useDeepCompareEffect } from "ahooks"
import { getAntdLocale } from "@/utils/locale"
import useChangeAppLocale from "./hooks/useChangeAppLocale"

const LocaleProvider = observer(
	({ children }: PropsWithChildren<{ loadingFallback?: boolean }>) => {
		const { displayLanguage } = configStore.i18n

		// Match the document direction to the selected language.
		const documentDir = isRtlLang(displayLanguage) ? "rtl" : "ltr"

		const {
			data: locale,
			cancel,
			runAsync,
		} = useRequest((key: string) => getAntdLocale(key), {
			manual: true,
		})

		const { changeAppLocale } = useChangeAppLocale()

		// Synchronize application translations and Ant Design locale data.
		useDeepCompareEffect(() => {
			changeAppLocale(displayLanguage)

			runAsync?.(displayLanguage).catch(console.error)
			return () => {
				cancel?.()
			}
		}, [displayLanguage])

		return (
			<ConfigProvider direction={documentDir} locale={locale}>
				{children}
			</ConfigProvider>
		)
	},
)

export default LocaleProvider
