import { createContext, useContext, useMemo, useEffect } from "react"
import type { PropsWithChildren } from "react"
import { ConfigProvider } from "antd"
import magicClient from "@/apis/clients/magic"
import { LanguageType, ThemeType } from "components"
import MagicThemeProvider from "../../../components/ThemeProvider"
import { SearchComponentProvider } from "../../../components/TableWithFilters/SearchComponentRegistry"
import locales from "../../../components/locales"
import type { LocaleType } from "../../../components/locales"
import type { AdminProviderContextType, AdminProviderProps } from "./types"
import { AppEnv } from "./types"
import { languageManager } from "../../utils/locale"

const defaultLanguage = LanguageType.zh_CN
const defaultTheme = ThemeType.LIGHT

const defaultContext: AdminProviderContextType = {
	apiClients: {
		magicClient,
	},
	clusterCode: "global",
	env: {
		MAGIC_APP_ENV: AppEnv.Test,
		MAGIC_BASE_URL: "",
	},

	theme: defaultTheme,
	language: defaultLanguage,
	isPersonalOrganization: false,
	organization: {
		organizationCode: "",
		teamshareOrganizationCode: "",
		organizationInfo: null,
		teamshareOrganizationInfo: null,
	},
	user: {
		token: "",
		userInfo: null,
		teamshareUserInfo: null,
	},
	areaCodes: null,
	isPrivateDeployment: false,
	navigate: () => {},
	// Navigate,
	getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
		return locales[defaultLanguage as keyof typeof locales][namespace]
	},
}
const AdminProviderContext = createContext<AdminProviderContextType>(defaultContext)

function AdminProvider(props: PropsWithChildren<AdminProviderProps>) {
	const { theme, language, children, ...rest } = props

	const safeLanguage =
		language && Object.keys(locales).includes(language) ? language : defaultLanguage

	// 同步语言到全局 languageManager，供 openModal 等使用
	useEffect(() => {
		languageManager.setLanguage(safeLanguage)
	}, [safeLanguage])

	const value = useMemo(() => {
		return {
			theme: theme || defaultContext.theme,
			language: safeLanguage,
			getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
				return locales[safeLanguage][namespace]
			},

			...rest,
		}
	}, [theme, safeLanguage, rest])

	const locale = languageManager.getAntdLocale()

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

export function useAdmin() {
	return useContext(AdminProviderContext)
}

// 导出 Context 以便在外部获取当前的 provider 值
export { AdminProviderContext }

export default AdminProvider
