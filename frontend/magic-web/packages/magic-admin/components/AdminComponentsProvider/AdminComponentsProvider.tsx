import { createContext, useContext, useMemo } from "react"
import type { PropsWithChildren } from "react"
import { ConfigProvider } from "antd"
import zhCN from "antd/es/locale/zh_CN"
import enUS from "antd/es/locale/en_US"
import MagicThemeProvider from "../ThemeProvider"
import { SearchComponentProvider } from "../TableWithFilters/SearchComponentRegistry"
import locales from "../locales"
import type { LocaleType } from "../locales"

/**
 * Languages the admin console ships translations for. The host application
 * drives this value; keep it aligned with the app's supported locales so the
 * admin console and the surrounding UI never disagree on language.
 */
export enum LanguageType {
	zh_CN = "zh_CN",
	en_US = "en_US",
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
