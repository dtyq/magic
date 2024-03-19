import { PropsWithChildren } from "react"
import { configStore } from "@/opensource/models/config"
import { isRtlLang } from "rtl-detect"
import { observer } from "mobx-react-lite"
import { ConfigProvider } from "antd"
import { useRequest, useDeepCompareEffect } from "ahooks"
import { getAntdLocale } from "@/opensource/utils/locale"
import { createStyles } from "antd-style"
import useChangeAppLocale from "./hooks/useChangeAppLocale"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		spin: css`
			.${prefixCls}-spin-blur {
				opacity: 1;
			}

			.${prefixCls}-spin {
				--${prefixCls}-spin-content-height: unset;
			}
		`,
	}
})

const LocaleProvider = observer(
	({ children, loadingFallback = true }: PropsWithChildren<{ loadingFallback?: boolean }>) => {
		const { displayLanguage } = configStore.i18n
		// const { styles } = useStyles()
		// const { t } = useTranslation("interface")

		// detect document direction
		const documentDir = isRtlLang(displayLanguage) ? "rtl" : "ltr"
		// const [init, setInit] = useState(true)

		const {
			data: locale,
			cancel,
			runAsync,
		} = useRequest((key: string) => getAntdLocale(key), {
			manual: true,
		})

		const { changeAppLocale } = useChangeAppLocale()

		// change language
		useDeepCompareEffect(() => {
			changeAppLocale(displayLanguage)

			runAsync?.(displayLanguage)
				// .then(() => setInit(false))
				.catch(console.error)
			return () => {
				cancel?.()
			}
		}, [displayLanguage])

		// if (init) {
		// 	if (!loadingFallback) {
		// 		return null
		// 	}
		// 	return (
		// 		<MagicSpin
		// 			spinning
		// 			tip={t("spin.loadingAuth")}
		// 			wrapperClassName={styles.spin}
		// 			data-component="LocaleProvider"
		// 		>
		// 			<div style={{ height: "100vh" }} />
		// 		</MagicSpin>
		// 	)
		// }
		return (
			<ConfigProvider direction={documentDir} locale={locale}>
				{children}
			</ConfigProvider>
		)
	},
)

export default LocaleProvider
