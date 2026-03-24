import { createContext, useContext, useMemo } from "react"
import type { PropsWithChildren } from "react"
import { ConfigProvider } from "antd"
import zhCN from "antd/es/locale/zh_CN.js"
import enUS from "antd/es/locale/en_US.js"
import ruRU from "antd/es/locale/ru_RU.js"
import kkKZ from "antd/es/locale/kk_KZ.js"
import idID from "antd/es/locale/id_ID.js"
import jaJP from "antd/es/locale/ja_JP.js"
import msMY from "antd/es/locale/ms_MY.js"
import thTH from "antd/es/locale/th_TH.js"
import viVN from "antd/es/locale/vi_VN.js"
import frFR from "antd/es/locale/fr_FR.js"
import MagicThemeProvider from "../ThemeProvider"
import { SearchComponentProvider } from "../TableWithFilters/SearchComponentRegistry"
import locales from "../locales"
import type { LocaleType } from "../locales"

export enum LanguageType {
	zh_CN = "zh_CN",
	en_US = "en_US",
	id_ID = "id_ID",
	ja_JP = "ja_JP",
	ms_MY = "ms_MY",
	th_TH = "th_TH",
	vi_VN = "vi_VN",
	fil_PH = "fil_PH",
	fr_FR = "fr_FR",
	ru_RU = "ru_RU",
	kk_KZ = "kk_KZ",
}
export enum ThemeType {
	LIGHT = "light",
	DARK = "dark",
}

export interface AdminComponentsProviderProps {
	theme?: ThemeType
	language?: LanguageType
}

export interface AdminComponentsProviderContextType extends Required<AdminComponentsProviderProps> {
	getLocale: <T extends keyof LocaleType>(namespace: T) => LocaleType[T]
}

const defaultLanguage = LanguageType.zh_CN

const defaultContext: AdminComponentsProviderContextType = {
	theme: ThemeType.LIGHT,
	language: defaultLanguage,
	getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
		return locales[defaultLanguage as keyof typeof locales][namespace]
	},
}
const AdminProviderContext = createContext<AdminComponentsProviderContextType>(defaultContext)

function AdminComponentsProvider(props: PropsWithChildren<AdminComponentsProviderProps>) {
	const { theme, language, children } = props

	const safeLanguage =
		language && Object.keys(locales).includes(language) ? language : defaultLanguage

	const value = useMemo(() => {
		return {
			theme: theme || defaultContext.theme,
			language: safeLanguage,
			getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
				return locales[safeLanguage][namespace]
			},
		}
	}, [theme, safeLanguage])

	const locale = useMemo(() => {
		switch (language) {
			case LanguageType.zh_CN:
				return zhCN
			case LanguageType.en_US:
				return enUS
			case LanguageType.ru_RU:
				return ruRU
			case LanguageType.kk_KZ:
				return kkKZ
			case LanguageType.id_ID:
				return idID
			case LanguageType.ja_JP:
				return jaJP
			case LanguageType.ms_MY:
				return msMY
			case LanguageType.th_TH:
				return thTH
			case LanguageType.vi_VN:
				return viVN
			case LanguageType.fr_FR:
				return frFR
			default:
				return enUS
		}
	}, [language])

	return (
		<AdminProviderContext.Provider value={value}>
			<ConfigProvider locale={locale}>
				<MagicThemeProvider>
					<SearchComponentProvider>{children}</SearchComponentProvider>
				</MagicThemeProvider>
			</ConfigProvider>
		</AdminProviderContext.Provider>
	)
}

export function useAdminComponents() {
	return useContext(AdminProviderContext)
}

export default AdminComponentsProvider
