import { createContext, useContext, useMemo, useEffect, useRef, useState } from "react"
import type { PropsWithChildren } from "react"
import { ConfigProvider } from "antd"
import { I18nextProvider } from "react-i18next"
import magicClient from "@admin/apis/clients/magic"
import {
	LanguageType,
	ThemeType,
	MagicThemeProvider,
	SearchComponentProvider,
	AdminAuthContentLoading,
} from "@admin-components"
import locales from "../../../components/locales"
import type { LocaleType } from "../../../components/locales"
import type { AdminProviderContextType, AdminProviderProps } from "./types"
import { AppEnv } from "./types"
import { languageManager } from "../../utils/locale"
import { adminI18n, initAdminI18n } from "@admin/locales"

const defaultLanguage = LanguageType.zh_CN
const defaultTheme = ThemeType.LIGHT
const runtimeCommonNamespaces = ["common", "admin/common"]

function syncRuntimeCommonResources(language: string, platformName?: string) {
	const resources = {
		platform: {
			name: platformName || "",
		},
	}

	runtimeCommonNamespaces.forEach((namespace) => {
		adminI18n.addResourceBundle(language, namespace, resources, true, true)
	})
	adminI18n.emit("languageChanged", language)
}

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
	organization: {
		organizationCode: "",
		teamshareOrganizationCode: "",
		organizationInfo: null,
		teamshareOrganizationInfo: null,
	},
	user: {
		token: "",
		userInfo: null,
	},
	areaCodes: null,
	isPrivateDeployment: false,
	navigate: () => undefined,
	// Navigate,
	getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
		return locales[defaultLanguage as keyof typeof locales][namespace]
	},
}
const AdminProviderContext = createContext<AdminProviderContextType>(defaultContext)

function AdminProvider(props: PropsWithChildren<AdminProviderProps>) {
	const { theme, language, children, platformName, ...rest } = props
	const [i18nReady, setI18nReady] = useState(adminI18n.isInitialized)
	const platformNameRef = useRef(platformName)

	const safeLanguage =
		language && Object.keys(locales).includes(language) ? language : defaultLanguage

	useEffect(() => {
		platformNameRef.current = platformName
	}, [platformName])

	// 同步语言到全局 languageManager，供 openModal 等使用
	useEffect(() => {
		languageManager.setLanguage(safeLanguage)
	}, [safeLanguage])

	useEffect(() => {
		let cancelled = false
		const isSameLanguage = adminI18n.isInitialized && adminI18n.language === safeLanguage
		if (!isSameLanguage) {
			setI18nReady(false)
		}
		initAdminI18n(safeLanguage).then(() => {
			if (cancelled) return
			syncRuntimeCommonResources(safeLanguage, platformNameRef.current)
			setI18nReady(true)
		})

		return () => {
			cancelled = true
		}
	}, [safeLanguage])

	useEffect(() => {
		if (!i18nReady) return
		syncRuntimeCommonResources(safeLanguage, platformName)
	}, [i18nReady, platformName, safeLanguage])

	const value = useMemo(() => {
		return {
			theme: theme || defaultContext.theme,
			language: safeLanguage,
			platformName,
			getLocale: <T extends keyof LocaleType>(namespace: T): LocaleType[T] => {
				return locales[safeLanguage][namespace]
			},

			...rest,
		}
	}, [theme, safeLanguage, platformName, rest])

	const locale = languageManager.getAntdLocale()

	return (
		<AdminProviderContext.Provider value={value}>
			<I18nextProvider i18n={adminI18n}>
				<ConfigProvider locale={locale}>
					<MagicThemeProvider>
						<SearchComponentProvider>
							{i18nReady ? children : <AdminAuthContentLoading fullScreen />}
						</SearchComponentProvider>
					</MagicThemeProvider>
				</ConfigProvider>
			</I18nextProvider>
		</AdminProviderContext.Provider>
	)
}

export function useAdmin() {
	return useContext(AdminProviderContext)
}

// 导出 Context 以便在外部获取当前的 provider 值
export { AdminProviderContext }

export default AdminProvider
