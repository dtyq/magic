import { getAntdLocale, normalizeLocale } from "@/common/utils/locale"
import { useDeepCompareEffect, useRequest } from "ahooks"
import { ConfigProvider, Flex, Spin } from "antd"
import { i18n } from "i18next"
import type { PropsWithChildren } from "react"
import React, { createContext, useState } from "react"
import { I18nextProvider } from "react-i18next"
import { isRtlLang } from "rtl-detect"
import { useShallow } from "zustand/react/shallow"
import type { GlobalLanguageStoreType } from "./store"
import { store } from "./store"
import { languageHelper } from "./utils"

const LocalesContext = createContext<GlobalLanguageStoreType>(store)

/**
 * @description 全局语言实例中间层，初始化时从 Storage、默认等同步当前语言
 * 语言包加载问题，需要基于 useState 主动控制，防止下级子节点被重新渲染导致 useEffect 被重复执行
 */
function IntermediateLayer({
	children,
	instance,
}: PropsWithChildren<{
	instance: i18n
}>) {
	// 用于优化首屏加载语言包时禁止下级所有节点重新被触发导致 useEffect 被重复执行
	const [loading, setLoading] = useState(true)

	const language = store(
		useShallow((languageStore) => {
			const lang = languageStore.language

			return lang === "auto"
				? languageHelper.transform(normalizeLocale(window.navigator.language))
				: lang
		}),
	)

	const {
		data: locale,
		cancel,
		run,
	} = useRequest((key: string) => getAntdLocale(key), {
		manual: true,
		onSuccess() {
			setLoading(false)
		},
	})

	// change language
	useDeepCompareEffect(() => {
		run?.(language)
		instance?.changeLanguage?.(language)
		return () => {
			cancel?.()
		}
	}, [language])

	// detect document direction
	const documentDir = isRtlLang(language!) ? "rtl" : "ltr"

	return (
		<I18nextProvider i18n={instance}>
			<ConfigProvider direction={documentDir} locale={locale}>
				{loading ? (
					<Flex align="center" justify="center">
						<Spin />
					</Flex>
				) : (
					children
				)}
			</ConfigProvider>
		</I18nextProvider>
	)
}

export function MagicFlowLocaleProvider(
	props: PropsWithChildren<{ store?: GlobalLanguageStoreType; i18nInstance: i18n }>,
) {
	return (
		<LocalesContext.Consumer>
			{(contextValue) => (
				<LocalesContext.Provider value={props?.store ?? contextValue}>
					<IntermediateLayer instance={props?.i18nInstance}>
						{props?.children}
					</IntermediateLayer>
				</LocalesContext.Provider>
			)}
		</LocalesContext.Consumer>
	)
}
